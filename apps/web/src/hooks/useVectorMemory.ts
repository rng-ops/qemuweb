/**
 * React Hook for Vector Memory
 * 
 * Provides access to the vector memory store for semantic search,
 * appending memories, and retrieving context.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  VectorMemoryStore, 
  MemoryEntry, 
  MemoryEventType, 
  MemoryCategory,
  MemorySearchResult,
  getMemoryStore 
} from '../services/vectorMemory';

export interface UseVectorMemoryOptions {
  subscribeToUpdates?: boolean;
  maxRecentEntries?: number;
}

export interface UseVectorMemoryReturn {
  isReady: boolean;
  sessionId: string | null;
  recentEntries: MemoryEntry[];
  stats: {
    totalMemories: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  } | null;
  
  // Methods
  append: (
    type: MemoryEventType,
    category: MemoryCategory,
    data: Record<string, unknown>,
    options?: { importance?: number; embedText?: string }
  ) => Promise<MemoryEntry | null>;
  
  search: (
    query: string,
    options?: { types?: MemoryEventType[]; categories?: MemoryCategory[]; limit?: number }
  ) => Promise<MemorySearchResult[]>;
  
  getByType: (type: MemoryEventType, limit?: number) => Promise<MemoryEntry[]>;
  getByCategory: (category: MemoryCategory, limit?: number) => Promise<MemoryEntry[]>;
  
  takeSnapshot: (label: string, state: Record<string, unknown>) => Promise<MemoryEntry | null>;
  
  exportMemories: () => Promise<MemoryEntry[]>;
  refreshStats: () => Promise<void>;
}

export function useVectorMemory(options: UseVectorMemoryOptions = {}): UseVectorMemoryReturn {
  const { subscribeToUpdates = true, maxRecentEntries = 50 } = options;
  
  const [store, setStore] = useState<VectorMemoryStore | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recentEntries, setRecentEntries] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState<UseVectorMemoryReturn['stats']>(null);

  // Initialize store
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        const memoryStore = await getMemoryStore();
        setStore(memoryStore);
        setSessionId(memoryStore.getSessionId());
        setIsReady(true);

        // Load initial data
        const recent = await memoryStore.getRecent(maxRecentEntries);
        setRecentEntries(recent);

        const initialStats = await memoryStore.getStats();
        setStats(initialStats);

        // Subscribe to updates
        if (subscribeToUpdates) {
          unsubscribe = memoryStore.subscribe((entry) => {
            setRecentEntries(prev => {
              const updated = [entry, ...prev];
              return updated.slice(0, maxRecentEntries);
            });
          });
        }
      } catch (err) {
        console.error('Failed to initialize vector memory:', err);
      }
    };

    init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [subscribeToUpdates, maxRecentEntries]);

  // Append a new memory entry
  const append = useCallback(async (
    type: MemoryEventType,
    category: MemoryCategory,
    data: Record<string, unknown>,
    options?: { importance?: number; embedText?: string }
  ): Promise<MemoryEntry | null> => {
    if (!store) return null;
    
    return store.append(type, category, data, {
      source: 'user',
      importance: options?.importance,
      embedText: options?.embedText,
    });
  }, [store]);

  // Semantic search
  const search = useCallback(async (
    query: string,
    options?: { types?: MemoryEventType[]; categories?: MemoryCategory[]; limit?: number }
  ): Promise<MemorySearchResult[]> => {
    if (!store) return [];
    
    return store.semanticSearch(query, {
      types: options?.types,
      categories: options?.categories,
      limit: options?.limit || 10,
    });
  }, [store]);

  // Get by type
  const getByType = useCallback(async (type: MemoryEventType, limit = 50): Promise<MemoryEntry[]> => {
    if (!store) return [];
    return store.getByType(type, limit);
  }, [store]);

  // Get by category
  const getByCategory = useCallback(async (category: MemoryCategory, limit = 50): Promise<MemoryEntry[]> => {
    if (!store) return [];
    return store.getByCategory(category, limit);
  }, [store]);

  // Take a state snapshot
  const takeSnapshot = useCallback(async (label: string, state: Record<string, unknown>): Promise<MemoryEntry | null> => {
    if (!store) return null;
    return store.takeSnapshot(label, state);
  }, [store]);

  // Export all memories
  const exportMemories = useCallback(async (): Promise<MemoryEntry[]> => {
    if (!store) return [];
    return store.exportMemories();
  }, [store]);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    if (!store) return;
    const newStats = await store.getStats();
    setStats(newStats);
  }, [store]);

  return {
    isReady,
    sessionId,
    recentEntries,
    stats,
    append,
    search,
    getByType,
    getByCategory,
    takeSnapshot,
    exportMemories,
    refreshStats,
  };
}

export default useVectorMemory;
