/**
 * Model Selector
 * 
 * Allows users to select which AI model to connect to:
 * - Remote (internet API endpoints like OpenAI, Anthropic, etc.)
 * - Local (running on host machine via Ollama, LM Studio, etc.)
 * - In-Architecture (AI agent running inside a VM/container)
 */

import { useState, useCallback } from 'react';
import { getEventTracker } from '../../services/eventTracker';

// ============ Types ============

export type ModelProvider = 'remote' | 'local' | 'in-architecture';

export interface ModelEndpoint {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;
  endpoint?: string;
  apiKey?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  capabilities?: string[];
  description?: string;
}

export interface RemoteProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: { id: string; name: string; contextWindow?: number }[];
  requiresKey: boolean;
}

export interface LocalModel {
  id: string;
  name: string;
  size: string;
  quantization?: string;
  status: 'loaded' | 'available' | 'downloading';
}

export interface InArchitectureAgent {
  id: string;
  name: string;
  containerId: string;
  modelId: string;
  status: 'running' | 'stopped' | 'starting';
  capabilities: string[];
}

// ============ Preset Providers ============

const REMOTE_PROVIDERS: RemoteProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
      { id: 'o1', name: 'o1', contextWindow: 200000 },
      { id: 'o3-mini', name: 'o3-mini', contextWindow: 200000 },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresKey: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (via OpenRouter)' },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)' },
      { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    baseUrl: '',
    requiresKey: false,
    models: [],
  },
];

const LOCAL_ENDPOINTS = [
  { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434' },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1' },
  { id: 'llamacpp', name: 'llama.cpp', baseUrl: 'http://localhost:8080' },
  { id: 'custom-local', name: 'Custom Local', baseUrl: '' },
];

// ============ Status Indicator Component ============

interface StatusIndicatorProps {
  status: ModelEndpoint['status'];
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  const colors = {
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    error: 'bg-red-500',
  };

  return (
    <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
  );
}

// ============ Provider Card Component ============

interface ProviderCardProps {
  provider: RemoteProvider;
  isSelected: boolean;
  onSelect: () => void;
}

function ProviderCard({ provider, isSelected, onSelect }: ProviderCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        p-4 rounded-lg border text-left transition-all w-full
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        }
      `}
    >
      <div className="font-medium text-white">{provider.name}</div>
      <div className="text-sm text-gray-400 mt-1">
        {provider.models.length > 0 
          ? `${provider.models.length} models available`
          : 'Configure endpoint'
        }
      </div>
      {provider.requiresKey && (
        <span className="inline-block mt-2 text-xs text-yellow-400">🔑 API key required</span>
      )}
    </button>
  );
}

// ============ Local Model Card Component ============

interface LocalModelCardProps {
  model: LocalModel;
  isSelected: boolean;
  onSelect: () => void;
  onLoad: () => void;
}

function LocalModelCard({ model, isSelected, onSelect, onLoad }: LocalModelCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium text-white">{model.name}</div>
        <span className={`
          px-2 py-0.5 rounded text-xs
          ${model.status === 'loaded' ? 'bg-green-600/20 text-green-400' : 
            model.status === 'downloading' ? 'bg-yellow-600/20 text-yellow-400' : 
            'bg-gray-600/20 text-gray-400'}
        `}>
          {model.status}
        </span>
      </div>
      <div className="text-sm text-gray-400 mt-1">
        {model.size} {model.quantization && `• ${model.quantization}`}
      </div>
      {model.status === 'available' && (
        <button
          onClick={(e) => { e.stopPropagation(); onLoad(); }}
          className="mt-2 px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Load Model
        </button>
      )}
    </div>
  );
}

// ============ Agent Card Component ============

interface AgentCardProps {
  agent: InArchitectureAgent;
  isSelected: boolean;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
}

function AgentCard({ agent, isSelected, onSelect, onStart, onStop }: AgentCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <div className="font-medium text-white">{agent.name}</div>
        </div>
        <span className={`
          px-2 py-0.5 rounded text-xs
          ${agent.status === 'running' ? 'bg-green-600/20 text-green-400' : 
            agent.status === 'starting' ? 'bg-yellow-600/20 text-yellow-400' : 
            'bg-gray-600/20 text-gray-400'}
        `}>
          {agent.status}
        </span>
      </div>
      <div className="text-sm text-gray-400 mt-1">
        {agent.modelId} • Container: {agent.containerId.slice(0, 8)}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {agent.capabilities.slice(0, 3).map(cap => (
          <span key={cap} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
            {cap}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
        {agent.status === 'running' ? (
          <button
            onClick={onStop}
            className="px-3 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className="px-3 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Main Model Selector Component ============

interface ModelSelectorProps {
  currentModel?: ModelEndpoint;
  onModelSelect: (model: ModelEndpoint) => void;
}

export function ModelSelector({ currentModel, onModelSelect }: ModelSelectorProps) {
  const [activeTab, setActiveTab] = useState<ModelProvider>('remote');
  const [selectedProvider, setSelectedProvider] = useState<RemoteProvider | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Mock local models
  const [localModels] = useState<LocalModel[]>([
    { id: 'llama3.2', name: 'Llama 3.2 3B', size: '2.0 GB', quantization: 'Q4_K_M', status: 'available' },
    { id: 'qwen2.5', name: 'Qwen 2.5 7B', size: '4.4 GB', quantization: 'Q4_K_M', status: 'loaded' },
    { id: 'deepseek-r1', name: 'DeepSeek-R1 7B', size: '4.7 GB', quantization: 'Q4_K_M', status: 'available' },
  ]);

  // Mock in-architecture agents
  const [agents] = useState<InArchitectureAgent[]>([
    {
      id: 'agent-1',
      name: 'Code Assistant',
      containerId: 'abc123def456',
      modelId: 'qwen2.5:7b',
      status: 'running',
      capabilities: ['code_generation', 'file_ops', 'shell'],
    },
    {
      id: 'agent-2',
      name: 'Research Agent',
      containerId: 'def456ghi789',
      modelId: 'llama3.2:3b',
      status: 'stopped',
      capabilities: ['web_search', 'summarization'],
    },
  ]);

  const [selectedLocalEndpoint, setSelectedLocalEndpoint] = useState(LOCAL_ENDPOINTS[0]);

  // Handle connection
  const handleConnect = useCallback(async () => {
    if (!selectedProvider && activeTab === 'remote') return;

    setIsConnecting(true);

    try {
      let endpoint: ModelEndpoint;

      if (activeTab === 'remote') {
        endpoint = {
          id: `${selectedProvider!.id}-${selectedModel}`,
          name: `${selectedProvider!.name} - ${selectedModel}`,
          provider: 'remote',
          modelId: selectedModel,
          endpoint: selectedProvider!.id === 'custom' ? customEndpoint : `${selectedProvider!.baseUrl}/chat/completions`,
          apiKey: apiKey || undefined,
          status: 'connecting',
        };
      } else if (activeTab === 'local') {
        endpoint = {
          id: `local-${selectedModel}`,
          name: `Local - ${selectedModel}`,
          provider: 'local',
          modelId: selectedModel,
          endpoint: selectedLocalEndpoint.baseUrl,
          status: 'connecting',
        };
      } else {
        const agent = agents.find(a => a.id === selectedModel);
        endpoint = {
          id: `agent-${selectedModel}`,
          name: agent?.name || 'In-Architecture Agent',
          provider: 'in-architecture',
          modelId: agent?.modelId || '',
          status: 'connecting',
          capabilities: agent?.capabilities,
        };
      }

      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Track model switch
      const tracker = await getEventTracker();
      tracker.trackModelSwitch({
        from: currentModel?.modelId,
        to: endpoint.modelId,
        provider: endpoint.provider,
        endpoint: endpoint.endpoint,
      });

      endpoint.status = 'connected';
      onModelSelect(endpoint);
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [activeTab, selectedProvider, selectedModel, apiKey, customEndpoint, selectedLocalEndpoint, agents, currentModel, onModelSelect]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Model Selection</h2>
          {currentModel && (
            <div className="flex items-center gap-2 text-sm">
              <StatusIndicator status={currentModel.status} />
              <span className="text-gray-400">{currentModel.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['remote', 'local', 'in-architecture'] as ModelProvider[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === tab 
                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' 
                : 'text-gray-400 hover:text-white'
              }
            `}
          >
            {tab === 'remote' && '🌐 Remote'}
            {tab === 'local' && '💻 Local'}
            {tab === 'in-architecture' && '🏗️ In-Architecture'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'remote' && (
          <div className="space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Provider</label>
              <div className="grid grid-cols-2 gap-3">
                {REMOTE_PROVIDERS.map(provider => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    isSelected={selectedProvider?.id === provider.id}
                    onSelect={() => {
                      setSelectedProvider(provider);
                      setSelectedModel(provider.models[0]?.id || '');
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Model Selection */}
            {selectedProvider && selectedProvider.models.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Model</label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                >
                  {selectedProvider.models.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} {model.contextWindow && `(${(model.contextWindow / 1000).toFixed(0)}k ctx)`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Endpoint */}
            {selectedProvider?.id === 'custom' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Endpoint URL</label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={e => setCustomEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1/chat/completions"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {/* API Key */}
            {selectedProvider?.requiresKey && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'local' && (
          <div className="space-y-4">
            {/* Local Endpoint Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Local Server</label>
              <select
                value={selectedLocalEndpoint.id}
                onChange={e => setSelectedLocalEndpoint(LOCAL_ENDPOINTS.find(ep => ep.id === e.target.value) || LOCAL_ENDPOINTS[0])}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
              >
                {LOCAL_ENDPOINTS.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
            </div>

            {/* Available Models */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Available Models</label>
              <div className="grid grid-cols-1 gap-3">
                {localModels.map(model => (
                  <LocalModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.id}
                    onSelect={() => setSelectedModel(model.id)}
                    onLoad={() => console.log('Load model:', model.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'in-architecture' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Connect to AI agents running inside VMs or containers in your architecture.
            </p>
            
            <div className="grid grid-cols-1 gap-3">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedModel === agent.id}
                  onSelect={() => setSelectedModel(agent.id)}
                  onStart={() => console.log('Start agent:', agent.id)}
                  onStop={() => console.log('Stop agent:', agent.id)}
                />
              ))}
            </div>

            {agents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No agents deployed yet.</p>
                <button className="mt-2 text-indigo-400 hover:text-indigo-300">
                  Deploy an agent →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Connect Button */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={handleConnect}
            disabled={isConnecting || !selectedModel}
            className={`
              w-full py-2.5 rounded-lg font-medium transition-colors
              ${isConnecting || !selectedModel
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }
            `}
          >
            {isConnecting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </span>
            ) : (
              'Connect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModelSelector;
