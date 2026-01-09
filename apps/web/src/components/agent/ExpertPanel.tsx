/**
 * Atlas Expert Panel
 * 
 * Advanced MoE (Mixture of Experts) panel for managing experts that observe
 * context and provide commentary like viewers on a stream. Each expert can
 * be configured with different endpoints, prompts, and personas.
 * 
 * Features:
 * - Expert configuration (endpoints, prompts, models)
 * - Live thought stream with expert avatars
 * - Resource bidding visualization
 * - Matrix channel integration status
 * - Endpoint health monitoring
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getExpertNetwork,
  initExpertNetwork,
  type ExpertConfig,
  type InferenceEndpoint,
  type PromptTemplate,
  type BiddingRound,
  type ExpertEvent,
  type ReviewTask,
  type CompletedReview,
  type ReviewQueueStatus,
} from '../../services/atlasExpertNetwork';
import { type MatrixEvent } from '../../services/atlasMatrixMock';

// ============ Types ============

type PanelTab = 'jobs' | 'experts' | 'endpoints' | 'templates' | 'bidding' | 'matrix';

// ============ Icons ============

const PERSONALITY_EMOJI: Record<string, string> = {
  analyst: '📊',
  critic: '🔍',
  optimist: '✨',
  pragmatist: '⚙️',
  'devil-advocate': '😈',
  mentor: '🎓',
  auditor: '📋',
  creative: '🎨',
  custom: '🔧',
};

const ENDPOINT_STATUS_COLORS: Record<string, string> = {
  unknown: 'bg-zinc-500',
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
};

// ============ Sub-Components ============

// Note: ThoughtCard, DebateMessageCard, and ProposalCard removed - not currently used

interface ExpertCardProps {
  expert: ExpertConfig;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
}

const ExpertCard: React.FC<ExpertCardProps> = ({ expert, onToggle, onEdit }) => {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: expert.color || '#3b82f6' }}
        >
          {expert.avatar || PERSONALITY_EMOJI[expert.personality] || '🤖'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-zinc-200">{expert.name}</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
              {expert.personality}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {expert.endpoint.name} • {expert.endpoint.model}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
            <span>⚡ {expert.avgLatencyMs.toFixed(0)}ms avg</span>
            <span>📊 {expert.totalInferences} runs</span>
            <span>🎫 {expert.bidding.budget} credits</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
          >
            Edit
          </button>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={expert.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${
              expert.enabled ? 'bg-green-600' : 'bg-zinc-600'
            }`}>
              <div className={`w-3 h-3 mt-0.5 rounded-full bg-white transition-transform ${
                expert.enabled ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

interface EndpointCardProps {
  endpoint: InferenceEndpoint;
  onTest: () => void;
  onEdit: () => void;
}

const EndpointCard: React.FC<EndpointCardProps> = ({ endpoint, onTest, onEdit }) => {
  const typeLabels: Record<string, string> = {
    ollama: '🦙 Ollama',
    'cloudflare-worker': '☁️ CF Worker',
    'cloudflare-gateway': '🌐 CF Gateway',
    'openai-compatible': '🤖 OpenAI API',
    anthropic: '🧠 Anthropic',
    'web-worker': '⚙️ Web Worker',
    'browser-sandbox': '🔒 Sandbox',
    custom: '🔧 Custom',
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${ENDPOINT_STATUS_COLORS[endpoint.status]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-zinc-200">{endpoint.name}</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
              {typeLabels[endpoint.type] || endpoint.type}
            </span>
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5">
            {endpoint.baseUrl} • {endpoint.model}
          </p>
          {endpoint.latencyMs && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Last check: {endpoint.latencyMs}ms
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onTest}
            className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
          >
            Test
          </button>
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};

interface BiddingRoundCardProps {
  round: BiddingRound;
  experts: Map<string, ExpertConfig>;
}

const BiddingRoundCard: React.FC<BiddingRoundCardProps> = ({ round, experts }) => {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400">
          {new Date(round.timestamp).toLocaleTimeString()}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
          {round.resource}
        </span>
      </div>
      <div className="space-y-1">
        {round.bids.map((bid, i) => {
          const expert = experts.get(bid.expertId);
          const isWinner = round.winners.includes(bid.expertId);
          return (
            <div 
              key={i}
              className={`flex items-center gap-2 text-xs p-1 rounded ${
                isWinner ? 'bg-green-900/30' : 'bg-zinc-700/30'
              }`}
            >
              <span className="text-sm">{expert?.avatar || '🤖'}</span>
              <span className="flex-1 text-zinc-300">{expert?.name || bid.expertId}</span>
              <span className="text-amber-400">🎫 {bid.amount}</span>
              {isWinner && <span className="text-green-400">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============ Expert Editor Modal ============

interface ExpertEditorProps {
  expert?: ExpertConfig;
  endpoints: InferenceEndpoint[];
  templates: PromptTemplate[];
  onSave: (expert: Partial<ExpertConfig>) => void;
  onClose: () => void;
}

const ExpertEditor: React.FC<ExpertEditorProps> = ({ 
  expert, endpoints, templates, onSave, onClose 
}) => {
  const [name, setName] = useState(expert?.name || '');
  const [personality, setPersonality] = useState(expert?.personality || 'analyst');
  const [avatar, setAvatar] = useState(expert?.avatar || '🤖');
  const [color, setColor] = useState(expert?.color || '#3b82f6');
  const [endpointId, setEndpointId] = useState(expert?.endpoint.id || endpoints[0]?.id || '');
  const [templateId, setTemplateId] = useState(expert?.promptTemplate.id || templates[0]?.id || '');
  const [temperature, setTemperature] = useState(expert?.inference.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(expert?.inference.maxTokens ?? 150);
  const [executionMode, setExecutionMode] = useState(expert?.execution.mode || 'main-thread');
  const [biddingEnabled, setBiddingEnabled] = useState(expert?.bidding.enabled ?? true);
  const [budget, setBudget] = useState(expert?.bidding.budget ?? 100);
  const [priority, setPriority] = useState(expert?.bidding.priority ?? 50);

  const handleSave = () => {
    const selectedEndpoint = endpoints.find(e => e.id === endpointId);
    const selectedTemplate = templates.find(t => t.id === templateId);
    
    if (!selectedEndpoint || !selectedTemplate) return;

    onSave({
      id: expert?.id || `expert-${Date.now()}`,
      name,
      personality: personality as ExpertConfig['personality'],
      avatar,
      color,
      endpoint: selectedEndpoint,
      promptTemplate: selectedTemplate,
      inference: {
        temperature,
        topP: 0.9,
        maxTokens,
      },
      execution: {
        mode: executionMode as ExpertConfig['execution']['mode'],
        timeout: 10000,
        retries: 1,
        cacheResults: false,
        cacheTtl: 0,
      },
      bidding: {
        enabled: biddingEnabled,
        budget,
        minBid: 3,
        maxBid: 20,
        strategy: 'adaptive',
        priority,
      },
      enabled: true,
      totalInferences: expert?.totalInferences ?? 0,
      avgLatencyMs: expert?.avgLatencyMs ?? 0,
      triggers: expert?.triggers ?? [{ type: 'context-change', config: {} }],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-zinc-200 mb-4">
          {expert ? 'Edit Expert' : 'Add Expert'}
        </h3>
        
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                placeholder="Expert name"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Avatar</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                placeholder="🤖"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Personality</label>
              <select
                value={personality}
                onChange={(e) => setPersonality(e.target.value as typeof personality)}
                className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
              >
                <option value="analyst">📊 Analyst</option>
                <option value="critic">🔍 Critic</option>
                <option value="optimist">✨ Optimist</option>
                <option value="pragmatist">⚙️ Pragmatist</option>
                <option value="devil-advocate">😈 Devil's Advocate</option>
                <option value="mentor">🎓 Mentor</option>
                <option value="auditor">📋 Auditor</option>
                <option value="creative">🎨 Creative</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Endpoint & Template */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Inference Endpoint</label>
            <select
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
            >
              {endpoints.map(ep => (
                <option key={ep.id} value={ep.id}>
                  {ep.name} ({ep.model})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Prompt Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Inference Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Temperature: {temperature.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Max Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 100)}
                className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
              />
            </div>
          </div>

          {/* Execution Mode */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Execution Mode</label>
            <select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as typeof executionMode)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
            >
              <option value="main-thread">Main Thread</option>
              <option value="web-worker">Web Worker (Background)</option>
              <option value="cloudflare">Cloudflare Workers</option>
              <option value="sandbox">Browser Sandbox</option>
            </select>
          </div>

          {/* Bidding */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-300">Resource Bidding</span>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={biddingEnabled}
                  onChange={(e) => setBiddingEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${
                  biddingEnabled ? 'bg-green-600' : 'bg-zinc-600'
                }`}>
                  <div className={`w-3 h-3 mt-0.5 rounded-full bg-white transition-transform ${
                    biddingEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </div>
              </label>
            </div>
            {biddingEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Budget</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Priority: {priority}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !endpointId}
            className="px-3 py-1.5 text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Endpoint Editor Modal ============

interface EndpointEditorProps {
  endpoint?: InferenceEndpoint;
  onSave: (endpoint: InferenceEndpoint) => void;
  onClose: () => void;
}

const EndpointEditor: React.FC<EndpointEditorProps> = ({ endpoint, onSave, onClose }) => {
  const [type, setType] = useState(endpoint?.type || 'ollama');
  const [name, setName] = useState(endpoint?.name || '');
  const [baseUrl, setBaseUrl] = useState(endpoint?.baseUrl || 'http://localhost:11434');
  const [model, setModel] = useState(endpoint?.model || '');
  const [apiKey, setApiKey] = useState(endpoint?.apiKey || '');
  const [accountId, setAccountId] = useState(endpoint?.accountId || '');

  const handleSave = () => {
    onSave({
      id: endpoint?.id || `endpoint-${Date.now()}`,
      type: type as InferenceEndpoint['type'],
      name,
      baseUrl,
      model,
      apiKey: apiKey || undefined,
      accountId: accountId || undefined,
      status: 'unknown',
    });
  };

  // Default URLs based on type
  useEffect(() => {
    if (!endpoint) {
      switch (type) {
        case 'ollama':
          setBaseUrl('http://localhost:11434');
          break;
        case 'openai-compatible':
          setBaseUrl('https://api.openai.com');
          break;
        case 'anthropic':
          setBaseUrl('https://api.anthropic.com');
          break;
        case 'cloudflare-gateway':
          setBaseUrl('https://gateway.ai.cloudflare.com/v1');
          break;
      }
    }
  }, [type, endpoint]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-full max-w-md">
        <h3 className="text-lg font-medium text-zinc-200 mb-4">
          {endpoint ? 'Edit Endpoint' : 'Add Endpoint'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
            >
              <option value="ollama">🦙 Ollama (Local)</option>
              <option value="openai-compatible">🤖 OpenAI Compatible</option>
              <option value="anthropic">🧠 Anthropic Claude</option>
              <option value="cloudflare-worker">☁️ Cloudflare Worker</option>
              <option value="cloudflare-gateway">🌐 Cloudflare AI Gateway</option>
              <option value="web-worker">⚙️ Web Worker</option>
              <option value="browser-sandbox">🔒 Browser Sandbox</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
              placeholder="My Endpoint"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
              placeholder="http://localhost:11434"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
              placeholder="qwen2.5:0.5b"
            />
          </div>

          {(type === 'openai-compatible' || type === 'anthropic' || type.includes('cloudflare')) && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                placeholder="sk-..."
              />
            </div>
          )}

          {type.includes('cloudflare') && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Account ID</label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                placeholder="cf account id"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !baseUrl || !model}
            className="px-3 py-1.5 text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Main Panel Component ============

// ============ Job Card Component ============

interface JobCardProps {
  task: ReviewTask;
  isExpanded: boolean;
  onToggle: () => void;
  experts: Map<string, ExpertConfig>;
  reviews: CompletedReview[];
}

const JobCard: React.FC<JobCardProps> = ({ task, isExpanded, onToggle, experts, reviews }) => {
  const statusColors: Record<string, string> = {
    queued: 'bg-zinc-600',
    processing: 'bg-blue-600 animate-pulse',
    completed: 'bg-green-600',
    failed: 'bg-red-600',
  };
  
  const priorityColors: Record<string, string> = {
    low: 'text-zinc-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    urgent: 'text-red-400',
  };
  
  const taskReviews = reviews.filter(r => r.taskId === task.id);
  const elapsed = task.startedAt ? Date.now() - task.startedAt : 0;
  const estimatedTotal = task.estimatedMs || 60000;
  const progressPercent = task.status === 'completed' ? 100 : Math.min(95, (elapsed / estimatedTotal) * 100);
  
  return (
    <div className="bg-zinc-800/70 border border-zinc-700 rounded-lg overflow-hidden animate-fadeIn">
      {/* Job Header */}
      <button 
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-zinc-700/50 transition-colors"
      >
        {/* Status indicator */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColors[task.status]}`} />
        
        {/* Job info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {task.trigger === 'user-message' ? '👤 User Message' : 
               task.trigger === 'assistant-response' ? '🤖 Assistant Response' :
               task.trigger === 'file-change' ? '📁 File Change' : '🔧 Manual'}
            </span>
            <span className={`text-[10px] ${priorityColors[task.priority]}`}>
              {task.priority.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">
            {task.contextSummary}
          </p>
        </div>
        
        {/* Expert avatars */}
        <div className="flex -space-x-1">
          {task.expertIds.slice(0, 4).map(expertId => {
            const expert = experts.get(expertId);
            return (
              <div
                key={expertId}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-zinc-600"
                style={{ backgroundColor: expert?.color || '#3b82f6' }}
                title={expert?.name || expertId}
              >
                {expert?.avatar || '🤖'}
              </div>
            );
          })}
          {task.expertIds.length > 4 && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] bg-zinc-700 text-zinc-300 border border-zinc-600">
              +{task.expertIds.length - 4}
            </div>
          )}
        </div>
        
        {/* Status badge & chevron */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors[task.status]} text-white`}>
            {task.status}
          </span>
          <span className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>
      
      {/* Progress bar */}
      {task.status === 'processing' && (
        <div className="px-3 pb-2">
          <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
            <span>{Math.round(progressPercent)}% • {taskReviews.length}/{task.expertIds.length} experts</span>
            <span>~{Math.ceil((estimatedTotal - elapsed) / 60000)}min remaining</span>
          </div>
        </div>
      )}
      
      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-zinc-700 bg-zinc-900/50">
          {/* Job metadata */}
          <div className="px-3 py-2 border-b border-zinc-700/50">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-zinc-500">Created:</span>
                <span className="text-zinc-300 ml-1">
                  {new Date(task.createdAt).toLocaleTimeString()}
                </span>
              </div>
              {task.startedAt && (
                <div>
                  <span className="text-zinc-500">Started:</span>
                  <span className="text-zinc-300 ml-1">
                    {new Date(task.startedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">Experts:</span>
                <span className="text-zinc-300 ml-1">{task.expertIds.length}</span>
              </div>
              <div>
                <span className="text-zinc-500">Est. time:</span>
                <span className="text-zinc-300 ml-1">~{Math.ceil((task.estimatedMs || 60000) / 60000)}min</span>
              </div>
            </div>
          </div>
          
          {/* Context preview */}
          <div className="px-3 py-2 border-b border-zinc-700/50">
            <div className="text-[10px] text-zinc-500 mb-1">Input Context</div>
            <pre className="text-xs text-zinc-400 bg-zinc-800 p-2 rounded max-h-20 overflow-auto whitespace-pre-wrap">
              {task.context.slice(0, 500)}{task.context.length > 500 ? '...' : ''}
            </pre>
          </div>
          
          {/* Expert reviews */}
          <div className="px-3 py-2">
            <div className="text-[10px] text-zinc-500 mb-2">Expert Reviews ({taskReviews.length}/{task.expertIds.length})</div>
            {taskReviews.length === 0 ? (
              <div className="text-xs text-zinc-600 text-center py-2">
                {task.status === 'queued' ? 'Waiting in queue...' : 
                 task.status === 'processing' ? 'Processing...' : 'No reviews yet'}
              </div>
            ) : (
              <div className="space-y-2">
                {taskReviews.map(review => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Review Card Component ============

interface ReviewCardProps {
  review: CompletedReview;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const severityColors: Record<string, string> = {
    info: 'border-zinc-600 bg-zinc-800/50',
    low: 'border-blue-600 bg-blue-900/20',
    medium: 'border-yellow-600 bg-yellow-900/20',
    high: 'border-orange-600 bg-orange-900/20',
    critical: 'border-red-600 bg-red-900/20',
  };
  
  const typeIcons: Record<string, string> = {
    security: '🛡️',
    architecture: '🏗️',
    'code-review': '📝',
    strategic: '📊',
    general: '💭',
  };
  
  return (
    <div className={`border rounded-lg overflow-hidden ${severityColors[review.severity]}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-2 py-1.5 flex items-center gap-2 hover:bg-zinc-700/30 transition-colors"
      >
        <div 
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
          style={{ backgroundColor: review.expertColor || '#3b82f6' }}
        >
          {review.expertAvatar || '🤖'}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-zinc-200">{review.expertName}</span>
            <span className="text-[10px] text-zinc-500">{typeIcons[review.type]} {review.type}</span>
          </div>
          <p className="text-[11px] text-zinc-400 truncate">{review.summary}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-zinc-500">{(review.durationMs / 1000).toFixed(1)}s</span>
          <span className={`text-zinc-500 text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-zinc-700/50 px-2 py-2 space-y-2">
          {/* Full details */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Details</div>
            <p className="text-xs text-zinc-300">{review.details}</p>
          </div>
          
          {/* Findings */}
          {review.findings && review.findings.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Findings</div>
              <div className="space-y-1">
                {review.findings.map((finding, i) => (
                  <div key={i} className="text-xs p-1.5 bg-zinc-800 rounded">
                    <span className={`text-[9px] px-1 py-0.5 rounded mr-1 ${
                      finding.severity === 'critical' ? 'bg-red-600' :
                      finding.severity === 'high' ? 'bg-orange-600' :
                      finding.severity === 'medium' ? 'bg-yellow-600' : 'bg-zinc-600'
                    } text-white`}>
                      {finding.type}
                    </span>
                    <span className="text-zinc-300">{finding.content}</span>
                    {finding.actionItem && (
                      <div className="mt-1 text-[10px] text-indigo-400">→ {finding.actionItem}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Action items */}
          {review.actionItems && review.actionItems.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Action Items</div>
              <ul className="text-xs text-zinc-300 space-y-0.5">
                {review.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-indigo-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Raw output (for debugging) */}
          {review.rawOutput && (
            <details className="text-[10px]">
              <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">Raw LLM Output</summary>
              <pre className="mt-1 p-1.5 bg-zinc-900 rounded text-zinc-400 overflow-auto max-h-32 whitespace-pre-wrap">
                {review.rawOutput}
              </pre>
            </details>
          )}
          
          {/* Metadata */}
          <div className="flex flex-wrap gap-2 text-[9px] text-zinc-500 pt-1 border-t border-zinc-700/50">
            <span>Confidence: {Math.round(review.confidence * 100)}%</span>
            <span>Duration: {(review.durationMs / 1000).toFixed(1)}s</span>
            <span>Completed: {new Date(review.completedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Main Panel Component ============

export const ExpertPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PanelTab>('jobs');
  const [experts, setExperts] = useState<ExpertConfig[]>([]);
  const [endpoints, setEndpoints] = useState<InferenceEndpoint[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [biddingHistory, setBiddingHistory] = useState<BiddingRound[]>([]);
  const [matrixConnected, setMatrixConnected] = useState(false);
  const [matrixTimeline, setMatrixTimeline] = useState<MatrixEvent[]>([]);
  const [usingMockMatrix, setUsingMockMatrix] = useState(false);
  
  // Job queue state
  const [queuedTasks, setQueuedTasks] = useState<ReviewTask[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<ReviewTask[]>([]);
  const [completedReviews, setCompletedReviews] = useState<CompletedReview[]>([]);
  const [queueStatus, setQueueStatus] = useState<ReviewQueueStatus>({ queued: 0, processing: 0, completed: 0, failed: 0, estimatedWaitMs: 0 });
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  
  // Modals
  const [editingExpert, setEditingExpert] = useState<ExpertConfig | null>(null);
  const [showExpertEditor, setShowExpertEditor] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<InferenceEndpoint | null>(null);
  const [showEndpointEditor, setShowEndpointEditor] = useState(false);

  // Initialize and subscribe to events
  useEffect(() => {
    const network = initExpertNetwork();
    
    // Load initial state
    setExperts(network.listExperts());
    setEndpoints(network.listEndpoints());
    setTemplates(network.listTemplates());
    setBiddingHistory(network.getBiddingHistory());
    setMatrixConnected(network.isMatrixConnected());
    setUsingMockMatrix(network.isUsingMockMatrix());
    setMatrixTimeline(network.getMatrixTimeline());
    
    // Load job queue state
    setQueuedTasks(network.getQueuedTasks());
    setInProgressTasks(network.getInProgressTasks());
    setCompletedReviews(network.getCompletedReviews());
    setQueueStatus(network.getQueueStatus());
    
    // Poll for queue updates (since processing happens async)
    const pollInterval = setInterval(() => {
      setQueuedTasks(network.getQueuedTasks());
      setInProgressTasks(network.getInProgressTasks());
      setCompletedReviews(network.getCompletedReviews());
      setQueueStatus(network.getQueueStatus());
    }, 2000);
    
    // Subscribe to events
    const unsubscribe = network.subscribe((event: ExpertEvent) => {
      switch (event.type) {
        case 'expert:registered':
        case 'expert:enabled':
        case 'expert:disabled':
          setExperts(network.listExperts());
          break;
        case 'expert:thought':
          setMatrixTimeline(network.getMatrixTimeline());
          break;
        case 'debate:started':
        case 'debate:message':
          setMatrixTimeline(network.getMatrixTimeline());
          break;
        case 'debate:proposal':
        case 'debate:vote':
        case 'debate:consensus':
          // Debate events - update matrix timeline only
          setMatrixTimeline(network.getMatrixTimeline());
          break;
        case 'bidding:round-end':
          setBiddingHistory(network.getBiddingHistory());
          setMatrixTimeline(network.getMatrixTimeline());
          break;
        case 'matrix:connected':
          setMatrixConnected(true);
          setUsingMockMatrix(network.isUsingMockMatrix());
          setMatrixTimeline(network.getMatrixTimeline());
          break;
        case 'matrix:message':
          setMatrixTimeline(network.getMatrixTimeline());
          break;
        case 'review:queued':
        case 'review:started':
        case 'review:completed':
          setQueuedTasks(network.getQueuedTasks());
          setInProgressTasks(network.getInProgressTasks());
          setCompletedReviews(network.getCompletedReviews());
          setQueueStatus(network.getQueueStatus());
          break;
      }
    });
    
    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  const expertsMap = useMemo(() => {
    const map = new Map<string, ExpertConfig>();
    experts.forEach(e => map.set(e.id, e));
    return map;
  }, [experts]);

  const handleToggleExpert = useCallback((id: string, enabled: boolean) => {
    const network = getExpertNetwork();
    if (enabled) {
      network.enableExpert(id);
    } else {
      network.disableExpert(id);
    }
  }, []);

  const handleSaveExpert = useCallback((expert: Partial<ExpertConfig>) => {
    const network = getExpertNetwork();
    if (expert.id) {
      const existing = network.getExpert(expert.id);
      if (existing) {
        network.updateExpert(expert.id, expert);
      } else {
        network.registerExpert(expert as ExpertConfig);
      }
    }
    setExperts(network.listExperts());
    setShowExpertEditor(false);
    setEditingExpert(null);
  }, []);

  const handleSaveEndpoint = useCallback((endpoint: InferenceEndpoint) => {
    const network = getExpertNetwork();
    network.registerEndpoint(endpoint);
    setEndpoints(network.listEndpoints());
    setShowEndpointEditor(false);
    setEditingEndpoint(null);
  }, []);

  const handleTestEndpoint = useCallback(async (id: string) => {
    const network = getExpertNetwork();
    await network.checkEndpointHealth(id);
    setEndpoints(network.listEndpoints());
  }, []);

  const handleRunExperts = useCallback(async () => {
    const network = getExpertNetwork();
    await network.runAllExperts({
      context: 'Manual trigger from panel',
      timestamp: Date.now(),
    });
  }, []);

  // All tasks combined for display
  const allTasks = useMemo(() => {
    const tasks = [...inProgressTasks, ...queuedTasks];
    // Add completed tasks that have reviews
    const completedTaskIds = new Set(completedReviews.map(r => r.taskId));
    completedTaskIds.forEach(taskId => {
      if (!tasks.find(t => t.id === taskId)) {
        // Create a synthetic completed task
        const firstReview = completedReviews.find(r => r.taskId === taskId);
        if (firstReview) {
          tasks.push({
            id: taskId,
            createdAt: firstReview.completedAt - (firstReview.durationMs || 0),
            startedAt: firstReview.completedAt - (firstReview.durationMs || 0),
            trigger: 'manual',
            context: '',
            contextSummary: 'Completed review',
            expertIds: completedReviews.filter(r => r.taskId === taskId).map(r => r.expertId),
            priority: 'medium',
            status: 'completed',
            progress: 100,
          });
        }
      }
    });
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }, [queuedTasks, inProgressTasks, completedReviews]);

  // Tabs config
  const tabs: { id: PanelTab; label: string; icon: string; badge?: number }[] = [
    { id: 'jobs', label: 'Analysis', icon: '🔬', badge: queueStatus.queued + queueStatus.processing },
    { id: 'experts', label: 'Experts', icon: '🎭' },
    { id: 'endpoints', label: 'Endpoints', icon: '🔌' },
    { id: 'templates', label: 'Templates', icon: '📝' },
    { id: 'bidding', label: 'Bidding', icon: '🎫' },
    { id: 'matrix', label: 'Matrix', icon: '🔗' },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Tab Bar */}
      <div className="flex border-b border-zinc-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors relative ${
              activeTab === tab.id
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded-full bg-indigo-600 text-white">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Jobs Tab - Async Analysis Queue */}
        {activeTab === 'jobs' && (
          <div className="space-y-3">
            {/* Queue Status Header */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    queueStatus.processing > 0 ? 'bg-blue-500 animate-pulse' : 
                    queueStatus.queued > 0 ? 'bg-yellow-500' : 'bg-zinc-500'
                  }`} />
                  <span className="text-sm font-medium text-zinc-200">Analysis Queue</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-blue-400">{queueStatus.processing} processing</span>
                  <span className="text-yellow-400">{queueStatus.queued} queued</span>
                  <span className="text-green-400">{queueStatus.completed} completed</span>
                </div>
              </div>
              
              {/* Expert avatars */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {experts.filter(e => e.enabled).slice(0, 6).map(expert => (
                    <div
                      key={expert.id}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-zinc-700"
                      style={{ backgroundColor: expert.color || '#3b82f6' }}
                      title={`${expert.name} (${expert.endpoint.model})`}
                    >
                      {expert.avatar || '🤖'}
                    </div>
                  ))}
                  {experts.filter(e => e.enabled).length > 6 && (
                    <span className="text-[10px] text-zinc-500">
                      +{experts.filter(e => e.enabled).length - 6}
                    </span>
                  )}
                </div>
                {queueStatus.estimatedWaitMs > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    ~{Math.ceil(queueStatus.estimatedWaitMs / 60000)}min total wait
                  </span>
                )}
              </div>
            </div>
            
            {/* Manual trigger button */}
            <div className="flex justify-end">
              <button
                onClick={handleRunExperts}
                className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1"
              >
                <span>🔬</span> Trigger Analysis
              </button>
            </div>
            
            {/* Job List */}
            {allTasks.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <div className="text-4xl mb-3">🔬</div>
                <p className="text-sm">No analysis jobs yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                  When you chat with the assistant, analysis jobs will be dispatched to experts automatically.
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Reviews run in the background — come back in ~5 minutes to see results.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {allTasks.map(task => (
                  <JobCard
                    key={task.id}
                    task={task}
                    isExpanded={expandedJobId === task.id}
                    onToggle={() => setExpandedJobId(expandedJobId === task.id ? null : task.id)}
                    experts={expertsMap}
                    reviews={completedReviews}
                  />
                ))}
              </div>
            )}
            
            {/* Completed Reviews Summary */}
            {completedReviews.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-700">
                <h4 className="text-xs text-zinc-400 font-medium mb-2">Recent Findings Summary</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="bg-zinc-800 p-2 rounded">
                    <div className="text-lg mb-0.5">🛡️</div>
                    <div className="text-zinc-400">Security</div>
                    <div className="text-zinc-200 font-medium">
                      {completedReviews.filter(r => r.type === 'security').length}
                    </div>
                  </div>
                  <div className="bg-zinc-800 p-2 rounded">
                    <div className="text-lg mb-0.5">🏗️</div>
                    <div className="text-zinc-400">Architecture</div>
                    <div className="text-zinc-200 font-medium">
                      {completedReviews.filter(r => r.type === 'architecture').length}
                    </div>
                  </div>
                  <div className="bg-zinc-800 p-2 rounded">
                    <div className="text-lg mb-0.5">📝</div>
                    <div className="text-zinc-400">Code Review</div>
                    <div className="text-zinc-200 font-medium">
                      {completedReviews.filter(r => r.type === 'code-review').length}
                    </div>
                  </div>
                  <div className="bg-zinc-800 p-2 rounded">
                    <div className="text-lg mb-0.5">📊</div>
                    <div className="text-zinc-400">Strategic</div>
                    <div className="text-zinc-200 font-medium">
                      {completedReviews.filter(r => r.type === 'strategic').length}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Experts Tab */}
        {activeTab === 'experts' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingExpert(null);
                  setShowExpertEditor(true);
                }}
                className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                + Add Expert
              </button>
            </div>
            {experts.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No experts configured. Add one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {experts.map(expert => (
                  <ExpertCard
                    key={expert.id}
                    expert={expert}
                    onToggle={(enabled) => handleToggleExpert(expert.id, enabled)}
                    onEdit={() => {
                      setEditingExpert(expert);
                      setShowExpertEditor(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Endpoints Tab */}
        {activeTab === 'endpoints' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingEndpoint(null);
                  setShowEndpointEditor(true);
                }}
                className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                + Add Endpoint
              </button>
            </div>
            {endpoints.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No endpoints configured. Add one to connect experts to inference services.
              </div>
            ) : (
              <div className="space-y-2">
                {endpoints.map(endpoint => (
                  <EndpointCard
                    key={endpoint.id}
                    endpoint={endpoint}
                    onTest={() => handleTestEndpoint(endpoint.id)}
                    onEdit={() => {
                      setEditingEndpoint(endpoint);
                      setShowEndpointEditor(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-3">
            {templates.map(template => (
              <div key={template.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                <h4 className="font-medium text-sm text-zinc-200">{template.name}</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Output: {template.outputFormat} • {template.variables.length} variables
                </p>
                <pre className="mt-2 text-[10px] text-zinc-400 bg-zinc-900 p-2 rounded overflow-x-auto max-h-24">
                  {template.systemPrompt.slice(0, 200)}...
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* Bidding Tab */}
        {activeTab === 'bidding' && (
          <div className="space-y-3">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">How Bidding Works</h4>
              <p className="text-xs text-zinc-500">
                Experts bid credits to get "airtime" when context changes. Winners get to 
                run their inference. Budget depletes with each bid, preventing noisy experts 
                from dominating.
              </p>
            </div>
            {biddingHistory.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No bidding rounds yet. Trigger experts to see bidding activity.
              </div>
            ) : (
              <div className="space-y-2">
                {biddingHistory.slice().reverse().map(round => (
                  <BiddingRoundCard key={round.id} round={round} experts={expertsMap} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Matrix Tab */}
        {activeTab === 'matrix' && (
          <div className="space-y-3">
            {/* Connection Status */}
            <div className={`p-3 rounded-lg border ${
              matrixConnected 
                ? 'bg-green-900/20 border-green-700' 
                : 'bg-zinc-800/50 border-zinc-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    matrixConnected ? 'bg-green-500' : 'bg-zinc-500'
                  }`} />
                  <span className="text-sm text-zinc-300">
                    {matrixConnected 
                      ? usingMockMatrix 
                        ? '🏠 Mock Matrix (In-Memory)' 
                        : 'Connected to Matrix'
                      : 'Not connected'}
                  </span>
                </div>
                {matrixConnected && (
                  <span className="text-xs text-zinc-500">
                    {matrixTimeline.length} events
                  </span>
                )}
              </div>
              {usingMockMatrix && (
                <p className="text-xs text-zinc-500 mt-2">
                  Using serverless in-memory Matrix. All events are stored locally and 
                  create auditable logs as if on a real Matrix server.
                </p>
              )}
            </div>
            
            {/* Matrix Timeline */}
            {matrixConnected && matrixTimeline.length > 0 && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-zinc-300">📜 Event Timeline</h4>
                  <span className="text-[10px] text-zinc-500">Live audit log</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {matrixTimeline.slice().reverse().map((event) => (
                    <div key={event.event_id} className="px-3 py-2 border-b border-zinc-700/50 last:border-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 text-xs text-zinc-500 w-16">
                          {new Date(event.origin_server_ts).toLocaleTimeString()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-xs">
                            <span className="font-medium text-indigo-400">
                              {event.sender.split(':')[0].replace('@', '')}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-500">{event.type}</span>
                          </div>
                          <p className="text-sm text-zinc-300 mt-0.5 break-words">
                            {String((event.content.body as string) || JSON.stringify(event.content).slice(0, 100))}
                          </p>
                          {Boolean(event.content['io.atlas.expert']) && (
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                                {String((event.content['io.atlas.expert'] as Record<string, unknown>).type)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                                {Math.round(Number((event.content['io.atlas.expert'] as Record<string, unknown>).confidence) * 100)}% conf
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Empty state for timeline */}
            {matrixConnected && matrixTimeline.length === 0 && (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No events yet. Run experts to see their thoughts appear here.
              </div>
            )}
            
            {/* Real Matrix Configuration (hidden when using mock) */}
            {!usingMockMatrix && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Connect to Real Matrix</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Homeserver URL</label>
                    <input
                      type="text"
                      placeholder="https://matrix.org"
                      className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Access Token</label>
                    <input
                      type="password"
                      placeholder="syt_..."
                      className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Room ID</label>
                    <input
                      type="text"
                      placeholder="!abc123:matrix.org"
                      className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                    />
                  </div>
                  <button className="w-full text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white">
                    Connect
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showExpertEditor && (
        <ExpertEditor
          expert={editingExpert || undefined}
          endpoints={endpoints}
          templates={templates}
          onSave={handleSaveExpert}
          onClose={() => {
            setShowExpertEditor(false);
            setEditingExpert(null);
          }}
        />
      )}
      
      {showEndpointEditor && (
        <EndpointEditor
          endpoint={editingEndpoint || undefined}
          onSave={handleSaveEndpoint}
          onClose={() => {
            setShowEndpointEditor(false);
            setEditingEndpoint(null);
          }}
        />
      )}
    </div>
  );
};

export default ExpertPanel;
