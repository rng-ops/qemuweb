/**
 * Agent Chat Interface
 * 
 * Enhanced chat interface with:
 * - Agent profile selection
 * - Reasoning level control
 * - Planning view
 * - Tool execution visualization
 * - Streaming responses
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getOllamaService, 
  type OllamaChatMessage, 
  type ReasoningLevel,
} from '../../services/ollamaService';
import {
  getAgentProfileManager,
  type AgentProfile,
  type AgentPlan,
  type AgentPlanStep,
  formatReasoningLevel,
  getReasoningLevelColor,
} from '../../services/agentProfiles';
import { getToolExecutor, getAllTools } from '../../services/agentTools';
import { getAuditLog } from '../../services/auditLog';
import { AgentProfileCard } from './AgentProfileCard';

// ============ Types ============

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  metadata?: {
    model?: string;
    reasoningLevel?: ReasoningLevel;
    duration?: number;
    tokens?: number;
    toolCalls?: { name: string; params: Record<string, unknown>; result?: unknown }[];
    thinking?: string;
  };
}

type AgentViewMode = 'chat' | 'planning' | 'profile' | 'settings';

// ============ Reasoning Level Selector ============

interface ReasoningLevelSelectorProps {
  value: ReasoningLevel;
  onChange: (level: ReasoningLevel) => void;
  compact?: boolean;
}

const ReasoningLevelSelector: React.FC<ReasoningLevelSelectorProps> = ({ 
  value, 
  onChange, 
  compact = false 
}) => {
  const levels: ReasoningLevel[] = ['none', 'low', 'medium', 'high', 'max'];
  
  if (compact) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ReasoningLevel)}
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-300"
      >
        {levels.map(level => (
          <option key={level} value={level}>
            {formatReasoningLevel(level)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-zinc-400">Reasoning Level</label>
      <div className="flex gap-1">
        {levels.map(level => (
          <button
            key={level}
            onClick={() => onChange(level)}
            className={`
              flex-1 px-3 py-2 rounded text-sm font-medium transition-all
              ${value === level
                ? `${getReasoningLevelColor(level).replace('text-', 'bg-').replace('400', '500/20')} ${getReasoningLevelColor(level)} border border-current`
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }
            `}
          >
            {formatReasoningLevel(level)}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        {value === 'none' && 'Quick responses, minimal reasoning'}
        {value === 'low' && 'Basic reasoning, faster responses'}
        {value === 'medium' && 'Balanced reasoning and speed'}
        {value === 'high' && 'Deep reasoning, thorough analysis'}
        {value === 'max' && 'Maximum reasoning depth'}
      </p>
    </div>
  );
};

// ============ Profile Selector ============

interface ProfileSelectorProps {
  profiles: AgentProfile[];
  selectedId: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({ 
  profiles, 
  selectedId, 
  onSelect,
  onManage 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = profiles.find(p => p.id === selectedId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg hover:bg-zinc-700 transition-colors"
      >
        <span className="text-lg">{selected?.icon || '🤖'}</span>
        <span className="text-sm text-zinc-300">{selected?.name || 'Select Profile'}</span>
        <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl z-50 overflow-hidden">
            {profiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => {
                  onSelect(profile.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-start gap-3 p-3 text-left hover:bg-zinc-700 transition-colors
                  ${profile.id === selectedId ? 'bg-zinc-700/50' : ''}
                `}
              >
                <span className="text-xl">{profile.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">{profile.name}</span>
                    {profile.isDefault && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{profile.description}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {profile.model.modelId} • {formatReasoningLevel(profile.model.defaultReasoningLevel)}
                  </p>
                </div>
              </button>
            ))}
            <div className="border-t border-zinc-700">
              <button
                onClick={() => {
                  onManage();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
              >
                ⚙️ Manage Profiles...
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============ Planning View ============

interface PlanningViewProps {
  plan: AgentPlan | null;
  onCreatePlan: (goal: string) => void;
  onExecuteStep: (stepId: string) => void;
  onCancelPlan: () => void;
}

const PlanningView: React.FC<PlanningViewProps> = ({ 
  plan, 
  onCreatePlan, 
  onExecuteStep,
  onCancelPlan 
}) => {
  const [goal, setGoal] = useState('');

  const getStepStatusIcon = (status: AgentPlanStep['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in-progress': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
    }
  };

  const getStepStatusColor = (status: AgentPlanStep['status']) => {
    switch (status) {
      case 'pending': return 'text-zinc-400';
      case 'in-progress': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'skipped': return 'text-yellow-400';
    }
  };

  if (!plan) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <label className="block text-sm text-zinc-400 mb-2">What would you like to accomplish?</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe your goal and the agent will create a plan..."
            className="w-full h-24 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
          />
        </div>
        <button
          onClick={() => {
            if (goal.trim()) {
              onCreatePlan(goal.trim());
              setGoal('');
            }
          }}
          disabled={!goal.trim()}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          Create Plan
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-medium text-zinc-200">Plan</span>
            <span className={`
              px-2 py-0.5 rounded text-xs font-medium
              ${plan.status === 'executing' ? 'bg-blue-500/20 text-blue-400' :
                plan.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                plan.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-zinc-700 text-zinc-400'}
            `}>
              {plan.status}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">{plan.goal}</p>
        </div>
        <button
          onClick={onCancelPlan}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Cancel plan"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {plan.steps.map((step, index) => (
          <div
            key={step.id}
            className={`
              p-3 rounded-lg border transition-all
              ${index === plan.currentStepIndex && plan.status === 'executing'
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-zinc-700 bg-zinc-800/50'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <span className={`${getStepStatusColor(step.status)} text-lg`}>
                {getStepStatusIcon(step.status)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{step.description}</span>
                  {step.status === 'pending' && index === plan.currentStepIndex && (
                    <button
                      onClick={() => onExecuteStep(step.id)}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
                    >
                      Execute
                    </button>
                  )}
                </div>
                {step.toolName && (
                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                    {step.toolName}({step.toolParams ? JSON.stringify(step.toolParams) : ''})
                  </p>
                )}
                {step.result !== undefined && step.result !== null && (
                  <pre className="mt-2 p-2 bg-zinc-900 rounded text-xs text-zinc-400 overflow-auto">
                    {String(JSON.stringify(step.result, null, 2))}
                  </pre>
                )}
                {step.error && (
                  <p className="mt-1 text-xs text-red-400">{step.error}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ Chat Message Component ============

interface ChatMessageViewProps {
  message: ChatMessage;
}

const ChatMessageView: React.FC<ChatMessageViewProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : isSystem
            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
            : isTool
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
            : 'bg-zinc-700 text-zinc-200'
        }`}
      >
        {/* Header */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2 text-xs opacity-70">
            {isSystem && <span>System</span>}
            {isTool && <span>Tool Result</span>}
            {message.metadata?.model && (
              <span className="font-mono">{message.metadata.model}</span>
            )}
            {message.metadata?.reasoningLevel && (
              <span className={getReasoningLevelColor(message.metadata.reasoningLevel)}>
                {formatReasoningLevel(message.metadata.reasoningLevel)}
              </span>
            )}
          </div>
        )}

        {/* Thinking/Reasoning Section */}
        {message.metadata?.thinking && (
          <details className="mb-2">
            <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-300">
              🧠 Thinking...
            </summary>
            <div className="mt-2 p-2 bg-zinc-800 rounded text-xs text-zinc-400 whitespace-pre-wrap">
              {message.metadata.thinking}
            </div>
          </details>
        )}

        {/* Content */}
        <div className="text-sm whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>

        {/* Tool Calls */}
        {message.metadata?.toolCalls && message.metadata.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.metadata.toolCalls.map((call, i) => (
              <div key={i} className="p-2 bg-zinc-800 rounded">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>🔧</span>
                  <span className="font-mono">{call.name}</span>
                </div>
                {call.result !== undefined && call.result !== null && (
                  <pre className="mt-1 text-xs text-zinc-500 overflow-auto">
                    {typeof call.result === 'string' 
                      ? String(call.result)
                      : String(JSON.stringify(call.result, null, 2))
                    }
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 mt-2 text-xs opacity-50">
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {message.metadata?.duration && (
            <span>{(message.metadata.duration / 1000).toFixed(1)}s</span>
          )}
          {message.metadata?.tokens && (
            <span>{message.metadata.tokens} tokens</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Main Agent Chat Component ============

interface AgentChatProps {
  className?: string;
  onManageProfiles?: () => void;
}

export const AgentChat: React.FC<AgentChatProps> = ({ 
  className = '',
  onManageProfiles 
}) => {
  const [viewMode, setViewMode] = useState<AgentViewMode>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('default');
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('medium');
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState({ connected: false, models: [] as string[] });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Initialize
  useEffect(() => {
    const profileManager = getAgentProfileManager();
    const ollamaService = getOllamaService();

    // Load profiles
    setProfiles(profileManager.getProfiles());
    const defaultProfile = profileManager.getDefaultProfile();
    setSelectedProfileId(defaultProfile.id);
    setReasoningLevel(defaultProfile.model.defaultReasoningLevel);

    // Subscribe to profile changes
    const unsubProfiles = profileManager.subscribe(() => {
      setProfiles(profileManager.getProfiles());
    });

    // Subscribe to ollama status
    const unsubOllama = ollamaService.onStatusChange((status) => {
      setOllamaStatus({
        connected: status.connected,
        models: status.models.map(m => m.name),
      });
    });

    // Add welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your AI assistant powered by Ollama. You can select different agent profiles and reasoning levels to customize how I respond.

Available actions:
• Chat naturally about anything
• Ask me to execute tools (list images, manage containers, etc.)
• Create plans for complex tasks
• Adjust reasoning level for more thorough analysis

How can I help you today?`,
      timestamp: Date.now(),
    }]);

    return () => {
      unsubProfiles();
      unsubOllama();
    };
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle profile change
  const handleProfileChange = useCallback((profileId: string) => {
    setSelectedProfileId(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setReasoningLevel(profile.model.defaultReasoningLevel);
    }
  }, [profiles]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    const profile = profiles.find(p => p.id === selectedProfileId);
    const ollamaService = getOllamaService();

    // Log to audit
    const auditLog = await getAuditLog();
    await auditLog.logAgentMessage('user', userMessage.content);

    // Check if Ollama is connected
    if (!ollamaService.isConnected) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: '⚠️ Ollama is not connected. Please ensure Ollama is running on your machine.',
        timestamp: Date.now(),
      }]);
      setIsProcessing(false);
      return;
    }

    // Create assistant message for streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    let fullContent = '';
    const startTime = Date.now();

    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      metadata: {
        model: profile?.model.modelId,
        reasoningLevel,
      },
    }]);

    try {
      // Build messages for Ollama
      const ollamaMessages: OllamaChatMessage[] = [
        { role: 'system', content: profile?.systemPrompt || '' },
      ];

      // Add recent messages for context
      const recentMessages = messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          ollamaMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Add current user message
      ollamaMessages.push({ role: 'user', content: userMessage.content });

      // Add tools context
      if (profile?.settings.planningMode !== 'none') {
        const allTools = getAllTools();
        const toolsContext = `\n\nAvailable tools:\n${allTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`;
        ollamaMessages[0].content += toolsContext;
      }

      // Stream response
      for await (const chunk of ollamaService.chatStream({
        model: profile?.model.modelId || 'qwen2.5:7b',
        messages: ollamaMessages,
        reasoningLevel,
      })) {
        fullContent += chunk.message.content;
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent }
            : msg
        ));
      }

      // Finalize message
      const duration = Date.now() - startTime;
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { 
              ...msg, 
              content: fullContent,
              isStreaming: false,
              metadata: {
                ...msg.metadata,
                duration,
              },
            }
          : msg
      ));

      // Log to audit
      await auditLog.logAgentMessage('assistant', fullContent);

      // Check for tool calls in response
      await checkAndExecuteTools(fullContent, profile);

    } catch (error) {
      console.error('[AgentChat] Error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { 
              ...msg, 
              content: fullContent || `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              isStreaming: false,
            }
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, messages, profiles, selectedProfileId, reasoningLevel]);

  // Check for and execute tool calls
  const checkAndExecuteTools = async (content: string, profile: AgentProfile | undefined) => {
    // Simple tool call detection (look for patterns like "I'll use list_images")
    const toolMentions = getAllTools()
      .filter(t => content.toLowerCase().includes(t.name.replace('_', ' ')))
      .slice(0, 1); // Only first mentioned tool

    if (toolMentions.length > 0 && profile?.settings.autoExecuteTools) {
      const tool = toolMentions[0];
      const executor = getToolExecutor();
      
      setMessages(prev => [...prev, {
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: `Executing ${tool.name}...`,
        timestamp: Date.now(),
      }]);

      const result = await executor.invoke(tool.name, {}, {
        agentId: profile.id,
        sessionId: 'current',
      });

      setMessages(prev => [...prev, {
        id: `tool-result-${Date.now()}`,
        role: 'tool',
        content: result.success 
          ? `✓ ${tool.name} completed:\n${JSON.stringify(result.data, null, 2)}`
          : `✗ ${tool.name} failed: ${result.error}`,
        timestamp: Date.now(),
      }]);
    }
  };

  // Create plan
  const handleCreatePlan = useCallback(async (goal: string) => {
    const profileManager = getAgentProfileManager();
    const session = profileManager.getActiveSession() || profileManager.createSession(selectedProfileId);
    
    // For now, create a simple plan (would use LLM in production)
    const plan = profileManager.createPlan(session.id, goal, [
      { description: 'Analyze the request', toolName: undefined },
      { description: 'Gather required information', toolName: 'list_images' },
      { description: 'Execute the main task', toolName: undefined },
      { description: 'Verify the result', toolName: undefined },
    ]);

    setCurrentPlan(plan);
  }, [selectedProfileId]);

  // Execute plan step
  const handleExecuteStep = useCallback(async (stepId: string) => {
    if (!currentPlan) return;

    const step = currentPlan.steps.find(s => s.id === stepId);
    if (!step) return;

    const profileManager = getAgentProfileManager();
    const session = profileManager.getActiveSession();
    if (!session) return;

    profileManager.updatePlanStep(session.id, stepId, { status: 'in-progress' });
    setCurrentPlan({ ...currentPlan });

    try {
      let result: unknown;
      
      if (step.toolName) {
        const executor = getToolExecutor();
        const toolResult = await executor.invoke(step.toolName, step.toolParams || {}, {
          agentId: selectedProfileId,
          sessionId: session.id,
        });
        result = toolResult.data;
      } else {
        // Simulate step completion
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = { status: 'completed' };
      }

      profileManager.updatePlanStep(session.id, stepId, { 
        status: 'completed',
        result,
      });
      profileManager.advancePlan(session.id);
      
      setCurrentPlan(session.currentPlan || null);
    } catch (error) {
      profileManager.updatePlanStep(session.id, stepId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setCurrentPlan(session.currentPlan || null);
    }
  }, [currentPlan, selectedProfileId]);

  // Cancel current generation
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
  }, []);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-3">
          <ProfileSelector
            profiles={profiles}
            selectedId={selectedProfileId}
            onSelect={handleProfileChange}
            onManage={onManageProfiles || (() => {})}
          />
          
          {/* Ollama Status */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${ollamaStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-zinc-400">
              {ollamaStatus.connected ? 'Ollama Connected' : 'Ollama Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Tabs */}
          <div className="flex bg-zinc-700 rounded-lg p-0.5">
            {(['chat', 'planning', 'profile'] as AgentViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  viewMode === mode
                    ? 'bg-zinc-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {mode === 'chat' && '💬 Chat'}
                {mode === 'planning' && '📋 Plan'}
                {mode === 'profile' && '👤 Profile'}
              </button>
            ))}
          </div>

          {/* Reasoning Level */}
          <ReasoningLevelSelector
            value={reasoningLevel}
            onChange={setReasoningLevel}
            compact
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-auto p-4">
              {messages.map(msg => (
                <ChatMessageView key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-700">
              {isProcessing && (
                <button
                  onClick={handleCancel}
                  className="mb-2 px-3 py-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  ⏹ Cancel
                </button>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={`Ask ${selectedProfile?.name || 'the assistant'}...`}
                  disabled={isProcessing}
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isProcessing || !input.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
                >
                  {isProcessing ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'planning' && (
          <div className="h-full overflow-auto">
            <PlanningView
              plan={currentPlan}
              onCreatePlan={handleCreatePlan}
              onExecuteStep={handleExecuteStep}
              onCancelPlan={() => setCurrentPlan(null)}
            />
          </div>
        )}

        {viewMode === 'profile' && (
          <div className="h-full overflow-auto">
            <AgentProfileCard
              agentId={selectedProfile?.id}
              onSwitchProfile={(id) => setSelectedProfileId(id)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentChat;
