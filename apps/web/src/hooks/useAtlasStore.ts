import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrowserAtlasStore,
  createBrowserAtlasStore,
  FileMetadata,
  FileFilter,
  StoreStats,
  ManifestType,
  FileOrigin,
} from '@qemuweb/storage';

interface UseAtlasStoreOptions {
  onError?: (error: Error) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAtlasStoreReturn {
  /** The underlying Atlas Store instance */
  store: BrowserAtlasStore | null;

  /** Loading state */
  loading: boolean;

  /** Store statistics */
  stats: StoreStats | null;

  /** List of files (based on current filter) */
  files: FileMetadata[];

  /** Current filter */
  filter: FileFilter;

  /** Set the file filter */
  setFilter: (filter: FileFilter) => void;

  /** Upload a file */
  uploadFile: (file: File, options?: UploadOptions) => Promise<FileMetadata>;

  /** Download a file as Blob */
  downloadFile: (name: string) => Promise<Blob | null>;

  /** Delete a file */
  deleteFile: (name: string) => Promise<boolean>;

  /** Rename a file */
  renameFile: (oldName: string, newName: string) => Promise<FileMetadata>;

  /** Update file metadata */
  updateFile: (name: string, updates: Partial<FileMetadata>) => Promise<FileMetadata>;

  /** Toggle file sharing with assistant */
  toggleShared: (name: string) => Promise<FileMetadata>;

  /** Refresh the file list */
  refresh: () => Promise<void>;

  /** Export files as bundle */
  exportBundle: (fileNames: string[]) => Promise<Blob>;

  /** Import bundle */
  importBundle: (bundle: Blob | File) => Promise<{
    imported: number;
    skipped: number;
    failed: number;
  }>;

  /** Run garbage collection */
  garbageCollect: () => Promise<{ deletedBlobs: number; freedBytes: number }>;
}

interface UploadOptions {
  type?: ManifestType;
  origin?: FileOrigin;
  originDetails?: string;
  tags?: string[];
  sharedWithAssistant?: boolean;
}

/**
 * React hook for working with the Atlas Store
 */
export function useAtlasStore(options: UseAtlasStoreOptions = {}): UseAtlasStoreReturn {
  const { onError, autoRefresh = false, refreshInterval = 30000 } = options;

  const [store, setStore] = useState<BrowserAtlasStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [filter, setFilter] = useState<FileFilter>({});

  const storeRef = useRef<BrowserAtlasStore | null>(null);

  // Initialize store
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const atlasStore = await createBrowserAtlasStore();
        if (mounted) {
          storeRef.current = atlasStore;
          setStore(atlasStore);

          const [fileList, storeStats] = await Promise.all([
            atlasStore.listFiles(filter),
            atlasStore.getStats(),
          ]);

          setFiles(fileList);
          setStats(storeStats);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      storeRef.current?.close();
    };
  }, [onError]);

  // Refresh on filter change
  useEffect(() => {
    if (storeRef.current) {
      storeRef.current.listFiles(filter).then(setFiles).catch((err) => {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }, [filter, onError]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !storeRef.current) return;

    const interval = setInterval(async () => {
      try {
        const [fileList, storeStats] = await Promise.all([
          storeRef.current!.listFiles(filter),
          storeRef.current!.getStats(),
        ]);
        setFiles(fileList);
        setStats(storeStats);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, filter, onError]);

  const refresh = useCallback(async () => {
    if (!storeRef.current) return;

    try {
      const [fileList, storeStats] = await Promise.all([
        storeRef.current.listFiles(filter),
        storeRef.current.getStats(),
      ]);
      setFiles(fileList);
      setStats(storeStats);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [filter, onError]);

  const uploadFile = useCallback(
    async (file: File, uploadOptions: UploadOptions = {}): Promise<FileMetadata> => {
      if (!storeRef.current) {
        throw new Error('Store not initialized');
      }

      const buffer = await file.arrayBuffer();
      const type = uploadOptions.type ?? inferFileType(file.name, file.type);

      const metadata = await storeRef.current.storeFile(file.name, buffer, {
        type,
        mimeType: file.type || undefined,
        origin: uploadOptions.origin ?? 'uploaded',
        originDetails: uploadOptions.originDetails,
        tags: uploadOptions.tags ?? [],
        sharedWithAssistant: uploadOptions.sharedWithAssistant ?? false,
      });

      await refresh();
      return metadata;
    },
    [refresh]
  );

  const downloadFile = useCallback(async (name: string): Promise<Blob | null> => {
    if (!storeRef.current) return null;

    const file = await storeRef.current.getFile(name);
    if (!file) return null;

    const data = await storeRef.current.readFile(name);
    if (!data) return null;

    return new Blob([data], { type: file.mimeType || 'application/octet-stream' });
  }, []);

  const deleteFile = useCallback(
    async (name: string): Promise<boolean> => {
      if (!storeRef.current) return false;

      const result = await storeRef.current.deleteFile(name);
      await refresh();
      return result;
    },
    [refresh]
  );

  const renameFile = useCallback(
    async (oldName: string, newName: string): Promise<FileMetadata> => {
      if (!storeRef.current) {
        throw new Error('Store not initialized');
      }

      const result = await storeRef.current.renameFile(oldName, newName);
      await refresh();
      return result;
    },
    [refresh]
  );

  const updateFile = useCallback(
    async (name: string, updates: Partial<FileMetadata>): Promise<FileMetadata> => {
      if (!storeRef.current) {
        throw new Error('Store not initialized');
      }

      const result = await storeRef.current.updateFile(name, updates);
      await refresh();
      return result;
    },
    [refresh]
  );

  const toggleShared = useCallback(
    async (name: string): Promise<FileMetadata> => {
      if (!storeRef.current) {
        throw new Error('Store not initialized');
      }

      const file = await storeRef.current.getFile(name);
      if (!file) {
        throw new Error(`File "${name}" not found`);
      }

      return updateFile(name, { sharedWithAssistant: !file.sharedWithAssistant });
    },
    [updateFile]
  );

  const exportBundle = useCallback(async (fileNames: string[]): Promise<Blob> => {
    if (!storeRef.current) {
      throw new Error('Store not initialized');
    }

    return storeRef.current.exportBundle(fileNames);
  }, []);

  const importBundle = useCallback(
    async (bundle: Blob | File) => {
      if (!storeRef.current) {
        throw new Error('Store not initialized');
      }

      const result = await storeRef.current.importBundle(bundle);
      await refresh();

      return {
        imported: result.imported.length,
        skipped: result.skipped.length,
        failed: result.failed.length,
      };
    },
    [refresh]
  );

  const garbageCollect = useCallback(async () => {
    if (!storeRef.current) {
      throw new Error('Store not initialized');
    }

    const result = await storeRef.current.garbageCollect();
    await refresh();
    return result;
  }, [refresh]);

  return {
    store,
    loading,
    stats,
    files,
    filter,
    setFilter,
    uploadFile,
    downloadFile,
    deleteFile,
    renameFile,
    updateFile,
    toggleShared,
    refresh,
    exportBundle,
    importBundle,
    garbageCollect,
  };
}

// ============ Helpers ============

function inferFileType(name: string, mimeType: string): ManifestType {
  const ext = name.split('.').pop()?.toLowerCase();

  if (ext === 'qcow2') return 'qcow2';
  if (ext === 'img' || ext === 'raw') return 'raw-disk';
  if (ext === 'wasm') return 'wasm';
  if (name.includes('vmlinuz') || name.includes('bzImage')) return 'kernel';
  if (name.includes('initrd') || name.includes('initramfs')) return 'initrd';
  if (ext === 'json' || ext === 'yaml' || ext === 'yml' || ext === 'toml') return 'config';
  if (ext === 'sh' || ext === 'py' || ext === 'js' || ext === 'ts') return 'script';
  if (ext === 'atlasbundle') return 'bundle';

  if (mimeType.startsWith('application/wasm')) return 'wasm';
  if (mimeType.includes('json') || mimeType.includes('yaml')) return 'config';

  return 'other';
}
