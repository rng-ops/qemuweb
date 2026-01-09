/**
 * Ollama Manager
 * 
 * UI for managing the local Ollama service:
 * - Connection status and configuration
 * - Model listing, pulling, and deletion
 * - Model info and running status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getOllamaService, 
  type OllamaModel, 
  type OllamaConnectionStatus,
  type OllamaPullProgress,
} from '../../services/ollamaService';

// ============ Connection Status Card ============

interface ConnectionStatusProps {
  status: OllamaConnectionStatus;
  onReconnect: () => void;
  onConfigure: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  status, 
  onReconnect,
  onConfigure,
}) => {
  return (
    <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${
            status.connected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="font-medium text-zinc-200">
            Ollama {status.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!status.connected && (
            <button
              onClick={onReconnect}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Reconnect
            </button>
          )}
          <button
            onClick={onConfigure}
            className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
          >
            Configure
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-zinc-500">Endpoint:</span>
          <span className="ml-2 text-zinc-300 font-mono">
            {status.host}:{status.port}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">Version:</span>
          <span className="ml-2 text-zinc-300">
            {status.version || 'Unknown'}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">Models:</span>
          <span className="ml-2 text-zinc-300">
            {status.models.length}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">Running:</span>
          <span className="ml-2 text-zinc-300">
            {status.runningModels.length}
          </span>
        </div>
      </div>

      {status.error && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {status.error}
        </div>
      )}
    </div>
  );
};

// ============ Configuration Modal ============

interface ConfigureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHost: string;
  currentPort: number;
  onSave: (host: string, port: number) => void;
}

const ConfigureModal: React.FC<ConfigureModalProps> = ({
  isOpen,
  onClose,
  currentHost,
  currentPort,
  onSave,
}) => {
  const [host, setHost] = useState(currentHost);
  const [port, setPort] = useState(currentPort.toString());

  useEffect(() => {
    setHost(currentHost);
    setPort(currentPort.toString());
  }, [currentHost, currentPort]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(host, parseInt(port) || 11434);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 w-96">
        <h3 className="text-lg font-medium text-zinc-200 mb-4">Configure Ollama</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
              placeholder="localhost"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
              placeholder="11434"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Pull Model Modal ============

interface PullModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPull: (modelName: string) => void;
}

const PullModelModal: React.FC<PullModelModalProps> = ({
  isOpen,
  onClose,
  onPull,
}) => {
  const [modelName, setModelName] = useState('');
  
  const popularModels = [
    { name: 'qwen2.5:7b', description: 'Qwen 2.5 7B - Fast and capable' },
    { name: 'llama3.2:3b', description: 'Llama 3.2 3B - Lightweight' },
    { name: 'deepseek-coder-v2:16b', description: 'DeepSeek Coder - For coding' },
    { name: 'mistral:7b', description: 'Mistral 7B - Balanced' },
    { name: 'phi3:mini', description: 'Phi-3 Mini - Very small' },
  ];

  if (!isOpen) return null;

  const handlePull = () => {
    if (modelName.trim()) {
      onPull(modelName.trim());
      setModelName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 w-[480px]">
        <h3 className="text-lg font-medium text-zinc-200 mb-4">Pull Model</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
              placeholder="e.g., qwen2.5:7b"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Popular Models</label>
            <div className="space-y-1 max-h-48 overflow-auto">
              {popularModels.map(model => (
                <button
                  key={model.name}
                  onClick={() => setModelName(model.name)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    modelName === model.name
                      ? 'bg-blue-500/20 border border-blue-500/50'
                      : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                >
                  <div className="text-sm text-zinc-200 font-mono">{model.name}</div>
                  <div className="text-xs text-zinc-500">{model.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePull}
            disabled={!modelName.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Pull Model
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Model Card ============

interface ModelCardProps {
  model: OllamaModel;
  isRunning: boolean;
  onLoad: () => void;
  onUnload: () => void;
  onDelete: () => void;
  onInspect: () => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isRunning,
  onLoad,
  onUnload,
  onDelete,
  onInspect,
}) => {
  const ollamaService = getOllamaService();
  const formattedSize = ollamaService.formatModelSize(model.size);

  return (
    <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-200 font-mono">{model.name}</span>
            {isRunning && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                Running
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span>{formattedSize}</span>
            <span>{model.details.parameterSize}</span>
            <span>{model.details.quantizationLevel}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onInspect}
            className="p-1.5 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
            title="Inspect"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {isRunning ? (
            <button
              onClick={onUnload}
              className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-zinc-700 rounded transition-colors"
              title="Unload"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onLoad}
              className="p-1.5 text-green-400 hover:text-green-300 hover:bg-zinc-700 rounded transition-colors"
              title="Load"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-zinc-700 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Pull Progress ============

interface PullProgressProps {
  modelName: string;
  progress: OllamaPullProgress | null;
}

const PullProgress: React.FC<PullProgressProps> = ({ modelName, progress }) => {
  if (!progress) return null;

  const percentage = progress.total && progress.completed
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-blue-400">Pulling {modelName}</span>
        <span className="text-xs text-blue-400">{percentage}%</span>
      </div>
      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 mt-2">{progress.status}</p>
    </div>
  );
};

// ============ Main Ollama Manager Component ============

interface OllamaManagerProps {
  className?: string;
}

export const OllamaManager: React.FC<OllamaManagerProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<OllamaConnectionStatus>({
    connected: false,
    host: 'localhost',
    port: 11434,
    models: [],
    runningModels: [],
    lastCheck: 0,
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPullModal, setShowPullModal] = useState(false);
  const [pulling, setPulling] = useState<{ name: string; progress: OllamaPullProgress | null } | null>(null);

  // Subscribe to status updates
  useEffect(() => {
    const ollamaService = getOllamaService();
    setStatus(ollamaService.getStatus());
    
    const unsubscribe = ollamaService.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  const handleReconnect = useCallback(async () => {
    const ollamaService = getOllamaService();
    await ollamaService.checkConnection();
  }, []);

  const handleConfigure = useCallback(async (host: string, port: number) => {
    const ollamaService = getOllamaService();
    await ollamaService.configure(host, port);
  }, []);

  const handlePull = useCallback(async (modelName: string) => {
    const ollamaService = getOllamaService();
    setPulling({ name: modelName, progress: null });
    
    await ollamaService.pullModel(modelName, (progress) => {
      setPulling({ name: modelName, progress });
    });
    
    setPulling(null);
  }, []);

  const handleLoad = useCallback(async (modelName: string) => {
    const ollamaService = getOllamaService();
    await ollamaService.loadModel(modelName);
  }, []);

  const handleUnload = useCallback(async (modelName: string) => {
    const ollamaService = getOllamaService();
    await ollamaService.unloadModel(modelName);
  }, []);

  const handleDelete = useCallback(async (modelName: string) => {
    if (confirm(`Delete model "${modelName}"? This cannot be undone.`)) {
      const ollamaService = getOllamaService();
      await ollamaService.deleteModel(modelName);
    }
  }, []);

  const runningModelNames = new Set(status.runningModels.map(m => m.name));

  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <h2 className="text-lg font-medium text-zinc-200">Ollama Models</h2>
        <button
          onClick={() => setShowPullModal(true)}
          disabled={!status.connected}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Pull Model
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Connection Status */}
        <ConnectionStatus
          status={status}
          onReconnect={handleReconnect}
          onConfigure={() => setShowConfigModal(true)}
        />

        {/* Pull Progress */}
        {pulling && (
          <PullProgress modelName={pulling.name} progress={pulling.progress} />
        )}

        {/* Models List */}
        {status.connected && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400">Installed Models</h3>
              <button
                onClick={handleReconnect}
                className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Refresh
              </button>
            </div>
            
            {status.models.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <p>No models installed</p>
                <button
                  onClick={() => setShowPullModal(true)}
                  className="mt-2 text-blue-400 hover:text-blue-300"
                >
                  Pull your first model →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {status.models.map(model => (
                  <ModelCard
                    key={model.digest}
                    model={model}
                    isRunning={runningModelNames.has(model.name)}
                    onLoad={() => handleLoad(model.name)}
                    onUnload={() => handleUnload(model.name)}
                    onDelete={() => handleDelete(model.name)}
                    onInspect={() => console.log('Inspect:', model)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfigureModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        currentHost={status.host}
        currentPort={status.port}
        onSave={handleConfigure}
      />

      <PullModelModal
        isOpen={showPullModal}
        onClose={() => setShowPullModal(false)}
        onPull={handlePull}
      />
    </div>
  );
};

export default OllamaManager;
