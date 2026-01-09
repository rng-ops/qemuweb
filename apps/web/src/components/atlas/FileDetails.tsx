import React, { useState, useEffect } from 'react';
import {
  BrowserAtlasStore,
  createBrowserAtlasStore,
  FileMetadata,
  ProvenanceRecord,
  VerificationResult,
} from '@qemuweb/storage';

interface FileDetailsProps {
  file: FileMetadata;
  onClose: () => void;
  onUpdate?: (file: FileMetadata) => void;
  onError?: (error: Error) => void;
}

export const FileDetails: React.FC<FileDetailsProps> = ({
  file,
  onClose,
  onUpdate,
  onError,
}) => {
  const [store, setStore] = useState<BrowserAtlasStore | null>(null);
  const [provenance, setProvenance] = useState<ProvenanceRecord[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [currentFile, setCurrentFile] = useState(file);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const atlasStore = await createBrowserAtlasStore();
        if (mounted) {
          setStore(atlasStore);

          // Load provenance
          const records = await atlasStore.getProvenanceForManifest(file.manifestHash);
          setProvenance(records);
        }
      } catch (err) {
        if (mounted) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [file.manifestHash, onError]);

  const handleVerify = async () => {
    if (!store) return;

    setVerifying(true);
    try {
      const result = await store.verify(currentFile.name);
      setVerification(result);

      // Add verification provenance
      await store.addProvenance({
        manifestHash: currentFile.manifestHash,
        type: 'verify',
        actor: 'user',
        timestamp: new Date(),
        notes: result.ok ? 'Verification passed' : 'Verification failed',
      });

      const records = await store.getProvenanceForManifest(currentFile.manifestHash);
      setProvenance(records);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setVerifying(false);
    }
  };

  const handleRename = async () => {
    if (!store || newName === currentFile.name) {
      setEditingName(false);
      return;
    }

    try {
      const updated = await store.renameFile(currentFile.name, newName);
      setCurrentFile(updated);
      onUpdate?.(updated);
      setEditingName(false);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleAddTag = async () => {
    if (!store || !tagInput.trim()) return;

    try {
      const newTags = [...currentFile.tags, tagInput.trim()];
      const updated = await store.updateFile(currentFile.name, { tags: newTags });
      setCurrentFile(updated);
      onUpdate?.(updated);
      setTagInput('');
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!store) return;

    try {
      const newTags = currentFile.tags.filter((t) => t !== tag);
      const updated = await store.updateFile(currentFile.name, { tags: newTags });
      setCurrentFile(updated);
      onUpdate?.(updated);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleToggleShared = async () => {
    if (!store) return;

    try {
      const updated = await store.updateFile(currentFile.name, {
        sharedWithAssistant: !currentFile.sharedWithAssistant,
      });
      setCurrentFile(updated);
      onUpdate?.(updated);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={handleRename}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNewName(currentFile.name);
                    }}
                    className="px-3 py-1 text-gray-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <h2
                  className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-indigo-600"
                  onClick={() => setEditingName(true)}
                  title="Click to rename"
                >
                  {currentFile.name}
                </h2>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <p className="text-gray-900">{currentFile.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Size</label>
                <p className="text-gray-900">{formatBytes(currentFile.size)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Origin</label>
                <p className="text-gray-900">
                  {currentFile.origin}
                  {currentFile.originDetails && (
                    <span className="text-gray-500"> ({currentFile.originDetails})</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">MIME Type</label>
                <p className="text-gray-900">{currentFile.mimeType || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-gray-900">
                  {new Date(currentFile.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Updated</label>
                <p className="text-gray-900">
                  {new Date(currentFile.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Manifest Hash */}
            <div>
              <label className="text-sm font-medium text-gray-500">Manifest Hash</label>
              <p className="text-sm font-mono text-gray-700 break-all">
                {currentFile.manifestHash}
              </p>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-500">Tags</label>
                <button
                  onClick={() => setEditingTags(!editingTags)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {editingTags ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentFile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm bg-gray-100 text-gray-800"
                  >
                    {tag}
                    {editingTags && (
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-gray-500 hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {editingTags && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add tag..."
                      className="px-2 py-0.5 text-sm border border-gray-300 rounded"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-2 py-0.5 text-sm bg-indigo-600 text-white rounded"
                    >
                      Add
                    </button>
                  </div>
                )}
                {currentFile.tags.length === 0 && !editingTags && (
                  <span className="text-sm text-gray-400">No tags</span>
                )}
              </div>
            </div>

            {/* Shared with Assistant */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Share with Assistant</h4>
                <p className="text-sm text-gray-500">
                  Allow the AI assistant to access this file
                </p>
              </div>
              <button
                onClick={handleToggleShared}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  currentFile.sharedWithAssistant ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    currentFile.sharedWithAssistant ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Verification */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-500">Verification</label>
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify Integrity'}
                </button>
              </div>
              {verification && (
                <div
                  className={`p-3 rounded-lg ${
                    verification.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <p
                    className={`font-medium ${
                      verification.ok ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {verification.ok
                      ? '✓ All chunks verified successfully'
                      : '✗ Verification failed'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {verification.totalChunks} chunks checked •{' '}
                    {verification.missingBlobs.length} missing •{' '}
                    {verification.mismatchedBlobs.length} mismatched
                  </p>
                </div>
              )}
            </div>

            {/* Provenance */}
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-3">
                Provenance History
              </label>
              {provenance.length === 0 ? (
                <p className="text-sm text-gray-400">No provenance records</p>
              ) : (
                <div className="space-y-3">
                  {provenance.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <ProvenanceIcon type={record.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 capitalize">
                            {record.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            by {record.actor}
                            {record.actorDetails && ` (${record.actorDetails})`}
                          </span>
                        </div>
                        {record.notes && (
                          <p className="text-sm text-gray-600 mt-1">{record.notes}</p>
                        )}
                        {record.buildInfo && (
                          <p className="text-xs text-gray-500 mt-1">
                            Tool: {record.buildInfo.tool}
                            {record.buildInfo.gitSha && ` @ ${record.buildInfo.gitSha.slice(0, 8)}`}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(record.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ Helpers ============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Icons ============

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ProvenanceIcon: React.FC<{ type: string }> = ({ type }) => {
  const icons: Record<string, React.ReactNode> = {
    create: (
      <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
        +
      </span>
    ),
    derive: (
      <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
        →
      </span>
    ),
    import: (
      <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
        ↓
      </span>
    ),
    sync: (
      <span className="w-6 h-6 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
        ⟳
      </span>
    ),
    verify: (
      <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
        ✓
      </span>
    ),
    sign: (
      <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
        ✎
      </span>
    ),
    modify: (
      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
        ✏
      </span>
    ),
  };

  return <>{icons[type] || icons.modify}</>;
};
