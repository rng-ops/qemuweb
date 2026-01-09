/**
 * Persistent Assistant Panel
 * 
 * A collapsible chat interface that persists across all tabs/views.
 * Features:
 * - Always loaded in background
 * - Multiple view modes: expanded, collapsed, summary
 * - Tab system: Chat, Audit Log, Tools
 * - Integration with approval workflow
 * - Event tracking summary view
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuditLogViewer } from '../audit/AuditLogViewer';
import { InlineApproval, useApprovalWorkflow } from '../approval/ApprovalWorkflow';
import { getAllTools, getToolExecutor, ToolDefinition } from '../../services/agentTools';
import { getAuditLog } from '../../services/auditLog';
import { getEventTracker } from '../../services/eventTracker';

// ============ Types ============

type AssistantMode = 'expanded' | 'collapsed' | 'summary';
type AssistantTab = 'chat' | 'audit' | 'tools';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    toolCalls?: { name: string; params: Record<string, unknown> }[];
    approvalPending?: boolean;
  };
}

interface EventSummary {
  recentActions: number;
  pendingApprovals: number;
  errors: number;
  lastActivity: number | null;
}

// ============ Chat Message Component ============

interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessageView: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div 
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : isSystem
            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
            : 'bg-zinc-700 text-zinc-200'
        }`}
      >
        {isSystem && <span className="text-xs opacity-70 block mb-1">System</span>}
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        <div className="text-xs opacity-50 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

// ============ Tools Panel ============

interface ToolsPanelProps {
  onInvokeTool: (tool: ToolDefinition) => void;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ onInvokeTool }) => {
  const tools = getAllTools();
  const [filter, setFilter] = useState('');

  const filteredTools = tools.filter((t: ToolDefinition) => 
    t.name.includes(filter.toLowerCase()) || 
    t.description.toLowerCase().includes(filter.toLowerCase())
  );

  const groupedTools = filteredTools.reduce<Record<string, ToolDefinition[]>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {});

  const riskColors: Record<string, string> = {
    safe: 'text-green-400',
    low: 'text-blue-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-zinc-700">
        <input
          type="text"
          placeholder="Search tools..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-300 placeholder-zinc-500"
        />
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-4">
        {Object.entries(groupedTools).map(([category, categoryTools]) => (
          <div key={category}>
            <div className="text-xs font-medium text-zinc-500 uppercase mb-2">{category}</div>
            <div className="space-y-1">
              {(categoryTools as ToolDefinition[]).map((tool: ToolDefinition) => (
                <button
                  key={tool.name}
                  onClick={() => onInvokeTool(tool)}
                  className="w-full text-left p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 font-mono">{tool.name}</span>
                    <span className={`text-xs ${riskColors[tool.riskLevel] || 'text-gray-400'}`}>
                      {tool.riskLevel}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{tool.description}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ Summary View ============

interface SummaryViewProps {
  summary: EventSummary;
  onExpand: () => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ summary, onExpand }) => {
  return (
    <div 
      className="flex items-center gap-3 px-3 py-2 bg-zinc-800 cursor-pointer hover:bg-zinc-700 transition-colors"
      onClick={onExpand}
    >
      <span className="text-lg">🤖</span>
      <div className="flex-1 flex items-center gap-4 text-xs">
        {summary.pendingApprovals > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            {summary.pendingApprovals} pending
          </span>
        )}
        {summary.errors > 0 && (
          <span className="text-red-400">
            ❌ {summary.errors} errors
          </span>
        )}
        {summary.recentActions > 0 && (
          <span className="text-zinc-400">
            📊 {summary.recentActions} recent
          </span>
        )}
        {summary.lastActivity && (
          <span className="text-zinc-500">
            Last: {new Date(summary.lastActivity).toLocaleTimeString()}
          </span>
        )}
      </div>
      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    </div>
  );
};

// ============ Main Assistant Panel ============

interface PersistentAssistantProps {
  className?: string;
  defaultMode?: AssistantMode;
}

export const PersistentAssistant: React.FC<PersistentAssistantProps> = ({ 
  className = '',
  defaultMode = 'collapsed',
}) => {
  const [mode, setMode] = useState<AssistantMode>(defaultMode);
  const [activeTab, setActiveTab] = useState<AssistantTab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<EventSummary>({
    recentActions: 0,
    pendingApprovals: 0,
    errors: 0,
    lastActivity: null,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { inlineApprovals, handleApprove, handleReject } = useApprovalWorkflow();

  // Load initial messages and set up event tracking
  useEffect(() => {
    const loadInitialData = async () => {
      // Add welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I\'m your assistant. I can help you manage containers, images, and navigate the application. How can I help you today?',
        timestamp: Date.now(),
      }]);

      // Track initial state
      await updateSummary();
    };

    loadInitialData();
  }, []);

  // Update summary periodically
  useEffect(() => {
    const updateInterval = setInterval(updateSummary, 5000);
    return () => clearInterval(updateInterval);
  }, []);

  const updateSummary = async () => {
    try {
      const executor = getToolExecutor();
      const auditLog = await getAuditLog();
      const stats = await auditLog.getStats();
      
      const recentEntries = await auditLog.query({
        startTime: Date.now() - 3600000, // Last hour
      });

      setSummary({
        recentActions: recentEntries.length,
        pendingApprovals: executor.getPendingApprovals().length,
        errors: stats.entriesByType.error,
        lastActivity: stats.lastEntry || null,
      });
    } catch (error) {
      console.error('[Assistant] Failed to update summary:', error);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for notifications from agent
  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      const { message, type } = event.detail;
      setMessages(prev => [...prev, {
        id: `notif-${Date.now()}`,
        role: 'system',
        content: `[${type.toUpperCase()}] ${message}`,
        timestamp: Date.now(),
      }]);
    };

    window.addEventListener('agent:notification', handleNotification as EventListener);
    return () => window.removeEventListener('agent:notification', handleNotification as EventListener);
  }, []);

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

    // Log to audit
    const auditLog = await getAuditLog();
    await auditLog.logAgentMessage('user', userMessage.content);

    // Track event
    const tracker = await getEventTracker();
    tracker.trackAgentRequest(userMessage.content, {});

    // Simulate assistant response (in real impl would call LLM)
    setTimeout(async () => {
      const response = await generateResponse(userMessage.content);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      await auditLog.logAgentMessage('assistant', response);
      setIsProcessing(false);
    }, 1000);
  }, [input, isProcessing]);

  const handleToolInvoke = useCallback(async (tool: ToolDefinition) => {
    const systemMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      role: 'system',
      content: `Invoking tool: ${tool.name}`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, systemMessage]);

    const executor = getToolExecutor();
    const result = await executor.invoke(tool.name, {}, {
      agentId: 'assistant',
      sessionId: 'current',
    });

    if (result.requiresApproval) {
      setMessages(prev => [...prev, {
        id: `approval-${Date.now()}`,
        role: 'system',
        content: `⚠️ This action requires approval. Please review the request.`,
        timestamp: Date.now(),
        metadata: { approvalPending: true },
      }]);
    } else {
      setMessages(prev => [...prev, {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: result.success 
          ? `✓ Tool executed successfully:\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``
          : `✕ Tool failed: ${result.error}`,
        timestamp: Date.now(),
      }]);
    }
  }, []);

  // Simple response generator (placeholder for LLM)
  const generateResponse = async (userInput: string): Promise<string> => {
    const input = userInput.toLowerCase();
    
    if (input.includes('list') && input.includes('image')) {
      const executor = getToolExecutor();
      const result = await executor.invoke('list_images', {}, {
        agentId: 'assistant',
        sessionId: 'current',
      });
      if (result.success && Array.isArray(result.data)) {
        return `Here are the available images:\n${(result.data as unknown[]).map((img: unknown) => {
          const i = img as { name: string; tag: string; size: number };
          return `• ${i.name}:${i.tag} (${(i.size / 1000000).toFixed(1)} MB)`;
        }).join('\n')}`;
      }
    }
    
    if (input.includes('help')) {
      return `I can help you with:\n• **Images**: List, pull, inspect, or delete container images\n• **Containers**: Create, start, stop containers\n• **Navigation**: Move between different views\n• **Audit**: View the audit log of all actions\n\nJust ask me what you'd like to do!`;
    }

    if (input.includes('audit') || input.includes('log')) {
      setActiveTab('audit');
      return 'I\'ve opened the Audit Log tab for you. You can see all recorded actions there.';
    }

    return 'I understand you want to: ' + userInput + '\n\nLet me help you with that. You can use the Tools tab to see all available actions, or just describe what you need in plain language.';
  };

  // Render based on mode
  if (mode === 'summary') {
    return (
      <div className={`border-t border-zinc-700 ${className}`}>
        <SummaryView summary={summary} onExpand={() => setMode('expanded')} />
      </div>
    );
  }

  if (mode === 'collapsed') {
    return (
      <div className={`border-t border-zinc-700 ${className}`}>
        <button
          onClick={() => setMode('expanded')}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">🤖</span>
            <span className="text-sm font-medium text-zinc-300">Assistant</span>
            {summary.pendingApprovals > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                {summary.pendingApprovals} pending
              </span>
            )}
          </div>
          <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // Expanded mode
  return (
    <div className={`flex flex-col bg-zinc-900 border-t border-zinc-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-lg">🤖</span>
          <span className="font-medium text-zinc-200">Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('summary')}
            className="p-1.5 text-zinc-400 hover:text-zinc-300 transition-colors"
            title="Summary view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          <button
            onClick={() => setMode('collapsed')}
            className="p-1.5 text-zinc-400 hover:text-zinc-300 transition-colors"
            title="Collapse"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        {(['chat', 'audit', 'tools'] as AssistantTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {tab === 'chat' && '💬 Chat'}
            {tab === 'audit' && '📋 Audit'}
            {tab === 'tools' && '🔧 Tools'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-auto p-4">
              {messages.map(msg => (
                <ChatMessageView key={msg.id} message={msg} />
              ))}
              
              {/* Inline approvals */}
              {inlineApprovals.map(({ request }) => (
                <div key={request.id} className="mb-3">
                  <InlineApproval
                    request={request}
                    onApprove={() => handleApprove(request.id)}
                    onReject={(reason) => handleReject(request.id, reason)}
                  />
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start mb-3">
                  <div className="bg-zinc-700 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span className="animate-pulse">●</span>
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-zinc-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask me anything..."
                  disabled={isProcessing}
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isProcessing || !input.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <AuditLogViewer className="h-full" />
        )}

        {activeTab === 'tools' && (
          <ToolsPanel onInvokeTool={handleToolInvoke} />
        )}
      </div>
    </div>
  );
};

export default PersistentAssistant;
