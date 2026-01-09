import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrowserAtlasStore,
  createBrowserAtlasStore,
  FileMetadata,
  FileFilter,
  ManifestType,
  StoreStats,
} from '@qemuweb/storage';

interface FilesManagerProps {
  onFileSelect?: (file: FileMetadata) => void;
  onError?: (error: Error) => void;
}

export const FilesManager: React.FC<FilesManagerProps> = ({
  onFileSelect,
  onError,
}) => {
  const [store, setStore] = useState<BrowserAtlasStore | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FileFilter>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize store
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const atlasStore = await createBrowserAtlasStore();
        if (mounted) {
          setStore(atlasStore);
          await refreshFiles(atlasStore);
          const storeStats = await atlasStore.getStats();
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
    };
  }, [onError]);

  const refreshFiles = useCallback(
    async (atlasStore: BrowserAtlasStore) => {
      try {
        const currentFilter: FileFilter = {
          ...filter,
          namePattern: searchQuery || undefined,
        };
        const fileList = await atlasStore.listFiles(currentFilter);
        setFiles(fileList);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [filter, searchQuery, onError]
  );

  useEffect(() => {
    if (store) {
      refreshFiles(store);
    }
  }, [store, refreshFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!store || !e.target.files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const buffer = await file.arrayBuffer();
        const type = inferFileType(file.name, file.type);

        await store.storeFile(file.name, buffer, {
          type,
          mimeType: file.type || undefined,
          origin: 'uploaded',
          tags: [],
          sharedWithAssistant: false,
        });
      }

      await refreshFiles(store);
      const storeStats = await store.getStats();
      setStats(storeStats);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (file: FileMetadata) => {
    if (!store) return;

    if (!confirm(`Delete "${file.name}"?`)) return;

    try {
      await store.deleteFile(file.name);
      await refreshFiles(store);
      const storeStats = await store.getStats();
      setStats(storeStats);
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleBulkDelete = async () => {
    if (!store || selectedFiles.size === 0) return;

    if (!confirm(`Delete ${selectedFiles.size} file(s)?`)) return;

    try {
      for (const id of selectedFiles) {
        const file = files.find((f) => f.id === id);
        if (file) {
          await store.deleteFile(file.name);
        }
      }

      setSelectedFiles(new Set());
      await refreshFiles(store);
      const storeStats = await store.getStats();
      setStats(storeStats);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleExport = async () => {
    if (!store || selectedFiles.size === 0) return;

    try {
      const fileNames = files
        .filter((f) => selectedFiles.has(f.id))
        .map((f) => f.name);

      const blob = await store.exportBundle(fileNames);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atlas-export-${Date.now()}.atlasbundle`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!store || !e.target.files?.length) return;

    setUploading(true);
    try {
      const file = e.target.files[0];
      const result = await store.importBundle(file);

      alert(
        `Imported ${result.imported.length} file(s), ` +
          `skipped ${result.skipped.length}, ` +
          `failed ${result.failed.length}`
      );

      await refreshFiles(store);
      const storeStats = await store.getStats();
      setStats(storeStats);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setUploading(false);
    }
  };

  const handleToggleShared = async (file: FileMetadata) => {
    if (!store) return;

    try {
      await store.updateFile(file.name, {
        sharedWithAssistant: !file.sharedWithAssistant,
      });
      await refreshFiles(store);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDownload = async (file: FileMetadata) => {
    if (!store) return;

    try {
      const data = await store.readFile(file.name);
      if (!data) {
        throw new Error('File data not found');
      }

      const blob = new Blob([data], { type: file.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleGarbageCollect = async () => {
    if (!store) return;

    try {
      const result = await store.garbageCollect();
      alert(
        `Garbage collection complete: ` +
          `deleted ${result.deletedBlobs} blobs, ` +
          `freed ${formatBytes(result.freedBytes)}`
      );
      const storeStats = await store.getStats();
      setStats(storeStats);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Files</h2>
          {stats && (
            <p className="text-sm text-gray-500">
              {stats.totalFiles} files • {formatBytes(stats.totalBytes)} used
              {stats.quotaBytes && ` of ${formatBytes(stats.quotaBytes)}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
          />

          <label className="px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            Import Bundle
            <input
              type="file"
              accept=".atlasbundle"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className={`px-4 py-2 border rounded-lg ${
            showFilterPanel ? 'bg-indigo-50 border-indigo-300' : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          Filters
        </button>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={(filter.type as string) || ''}
                onChange={(e) =>
                  setFilter({ ...filter, type: e.target.value as ManifestType || undefined })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All types</option>
                <option value="qcow2">QCOW2 Disk</option>
                <option value="raw-disk">Raw Disk</option>
                <option value="wasm">WebAssembly</option>
                <option value="kernel">Kernel</option>
                <option value="initrd">Initrd</option>
                <option value="config">Config</option>
                <option value="script">Script</option>
                <option value="bundle">Bundle</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shared with Assistant
              </label>
              <select
                value={
                  filter.sharedWithAssistant === undefined
                    ? ''
                    : filter.sharedWithAssistant.toString()
                }
                onChange={(e) =>
                  setFilter({
                    ...filter,
                    sharedWithAssistant:
                      e.target.value === '' ? undefined : e.target.value === 'true',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All</option>
                <option value="true">Shared</option>
                <option value="false">Not shared</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilter({})}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedFiles.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-indigo-50 rounded-lg">
          <span className="text-sm font-medium text-indigo-700">
            {selectedFiles.size} file(s) selected
          </span>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm bg-white border border-indigo-300 rounded-lg hover:bg-indigo-100"
          >
            Export Bundle
          </button>
          <button
            onClick={handleBulkDelete}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 border border-red-300 rounded-lg hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      )}

      {/* File List */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === files.length && files.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Origin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Shared
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No files found. Upload files to get started.
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr
                  key={file.id}
                  className={`hover:bg-gray-50 ${
                    selectedFiles.has(file.id) ? 'bg-indigo-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td
                    className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:text-indigo-600"
                    onClick={() => onFileSelect?.(file)}
                  >
                    {file.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(
                        file.type
                      )}`}
                    >
                      {file.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatBytes(file.size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{file.origin}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleShared(file)}
                      className={`p-1 rounded ${
                        file.sharedWithAssistant
                          ? 'text-indigo-600 bg-indigo-100'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title={
                        file.sharedWithAssistant
                          ? 'Click to unshare with assistant'
                          : 'Click to share with assistant'
                      }
                    >
                      <ShareIcon className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Download"
                      >
                        <DownloadIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleGarbageCollect}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Run Garbage Collection
        </button>
      </div>
    </div>
  );
};

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getTypeColor(type: ManifestType): string {
  const colors: Record<ManifestType, string> = {
    qcow2: 'bg-purple-100 text-purple-800',
    'raw-disk': 'bg-blue-100 text-blue-800',
    wasm: 'bg-green-100 text-green-800',
    kernel: 'bg-orange-100 text-orange-800',
    initrd: 'bg-yellow-100 text-yellow-800',
    config: 'bg-gray-100 text-gray-800',
    script: 'bg-cyan-100 text-cyan-800',
    plan: 'bg-indigo-100 text-indigo-800',
    report: 'bg-pink-100 text-pink-800',
    bundle: 'bg-teal-100 text-teal-800',
    upload: 'bg-rose-100 text-rose-800',
    other: 'bg-gray-100 text-gray-600',
  };
  return colors[type] || colors.other;
}

// ============ Icons ============

const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
    />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);
