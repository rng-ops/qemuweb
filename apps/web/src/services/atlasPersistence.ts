/**
 * Atlas Persistence Layer
 * 
 * Provides IndexedDB-based persistence for Atlas state that survives
 * page refreshes and navigation. Works similar to Chrome's "Persist logs"
 * feature - state is kept across page changes until explicitly cleared.
 * 
 * Stored data:
 * - Chat messages (user and assistant)
 * - Agent thoughts (chain-of-thought reasoning)
 * - A11y events (with configurable retention)
 * - Configuration settings
 * - Session metadata
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AtlasThought, AtlasConfig, ThinkingMode, ReasoningDepth } from './atlasAgent';
import type { A11yEvent, A11yEventBatch, A11yObserverConfig } from './accessibilityEvents';

// ============ Types ============

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    thinkingMode?: ThinkingMode;
    reasoningDepth?: ReasoningDepth;
    tokenCount?: number;
  };
}

export interface AtlasSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  title?: string;
  messageCount: number;
  thoughtCount: number;
}

export interface PersistedAtlasState {
  session: AtlasSession;
  messages: ChatMessage[];
  thoughts: AtlasThought[];
  events: A11yEvent[]; // A11y events
  orchestratorEvents: Array<{
    id: string;
    timestamp: number;
    type: string;
    source: string;
    data: Record<string, unknown>;
  }>; // Atlas orchestrator events (file ops, terminal, etc)
  eventBatches: A11yEventBatch[];
  config: Partial<AtlasConfig>;
  a11yConfig: Partial<A11yObserverConfig>;
  preferences: AtlasPreferences;
}

export interface AtlasPreferences {
  persistLogs: boolean;
  maxMessages: number;
  maxThoughts: number;
  maxEvents: number;
  autoSaveInterval: number; // ms
  theme: 'dark' | 'light' | 'system';
}

// ============ Database Schema ============

interface AtlasDBSchema extends DBSchema {
  sessions: {
    key: string;
    value: AtlasSession;
    indexes: { 'by-updated': number };
  };
  messages: {
    key: string;
    value: ChatMessage & { sessionId: string };
    indexes: { 
      'by-session': string;
      'by-timestamp': number;
    };
  };
  thoughts: {
    key: string;
    value: AtlasThought & { sessionId: string };
    indexes: { 
      'by-session': string;
      'by-timestamp': number;
    };
  };
  events: {
    key: string;
    value: A11yEvent & { sessionId: string };
    indexes: { 
      'by-session': string;
      'by-timestamp': number;
      'by-type': string;
    };
  };
  orchestratorEvents: {
    key: string;
    value: {
      id: string;
      sessionId: string;
      timestamp: number;
      type: string;
      source: string;
      data: Record<string, unknown>;
    };
    indexes: { 
      'by-session': string;
      'by-timestamp': number;
      'by-type': string;
    };
  };
  eventBatches: {
    key: string;
    value: A11yEventBatch & { sessionId: string };
    indexes: { 
      'by-session': string;
      'by-start-time': number;
    };
  };
  config: {
    key: 'atlas-config' | 'a11y-config' | 'preferences';
    value: {
      key: string;
      data: Partial<AtlasConfig> | Partial<A11yObserverConfig> | AtlasPreferences;
    };
  };
}

// ============ Constants ============

const DB_NAME = 'atlas-persistence';
const DB_VERSION = 2; // Increment version for new store
const CURRENT_SESSION_KEY = 'atlas-current-session';

const DEFAULT_PREFERENCES: AtlasPreferences = {
  persistLogs: true,
  maxMessages: 500,
  maxThoughts: 200,
  maxEvents: 1000,
  autoSaveInterval: 5000,
  theme: 'dark',
};

// ============ Persistence Class ============

export class AtlasPersistence {
  private db: IDBPDatabase<AtlasDBSchema> | null = null;
  private currentSessionId: string | null = null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private pendingWrites: Map<string, () => Promise<void>> = new Map();
  private preferences: AtlasPreferences = DEFAULT_PREFERENCES;
  
  // ============ Initialization ============
  
  async init(): Promise<void> {
    if (this.db) return;
    
    this.db = await openDB<AtlasDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-updated', 'updatedAt');
        }
        
        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-session', 'sessionId');
          messageStore.createIndex('by-timestamp', 'timestamp');
        }
        
        // Thoughts store
        if (!db.objectStoreNames.contains('thoughts')) {
          const thoughtStore = db.createObjectStore('thoughts', { keyPath: 'id' });
          thoughtStore.createIndex('by-session', 'sessionId');
          thoughtStore.createIndex('by-timestamp', 'timestamp');
        }
        
        // Events store (A11y events)
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('by-session', 'sessionId');
          eventStore.createIndex('by-timestamp', 'timestamp');
          eventStore.createIndex('by-type', 'type');
        }
        
        // Orchestrator events store (file ops, terminal, etc)
        if (!db.objectStoreNames.contains('orchestratorEvents')) {
          const orchEventStore = db.createObjectStore('orchestratorEvents', { keyPath: 'id' });
          orchEventStore.createIndex('by-session', 'sessionId');
          orchEventStore.createIndex('by-timestamp', 'timestamp');
          orchEventStore.createIndex('by-type', 'type');
        }
        
        // Event batches store
        if (!db.objectStoreNames.contains('eventBatches')) {
          const batchStore = db.createObjectStore('eventBatches', { keyPath: 'id' });
          batchStore.createIndex('by-session', 'sessionId');
          batchStore.createIndex('by-start-time', 'startTime');
        }
        
        // Config store
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      },
    });
    
    // Load preferences
    await this.loadPreferences();
    
    // Get or create current session
    await this.ensureSession();
    
    // Start auto-save if enabled
    if (this.preferences.autoSaveInterval > 0) {
      this.startAutoSave();
    }
  }
  
  private async loadPreferences(): Promise<void> {
    if (!this.db) return;
    
    try {
      const stored = await this.db.get('config', 'preferences');
      if (stored?.data) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...stored.data as AtlasPreferences };
      }
    } catch {
      // Use defaults
    }
  }
  
  private async ensureSession(): Promise<void> {
    // Try to get current session from localStorage
    const storedSessionId = localStorage.getItem(CURRENT_SESSION_KEY);
    
    if (storedSessionId && this.db) {
      const session = await this.db.get('sessions', storedSessionId);
      if (session) {
        this.currentSessionId = storedSessionId;
        // Update last accessed time
        await this.db.put('sessions', {
          ...session,
          updatedAt: Date.now(),
        });
        return;
      }
    }
    
    // Create new session
    await this.createSession();
  }
  
  private async createSession(): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: AtlasSession = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      thoughtCount: 0,
    };
    
    if (this.db) {
      await this.db.put('sessions', session);
    }
    
    this.currentSessionId = sessionId;
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
    
    return sessionId;
  }
  
  // ============ Auto-Save ============
  
  private startAutoSave(): void {
    if (this.autoSaveTimer) return;
    
    this.autoSaveTimer = setInterval(async () => {
      await this.flushPendingWrites();
    }, this.preferences.autoSaveInterval);
  }
  
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  private async flushPendingWrites(): Promise<void> {
    const writes = Array.from(this.pendingWrites.values());
    this.pendingWrites.clear();
    
    await Promise.all(writes.map(fn => fn().catch(() => {})));
  }
  
  // ============ Messages ============
  
  async saveMessage(message: ChatMessage): Promise<void> {
    if (!this.db || !this.currentSessionId) return;
    
    const sessionId = this.currentSessionId;
    const db = this.db;
    
    this.pendingWrites.set(`msg-${message.id}`, async () => {
      await db.put('messages', { ...message, sessionId });
      
      // Update session
      const session = await db.get('sessions', sessionId);
      if (session) {
        session.messageCount++;
        session.updatedAt = Date.now();
        await db.put('sessions', session);
      }
    });
    
    // Also flush immediately for messages
    await this.flushPendingWrites();
  }
  
  async getMessages(limit?: number): Promise<ChatMessage[]> {
    if (!this.db || !this.currentSessionId) return [];
    
    const messages = await this.db.getAllFromIndex(
      'messages', 
      'by-session', 
      this.currentSessionId
    );
    
    // Sort by timestamp and apply limit
    const sorted = messages.sort((a, b) => a.timestamp - b.timestamp);
    
    if (limit) {
      return sorted.slice(-limit).map(({ sessionId: _, ...msg }) => msg);
    }
    
    return sorted.map(({ sessionId: _, ...msg }) => msg);
  }
  
  // ============ Thoughts ============
  
  async saveThought(thought: AtlasThought): Promise<void> {
    if (!this.db || !this.currentSessionId) return;
    
    const sessionId = this.currentSessionId;
    const db = this.db;
    
    this.pendingWrites.set(`thought-${thought.id}`, async () => {
      await db.put('thoughts', { ...thought, sessionId });
    });
  }
  
  async getThoughts(limit?: number): Promise<AtlasThought[]> {
    if (!this.db || !this.currentSessionId) return [];
    
    const thoughts = await this.db.getAllFromIndex(
      'thoughts',
      'by-session',
      this.currentSessionId
    );
    
    const sorted = thoughts.sort((a, b) => a.timestamp - b.timestamp);
    const effectiveLimit = limit ?? this.preferences.maxThoughts;
    
    return sorted.slice(-effectiveLimit).map(({ sessionId: _, ...t }) => t);
  }
  
  // ============ Events ============
  
  async saveEvent(event: A11yEvent): Promise<void> {
    if (!this.db || !this.currentSessionId || !this.preferences.persistLogs) return;
    
    const sessionId = this.currentSessionId;
    const db = this.db;
    
    this.pendingWrites.set(`event-${event.id}`, async () => {
      await db.put('events', { ...event, sessionId });
      
      // Prune old events if over limit
      const count = await db.countFromIndex('events', 'by-session', sessionId);
      if (count > this.preferences.maxEvents) {
        const allEvents = await db.getAllFromIndex('events', 'by-session', sessionId);
        const toDelete = allEvents
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, count - this.preferences.maxEvents);
        
        const tx = db.transaction('events', 'readwrite');
        await Promise.all(toDelete.map(e => tx.store.delete(e.id)));
        await tx.done;
      }
    });
  }
  
  async saveEventBatch(batch: A11yEventBatch): Promise<void> {
    if (!this.db || !this.currentSessionId || !this.preferences.persistLogs) return;
    
    await this.db.put('eventBatches', { 
      ...batch, 
      sessionId: this.currentSessionId 
    });
  }
  
  async getEvents(limit?: number): Promise<A11yEvent[]> {
    if (!this.db || !this.currentSessionId) return [];
    
    const events = await this.db.getAllFromIndex(
      'events',
      'by-session',
      this.currentSessionId
    );
    
    const sorted = events.sort((a, b) => a.timestamp - b.timestamp);
    const effectiveLimit = limit ?? this.preferences.maxEvents;
    
    return sorted.slice(-effectiveLimit).map(({ sessionId: _, ...e }) => e);
  }
  
  async getEventBatches(limit = 50): Promise<A11yEventBatch[]> {
    if (!this.db || !this.currentSessionId) return [];
    
    const batches = await this.db.getAllFromIndex(
      'eventBatches',
      'by-session',
      this.currentSessionId
    );
    
    return batches
      .sort((a, b) => a.startTime - b.startTime)
      .slice(-limit)
      .map(({ sessionId: _, ...b }) => b);
  }
  
  // ============ Orchestrator Events ============
  
  async saveOrchestratorEvent(event: {
    id: string;
    timestamp: number;
    type: string;
    source: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    if (!this.db || !this.currentSessionId || !this.preferences.persistLogs) return;
    
    const sessionId = this.currentSessionId;
    const db = this.db;
    
    this.pendingWrites.set(`orch-event-${event.id}`, async () => {
      await db.put('orchestratorEvents', { ...event, sessionId });
      
      // Prune old events if over limit
      const count = await db.countFromIndex('orchestratorEvents', 'by-session', sessionId);
      if (count > this.preferences.maxEvents) {
        const allEvents = await db.getAllFromIndex('orchestratorEvents', 'by-session', sessionId);
        const toDelete = allEvents
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, count - this.preferences.maxEvents);
        
        const tx = db.transaction('orchestratorEvents', 'readwrite');
        await Promise.all(toDelete.map(e => tx.store.delete(e.id)));
        await tx.done;
      }
    });
  }
  
  async getOrchestratorEvents(limit?: number): Promise<Array<{
    id: string;
    timestamp: number;
    type: string;
    source: string;
    data: Record<string, unknown>;
  }>> {
    if (!this.db || !this.currentSessionId) return [];
    
    const events = await this.db.getAllFromIndex(
      'orchestratorEvents',
      'by-session',
      this.currentSessionId
    );
    
    const sorted = events.sort((a, b) => a.timestamp - b.timestamp);
    const effectiveLimit = limit ?? this.preferences.maxEvents;
    
    return sorted.slice(-effectiveLimit).map(({ sessionId: _, ...e }) => e);
  }
  
  // ============ Configuration ============
  
  async saveConfig(config: Partial<AtlasConfig>): Promise<void> {
    if (!this.db) return;
    
    await this.db.put('config', {
      key: 'atlas-config',
      data: config,
    });
  }
  
  async getConfig(): Promise<Partial<AtlasConfig> | null> {
    if (!this.db) return null;
    
    const stored = await this.db.get('config', 'atlas-config');
    return stored?.data as Partial<AtlasConfig> ?? null;
  }
  
  async saveA11yConfig(config: Partial<A11yObserverConfig>): Promise<void> {
    if (!this.db) return;
    
    await this.db.put('config', {
      key: 'a11y-config',
      data: config,
    });
  }
  
  async getA11yConfig(): Promise<Partial<A11yObserverConfig> | null> {
    if (!this.db) return null;
    
    const stored = await this.db.get('config', 'a11y-config');
    return stored?.data as Partial<A11yObserverConfig> ?? null;
  }
  
  async savePreferences(prefs: Partial<AtlasPreferences>): Promise<void> {
    if (!this.db) return;
    
    this.preferences = { ...this.preferences, ...prefs };
    
    await this.db.put('config', {
      key: 'preferences',
      data: this.preferences,
    });
    
    // Update auto-save timer
    this.stopAutoSave();
    if (this.preferences.autoSaveInterval > 0) {
      this.startAutoSave();
    }
  }
  
  getPreferences(): AtlasPreferences {
    return { ...this.preferences };
  }
  
  // ============ Full State Load/Save ============
  
  async loadState(): Promise<PersistedAtlasState | null> {
    if (!this.db || !this.currentSessionId) return null;
    
    const session = await this.db.get('sessions', this.currentSessionId);
    if (!session) return null;
    
    const [messages, thoughts, events, orchestratorEvents, eventBatches, config, a11yConfig] = await Promise.all([
      this.getMessages(),
      this.getThoughts(),
      this.getEvents(),
      this.getOrchestratorEvents(),
      this.getEventBatches(),
      this.getConfig(),
      this.getA11yConfig(),
    ]);
    
    return {
      session,
      messages,
      thoughts,
      events,
      orchestratorEvents,
      eventBatches,
      config: config ?? {},
      a11yConfig: a11yConfig ?? {},
      preferences: this.preferences,
    };
  }
  
  async saveState(state: Partial<PersistedAtlasState>): Promise<void> {
    if (!this.db) return;
    
    const promises: Promise<void>[] = [];
    
    if (state.messages) {
      promises.push(...state.messages.map(m => this.saveMessage(m)));
    }
    
    if (state.thoughts) {
      promises.push(...state.thoughts.map(t => this.saveThought(t)));
    }
    
    if (state.events) {
      promises.push(...state.events.map(e => this.saveEvent(e)));
    }
    
    if (state.orchestratorEvents) {
      promises.push(...state.orchestratorEvents.map(e => this.saveOrchestratorEvent(e)));
    }
    
    if (state.config) {
      promises.push(this.saveConfig(state.config));
    }
    
    if (state.a11yConfig) {
      promises.push(this.saveA11yConfig(state.a11yConfig));
    }
    
    if (state.preferences) {
      promises.push(this.savePreferences(state.preferences));
    }
    
    await Promise.all(promises);
    await this.flushPendingWrites();
  }
  
  // ============ Session Management ============
  
  async clearCurrentSession(): Promise<void> {
    if (!this.db || !this.currentSessionId) return;
    
    const sessionId = this.currentSessionId;
    
    // Delete all data for current session
    const tx = this.db.transaction(
      ['messages', 'thoughts', 'events', 'eventBatches', 'sessions'],
      'readwrite'
    );
    
    // Get and delete messages
    const messages = await tx.objectStore('messages').index('by-session').getAllKeys(sessionId);
    await Promise.all(messages.map(k => tx.objectStore('messages').delete(k)));
    
    // Get and delete thoughts  
    const thoughts = await tx.objectStore('thoughts').index('by-session').getAllKeys(sessionId);
    await Promise.all(thoughts.map(k => tx.objectStore('thoughts').delete(k)));
    
    // Get and delete events
    const events = await tx.objectStore('events').index('by-session').getAllKeys(sessionId);
    await Promise.all(events.map(k => tx.objectStore('events').delete(k)));
    
    // Get and delete batches
    const batches = await tx.objectStore('eventBatches').index('by-session').getAllKeys(sessionId);
    await Promise.all(batches.map(k => tx.objectStore('eventBatches').delete(k)));
    
    // Delete session
    await tx.objectStore('sessions').delete(sessionId);
    
    await tx.done;
    
    // Create new session
    await this.createSession();
  }
  
  async newSession(): Promise<void> {
    await this.flushPendingWrites();
    await this.createSession();
  }
  
  async getSessions(limit = 10): Promise<AtlasSession[]> {
    if (!this.db) return [];
    
    const sessions = await this.db.getAllFromIndex('sessions', 'by-updated');
    return sessions.slice(-limit).reverse();
  }
  
  async loadSession(sessionId: string): Promise<boolean> {
    if (!this.db) return false;
    
    const session = await this.db.get('sessions', sessionId);
    if (!session) return false;
    
    // Save any pending writes for current session
    await this.flushPendingWrites();
    
    this.currentSessionId = sessionId;
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
    
    // Update session access time
    await this.db.put('sessions', {
      ...session,
      updatedAt: Date.now(),
    });
    
    return true;
  }
  
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
  
  // ============ Cleanup ============
  
  async close(): Promise<void> {
    await this.flushPendingWrites();
    this.stopAutoSave();
    this.db?.close();
    this.db = null;
  }
}

// ============ Singleton ============

let persistenceInstance: AtlasPersistence | null = null;

export function getAtlasPersistence(): AtlasPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new AtlasPersistence();
  }
  return persistenceInstance;
}

/**
 * Initialize persistence (call early in app lifecycle)
 */
export async function initAtlasPersistence(): Promise<AtlasPersistence> {
  const persistence = getAtlasPersistence();
  await persistence.init();
  return persistence;
}
