/**
 * Vector Memory Store
 * 
 * FAISS-like in-browser vector database for storing user interactions,
 * events, DOM state, and agent memory in an append-only fashion.
 * 
 * Uses cosine similarity for semantic search over embedded events.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ============ Types ============

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: MemoryEventType;
  category: MemoryCategory;
  data: Record<string, unknown>;
  embedding?: Float32Array;
  metadata: {
    source: 'user' | 'system' | 'agent';
    sessionId: string;
    componentPath?: string;
    importance: number; // 0-1 scale for memory prioritization
  };
}

export type MemoryEventType =
  | 'click'
  | 'navigation'
  | 'view_change'
  | 'container_start'
  | 'container_stop'
  | 'service_connect'
  | 'service_disconnect'
  | 'mcp_connect'
  | 'mcp_disconnect'
  | 'tool_invoke'
  | 'model_switch'
  | 'dom_mutation'
  | 'user_input'
  | 'agent_action'
  | 'agent_request'
  | 'error'
  | 'capability_change'
  | 'image_pull'
  | 'image_build'
  | 'network_event'
  | 'file_change'
  | 'state_snapshot';

export type MemoryCategory =
  | 'interaction'
  | 'navigation'
  | 'service'
  | 'container'
  | 'agent'
  | 'model'
  | 'network'
  | 'file'
  | 'system';

export interface MemoryQuery {
  embedding?: Float32Array;
  types?: MemoryEventType[];
  categories?: MemoryCategory[];
  timeRange?: { start: number; end: number };
  source?: 'user' | 'system' | 'agent';
  limit?: number;
  minImportance?: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
}

interface VectorMemoryDBSchema extends DBSchema {
  memories: {
    key: string;
    value: MemoryEntry;
    indexes: {
      'by-timestamp': number;
      'by-type': MemoryEventType;
      'by-category': MemoryCategory;
      'by-session': string;
    };
  };
  embeddings: {
    key: string;
    value: {
      id: string;
      vector: number[];
    };
  };
  sessions: {
    key: string;
    value: {
      id: string;
      startTime: number;
      endTime?: number;
      metadata: Record<string, unknown>;
    };
  };
}

// ============ Vector Operations ============

function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

function normalizeVector(vector: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  
  const normalized = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = norm === 0 ? 0 : vector[i] / norm;
  }
  return normalized;
}

// Simple text embedding using character n-grams
// In production, replace with a proper embedding model
function simpleTextEmbed(text: string, dimensions: number = 256): Float32Array {
  const embedding = new Float32Array(dimensions);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  
  // Character-level features
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = charCode % dimensions;
    embedding[idx] += 1;
    
    // Bigrams
    if (i < normalized.length - 1) {
      const bigramIdx = (charCode * 31 + normalized.charCodeAt(i + 1)) % dimensions;
      embedding[bigramIdx] += 0.5;
    }
    
    // Trigrams
    if (i < normalized.length - 2) {
      const trigramIdx = (charCode * 31 * 31 + normalized.charCodeAt(i + 1) * 31 + normalized.charCodeAt(i + 2)) % dimensions;
      embedding[trigramIdx] += 0.25;
    }
  }
  
  return normalizeVector(embedding);
}

// ============ Memory Store Class ============

export class VectorMemoryStore {
  private db: IDBPDatabase<VectorMemoryDBSchema> | null = null;
  private memoryCache: Map<string, MemoryEntry> = new Map();
  private embeddingIndex: Map<string, Float32Array> = new Map();
  private sessionId: string;
  private subscribers: Set<(entry: MemoryEntry) => void> = new Set();
  private maxCacheSize = 10000;
  private embeddingDimensions = 256;

  constructor() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async initialize(): Promise<void> {
    this.db = await openDB<VectorMemoryDBSchema>('vector-memory', 1, {
      upgrade(db) {
        // Memories store
        const memoryStore = db.createObjectStore('memories', { keyPath: 'id' });
        memoryStore.createIndex('by-timestamp', 'timestamp');
        memoryStore.createIndex('by-type', 'type');
        memoryStore.createIndex('by-category', 'category');
        memoryStore.createIndex('by-session', 'metadata.sessionId');

        // Embeddings store (separate for efficiency)
        db.createObjectStore('embeddings', { keyPath: 'id' });

        // Sessions store
        db.createObjectStore('sessions', { keyPath: 'id' });
      },
    });

    // Start session
    await this.db.put('sessions', {
      id: this.sessionId,
      startTime: Date.now(),
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
    });

    // Load recent memories into cache
    await this.loadRecentToCache(1000);
  }

  private async loadRecentToCache(limit: number): Promise<void> {
    if (!this.db) return;

    const entries = await this.db.getAllFromIndex('memories', 'by-timestamp');
    const recent = entries.slice(-limit);

    for (const entry of recent) {
      this.memoryCache.set(entry.id, entry);
      
      // Load embedding
      const embeddingRecord = await this.db.get('embeddings', entry.id);
      if (embeddingRecord) {
        this.embeddingIndex.set(entry.id, new Float32Array(embeddingRecord.vector));
      }
    }
  }

  // ============ Core Operations ============

  async append(
    type: MemoryEventType,
    category: MemoryCategory,
    data: Record<string, unknown>,
    options: {
      source?: 'user' | 'system' | 'agent';
      componentPath?: string;
      importance?: number;
      embedText?: string;
    } = {}
  ): Promise<MemoryEntry> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // Generate embedding from data
    const embedText = options.embedText || JSON.stringify(data);
    const embedding = simpleTextEmbed(embedText, this.embeddingDimensions);

    const entry: MemoryEntry = {
      id,
      timestamp: Date.now(),
      type,
      category,
      data,
      embedding,
      metadata: {
        source: options.source || 'system',
        sessionId: this.sessionId,
        componentPath: options.componentPath,
        importance: options.importance ?? 0.5,
      },
    };

    // Store in IndexedDB
    if (this.db) {
      await this.db.put('memories', entry);
      await this.db.put('embeddings', {
        id,
        vector: Array.from(embedding),
      });
    }

    // Update cache
    this.memoryCache.set(id, entry);
    this.embeddingIndex.set(id, embedding);

    // Evict old entries if cache is full
    if (this.memoryCache.size > this.maxCacheSize) {
      const oldest = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 100);
      
      for (const [key] of oldest) {
        this.memoryCache.delete(key);
        this.embeddingIndex.delete(key);
      }
    }

    // Notify subscribers
    this.subscribers.forEach(callback => callback(entry));

    return entry;
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const limit = query.limit ?? 10;
    let candidates: MemoryEntry[] = [];

    // Get candidates from cache or DB
    if (this.memoryCache.size > 0) {
      candidates = Array.from(this.memoryCache.values());
    } else if (this.db) {
      candidates = await this.db.getAll('memories');
    }

    // Filter by criteria
    candidates = candidates.filter(entry => {
      if (query.types && !query.types.includes(entry.type)) return false;
      if (query.categories && !query.categories.includes(entry.category)) return false;
      if (query.source && entry.metadata.source !== query.source) return false;
      if (query.minImportance && entry.metadata.importance < query.minImportance) return false;
      if (query.timeRange) {
        if (entry.timestamp < query.timeRange.start || entry.timestamp > query.timeRange.end) {
          return false;
        }
      }
      return true;
    });

    // Score by embedding similarity if query embedding provided
    let results: MemorySearchResult[];
    
    if (query.embedding) {
      results = candidates.map(entry => {
        const entryEmbedding = this.embeddingIndex.get(entry.id) || entry.embedding;
        const score = entryEmbedding 
          ? cosineSimilarity(query.embedding!, entryEmbedding)
          : 0;
        return { entry, score };
      });
      
      results.sort((a, b) => b.score - a.score);
    } else {
      // Sort by recency if no embedding query
      results = candidates
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(entry => ({ entry, score: 1 }));
    }

    return results.slice(0, limit);
  }

  async semanticSearch(text: string, options: Omit<MemoryQuery, 'embedding'> = {}): Promise<MemorySearchResult[]> {
    const embedding = simpleTextEmbed(text, this.embeddingDimensions);
    return this.search({ ...options, embedding });
  }

  async getRecent(limit: number = 100): Promise<MemoryEntry[]> {
    const results = await this.search({ limit });
    return results.map(r => r.entry);
  }

  async getByType(type: MemoryEventType, limit: number = 100): Promise<MemoryEntry[]> {
    const results = await this.search({ types: [type], limit });
    return results.map(r => r.entry);
  }

  async getByCategory(category: MemoryCategory, limit: number = 100): Promise<MemoryEntry[]> {
    const results = await this.search({ categories: [category], limit });
    return results.map(r => r.entry);
  }

  async getSessionMemories(sessionId?: string): Promise<MemoryEntry[]> {
    const targetSession = sessionId || this.sessionId;
    
    if (this.db) {
      return this.db.getAllFromIndex('memories', 'by-session', targetSession);
    }
    
    return Array.from(this.memoryCache.values())
      .filter(e => e.metadata.sessionId === targetSession);
  }

  // ============ Subscription ============

  subscribe(callback: (entry: MemoryEntry) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // ============ State Snapshots ============

  async takeSnapshot(label: string, state: Record<string, unknown>): Promise<MemoryEntry> {
    return this.append('state_snapshot', 'system', {
      label,
      state,
      snapshotTime: Date.now(),
    }, {
      source: 'system',
      importance: 0.8,
      embedText: `state snapshot ${label} ${JSON.stringify(state).slice(0, 500)}`,
    });
  }

  // ============ Export/Import ============

  async exportMemories(filter?: MemoryQuery): Promise<MemoryEntry[]> {
    if (filter) {
      const results = await this.search({ ...filter, limit: Infinity });
      return results.map(r => r.entry);
    }
    
    if (this.db) {
      return this.db.getAll('memories');
    }
    
    return Array.from(this.memoryCache.values());
  }

  async importMemories(entries: MemoryEntry[]): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(['memories', 'embeddings'], 'readwrite');
    
    for (const entry of entries) {
      await tx.objectStore('memories').put(entry);
      if (entry.embedding) {
        await tx.objectStore('embeddings').put({
          id: entry.id,
          vector: Array.from(entry.embedding),
        });
      }
    }
    
    await tx.done;
    await this.loadRecentToCache(1000);
  }

  // ============ Statistics ============

  async getStats(): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    sessionCount: number;
  }> {
    const memories = await this.exportMemories();
    
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    
    for (const mem of memories) {
      byType[mem.type] = (byType[mem.type] || 0) + 1;
      byCategory[mem.category] = (byCategory[mem.category] || 0) + 1;
    }

    const sessions = this.db ? await this.db.getAll('sessions') : [];

    return {
      totalMemories: memories.length,
      byType,
      byCategory,
      sessionCount: sessions.length,
    };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async close(): Promise<void> {
    // End session
    if (this.db) {
      const session = await this.db.get('sessions', this.sessionId);
      if (session) {
        session.endTime = Date.now();
        await this.db.put('sessions', session);
      }
    }
    
    this.db?.close();
    this.memoryCache.clear();
    this.embeddingIndex.clear();
    this.subscribers.clear();
  }
}

// ============ Singleton Instance ============

let memoryStoreInstance: VectorMemoryStore | null = null;

export async function getMemoryStore(): Promise<VectorMemoryStore> {
  if (!memoryStoreInstance) {
    memoryStoreInstance = new VectorMemoryStore();
    await memoryStoreInstance.initialize();
  }
  return memoryStoreInstance;
}

export function getMemoryStoreSync(): VectorMemoryStore | null {
  return memoryStoreInstance;
}
