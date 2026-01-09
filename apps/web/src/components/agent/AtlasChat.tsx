/**
 * Atlas Chat Interface
 * 
 * A new chat interface for the Atlas agent featuring:
 * - Thoughts panel showing chain-of-thought reasoning
 * - Accessibility events panel with DOM hooks visibility
 * - Thinking mode selector
 * - Observer internal monologue
 * - Chat with context awareness
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getAtlasAgent, 
  type AtlasThought, 
  type AtlasConfig,
  type ThinkingMode,
  type ReasoningDepth,
} from '../../services/atlasAgent';
import {
  getA11yEvents,
  type A11yEvent,
  type A11yEventBatch,
  type A11yObserverConfig,
  type A11yEventType,
  type A11yEventPriority,
  DEFAULT_A11Y_CONFIG,
} from '../../services/accessibilityEvents';

// ============ Types ============

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

type ViewTab = 'chat' | 'thoughts' | 'events' | 'settings';

// ============ Accessibility Event Type Config ============

const A11Y_EVENT_CONFIG: Record<A11yEventType, { icon: string; color: string; label: string }> = {
  'focus-change': { icon: '🎯', color: 'text-blue-400', label: 'Focus' },
  'focus-trap-enter': { icon: '🔒', color: 'text-orange-400', label: 'Trap Enter' },
  'focus-trap-exit': { icon: '🔓', color: 'text-green-400', label: 'Trap Exit' },
  'live-region-update': { icon: '📢', color: 'text-purple-400', label: 'Live Region' },
  'announcement': { icon: '🔊', color: 'text-cyan-400', label: 'Announce' },
  'landmark-enter': { icon: '🏛️', color: 'text-indigo-400', label: 'Landmark In' },
  'landmark-exit': { icon: '🚪', color: 'text-zinc-400', label: 'Landmark Out' },
  'expansion-change': { icon: '↕️', color: 'text-yellow-400', label: 'Expand/Collapse' },
  'selection-change': { icon: '✅', color: 'text-green-400', label: 'Selection' },
  'value-change': { icon: '✏️', color: 'text-blue-300', label: 'Value' },
  'state-change': { icon: '🔄', color: 'text-pink-400', label: 'State' },
  'error-announce': { icon: '❌', color: 'text-red-400', label: 'Error' },
  'progress-update': { icon: '📊', color: 'text-teal-400', label: 'Progress' },
  'navigation': { icon: '🧭', color: 'text-amber-400', label: 'Navigation' },
  'modal-open': { icon: '📦', color: 'text-violet-400', label: 'Modal Open' },
  'modal-close': { icon: '📤', color: 'text-violet-300', label: 'Modal Close' },
  'tooltip-show': { icon: '💬', color: 'text-zinc-300', label: 'Tooltip Show' },
  'tooltip-hide': { icon: '💨', color: 'text-zinc-500', label: 'Tooltip Hide' },
  'menu-open': { icon: '📋', color: 'text-emerald-400', label: 'Menu Open' },
  'menu-close': { icon: '📁', color: 'text-emerald-300', label: 'Menu Close' },
  'tree-expand': { icon: '🌲', color: 'text-green-500', label: 'Tree Expand' },
  'tree-collapse': { icon: '🌳', color: 'text-green-600', label: 'Tree Collapse' },
  'drag-start': { icon: '✊', color: 'text-orange-500', label: 'Drag Start' },
  'drag-end': { icon: '✋', color: 'text-orange-300', label: 'Drag End' },
  'sort-change': { icon: '🔢', color: 'text-sky-400', label: 'Sort' },
  'filter-change': { icon: '🔍', color: 'text-sky-300', label: 'Filter' },
  'page-load': { icon: '🌐', color: 'text-lime-400', label: 'Page Load' },
  'content-update': { icon: '📝', color: 'text-slate-400', label: 'Content' },
};

const A11Y_PRIORITY_CONFIG: Record<A11yEventPriority, { color: string; bgColor: string }> = {
  critical: { color: 'text-red-400', bgColor: 'bg-red-500/20' },
  high: { color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  medium: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  low: { color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  debug: { color: 'text-zinc-500', bgColor: 'bg-zinc-500/20' },
};

// ============ Thinking Mode Icons & Colors ============

const THINKING_MODE_CONFIG: Record<ThinkingMode, { icon: string; color: string; label: string; description: string }> = {
  observer: { 
    icon: '👁️', 
    color: 'text-blue-400', 
    label: 'Observer',
    description: 'Passive observation with internal monologue',
  },
  anticipatory: { 
    icon: '🔮', 
    color: 'text-purple-400', 
    label: 'Anticipatory',
    description: 'Predicts user intent and prepares context',
  },
  suspicious: { 
    icon: '🔍', 
    color: 'text-orange-400', 
    label: 'Suspicious',
    description: 'Extra scrutiny, flags unusual patterns',
  },
  helpful: { 
    icon: '🤝', 
    color: 'text-green-400', 
    label: 'Helpful',
    description: 'Proactively suggests and assists',
  },
  ethical: { 
    icon: '⚖️', 
    color: 'text-yellow-400', 
    label: 'Ethical',
    description: 'Focus on ethical considerations',
  },
  quiet: { 
    icon: '🤫', 
    color: 'text-zinc-400', 
    label: 'Quiet',
    description: 'Minimal output, only speaks when needed',
  },
};

const REASONING_DEPTH_CONFIG: Record<ReasoningDepth, { label: string; description: string }> = {
  shallow: { label: 'Shallow', description: 'Quick, brief reasoning' },
  moderate: { label: 'Moderate', description: 'Balanced depth' },
  deep: { label: 'Deep', description: 'Thorough analysis' },
  exhaustive: { label: 'Exhaustive', description: 'Leave no stone unturned' },
};

const THOUGHT_TYPE_CONFIG: Record<AtlasThought['type'], { icon: string; color: string }> = {
  observation: { icon: '👁️', color: 'text-blue-400' },
  inference: { icon: '💭', color: 'text-purple-400' },
  concern: { icon: '⚠️', color: 'text-orange-400' },
  suggestion: { icon: '💡', color: 'text-green-400' },
  question: { icon: '❓', color: 'text-cyan-400' },
  reflection: { icon: '🪞', color: 'text-pink-400' },
};

// ============ Thinking Mode Selector ============

interface ThinkingModeSelectorProps {
  currentMode: ThinkingMode;
  onSelect: (mode: ThinkingMode) => void;
  compact?: boolean;
}

const ThinkingModeSelector: React.FC<ThinkingModeSelectorProps> = ({ 
  currentMode, 
  onSelect,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = THINKING_MODE_CONFIG[currentMode];

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 transition-colors ${config.color}`}
        >
          <span>{config.icon}</span>
          <span className="text-sm">{config.label}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl z-50 overflow-hidden">
              {(Object.keys(THINKING_MODE_CONFIG) as ThinkingMode[]).map(mode => {
                const modeConfig = THINKING_MODE_CONFIG[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      onSelect(mode);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-zinc-700 transition-colors flex items-start gap-3 ${
                      mode === currentMode ? 'bg-zinc-700' : ''
                    }`}
                  >
                    <span className={`text-lg ${modeConfig.color}`}>{modeConfig.icon}</span>
                    <div>
                      <div className={`font-medium ${modeConfig.color}`}>{modeConfig.label}</div>
                      <div className="text-xs text-zinc-400">{modeConfig.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(THINKING_MODE_CONFIG) as ThinkingMode[]).map(mode => {
        const modeConfig = THINKING_MODE_CONFIG[mode];
        return (
          <button
            key={mode}
            onClick={() => onSelect(mode)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
              mode === currentMode
                ? `${modeConfig.color} border-current bg-current/10`
                : 'border-zinc-600 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <span className="text-xl">{modeConfig.icon}</span>
            <span className="text-xs font-medium">{modeConfig.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ============ Reasoning Depth Selector ============

interface ReasoningDepthSelectorProps {
  currentDepth: ReasoningDepth;
  onSelect: (depth: ReasoningDepth) => void;
}

const ReasoningDepthSelector: React.FC<ReasoningDepthSelectorProps> = ({ 
  currentDepth, 
  onSelect,
}) => {
  const depths: ReasoningDepth[] = ['shallow', 'moderate', 'deep', 'exhaustive'];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-zinc-400">Reasoning Depth</label>
      <div className="flex gap-1">
        {depths.map(depth => (
          <button
            key={depth}
            onClick={() => onSelect(depth)}
            className={`flex-1 px-2 py-2 rounded text-sm transition-all ${
              depth === currentDepth
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {REASONING_DEPTH_CONFIG[depth].label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============ Thought Card ============

interface ThoughtCardProps {
  thought: AtlasThought;
}

const ThoughtCard: React.FC<ThoughtCardProps> = ({ thought }) => {
  const config = THOUGHT_TYPE_CONFIG[thought.type];
  const timeAgo = getTimeAgo(thought.timestamp);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 mb-2">
      <div className="flex items-start gap-2">
        <span className={`${config.color} text-lg`}>{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium uppercase ${config.color}`}>
              {thought.type}
            </span>
            <span className="text-xs text-zinc-500">{timeAgo}</span>
          </div>
          <p className="text-sm text-zinc-300">{thought.content}</p>
          {thought.reasoning && (
            <details className="mt-2">
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                Show reasoning
              </summary>
              <p className="mt-1 text-xs text-zinc-400 bg-zinc-900 rounded p-2">
                {thought.reasoning}
              </p>
            </details>
          )}
          {thought.metadata?.triggeredBy && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-zinc-500">
                Triggered by: {thought.metadata.triggeredBy}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Thoughts Panel ============

interface ThoughtsPanelProps {
  thoughts: AtlasThought[];
  isLoading: boolean;
}

const ThoughtsPanel: React.FC<ThoughtsPanelProps> = ({ thoughts, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts]);

  if (thoughts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <span className="text-4xl mb-2 block">🧠</span>
          <p className="text-sm">Atlas is observing...</p>
          <p className="text-xs mt-1">Thoughts will appear here as Atlas processes information</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
      {thoughts.map(thought => (
        <ThoughtCard key={thought.id} thought={thought} />
      ))}
      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 p-3">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-sm">Thinking...</span>
        </div>
      )}
    </div>
  );
};

// ============ A11y Event Card ============

interface A11yEventCardProps {
  event: A11yEvent;
  expanded?: boolean;
  onToggle?: () => void;
}

const A11yEventCard: React.FC<A11yEventCardProps> = ({ event, expanded, onToggle }) => {
  const config = A11Y_EVENT_CONFIG[event.type] || { icon: '📌', color: 'text-zinc-400', label: event.type };
  const priorityConfig = A11Y_PRIORITY_CONFIG[event.priority];
  const timeAgo = getTimeAgo(event.timestamp);

  return (
    <div 
      className={`border border-zinc-700 rounded-lg mb-2 overflow-hidden ${priorityConfig.bgColor}`}
      role="article"
      aria-label={`${config.label} event: ${event.details.description}`}
    >
      <button
        onClick={onToggle}
        className="w-full p-3 text-left hover:bg-zinc-700/30 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-2">
          <span className={`${config.color} text-lg`} aria-hidden="true">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${priorityConfig.bgColor} ${priorityConfig.color}`}>
                  {event.priority}
                </span>
              </div>
              <span className="text-xs text-zinc-500">{timeAgo}</span>
            </div>
            <p className="text-sm text-zinc-300 truncate">{event.details.description}</p>
          </div>
          <svg 
            className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-700/50">
          {/* Element Info */}
          {event.element && (
            <div className="mt-2">
              <p className="text-xs text-zinc-500 mb-1">Element</p>
              <code className="text-xs text-cyan-400 bg-zinc-900 px-2 py-1 rounded block">
                {event.element.selector}
              </code>
              {event.element.role && (
                <p className="text-xs text-zinc-400 mt-1">
                  Role: <span className="text-purple-400">{event.element.role}</span>
                </p>
              )}
              {event.element.ariaLabel && (
                <p className="text-xs text-zinc-400 mt-1">
                  Label: <span className="text-green-400">{event.element.ariaLabel}</span>
                </p>
              )}
            </div>
          )}
          
          {/* Values */}
          {(event.details.oldValue || event.details.newValue) && (
            <div className="mt-2 flex gap-2">
              {event.details.oldValue && (
                <div className="flex-1">
                  <p className="text-xs text-zinc-500">Old</p>
                  <p className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                    {event.details.oldValue}
                  </p>
                </div>
              )}
              {event.details.newValue && (
                <div className="flex-1">
                  <p className="text-xs text-zinc-500">New</p>
                  <p className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                    {event.details.newValue}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Announcement */}
          {event.details.announcement && (
            <div className="mt-2">
              <p className="text-xs text-zinc-500">Announcement ({event.details.politeness})</p>
              <p className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded mt-1">
                "{event.details.announcement}"
              </p>
            </div>
          )}
          
          {/* A11y Context */}
          <div className="mt-2 flex flex-wrap gap-2">
            {event.a11y.landmark && (
              <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                🏛️ {event.a11y.landmark}
              </span>
            )}
            {event.a11y.inModal && (
              <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded">
                📦 In Modal
              </span>
            )}
            {event.a11y.inFocusTrap && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                🔒 Focus Trapped
              </span>
            )}
            {event.a11y.heading && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                📑 {event.a11y.heading.slice(0, 30)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ A11y Events Panel ============

interface A11yEventsPanelProps {
  events: A11yEvent[];
  batches: A11yEventBatch[];
  config: A11yObserverConfig;
  onUpdateConfig: (updates: Partial<A11yObserverConfig>) => void;
  onClearEvents: () => void;
}

const A11yEventsPanel: React.FC<A11yEventsPanelProps> = ({ 
  events, 
  batches,
  config, 
  onUpdateConfig,
  onClearEvents,
}) => {
  const [viewMode, setViewMode] = useState<'stream' | 'batched' | 'config'>('stream');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<A11yEventType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<A11yEventPriority | 'all'>('all');
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, isPaused]);

  const filteredEvents = events.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && e.priority !== priorityFilter) return false;
    return true;
  });

  const eventTypes = Array.from(new Set(events.map(e => e.type)));
  const priorities: A11yEventPriority[] = ['critical', 'high', 'medium', 'low', 'debug'];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 p-3 border-b border-zinc-700 space-y-2">
        {/* View Mode Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('stream')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'stream' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
            aria-pressed={viewMode === 'stream'}
          >
            📡 Stream
          </button>
          <button
            onClick={() => setViewMode('batched')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'batched' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
            aria-pressed={viewMode === 'batched'}
          >
            📦 Batched ({batches.length})
          </button>
          <button
            onClick={() => setViewMode('config')}
            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'config' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
            aria-pressed={viewMode === 'config'}
            aria-label="Configure event observation"
          >
            ⚙️
          </button>
        </div>
        
        {/* Filters (only in stream mode) */}
        {viewMode === 'stream' && (
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as A11yEventType | 'all')}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300"
              aria-label="Filter by event type"
            >
              <option value="all">All Types ({events.length})</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>
                  {A11Y_EVENT_CONFIG[type]?.icon} {A11Y_EVENT_CONFIG[type]?.label || type}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as A11yEventPriority | 'all')}
              className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300"
              aria-label="Filter by priority"
            >
              <option value="all">All</option>
              {priorities.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-2 py-1 rounded text-xs ${
                isPaused ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-300'
              }`}
              aria-pressed={isPaused}
              aria-label={isPaused ? 'Resume stream' : 'Pause stream'}
            >
              {isPaused ? '▶️' : '⏸️'}
            </button>
            <button
              onClick={onClearEvents}
              className="px-2 py-1 rounded text-xs bg-zinc-700 text-zinc-300 hover:bg-red-600/50"
              aria-label="Clear all events"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      {viewMode === 'stream' && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
          {filteredEvents.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              <span className="text-3xl block mb-2">📡</span>
              <p className="text-sm">No events captured yet</p>
              <p className="text-xs mt-1">Interact with the UI to see accessibility events</p>
            </div>
          ) : (
            filteredEvents.map(event => (
              <A11yEventCard
                key={event.id}
                event={event}
                expanded={expandedId === event.id}
                onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
              />
            ))
          )}
        </div>
      )}

      {viewMode === 'batched' && (
        <div className="flex-1 overflow-y-auto p-3">
          {batches.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              <span className="text-3xl block mb-2">📦</span>
              <p className="text-sm">No batches yet</p>
              <p className="text-xs mt-1">Events are batched based on your configuration</p>
            </div>
          ) : (
            batches.map(batch => (
              <div 
                key={batch.id} 
                className={`border border-zinc-700 rounded-lg mb-2 overflow-hidden ${A11Y_PRIORITY_CONFIG[batch.priority].bgColor}`}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium ${A11Y_PRIORITY_CONFIG[batch.priority].color}`}>
                      Batch ({batch.events.length} events)
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(batch.startTime).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{batch.summary}</p>
                  <details className="mt-2">
                    <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                      Show events
                    </summary>
                    <div className="mt-2 space-y-1">
                      {batch.events.map(event => (
                        <div key={event.id} className="text-xs text-zinc-400 bg-zinc-900 rounded px-2 py-1">
                          <span className={A11Y_EVENT_CONFIG[event.type]?.color}>
                            {A11Y_EVENT_CONFIG[event.type]?.icon}
                          </span>{' '}
                          {event.details.description}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'config' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Observation Mode */}
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Observation Mode</label>
            <div className="flex gap-1">
              {(['timer', 'event-driven', 'hybrid'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => onUpdateConfig({ mode })}
                  className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                    config.mode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {mode === 'timer' && '⏱️ Timer'}
                  {mode === 'event-driven' && '📡 Events'}
                  {mode === 'hybrid' && '🔀 Hybrid'}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {config.mode === 'timer' && 'Collects events on a timer interval'}
              {config.mode === 'event-driven' && 'Processes events immediately as they occur'}
              {config.mode === 'hybrid' && 'Timer-based with immediate critical events'}
            </p>
          </div>

          {/* Timer Interval */}
          {(config.mode === 'timer' || config.mode === 'hybrid') && (
            <div>
              <label className="text-sm text-zinc-400 block mb-2">
                Timer Interval: {config.timerInterval / 1000}s
              </label>
              <input
                type="range"
                min="500"
                max="10000"
                step="500"
                value={config.timerInterval}
                onChange={(e) => onUpdateConfig({ timerInterval: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          )}

          {/* Batch Settings */}
          <div>
            <label className="text-sm text-zinc-400 block mb-2">
              Max Batch Size: {config.maxBatchSize}
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={config.maxBatchSize}
              onChange={(e) => onUpdateConfig({ maxBatchSize: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Min Priority */}
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Minimum Priority</label>
            <div className="flex gap-1">
              {priorities.map(p => (
                <button
                  key={p}
                  onClick={() => onUpdateConfig({ minPriority: p })}
                  className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
                    config.minPriority === p
                      ? `${A11Y_PRIORITY_CONFIG[p].bgColor} ${A11Y_PRIORITY_CONFIG[p].color} border border-current`
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Observer Toggles */}
          <div className="space-y-2">
            <p className="text-sm text-zinc-400">Observers</p>
            {[
              { key: 'observeMutations', label: 'DOM Mutations' },
              { key: 'observeFocus', label: 'Focus Changes' },
              { key: 'observeAriaChanges', label: 'ARIA Attributes' },
              { key: 'observeKeyboard', label: 'Keyboard Events' },
              { key: 'observeMouse', label: 'Mouse Events' },
              { key: 'captureAnnouncements', label: 'Live Region Announcements' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config[key as keyof A11yObserverConfig] as boolean}
                  onChange={(e) => onUpdateConfig({ [key]: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-zinc-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Rate Limiting */}
          <div>
            <label className="text-sm text-zinc-400 block mb-2">
              Max Events/Second: {config.maxEventsPerSecond}
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={config.maxEventsPerSecond}
              onChange={(e) => onUpdateConfig({ maxEventsPerSecond: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Chat Message ============

interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessageView: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser 
            ? 'bg-indigo-600 text-white' 
            : 'bg-zinc-700 text-zinc-200'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>
        <div className="text-xs opacity-50 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

// ============ Settings Panel ============

interface SettingsPanelProps {
  config: AtlasConfig | null;
  onUpdateConfig: (updates: Partial<AtlasConfig>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onUpdateConfig }) => {
  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Thinking Mode */}
      <div>
        <label className="text-sm text-zinc-400 block mb-2">Thinking Mode</label>
        <ThinkingModeSelector
          currentMode={config.thinkingMode}
          onSelect={(mode) => onUpdateConfig({ thinkingMode: mode })}
        />
      </div>

      {/* Reasoning Depth */}
      <ReasoningDepthSelector
        currentDepth={config.reasoningDepth}
        onSelect={(depth) => onUpdateConfig({ reasoningDepth: depth })}
      />

      {/* Model Selection */}
      <div>
        <label className="text-sm text-zinc-400 block mb-2">Model</label>
        <input
          type="text"
          value={config.modelName}
          onChange={(e) => onUpdateConfig({ modelName: e.target.value })}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-300"
          placeholder="gpt-oss"
        />
        <p className="text-xs text-zinc-500 mt-1">Local Ollama model name</p>
      </div>

      {/* Temperature */}
      <div>
        <label className="text-sm text-zinc-400 block mb-2">
          Temperature: {config.temperature.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature}
          onChange={(e) => onUpdateConfig({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Observation Interval */}
      <div>
        <label className="text-sm text-zinc-400 block mb-2">
          Observation Interval: {config.observationInterval / 1000}s
        </label>
        <input
          type="range"
          min="1000"
          max="30000"
          step="1000"
          value={config.observationInterval}
          onChange={(e) => onUpdateConfig({ observationInterval: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.enableEthicalChecks}
            onChange={(e) => onUpdateConfig({ enableEthicalChecks: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-zinc-300">Enable ethical checks</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.enablePatternDetection}
            onChange={(e) => onUpdateConfig({ enablePatternDetection: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-zinc-300">Enable pattern detection</span>
        </label>
      </div>
    </div>
  );
};

// ============ Main Atlas Chat Component ============

export const AtlasChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thoughts, setThoughts] = useState<AtlasThought[]>([]);
  const [a11yEvents, setA11yEvents] = useState<A11yEvent[]>([]);
  const [a11yBatches, setA11yBatches] = useState<A11yEventBatch[]>([]);
  const [a11yConfig, setA11yConfig] = useState<A11yObserverConfig>(DEFAULT_A11Y_CONFIG);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTab, setCurrentTab] = useState<ViewTab>('chat');
  const [config, setConfig] = useState<AtlasConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Initialize Atlas agent and A11y events
  useEffect(() => {
    let unsubscribeThought: (() => void) | null = null;
    let unsubscribeA11yEvent: (() => void) | null = null;
    let unsubscribeA11yBatch: (() => void) | null = null;

    const init = async () => {
      try {
        // Initialize Atlas agent
        const agent = await getAtlasAgent();
        setConfig(agent.getConfig());
        setThoughts(agent.getRecentThoughts());

        // Subscribe to new thoughts
        unsubscribeThought = agent.onThought((thought) => {
          setThoughts(prev => [...prev, thought]);
        });

        // Initialize A11y events service
        const a11yService = getA11yEvents();
        a11yService.start();
        setA11yConfig(a11yService.getConfig());
        setA11yEvents(a11yService.getEvents());
        setA11yBatches(a11yService.getBatches());

        // Subscribe to new a11y events
        unsubscribeA11yEvent = a11yService.onEvent((event) => {
          setA11yEvents(prev => {
            const updated = [...prev, event];
            return updated.slice(-200); // Keep last 200 events
          });
        });

        // Subscribe to batches
        unsubscribeA11yBatch = a11yService.onBatch((batch) => {
          setA11yBatches(prev => [...prev, batch].slice(-50));
        });

        setIsInitialized(true);
      } catch (err) {
        console.error('[AtlasChat] Failed to initialize:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Atlas');
      }
    };

    init();

    return () => {
      if (unsubscribeThought) unsubscribeThought();
      if (unsubscribeA11yEvent) unsubscribeA11yEvent();
      if (unsubscribeA11yBatch) unsubscribeA11yBatch();
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle config updates
  const handleUpdateConfig = useCallback(async (updates: Partial<AtlasConfig>) => {
    try {
      const agent = await getAtlasAgent();
      await agent.updateConfig(updates);
      setConfig(agent.getConfig());
    } catch (err) {
      console.error('[AtlasChat] Failed to update config:', err);
    }
  }, []);

  // Handle A11y config updates
  const handleUpdateA11yConfig = useCallback((updates: Partial<A11yObserverConfig>) => {
    const a11yService = getA11yEvents();
    a11yService.updateConfig(updates);
    setA11yConfig(a11yService.getConfig());
  }, []);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    // Announce for screen readers
    getA11yEvents().announce(`Sending message to Atlas`, 'polite');

    try {
      const agent = await getAtlasAgent();
      const stream = await agent.chat(userMessage.content);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, assistantMessage]);

      for await (const chunk of stream) {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.isStreaming) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content + chunk,
            };
          }
          return updated;
        });
      }

      // Mark as done streaming
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.isStreaming) {
          updated[lastIdx] = { ...updated[lastIdx], isStreaming: false };
        }
        return updated;
      });
    } catch (err) {
      console.error('[AtlasChat] Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Remove the streaming message on error
      setMessages(prev => prev.filter(m => !m.isStreaming));
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Render loading state
  if (!isInitialized) {
    return (
      <div className="flex flex-col h-full bg-zinc-900 items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Initializing Atlas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-700 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            <div>
              <h2 className="text-lg font-semibold text-white">Atlas</h2>
              <p className="text-xs text-zinc-500">Intelligent Observer & Guide</p>
            </div>
          </div>
          {config && (
            <ThinkingModeSelector
              currentMode={config.thinkingMode}
              onSelect={(mode) => handleUpdateConfig({ thinkingMode: mode })}
              compact
            />
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-1" role="tablist" aria-label="Atlas view tabs">
          <button
            role="tab"
            aria-selected={currentTab === 'chat'}
            aria-controls="atlas-chat-panel"
            onClick={() => setCurrentTab('chat')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            aria-controls="atlas-thoughts-panel"
            onClick={() => setCurrentTab('thoughts')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'thoughts'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            🧠 Thoughts
            {thoughts.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-zinc-700 rounded text-xs" aria-label={`${thoughts.length} thoughts`}>
                {thoughts.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={currentTab === 'events'}
            aria-controls="atlas-events-panel"
            onClick={() => setCurrentTab('events')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'events'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            📡 Events
            {a11yEvents.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-zinc-700 rounded text-xs" aria-label={`${a11yEvents.length} events`}>
                {a11yEvents.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={currentTab === 'settings'}
            aria-controls="atlas-settings-panel"
            onClick={() => setCurrentTab('settings')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Content Area */}
      {currentTab === 'chat' && (
        <>
          {/* Messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500">
                <div className="text-center max-w-md">
                  <span className="text-5xl mb-4 block">🌐</span>
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">Welcome to Atlas</h3>
                  <p className="text-sm">
                    I'm an intelligent observer that watches, thinks, and guides. 
                    I specialize in scientific tasks, DevOps, and ethical considerations.
                  </p>
                  <p className="text-sm mt-2">
                    Check the <strong>Thoughts</strong> tab to see my internal monologue.
                  </p>
                </div>
              </div>
            ) : (
              messages.map(message => (
                <ChatMessageView key={message.id} message={message} />
              ))
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-4 mb-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Input Area */}
          <div className="flex-shrink-0 border-t border-zinc-700 p-4">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask Atlas anything..."
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-indigo-500"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {currentTab === 'thoughts' && (
        <div id="atlas-thoughts-panel" role="tabpanel" aria-labelledby="thoughts-tab">
          <ThoughtsPanel thoughts={thoughts} isLoading={isLoading} />
        </div>
      )}

      {currentTab === 'events' && (
        <div id="atlas-events-panel" role="tabpanel" aria-labelledby="events-tab">
          <A11yEventsPanel
            events={a11yEvents}
            batches={a11yBatches}
            config={a11yConfig}
            onUpdateConfig={handleUpdateA11yConfig}
            onClearEvents={() => {
              getA11yEvents().clearEvents();
              setA11yEvents([]);
              setA11yBatches([]);
            }}
          />
        </div>
      )}

      {currentTab === 'settings' && (
        <div id="atlas-settings-panel" role="tabpanel" aria-labelledby="settings-tab">
          <SettingsPanel config={config} onUpdateConfig={handleUpdateConfig} />
        </div>
      )}
    </div>
  );
};

// ============ Helper Functions ============

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default AtlasChat;
