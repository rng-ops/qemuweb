/**
 * Atlas Iframe App (v2)
 * 
 * Refactored to use the dual-model orchestrator with:
 * - Separate rendering pipelines for chat and thoughts
 * - Background thought stream that runs passively
 * - Context and filter logging in Events panel
 * - Persistent tab state
 * - DOM event forwarding
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  listenFromParent, 
  sendToParent,
  createAtlasMessage,
  type MainToAtlasMessage,
} from '../../services/atlasIframeProtocol';
import { 
  initAtlasPersistence, 
  getAtlasPersistence,
  type ChatMessage,
} from '../../services/atlasPersistence';
import {
  initAtlasOrchestrator,
  getAtlasOrchestrator,
  type AtlasEvent,
  type AtlasEventType,
  type AtlasThought,
  type OrchestratorConfig,
} from '../../services/atlasOrchestrator';
import {
  getContextLogger,
  type ContextLogEntry,
} from '../../services/atlasContextLogger';
import { getDashboardContext } from '../../services/dashboardContext';
import { ExpertPanel } from './ExpertPanel';
import { initExpertNetwork, getExpertNetwork } from '../../services/atlasExpertNetwork';
import { initAgentMatrix } from '../../services/atlasAgentMatrix';
import { initApprovalGates } from '../../services/atlasApprovalGates';
import { initPolicyEngine } from '../../services/atlasPolicyEngine';
import { initBrowserInference } from '../../services/atlasBrowserInference';

// ============ Types ============

type ViewTab = 'chat' | 'thoughts' | 'events' | 'settings';

interface StreamingMessage extends ChatMessage {
  isStreaming?: boolean;
}

// Event categories for filtering
type EventCategory = 'all' | 'context' | 'thought' | 'ui' | 'model' | 'system';

// ============ Constants ============

const TAB_STATE_KEY = 'atlas-current-tab';

// ============ Event Type Styles ============

const EVENT_STYLES: Record<string, { icon: string; color: string }> = {
  'context:passed': { icon: '📦', color: 'text-blue-400' },
  'context:filtered': { icon: '🔍', color: 'text-yellow-400' },
  'thought:observation': { icon: '👁️', color: 'text-purple-400' },
  'thought:inference': { icon: '🧠', color: 'text-indigo-400' },
  'thought:suggestion': { icon: '💡', color: 'text-green-400' },
  'thought:concern': { icon: '⚠️', color: 'text-orange-400' },
  'thought:reflection': { icon: '🔮', color: 'text-pink-400' },
  'chat:start': { icon: '💬', color: 'text-cyan-400' },
  'chat:complete': { icon: '✅', color: 'text-green-400' },
  'ui:action': { icon: '👆', color: 'text-zinc-400' },
  'ui:navigation': { icon: '🧭', color: 'text-blue-300' },
  'model:switch': { icon: '🔄', color: 'text-yellow-300' },
  'error': { icon: '❌', color: 'text-red-400' },
};

// ============ Thought Type Styles ============

const THOUGHT_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  'observation': { icon: '👁️', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  'inference': { icon: '🧠', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  'suggestion': { icon: '💡', color: 'text-green-400', bg: 'bg-green-500/10' },
  'concern': { icon: '⚠️', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  'reflection': { icon: '🔮', color: 'text-pink-400', bg: 'bg-pink-500/10' },
};

// ============ Main Component ============

export const AtlasIframeApp: React.FC = () => {
  // Core state
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Persist tab state
  const [currentTab, setCurrentTab] = useState<ViewTab>(() => {
    try {
      const saved = localStorage.getItem(TAB_STATE_KEY);
      if (saved && ['chat', 'thoughts', 'events', 'settings'].includes(saved)) {
        return saved as ViewTab;
      }
    } catch { /* ignore localStorage errors */ }
    return 'chat';
  });
  
  // Chat state
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Background thoughts (separate stream)
  const [thoughts, setThoughts] = useState<AtlasThought[]>([]);
  const [latestThought, setLatestThought] = useState<AtlasThought | null>(null);
  
  // Events (context logs, UI actions, etc.)
  const [events, setEvents] = useState<AtlasEvent[]>([]);
  const [contextLogs, setContextLogs] = useState<ContextLogEntry[]>([]);
  const [eventFilter, setEventFilter] = useState<EventCategory>('all');
  
  // Config
  const [config, setConfig] = useState<OrchestratorConfig | null>(null);
  
  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const thoughtsScrollRef = useRef<HTMLDivElement>(null);
  const eventsScrollRef = useRef<HTMLDivElement>(null);

  // ============ Tab State Persistence ============

  useEffect(() => {
    localStorage.setItem(TAB_STATE_KEY, currentTab);
  }, [currentTab]);

  // ============ Initialization ============

  useEffect(() => {
    let unsubscribeEvents: (() => void) | null = null;
    let unsubscribeLogs: (() => void) | null = null;
    let unsubscribeParent: (() => void) | null = null;

    const init = async () => {
      try {
        // Initialize persistence
        await initAtlasPersistence();
        const persistence = getAtlasPersistence();
        
        // Load persisted state
        const state = await persistence.loadState();
        if (state) {
          setMessages(state.messages);
          setThoughts(state.thoughts as AtlasThought[]);
          // Load orchestrator events
          if (state.orchestratorEvents) {
            setEvents(state.orchestratorEvents as AtlasEvent[]);
          }
        }
        
        // Initialize orchestrator
        await initAtlasOrchestrator();
        const orchestrator = getAtlasOrchestrator();
        setConfig(orchestrator.getConfig());
        
        // Initialize multi-agent matrix services
        initAgentMatrix();
        initApprovalGates();
        initPolicyEngine();
        initBrowserInference();
        initExpertNetwork();  // Initialize expert network with configurable endpoints
        
        // Connect orchestrator to agent matrix
        orchestrator.initAgentMatrix();
        
        // Subscribe to orchestrator events
        unsubscribeEvents = orchestrator.onEvent((event) => {
          // Add to events list
          setEvents(prev => [...prev, event].slice(-200));
          
          // Save to persistence
          persistence.saveOrchestratorEvent({
            id: event.id,
            timestamp: event.timestamp,
            type: event.type,
            source: event.source,
            data: event.data,
          });
          
          // Handle thought events specially
          if (event.type.startsWith('thought:')) {
            const thought = event.data.thought as AtlasThought;
            if (thought) {
              setThoughts(prev => [...prev, thought].slice(-100));
              setLatestThought(thought);
              persistence.saveThought(thought);
            }
          }
          
          // Handle context events
          if (event.type.startsWith('context:')) {
            getContextLogger().info('context', event.type, event.data);
          }
          
          // Evaluate policies on events
          orchestrator.evaluatePolicies(event).catch(console.error);
        });
        
        // Subscribe to context logs
        const logger = getContextLogger();
        unsubscribeLogs = logger.onLog((log) => {
          setContextLogs(prev => [...prev, log].slice(-500));
        });
        
        // Listen for parent messages
        unsubscribeParent = listenFromParent(handleParentMessage);
        
        setIsInitialized(true);
        sendToParent(createAtlasMessage.ready());
        
      } catch (err) {
        console.error('[AtlasIframe] Init failed:', err);
        setError(err instanceof Error ? err.message : 'Initialization failed');
      }
    };

    init();

    return () => {
      unsubscribeEvents?.();
      unsubscribeLogs?.();
      unsubscribeParent?.();
    };
  }, []);

  // ============ Parent Message Handler ============

  const handleParentMessage = useCallback((message: MainToAtlasMessage) => {
    const orchestrator = getAtlasOrchestrator();
    const logger = getContextLogger();
    
    switch (message.type) {
      case 'main:route-change':
        orchestrator.trackNavigation(message.payload.path);
        logger.logNavigation(undefined, message.payload.path);
        break;
        
      case 'main:dom-event':
        orchestrator.trackUIAction(
          message.payload.eventType,
          message.payload.target?.tagName,
          message.payload.details
        );
        logger.logUIAction(
          message.payload.eventType,
          message.payload.target?.tagName
        );
        break;
        
      case 'main:a11y-event':
        // Forward to events
        setEvents(prev => [...prev, {
          id: message.payload.id,
          timestamp: message.payload.timestamp,
          type: 'ui:action' as AtlasEventType,
          source: 'ui' as const,
          data: message.payload as unknown as Record<string, unknown>,
        }].slice(-200));
        break;
        
      case 'main:file-open':
        logger.info('context', 'File opened', message.payload as unknown as Record<string, unknown>);
        setEvents(prev => [...prev, {
          id: `file-open-${Date.now()}`,
          timestamp: message.payload.timestamp,
          type: 'context:passed' as AtlasEventType,
          source: 'system' as const,
          data: { action: 'file-open', ...message.payload },
        }].slice(-200));
        break;
        
      case 'main:file-save':
        logger.info('context', 'File saved', message.payload as unknown as Record<string, unknown>);
        setEvents(prev => [...prev, {
          id: `file-save-${Date.now()}`,
          timestamp: message.payload.timestamp,
          type: 'context:passed' as AtlasEventType,
          source: 'system' as const,
          data: { action: 'file-save', ...message.payload },
        }].slice(-200));
        break;
        
      case 'main:file-update':
        logger.debug('context', 'File updated', message.payload as unknown as Record<string, unknown>);
        break;
        
      case 'main:file-diff':
        logger.info('context', 'File diff generated', {
          fileName: message.payload.fileName,
          additions: message.payload.additions,
          deletions: message.payload.deletions,
        });
        setEvents(prev => [...prev, {
          id: `file-diff-${Date.now()}`,
          timestamp: message.payload.timestamp,
          type: 'context:passed' as AtlasEventType,
          source: 'system' as const,
          data: { action: 'file-diff', ...message.payload },
        }].slice(-200));
        break;
        
      case 'main:terminal-command':
        logger.info('context', 'Terminal command', message.payload as unknown as Record<string, unknown>);
        setEvents(prev => [...prev, {
          id: `term-cmd-${message.payload.sessionId}`,
          timestamp: message.payload.timestamp,
          type: 'context:passed' as AtlasEventType,
          source: 'system' as const,
          data: { action: 'terminal-command', ...message.payload },
        }].slice(-200));
        break;
        
      case 'main:terminal-output':
        if (message.payload.isComplete) {
          logger.debug('context', 'Terminal command completed', {
            sessionId: message.payload.sessionId,
            exitCode: message.payload.exitCode,
          });
        }
        break;
        
      case 'main:dashboard-context':
        // Store dashboard context for the orchestrator
        const dashCtx = getDashboardContext();
        console.log('[AtlasIframeAppV2] Received dashboard context:', message.payload);
        dashCtx.setServices(message.payload.services);
        dashCtx.setImages(message.payload.images);
        dashCtx.setCurrentView(message.payload.currentView);
        logger.info('context', 'Dashboard context updated', {
          services: message.payload.services.length,
          images: message.payload.images.length,
          currentView: message.payload.currentView,
        });
        setEvents(prev => [...prev, {
          id: `dashboard-ctx-${Date.now()}`,
          timestamp: message.payload.timestamp,
          type: 'context:passed' as AtlasEventType,
          source: 'system' as const,
          data: { 
            action: 'dashboard-context',
            services: message.payload.services.map((s: { name: string; status: string }) => s.name),
            images: message.payload.images.map((i: { name: string }) => i.name),
            currentView: message.payload.currentView,
          },
        }].slice(-200));
        break;
    }
  }, []);

  // ============ Chat Handler ============

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: StreamingMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    
    // Persist user message
    getAtlasPersistence().saveMessage(userMessage);
    
    // Trigger expert analysis on user message
    const expertNetwork = getExpertNetwork();
    expertNetwork.onUserMessage(userMessage.content).catch(err => {
      console.error('[AtlasIframe] Expert analysis error:', err);
    });
    
    const assistantMessage: StreamingMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, assistantMessage]);
    
    try {
      const orchestrator = getAtlasOrchestrator();
      const stream = orchestrator.chat(userMessage.content);
      
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.isStreaming) {
            last.content = fullContent;
          }
          return updated;
        });
      }
      
      // Finalize message
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.isStreaming) {
          last.isStreaming = false;
          getAtlasPersistence().saveMessage({
            id: last.id,
            role: 'assistant',
            content: last.content,
            timestamp: last.timestamp,
          });
          
          // Trigger expert analysis on assistant response
          expertNetwork.onAssistantResponse(last.content).catch(err => {
            console.error('[AtlasIframe] Expert analysis error:', err);
          });
        }
        return updated;
      });
      
    } catch (err) {
      console.error('[AtlasIframe] Chat error:', err);
      setError(err instanceof Error ? err.message : 'Chat failed');
      // Remove streaming message
      setMessages(prev => prev.filter(m => !m.isStreaming));
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading]);

  // ============ Key Handler ============

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ============ Auto-scroll ============

  useEffect(() => {
    if (chatScrollRef.current && currentTab === 'chat') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, currentTab]);

  useEffect(() => {
    if (thoughtsScrollRef.current && currentTab === 'thoughts') {
      thoughtsScrollRef.current.scrollTop = thoughtsScrollRef.current.scrollHeight;
    }
  }, [thoughts, currentTab]);

  useEffect(() => {
    if (eventsScrollRef.current && currentTab === 'events') {
      eventsScrollRef.current.scrollTop = eventsScrollRef.current.scrollHeight;
    }
  }, [events, contextLogs, currentTab]);

  // ============ Filtered Events ============

  const filteredEvents = useMemo(() => {
    const allEvents = [...events];
    
    // Also include context logs as events
    for (const log of contextLogs) {
      allEvents.push({
        id: log.id,
        timestamp: log.timestamp,
        type: `context:${log.category}` as AtlasEvent['type'],
        source: 'system',
        data: { message: log.message, ...log.data },
      });
    }
    
    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    // Filter by category
    if (eventFilter === 'all') {
      return allEvents.slice(-100);
    }
    
    return allEvents.filter(e => {
      switch (eventFilter) {
        case 'context': return e.type.startsWith('context:');
        case 'thought': return e.type.startsWith('thought:');
        case 'ui': return e.type.startsWith('ui:');
        case 'model': return e.type.startsWith('model:') || e.type.startsWith('chat:');
        case 'system': return e.source === 'system';
        default: return true;
      }
    }).slice(-100);
  }, [events, contextLogs, eventFilter]);

  // ============ Clear handlers ============

  const handleClearChat = useCallback(async () => {
    setMessages([]);
    await getAtlasPersistence().clearCurrentSession();
  }, []);

  const handleClearEvents = useCallback(() => {
    setEvents([]);
    setContextLogs([]);
    getContextLogger().clear();
  }, []);

  // ============ Render ============

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Initializing Atlas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      {/* Tab Bar with thought indicator */}
      <div className="flex-shrink-0 border-b border-zinc-700 p-2">
        <div className="flex gap-1" role="tablist">
          <button
            role="tab"
            aria-selected={currentTab === 'chat'}
            onClick={() => setCurrentTab('chat')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              currentTab === 'chat'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            💬 Chat
          </button>
          <button
            role="tab"
            aria-selected={currentTab === 'thoughts'}
            onClick={() => setCurrentTab('thoughts')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors relative ${
              currentTab === 'thoughts'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            🧠 Thoughts
            {thoughts.length > 0 && currentTab !== 'thoughts' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full text-[10px] flex items-center justify-center">
                {thoughts.length > 9 ? '9+' : thoughts.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={currentTab === 'events'}
            onClick={() => setCurrentTab('events')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              currentTab === 'events'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            📡 Events
          </button>
          <button
            role="tab"
            aria-selected={currentTab === 'settings'}
            onClick={() => setCurrentTab('settings')}
            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              currentTab === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            ⚙️
          </button>
        </div>
        
        {/* Latest thought indicator (shows regardless of tab) */}
        {latestThought && currentTab !== 'thoughts' && (
          <div 
            className="mt-2 p-2 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs cursor-pointer hover:bg-zinc-700/50"
            onClick={() => setCurrentTab('thoughts')}
          >
            <div className="flex items-center gap-2">
              <span>{THOUGHT_STYLES[latestThought.type]?.icon || '💭'}</span>
              <span className="text-zinc-400 truncate">{latestThought.content}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Chat Tab */}
        {currentTab === 'chat' && (
          <div className="flex flex-col h-full">
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-zinc-500 max-w-xs">
                    <span className="text-4xl block mb-3">🌐</span>
                    <p className="text-sm">Chat with Atlas in plain English.</p>
                    <p className="text-xs mt-2 text-zinc-600">
                      Background thoughts run passively in the Thoughts tab.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600/20 border border-indigo-500/30 ml-8'
                        : 'bg-zinc-800 border border-zinc-700 mr-8'
                    }`}
                  >
                    <div className="text-zinc-200 whitespace-pre-wrap">
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-1" />
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && (
              <div className="mx-3 mb-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="hover:text-red-200">✕</button>
              </div>
            )}

            {/* Context Visibility - Show recent events being passed to model */}
            {events.length > 0 && (
              <div className="mx-3 mb-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                    Context ({events.slice(-5).length} recent)
                  </span>
                  <button
                    onClick={() => setCurrentTab('events')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    View All →
                  </button>
                </div>
                <div className="p-2 space-y-1 max-h-24 overflow-y-auto">
                  {events.slice(-5).reverse().map((event) => {
                    const eventData = event.data as { action?: string; fileName?: string; command?: string; services?: string[]; images?: string[] };
                    return (
                      <div key={event.id} className="text-[10px] text-zinc-400 flex items-start gap-1.5">
                        <span className="text-zinc-600">{event.source === 'system' ? '📄' : '🔧'}</span>
                        <span className="flex-1 truncate">
                          {eventData.action === 'file-open' && `Opened: ${eventData.fileName}`}
                          {eventData.action === 'file-save' && `Saved: ${eventData.fileName}`}
                          {eventData.action === 'file-diff' && `Modified: ${eventData.fileName}`}
                          {eventData.action === 'terminal-command' && `$ ${eventData.command}`}
                          {eventData.action === 'dashboard-context' && `Dashboard: ${eventData.services?.length ?? 0} services, ${eventData.images?.length ?? 0} images`}
                          {!eventData.action && event.type}
                        </span>
                        <span className="text-zinc-600">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-shrink-0 border-t border-zinc-700 p-3">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Chat with Atlas..."
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 resize-none focus:outline-none focus:border-indigo-500"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors"
                >
                  {isLoading ? '...' : '↑'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Thoughts Tab - Now uses Expert Panel (Mixture of Experts) */}
        {currentTab === 'thoughts' && (
          <ExpertPanel />
        )}

        {/* Events Tab */}
        {currentTab === 'events' && (
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 p-2 border-b border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">{filteredEvents.length} events</span>
                <button
                  onClick={handleClearEvents}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Clear
                </button>
              </div>
              <div className="flex gap-1">
                {(['all', 'context', 'thought', 'ui', 'model'] as EventCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setEventFilter(cat)}
                    className={`px-2 py-1 rounded text-[10px] font-medium ${
                      eventFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div ref={eventsScrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredEvents.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                  No events captured...
                </div>
              ) : (
                filteredEvents.map((event) => {
                  const style = EVENT_STYLES[event.type] || { icon: '📌', color: 'text-zinc-400' };
                  return (
                    <div
                      key={event.id}
                      className="p-2 bg-zinc-800/30 border border-zinc-700/30 rounded text-xs group"
                    >
                      <div className="flex items-center gap-2">
                        <span>{style.icon}</span>
                        <span className={`font-mono ${style.color}`}>{event.type}</span>
                        <span className="text-zinc-600 ml-auto">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {event.data && Object.keys(event.data).length > 0 && (
                        <div className="mt-1 text-zinc-500 text-[10px] font-mono overflow-hidden group-hover:max-h-40 max-h-6 transition-all">
                          {JSON.stringify(event.data, null, 2).slice(0, 200)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {currentTab === 'settings' && (
          <div className="h-full overflow-y-auto p-3 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Chat Model</h3>
              <input
                type="text"
                value={config?.chatModel.name ?? ''}
                onChange={(e) => {
                  const orchestrator = getAtlasOrchestrator();
                  orchestrator.updateConfig({
                    chatModel: { ...config!.chatModel, name: e.target.value }
                  });
                  setConfig(orchestrator.getConfig());
                }}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200"
                placeholder="e.g., qwen2.5:3b"
              />
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Observer Model</h3>
              <input
                type="text"
                value={config?.observerModel.name ?? ''}
                onChange={(e) => {
                  const orchestrator = getAtlasOrchestrator();
                  orchestrator.updateConfig({
                    observerModel: { ...config!.observerModel, name: e.target.value }
                  });
                  setConfig(orchestrator.getConfig());
                }}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200"
                placeholder="e.g., qwen2.5:0.5b"
              />
              <label className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={config?.observerModel.enabled ?? true}
                  onChange={(e) => {
                    const orchestrator = getAtlasOrchestrator();
                    orchestrator.updateConfig({
                      observerModel: { ...config!.observerModel, enabled: e.target.checked }
                    });
                    setConfig(orchestrator.getConfig());
                  }}
                  className="rounded bg-zinc-700"
                />
                Enable background thoughts
              </label>
            </div>

            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Thought Interval</h3>
              <select
                value={config?.thoughtInterval ?? 10000}
                onChange={(e) => {
                  const orchestrator = getAtlasOrchestrator();
                  orchestrator.updateConfig({ thoughtInterval: parseInt(e.target.value) });
                  setConfig(orchestrator.getConfig());
                }}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200"
              >
                <option value="5000">5 seconds</option>
                <option value="10000">10 seconds</option>
                <option value="30000">30 seconds</option>
                <option value="60000">1 minute</option>
              </select>
            </div>
            
            <div className="pt-4 border-t border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Actions</h3>
              <button
                onClick={handleClearChat}
                className="w-full px-3 py-2 bg-red-600/20 border border-red-500/30 rounded text-red-400 text-sm hover:bg-red-600/30"
              >
                Clear Chat History
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtlasIframeApp;
