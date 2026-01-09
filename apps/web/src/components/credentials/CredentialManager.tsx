/**
 * CredentialManager Component
 *
 * UI for managing stored credentials, generating passwords, and viewing usage.
 */

import React, { useState, useCallback } from 'react';
import { useCredentials } from '../../hooks/useCredentials';
import type { Credential } from '../../services/credentialService';

interface CredentialManagerProps {
  onClose: () => void;
  onSelectCredential?: (credential: Credential) => void;
  filterTargetId?: string;
  filterType?: Credential['type'];
}

export const CredentialManager: React.FC<CredentialManagerProps> = ({
  onClose,
  onSelectCredential,
  filterTargetId,
  filterType,
}) => {
  const {
    credentials,
    loading,
    create,
    update,
    remove,
    generatePassword,
    generatePassphrase,
  } = useCredentials();

  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassword, setShowPassword] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter credentials based on props and search
  const filteredCredentials = credentials.filter((cred) => {
    if (filterTargetId && cred.targetId !== filterTargetId) return false;
    if (filterType && cred.type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        cred.name.toLowerCase().includes(query) ||
        cred.username.toLowerCase().includes(query) ||
        cred.host?.toLowerCase().includes(query) ||
        cred.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (confirm('Are you sure you want to delete this credential?')) {
      await remove(id);
    }
  }, [remove]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <KeyIcon className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">Credential Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm rounded ${
              view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            All Credentials
          </button>
          <button
            onClick={() => {
              setView('add');
              setEditingCredential(null);
            }}
            className={`px-3 py-1.5 text-sm rounded ${
              view === 'add' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Add New
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
            </div>
          ) : view === 'list' ? (
            <CredentialList
              credentials={filteredCredentials}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              showPassword={showPassword}
              onTogglePassword={(id) => setShowPassword(showPassword === id ? null : id)}
              copiedId={copiedId}
              onCopy={handleCopy}
              onEdit={(cred) => {
                setEditingCredential(cred);
                setView('edit');
              }}
              onDelete={handleDelete}
              onSelect={onSelectCredential}
            />
          ) : (
            <CredentialForm
              credential={view === 'edit' ? editingCredential : null}
              onSave={async (data) => {
                if (editingCredential) {
                  await update(editingCredential.id, data);
                } else {
                  await create(data as Omit<Credential, 'id' | 'createdAt' | 'usageCount'>);
                }
                setView('list');
                setEditingCredential(null);
              }}
              onCancel={() => {
                setView('list');
                setEditingCredential(null);
              }}
              generatePassword={generatePassword}
              generatePassphrase={generatePassphrase}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Credential List Component
interface CredentialListProps {
  credentials: Credential[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showPassword: string | null;
  onTogglePassword: (id: string) => void;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onEdit: (credential: Credential) => void;
  onDelete: (id: string) => void;
  onSelect?: (credential: Credential) => void;
}

const CredentialList: React.FC<CredentialListProps> = ({
  credentials,
  searchQuery,
  onSearchChange,
  showPassword,
  onTogglePassword,
  copiedId,
  onCopy,
  onEdit,
  onDelete,
  onSelect,
}) => (
  <div className="space-y-4">
    {/* Search */}
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search credentials..."
        className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
    </div>

    {/* List */}
    {credentials.length === 0 ? (
      <div className="text-center py-8 text-gray-500">
        {searchQuery ? 'No matching credentials found' : 'No credentials stored yet'}
      </div>
    ) : (
      <div className="space-y-2">
        {credentials.map((cred) => (
          <div
            key={cred.id}
            className="bg-gray-900 rounded-lg p-3 hover:bg-gray-850 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getTypeColor(cred.type)}`}>
                  {getTypeIcon(cred.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{cred.name}</span>
                    {cred.isGenerated && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-600/20 text-green-400 rounded">
                        Generated
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {cred.username}
                    {cred.host && `@${cred.host}`}
                    {cred.port && `:${cred.port}`}
                  </div>
                  {cred.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {cred.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {onSelect && (
                  <button
                    onClick={() => onSelect(cred)}
                    className="p-1.5 hover:bg-gray-700 rounded text-green-400"
                    title="Use credential"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onCopy(cred.password, cred.id)}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400"
                  title="Copy password"
                >
                  {copiedId === cred.id ? (
                    <CheckIcon className="w-4 h-4 text-green-400" />
                  ) : (
                    <CopyIcon className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onTogglePassword(cred.id)}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400"
                  title="Toggle password visibility"
                >
                  {showPassword === cred.id ? (
                    <EyeOffIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onEdit(cred)}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400"
                  title="Edit"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(cred.id)}
                  className="p-1.5 hover:bg-gray-700 rounded text-red-400"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showPassword === cred.id && (
              <div className="mt-2 p-2 bg-gray-800 rounded font-mono text-sm text-gray-300">
                {cred.password}
              </div>
            )}

            {cred.lastUsedAt && (
              <div className="text-xs text-gray-500 mt-2">
                Last used: {new Date(cred.lastUsedAt).toLocaleDateString()} • Used {cred.usageCount} times
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

// Credential Form Component
interface CredentialFormProps {
  credential: Credential | null;
  onSave: (data: Partial<Credential>) => Promise<void>;
  onCancel: () => void;
  generatePassword: (length?: number) => string;
  generatePassphrase: (wordCount?: number) => string;
}

const CredentialForm: React.FC<CredentialFormProps> = ({
  credential,
  onSave,
  onCancel,
  generatePassword,
  generatePassphrase,
}) => {
  const [name, setName] = useState(credential?.name || '');
  const [type, setType] = useState<Credential['type']>(credential?.type || 'ssh');
  const [username, setUsername] = useState(credential?.username || '');
  const [password, setPassword] = useState(credential?.password || '');
  const [host, setHost] = useState(credential?.host || '');
  const [port, setPort] = useState(credential?.port?.toString() || '');
  const [tags, setTags] = useState(credential?.tags.join(', ') || '');
  const [notes, setNotes] = useState(credential?.notes || '');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        type,
        username,
        password,
        host: host || undefined,
        port: port ? parseInt(port, 10) : undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        notes: notes || undefined,
        isGenerated: credential?.isGenerated || false,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="My Server SSH"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Credential['type'])}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ssh">SSH</option>
            <option value="api">API Key</option>
            <option value="database">Database</option>
            <option value="token">Token</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="root"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 pr-24 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="absolute right-1 top-1 flex gap-1">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400"
              >
                {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Generator */}
      <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg">
        <span className="text-xs text-gray-400">Generate:</span>
        <button
          type="button"
          onClick={() => setPassword(generatePassword(16))}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          16 chars
        </button>
        <button
          type="button"
          onClick={() => setPassword(generatePassword(24))}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          24 chars
        </button>
        <button
          type="button"
          onClick={() => setPassword(generatePassword(32))}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          32 chars
        </button>
        <button
          type="button"
          onClick={() => setPassword(generatePassphrase(4))}
          className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
        >
          Passphrase
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Host (optional)</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="192.168.1.100"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Port (optional)</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="22"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Tags (comma separated)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          placeholder="production, server, main"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : credential ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

// Helper functions
function getTypeColor(type: Credential['type']): string {
  switch (type) {
    case 'ssh': return 'bg-green-600/20 text-green-400';
    case 'api': return 'bg-blue-600/20 text-blue-400';
    case 'database': return 'bg-purple-600/20 text-purple-400';
    case 'token': return 'bg-yellow-600/20 text-yellow-400';
    default: return 'bg-gray-600/20 text-gray-400';
  }
}

function getTypeIcon(type: Credential['type']): React.ReactNode {
  switch (type) {
    case 'ssh': return <TerminalIcon className="w-4 h-4" />;
    case 'api': return <ApiIcon className="w-4 h-4" />;
    case 'database': return <DatabaseIcon className="w-4 h-4" />;
    case 'token': return <TokenIcon className="w-4 h-4" />;
    default: return <KeyIcon className="w-4 h-4" />;
  }
}

// Icons
const KeyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
  </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const TerminalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ApiIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const DatabaseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const TokenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

export default CredentialManager;
