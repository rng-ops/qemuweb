/**
 * Atlas MoE (Mixture of Experts) Panel
 * 
 * Displays multi-agent observations, recommendations, and approval gates.
 * Shows the "meeting in the background" of different specialized agents
 * analyzing the user's context and providing insights.
 * 
 * Features:
 * - Agent status cards showing which agents are thinking/idle
 * - Thought stream grouped by agent with role icons
 * - Approval gates requiring user intervention
 * - Policy match notifications
 * - Resource preparation status
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getAgentMatrix, 
  type AgentInstance, 
  type MatrixMessage,
  type AgentRole,
} from '../../services/atlasAgentMatrix';
import { 
  getApprovalGates, 
  type ApprovalGate,
} from '../../services/atlasApprovalGates';
import { 
  getPolicyEngine, 
  type PolicyMatch,
} from '../../services/atlasPolicyEngine';
import { 
  getBrowserInference,
  type LoadedModel,
} from '../../services/atlasBrowserInference';

// ============ Role Icons & Colors ============

const ROLE_CONFIG: Record<AgentRole, { icon: string; color: string; bgColor: string }> = {
  security: { icon: '🔒', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  performance: { icon: '⚡', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  ux: { icon: '🎨', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  compliance: { icon: '📋', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  architecture: { icon: '🏗️', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  testing: { icon: '🧪', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  documentation: { icon: '📚', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  cost: { icon: '💰', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  orchestrator: { icon: '🎭', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  custom: { icon: '🔧', color: 'text-zinc-400', bgColor: 'bg-zinc-500/20' },
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-zinc-500',
  thinking: 'bg-yellow-500 animate-pulse',
  blocked: 'bg-red-500',
  error: 'bg-red-600',
  disabled: 'bg-zinc-700',
};

// ============ Sub-Components ============

interface AgentCardProps {
  agent: AgentInstance;
  isExpanded: boolean;
  onToggle: () => void;
  onEnable: (enabled: boolean) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, isExpanded, onToggle, onEnable }) => {
  const roleConfig = ROLE_CONFIG[agent.config.role] || ROLE_CONFIG.custom;
  
  return (
    <div className={`border rounded-lg overflow-hidden ${roleConfig.bgColor} border-zinc-700/50`}>
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
        onClick={onToggle}
      >
        <span className="text-lg">{roleConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm ${roleConfig.color}`}>
              {agent.config.name}
            </span>
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status]}`} />
          </div>
          <div className="text-[10px] text-zinc-500 truncate">
            {agent.config.description}
          </div>
        </div>
        <label className="flex items-center" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={agent.config.enabled}
            onChange={(e) => onEnable(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-8 h-4 rounded-full transition-colors ${
            agent.config.enabled ? 'bg-indigo-600' : 'bg-zinc-600'
          }`}>
            <div className={`w-3 h-3 mt-0.5 rounded-full bg-white transition-transform ${
              agent.config.enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </div>
        </label>
        <span className="text-zinc-500 text-xs">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="px-3 py-2 border-t border-zinc-700/50 bg-black/20 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-zinc-500">Model:</span>{' '}
              <span className="text-zinc-300">{agent.config.model.name}</span>
            </div>
            <div>
              <span className="text-zinc-500">Priority:</span>{' '}
              <span className="text-zinc-300">{agent.config.priority}</span>
            </div>
            <div>
              <span className="text-zinc-500">Runs:</span>{' '}
              <span className="text-zinc-300">{agent.metrics.totalRuns}</span>
            </div>
            <div>
              <span className="text-zinc-500">Avg Latency:</span>{' '}
              <span className="text-zinc-300">{agent.metrics.avgLatencyMs.toFixed(0)}ms</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-zinc-500">Triggers:</span>{' '}
            <span className="text-zinc-400">{agent.config.triggers.join(', ')}</span>
          </div>
          {agent.lastError && (
            <div className="mt-2 text-red-400">
              Error: {agent.lastError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ApprovalGateCardProps {
  gate: ApprovalGate;
  onApprove: () => void;
  onReject: () => void;
}

const ApprovalGateCard: React.FC<ApprovalGateCardProps> = ({ gate, onApprove, onReject }) => {
  const timeRemaining = Math.max(0, gate.expiresAt - Date.now());
  const [remaining, setRemaining] = useState(timeRemaining);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, gate.expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [gate.expiresAt]);
  
  const priorityColors: Record<string, string> = {
    critical: 'border-red-500 bg-red-500/10',
    high: 'border-orange-500 bg-orange-500/10',
    normal: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-zinc-500 bg-zinc-500/10',
  };
  
  return (
    <div className={`border rounded-lg p-3 ${priorityColors[gate.config.priority]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-yellow-500">⚠️</span>
            <span className="font-medium text-sm text-zinc-200">{gate.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
              gate.config.priority === 'critical' ? 'bg-red-500/30 text-red-300' :
              gate.config.priority === 'high' ? 'bg-orange-500/30 text-orange-300' :
              'bg-zinc-500/30 text-zinc-400'
            }`}>
              {gate.config.priority}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">{gate.description}</p>
          <div className="text-[10px] text-zinc-500 mt-1">
            From: {gate.trigger.sourceId} • Expires in: {Math.ceil(remaining / 1000)}s
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={onApprove}
          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
        >
          ✓ Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
};

interface ThoughtItemProps {
  message: MatrixMessage;
  agent?: AgentInstance;
}

const ThoughtItem: React.FC<ThoughtItemProps> = ({ message, agent }) => {
  const roleConfig = agent ? ROLE_CONFIG[agent.config.role] : ROLE_CONFIG.custom;
  
  const typeIcons: Record<string, string> = {
    thought: '💭',
    concern: '⚠️',
    recommendation: '💡',
    question: '❓',
    'approval-request': '🔐',
  };
  
  return (
    <div className="flex items-start gap-2 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-lg">{roleConfig.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${roleConfig.color}`}>
            {agent?.config.name || message.fromAgent}
          </span>
          <span className="text-[10px] text-zinc-600">
            {typeIcons[message.type] || '💬'} {message.type}
          </span>
          {message.content.confidence && (
            <span className="text-[10px] text-zinc-500">
              {Math.round(message.content.confidence * 100)}%
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-300 mt-0.5">{message.content.text}</p>
        {message.content.severity && message.content.severity !== 'info' && (
          <span className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded ${
            message.content.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
            message.content.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
            message.content.severity === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-zinc-500/20 text-zinc-400'
          }`}>
            {message.content.severity}
          </span>
        )}
        <div className="text-[10px] text-zinc-600 mt-0.5">
          {new Date(message.timestamp).toLocaleTimeString()}
          {message.metadata.processingTimeMs && ` • ${message.metadata.processingTimeMs}ms`}
        </div>
      </div>
    </div>
  );
};

interface InferenceModelCardProps {
  model: LoadedModel;
  onLoad: () => void;
  onUnload: () => void;
}

const InferenceModelCard: React.FC<InferenceModelCardProps> = ({ model, onLoad, onUnload }) => {
  const statusColors: Record<string, string> = {
    'not-loaded': 'text-zinc-500',
    'loading': 'text-yellow-400 animate-pulse',
    'ready': 'text-green-400',
    'error': 'text-red-400',
    'unloading': 'text-yellow-400',
  };
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-300">{model.config.name}</span>
          <span className={`text-xs ${statusColors[model.status]}`}>
            {model.status}
          </span>
        </div>
        <div className="text-[10px] text-zinc-500">
          {model.config.backend} • {model.config.limits.maxMemoryMB}MB max
          {model.memoryUsageMB && ` • ${model.memoryUsageMB}MB used`}
        </div>
      </div>
      {model.status === 'ready' ? (
        <button
          onClick={onUnload}
          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded"
        >
          Unload
        </button>
      ) : model.status === 'not-loaded' ? (
        <button
          onClick={onLoad}
          className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
        >
          Load
        </button>
      ) : null}
    </div>
  );
};

// ============ Main MoE Panel ============

type PanelTab = 'agents' | 'thoughts' | 'gates' | 'inference' | 'policies';

interface MoEPanelProps {
  className?: string;
}

export const MoEPanel: React.FC<MoEPanelProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('thoughts');
  const [agents, setAgents] = useState<AgentInstance[]>([]);
  const [messages, setMessages] = useState<MatrixMessage[]>([]);
  const [gates, setGates] = useState<ApprovalGate[]>([]);
  const [models, setModels] = useState<LoadedModel[]>([]);
  const [policyMatches, setPolicyMatches] = useState<PolicyMatch[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  
  // Load initial data and subscribe to updates
  useEffect(() => {
    const matrix = getAgentMatrix();
    const gatesService = getApprovalGates();
    const inference = getBrowserInference();
    const policyEngine = getPolicyEngine();
    
    // Initial load
    setAgents(matrix.getAgents());
    setMessages(matrix.getRoomMessages(matrix.getActiveRoom().id));
    setGates(gatesService.getPendingGates());
    setModels(inference.getModels());
    setPolicyMatches(policyEngine.getRecentMatches(20));
    
    // Subscribe to matrix messages
    const unsubMessage = matrix.onMessage((message) => {
      setMessages(prev => [...prev, message].slice(-200));
    });
    
    // Subscribe to matrix events
    const unsubEvent = matrix.onEvent((event) => {
      if (event.type === 'agent:registered' || event.type === 'agent:started' || event.type === 'agent:stopped') {
        setAgents(matrix.getAgents());
      }
    });
    
    // Subscribe to gate events
    const unsubGate = gatesService.onEvent(() => {
      setGates(gatesService.getPendingGates());
    });
    
    // Subscribe to inference events
    const unsubInference = inference.onEvent(() => {
      setModels(inference.getModels());
    });
    
    // Subscribe to policy events
    const unsubPolicy = policyEngine.onEvent((event) => {
      if (event.type === 'policies:matched') {
        setPolicyMatches(policyEngine.getRecentMatches(20));
      }
    });
    
    return () => {
      unsubMessage();
      unsubEvent();
      unsubGate();
      unsubInference();
      unsubPolicy();
    };
  }, []);
  
  // Handlers
  const handleAgentToggle = useCallback((agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);
  
  const handleAgentEnable = useCallback((agentId: string, enabled: boolean) => {
    const matrix = getAgentMatrix();
    matrix.setAgentEnabled(agentId, enabled);
    setAgents(matrix.getAgents());
  }, []);
  
  const handleApprove = useCallback((gateId: string) => {
    const gatesService = getApprovalGates();
    gatesService.approve(gateId, {
      approverType: 'human',
      approverId: 'user',
      approverName: 'User',
    });
    setGates(gatesService.getPendingGates());
  }, []);
  
  const handleReject = useCallback((gateId: string) => {
    const gatesService = getApprovalGates();
    gatesService.reject(gateId, {
      rejectorType: 'human',
      rejectorId: 'user',
      rejectorName: 'User',
      reason: 'User rejected',
    });
    setGates(gatesService.getPendingGates());
  }, []);
  
  const handleLoadModel = useCallback(async (modelId: string) => {
    const inference = getBrowserInference();
    await inference.loadModel(modelId);
    setModels(inference.getModels());
  }, []);
  
  const handleUnloadModel = useCallback(async (modelId: string) => {
    const inference = getBrowserInference();
    await inference.unloadModel(modelId);
    setModels(inference.getModels());
  }, []);
  
  // Create agent map for efficient lookups
  const agentMap = useMemo(() => {
    const map = new Map<string, AgentInstance>();
    for (const agent of agents) {
      map.set(agent.config.id, agent);
    }
    return map;
  }, [agents]);
  
  // Stats
  const activeAgents = agents.filter(a => a.config.enabled && a.status !== 'disabled').length;
  const thinkingAgents = agents.filter(a => a.status === 'thinking').length;
  
  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      {/* Header Stats */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-zinc-800 bg-zinc-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-200">MoE Panel</span>
            {gates.length > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full animate-pulse">
                {gates.length} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span>{activeAgents} agents</span>
            {thinkingAgents > 0 && (
              <span className="text-yellow-400">• {thinkingAgents} thinking</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Tab Bar */}
      <div className="flex-shrink-0 flex border-b border-zinc-800">
        {(['thoughts', 'agents', 'gates', 'inference', 'policies'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'thoughts' && `💭 Thoughts (${messages.length})`}
            {tab === 'agents' && `🤖 Agents (${agents.length})`}
            {tab === 'gates' && `🔐 Gates (${gates.length})`}
            {tab === 'inference' && `🧠 Inference`}
            {tab === 'policies' && `📋 Policies`}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Thoughts Tab */}
        {activeTab === 'thoughts' && (
          <div className="p-3 space-y-1">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                <p>No agent thoughts yet.</p>
                <p className="text-xs mt-1">Agents will share observations as you work.</p>
              </div>
            ) : (
              messages.slice().reverse().map((message) => (
                <ThoughtItem 
                  key={message.id} 
                  message={message} 
                  agent={agentMap.get(message.fromAgent)}
                />
              ))
            )}
          </div>
        )}
        
        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="p-3 space-y-2">
            {agents.map((agent) => (
              <AgentCard
                key={agent.config.id}
                agent={agent}
                isExpanded={expandedAgents.has(agent.config.id)}
                onToggle={() => handleAgentToggle(agent.config.id)}
                onEnable={(enabled) => handleAgentEnable(agent.config.id, enabled)}
              />
            ))}
          </div>
        )}
        
        {/* Gates Tab */}
        {activeTab === 'gates' && (
          <div className="p-3 space-y-2">
            {gates.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                <p>No pending approvals.</p>
                <p className="text-xs mt-1">Actions requiring review will appear here.</p>
              </div>
            ) : (
              gates.map((gate) => (
                <ApprovalGateCard
                  key={gate.id}
                  gate={gate}
                  onApprove={() => handleApprove(gate.id)}
                  onReject={() => handleReject(gate.id)}
                />
              ))
            )}
          </div>
        )}
        
        {/* Inference Tab */}
        {activeTab === 'inference' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Browser Models</span>
              <span>
                {getBrowserInference().getMemoryUsage().used}MB / {getBrowserInference().getMemoryUsage().max}MB
              </span>
            </div>
            <div className="space-y-2">
              {models.map((model) => (
                <InferenceModelCard
                  key={model.config.id}
                  model={model}
                  onLoad={() => handleLoadModel(model.config.id)}
                  onUnload={() => handleUnloadModel(model.config.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="p-3 space-y-2">
            <div className="text-xs text-zinc-500 mb-2">
              Recent policy matches
            </div>
            {policyMatches.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                <p>No recent policy matches.</p>
              </div>
            ) : (
              policyMatches.slice().reverse().map((match, i) => (
                <div key={`${match.policyId}-${i}`} className="p-2 bg-zinc-800/50 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300">{match.policyName}</span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(match.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Triggered by: {match.triggerEvent.type}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoEPanel;
