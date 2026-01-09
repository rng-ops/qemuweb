/**
 * Atlas Iframe App
 * 
 * The main component running inside the Atlas iframe.
 * Handles:
 * - PostMessage communication with parent window
 * - State persistence via IndexedDB
 * - Bridging between parent events and Atlas agent
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  getAtlasAgent, 
  type AtlasThought, 
  type AtlasConfig,
  type ThinkingMode,
  type ReasoningDepth,
} from '../../services/atlasAgent';
import {
  type A11yEvent,
  type A11yEventBatch,
  type A11yObserverConfig,
  DEFAULT_A11Y_CONFIG,
} from '../../services/accessibilityEvents';
import {
  getExpertNetwork,
  initExpertNetwork,
} from '../../services/atlasExpertNetwork';

// ============ Types ============

type ViewTab = 'chat' | 'thoughts' | 'events' | 'settings';

// ============ Main Component ============

export const AtlasIframeApp: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thoughts, setThoughts] = useState<AtlasThought[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<ViewTab>('chat');
  const [config, setConfig] = useState<AtlasConfig | null>(null);
  
  // A11y events state
  const [a11yEvents, setA11yEvents] = useState<A11yEvent[]>([]);
  const [_a11yBatches, setA11yBatches] = useState<A11yEventBatch[]>([]);
  const [_a11yConfig, setA11yConfig] = useState<A11yObserverConfig>(DEFAULT_A11Y_CONFIG);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const persistenceInitialized = useRef(false);

  // ============ Initialization ============

  useEffect(() => {
    let unsubscribeParent: (() => void) | null = null;
    let unsubscribeThought: (() => void) | null = null;
    
    const init = async () => {
      try {
        // Initialize persistence
        if (!persistenceInitialized.current) {
          await initAtlasPersistence();
          persistenceInitialized.current = true;
        }
        
        const persistence = getAtlasPersistence();
        
        // Load persisted state
        const state = await persistence.loadState();
        if (state) {
          setMessages(state.messages);
          setThoughts(state.thoughts);
          setA11yEvents(state.events);
          setA11yBatches(state.eventBatches);
          if (state.a11yConfig) {
            setA11yConfig({ ...DEFAULT_A11Y_CONFIG, ...state.a11yConfig });
          }
        }
        
        // Initialize Atlas agent
        const agent = await getAtlasAgent();
        setConfig(agent.getConfig());
        
        // Initialize Expert Network for panel debates
        const expertNetwork = initExpertNetwork();
        
        // Register available resources for expert discussions
        expertNetwork.registerResources({
          tools: [
            { type: 'tool', id: 'qemu-vm', name: 'QEMU VM', description: 'Run virtual machines in browser', availability: 'available' },
            { type: 'tool', id: 'terminal', name: 'Terminal', description: 'Execute shell commands', availability: 'available' },
            { type: 'tool', id: 'file-browser', name: 'File Browser', description: 'Browse and manage files', availability: 'available' },
          ],
          endpoints: [
            { type: 'endpoint', id: 'ollama-local', name: 'Ollama Local', description: 'Local LLM inference', availability: 'available' },
          ],
          dataSources: [
            { type: 'data-source', id: 'chat-history', name: 'Chat History', description: 'Previous conversation context', availability: 'available' },
            { type: 'data-source', id: 'vm-state', name: 'VM State', description: 'Current VM status and metrics', availability: 'available' },
          ],
          services: [
            { type: 'service', id: 'atlas-agent', name: 'Atlas Agent', description: 'Main AI assistant', availability: 'available' },
            { type: 'service', id: 'matrix-bridge', name: 'Matrix Bridge', description: 'Expert communication logs', availability: 'available' },
          ],
        });
        
        // Subscribe to thoughts
        unsubscribeThought = agent.onThought((thought) => {
          setThoughts(prev => {
            const updated = [...prev, thought];
            // Persist thought
            persistence.saveThought(thought);
            return updated;
          });
        });
        
        // Listen for messages from parent
        unsubscribeParent = listenFromParent(handleParentMessage);
        
        setIsInitialized(true);
        
        // Notify parent that iframe is ready
        sendToParent(createAtlasMessage.ready());
        
      } catch (err) {
        console.error('[AtlasIframe] Initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        sendToParent(createAtlasMessage.error(
          err instanceof Error ? err.message : 'Initialization failed',
          'init'
        ));
      }
    };
    
    init();
    
    return () => {
      if (unsubscribeParent) unsubscribeParent();
      if (unsubscribeThought) unsubscribeThought();
    };
  }, []);

  // ============ Parent Message Handler ============

  const handleParentMessage = useCallback((message: MainToAtlasMessage) => {
    switch (message.type) {
      case 'main:init-state':
        // Parent is providing initial state (we may have already loaded from IndexedDB)
        if (message.payload && messages.length === 0) {
          setMessages(message.payload.messages);
          setThoughts(message.payload.thoughts);
          setA11yEvents(message.payload.events);
          setA11yBatches(message.payload.eventBatches);
        }
        break;
        
      case 'main:route-change':
        // Log route change as an event
        handleRouteChange(message.payload);
        break;
        
      case 'main:dom-event':
        // Convert DOM event to A11y event if relevant
        // This allows parent to forward important DOM observations
        break;
        
      case 'main:a11y-event':
        // Parent is forwarding an A11y event
        setA11yEvents(prev => [...prev, message.payload].slice(-200));
        getAtlasPersistence().saveEvent(message.payload);
        break;
        
      case 'main:a11y-batch':
        setA11yBatches(prev => [...prev, message.payload].slice(-50));
        getAtlasPersistence().saveEventBatch(message.payload);
        break;
        
      case 'main:a11y-config':
        setA11yConfig(prev => ({ ...prev, ...message.payload }));
        getAtlasPersistence().saveA11yConfig(message.payload);
        break;
        
      case 'main:settings-update':
        handleUpdateConfig(message.payload);
        break;
        
      case 'main:request-state':
        // Parent is requesting current state
        sendCurrentState();
        break;
        
      case 'main:clear-state':
        handleClearState();
        break;
    }
  }, [messages.length]);

  // ============ Route Change Handler ============

  const handleRouteChange = useCallback((payload: { path: string; search: string; hash: string }) => {
    const event: A11yEvent = {
      id: `route-${Date.now()}`,
      type: 'page-load',
      priority: 'medium',
      timestamp: Date.now(),
      element: {
        tagName: 'LOCATION',
      },
      details: {
        description: `Navigated to ${payload.path}`,
        newValue: `${payload.path}${payload.search}${payload.hash}`,
      },
      a11y: {},
    };
    
    setA11yEvents(prev => [...prev, event].slice(-200));
    getAtlasPersistence().saveEvent(event);
  }, []);

  // ============ State Sync ============

  const sendCurrentState = useCallback(async () => {
    const persistence = getAtlasPersistence();
    const state = await persistence.loadState();
    
    if (state) {
      sendToParent(createAtlasMessage.saveState(state));
    }
    
    sendToParent(createAtlasMessage.stateUpdate({
      messageCount: messages.length,
      thoughtCount: thoughts.length,
      eventCount: a11yEvents.length,
      currentTab,
      isTyping: isLoading,
    }));
  }, [messages.length, thoughts.length, a11yEvents.length, currentTab, isLoading]);

  // ============ Config Updates ============

  const handleUpdateConfig = useCallback(async (updates: Partial<AtlasConfig>) => {
    try {
      const agent = await getAtlasAgent();
      await agent.updateConfig(updates);
      setConfig(agent.getConfig());
      getAtlasPersistence().saveConfig(updates);
    } catch (err) {
      console.error('[AtlasIframe] Failed to update config:', err);
    }
  }, []);

  // ============ Clear State ============

  const handleClearState = useCallback(async () => {
    try {
      await getAtlasPersistence().clearCurrentSession();
      setMessages([]);
      setThoughts([]);
      setA11yEvents([]);
      setA11yBatches([]);
    } catch (err) {
      console.error('[AtlasIframe] Failed to clear state:', err);
    }
  }, []);

  // ============ Send Message ============

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    // Persist user message
    getAtlasPersistence().saveMessage(userMessage);
    
    // Trigger expert debate on user message
    const expertNetwork = getExpertNetwork();
    expertNetwork.onUserMessage(userMessage.content).catch(err => {
      console.error('[AtlasIframe] Expert debate error:', err);
    });
    
    // Notify parent of state change
    sendToParent(createAtlasMessage.stateUpdate({
      isTyping: true,
      messageCount: messages.length + 1,
    }));
    
    try {
      const agent = await getAtlasAgent();
      const stream = await agent.chat(userMessage.content);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = fullContent;
          }
          return updated;
        });
      }
      
      // Persist assistant message
      assistantMessage.content = fullContent;
      getAtlasPersistence().saveMessage(assistantMessage);
      
      // Trigger expert reactions to assistant response
      expertNetwork.onAssistantResponse(fullContent).catch(err => {
        console.error('[AtlasIframe] Expert reaction error:', err);
      });
      
      // Announce completion
      sendToParent(createAtlasMessage.announce('Atlas has responded'));
      
    } catch (err) {
      console.error('[AtlasIframe] Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Remove incomplete message
      setMessages(prev => prev.filter(m => m.id !== `assistant-${Date.now()}`));
      
      sendToParent(createAtlasMessage.error(
        err instanceof Error ? err.message : 'Chat failed',
        'chat'
      ));
    } finally {
      setIsLoading(false);
      sendToParent(createAtlasMessage.stateUpdate({
        isTyping: false,
        messageCount: messages.length + 2,
      }));
    }
  }, [inputValue, isLoading, messages.length]);

  // ============ Key Handler ============

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ============ Auto-scroll ============

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ============ Request Focus ============

  const handleRequestFocus = useCallback(() => {
    sendToParent(createAtlasMessage.requestFocus());
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
    <div 
      className="flex flex-col h-screen bg-zinc-900"
      onClick={handleRequestFocus}
    >
      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-zinc-700 p-2">
        <div className="flex gap-1" role="tablist">
          {(['chat', 'thoughts', 'events', 'settings'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={currentTab === tab}
              onClick={() => setCurrentTab(tab)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                currentTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {tab === 'chat' && '💬'}
              {tab === 'thoughts' && `🧠 ${thoughts.length > 0 ? `(${thoughts.length})` : ''}`}
              {tab === 'events' && `📡 ${a11yEvents.length > 0 ? `(${a11yEvents.length})` : ''}`}
              {tab === 'settings' && '⚙️'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-zinc-500 max-w-xs">
                    <span className="text-4xl block mb-3">🌐</span>
                    <p className="text-sm">Ask Atlas anything...</p>
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
                    <div className="text-zinc-200 whitespace-pre-wrap">{msg.content}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>Atlas is thinking...</span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-3 mb-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-xs">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 text-red-400 hover:text-red-200"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input */}
            <div className="flex-shrink-0 border-t border-zinc-700 p-3">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask Atlas..."
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 resize-none focus:outline-none focus:border-indigo-500"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors"
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'thoughts' && (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {thoughts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                No thoughts yet...
              </div>
            ) : (
              thoughts.map((thought) => (
                <div
                  key={thought.id}
                  className="p-2 bg-zinc-800 border border-zinc-700 rounded text-xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-indigo-400">{thought.type}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500">
                      {new Date(thought.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-zinc-300">{thought.content}</div>
                  {thought.reasoning && (
                    <div className="mt-1 text-zinc-500 italic">{thought.reasoning}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {currentTab === 'events' && (
          <div className="h-full overflow-y-auto p-3 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400">{a11yEvents.length} events</span>
              <button
                onClick={() => {
                  setA11yEvents([]);
                  setA11yBatches([]);
                }}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Clear
              </button>
            </div>
            {a11yEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                No events captured...
              </div>
            ) : (
              a11yEvents.slice(-50).map((event) => (
                <div
                  key={event.id}
                  className="p-2 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-400">{event.type}</span>
                    <span className={`px-1 rounded text-[10px] ${
                      event.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      event.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      event.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-zinc-600/20 text-zinc-400'
                    }`}>
                      {event.priority}
                    </span>
                  </div>
                  {event.details?.description && (
                    <div className="text-zinc-400 mt-1">{event.details.description}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="h-full overflow-y-auto p-3 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Thinking Mode</h3>
              <select
                value={config?.thinkingMode ?? 'observer'}
                onChange={(e) => handleUpdateConfig({ thinkingMode: e.target.value as ThinkingMode })}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200"
              >
                <option value="observer">🔭 Observer</option>
                <option value="anticipatory">⚡ Anticipatory</option>
                <option value="suspicious">🔍 Suspicious</option>
                <option value="helpful">🤝 Helpful</option>
                <option value="ethical">⚖️ Ethical</option>
                <option value="quiet">🤫 Quiet</option>
              </select>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Reasoning Depth</h3>
              <select
                value={config?.reasoningDepth ?? 'balanced'}
                onChange={(e) => handleUpdateConfig({ reasoningDepth: e.target.value as ReasoningDepth })}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200"
              >
                <option value="quick">Quick</option>
                <option value="balanced">Balanced</option>
                <option value="deep">Deep</option>
                <option value="exhaustive">Exhaustive</option>
              </select>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Actions</h3>
              <button
                onClick={handleClearState}
                className="w-full px-3 py-2 bg-red-600/20 border border-red-500/30 rounded text-red-400 text-sm hover:bg-red-600/30"
              >
                Clear All Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtlasIframeApp;
