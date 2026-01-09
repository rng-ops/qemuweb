/**
 * Audit Log Viewer Component
 * 
 * Displays the cryptographically signed audit log with:
 * - Real-time updates
 * - Filtering by type, risk level, search
 * - Verification status
 * - Export functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuditEntry, AuditEventType, AuditQuery, AuditStats, getAuditLog } from '../../services/auditLog';
import { ToolRiskLevel } from '../../services/agentTools';

// ============ Type Badges ============

const typeConfig: Record<AuditEventType, { icon: string; label: string; color: string }> = {
  tool_invocation: { icon: '🔧', label: 'Tool', color: 'bg-blue-500/20 text-blue-400' },
  approval_requested: { icon: '❓', label: 'Approval', color: 'bg-yellow-500/20 text-yellow-400' },
  approval_granted: { icon: '✓', label: 'Approved', color: 'bg-green-500/20 text-green-400' },
  approval_denied: { icon: '✕', label: 'Denied', color: 'bg-red-500/20 text-red-400' },
  navigation: { icon: '🧭', label: 'Nav', color: 'bg-purple-500/20 text-purple-400' },
  user_action: { icon: '👆', label: 'Action', color: 'bg-cyan-500/20 text-cyan-400' },
  agent_message: { icon: '💬', label: 'Message', color: 'bg-indigo-500/20 text-indigo-400' },
  system_event: { icon: '⚙️', label: 'System', color: 'bg-gray-500/20 text-gray-400' },
  error: { icon: '❌', label: 'Error', color: 'bg-red-600/20 text-red-400' },
};

const riskConfig: Record<ToolRiskLevel, { color: string; label: string }> = {
  safe: { color: 'text-green-400', label: 'Safe' },
  low: { color: 'text-blue-400', label: 'Low' },
  medium: { color: 'text-yellow-400', label: 'Medium' },
  high: { color: 'text-orange-400', label: 'High' },
  critical: { color: 'text-red-400', label: 'Critical' },
};

// ============ Entry Component ============

interface AuditEntryRowProps {
  entry: AuditEntry;
  expanded: boolean;
  onToggle: () => void;
}

const AuditEntryRow: React.FC<AuditEntryRowProps> = ({ entry, expanded, onToggle }) => {
  const config = typeConfig[entry.type];
  const risk = entry.metadata.riskLevel ? riskConfig[entry.metadata.riskLevel] : null;
  const time = new Date(entry.timestamp);

  return (
    <div className="border-b border-zinc-700/50 hover:bg-zinc-800/30 transition-colors">
      <div 
        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
        onClick={onToggle}
      >
        {/* Time */}
        <div className="text-xs text-zinc-500 font-mono w-16 flex-shrink-0">
          {time.toLocaleTimeString('en-US', { hour12: false })}
        </div>

        {/* Type badge */}
        <div className={`px-2 py-0.5 rounded text-xs font-medium ${config.color} flex items-center gap-1`}>
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </div>

        {/* Risk level */}
        {risk && (
          <div className={`text-xs font-medium ${risk.color}`}>
            {risk.label}
          </div>
        )}

        {/* Summary */}
        <div className="flex-1 text-sm text-zinc-300 truncate">
          {getSummary(entry)}
        </div>

        {/* Verification */}
        <div className="flex items-center gap-1" title={entry.verified ? 'Signature verified' : 'Unverified'}>
          {entry.verified ? (
            <span className="text-green-500">🔐</span>
          ) : (
            <span className="text-yellow-500">⚠️</span>
          )}
        </div>

        {/* Expand icon */}
        <svg 
          className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-zinc-900/50">
          <div className="grid grid-cols-2 gap-4 text-xs mb-3">
            <div>
              <span className="text-zinc-500">ID:</span>
              <span className="ml-2 font-mono text-zinc-400">{entry.id}</span>
            </div>
            <div>
              <span className="text-zinc-500">Session:</span>
              <span className="ml-2 font-mono text-zinc-400">{entry.metadata.sessionId.slice(0, 16)}...</span>
            </div>
            <div>
              <span className="text-zinc-500">Hash:</span>
              <span className="ml-2 font-mono text-zinc-400">{entry.hash.slice(0, 16)}...</span>
            </div>
            {entry.previousHash && (
              <div>
                <span className="text-zinc-500">Prev Hash:</span>
                <span className="ml-2 font-mono text-zinc-400">{entry.previousHash.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {entry.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {entry.metadata.tags.map((tag, i) => (
                <span 
                  key={i}
                  className="px-1.5 py-0.5 bg-zinc-700/50 rounded text-xs text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Data */}
          <details className="mt-2">
            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
              View Raw Data
            </summary>
            <pre className="mt-2 p-2 bg-black/50 rounded text-xs text-zinc-400 overflow-auto max-h-48">
              {JSON.stringify(entry.data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

function getSummary(entry: AuditEntry): string {
  const data = entry.data;
  
  switch (entry.type) {
    case 'tool_invocation':
      return `${data.toolName} - ${data.status}`;
    case 'approval_requested':
      return `Request: ${data.toolName}`;
    case 'approval_granted':
    case 'approval_denied':
      return `Approval ${data.approved ? 'granted' : 'denied'}`;
    case 'agent_message':
      return `${data.role}: ${String(data.content).slice(0, 50)}...`;
    case 'navigation':
      return `${data.from} → ${data.to}`;
    case 'error':
      return String(data.message).slice(0, 60);
    default:
      return entry.metadata.searchableText.slice(0, 60);
  }
}

// ============ Stats Bar ============

interface StatsBarProps {
  stats: AuditStats | null;
}

const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-zinc-800/50 border-b border-zinc-700/50 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-zinc-500">Total:</span>
        <span className="text-zinc-300 font-medium">{stats.totalEntries}</span>
      </div>
      
      <div className="flex items-center gap-1">
        <span className="text-zinc-500">Chain:</span>
        <span className={stats.chainIntegrity ? 'text-green-400' : 'text-red-400'}>
          {stats.chainIntegrity ? '✓ Valid' : '✕ Broken'}
        </span>
      </div>

      {stats.entriesByRiskLevel.critical > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-red-400">⚠ {stats.entriesByRiskLevel.critical} critical</span>
        </div>
      )}

      {stats.entriesByType.error > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-red-400">❌ {stats.entriesByType.error} errors</span>
        </div>
      )}
    </div>
  );
};

// ============ Filter Bar ============

interface FilterBarProps {
  query: AuditQuery;
  onQueryChange: (query: AuditQuery) => void;
  onExport: () => void;
  onVerify: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ query, onQueryChange, onExport, onVerify }) => {
  const [searchText, setSearchText] = useState(query.searchText || '');

  const handleSearch = () => {
    onQueryChange({ ...query, searchText: searchText || undefined });
  };

  return (
    <div className="px-3 py-2 bg-zinc-800/30 border-b border-zinc-700/50 space-y-2">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search logs..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
        <button
          onClick={handleSearch}
          className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-zinc-300 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Type filter */}
        <select
          value={Array.isArray(query.type) ? query.type[0] : query.type || ''}
          onChange={(e) => onQueryChange({ 
            ...query, 
            type: e.target.value ? e.target.value as AuditEventType : undefined 
          })}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
        >
          <option value="">All Types</option>
          {Object.entries(typeConfig).map(([type, config]) => (
            <option key={type} value={type}>{config.icon} {config.label}</option>
          ))}
        </select>

        {/* Risk filter */}
        <select
          value={query.riskLevel?.[0] || ''}
          onChange={(e) => onQueryChange({ 
            ...query, 
            riskLevel: e.target.value ? [e.target.value as ToolRiskLevel] : undefined 
          })}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
        >
          <option value="">All Risks</option>
          {Object.entries(riskConfig).map(([level, config]) => (
            <option key={level} value={level}>{config.label}</option>
          ))}
        </select>

        {/* Time range */}
        <select
          onChange={(e) => {
            const now = Date.now();
            const ranges: Record<string, number> = {
              '1h': 3600000,
              '24h': 86400000,
              '7d': 604800000,
            };
            const range = ranges[e.target.value];
            onQueryChange({
              ...query,
              startTime: range ? now - range : undefined,
            });
          }}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
        >
          <option value="">All Time</option>
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 Days</option>
        </select>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={onVerify}
          className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          🔐 Verify Chain
        </button>
        <button
          onClick={onExport}
          className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          📥 Export
        </button>
      </div>
    </div>
  );
};

// ============ Main Audit Log Viewer ============

interface AuditLogViewerProps {
  className?: string;
  compact?: boolean;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ className = '', compact = false }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [query, setQuery] = useState<AuditQuery>({ limit: 100 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load entries
  const loadEntries = useCallback(async () => {
    try {
      const auditLog = await getAuditLog();
      const [newEntries, newStats] = await Promise.all([
        auditLog.query(query),
        auditLog.getStats(),
      ]);
      setEntries(newEntries);
      setStats(newStats);
    } catch (error) {
      console.error('[AuditLogViewer] Failed to load entries:', error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Listen for real-time updates
  useEffect(() => {
    const handleNewEntry = (event: CustomEvent<AuditEntry>) => {
      setEntries(prev => [event.detail, ...prev].slice(0, query.limit || 100));
    };

    window.addEventListener('auditlog:entry', handleNewEntry as EventListener);
    return () => window.removeEventListener('auditlog:entry', handleNewEntry as EventListener);
  }, [query.limit]);

  const handleExport = async () => {
    try {
      const auditLog = await getAuditLog();
      const exportData = await auditLog.export();
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[AuditLogViewer] Export failed:', error);
    }
  };

  const handleVerify = async () => {
    try {
      const auditLog = await getAuditLog();
      const valid = await auditLog.verifyChain();
      alert(valid ? '✓ Chain integrity verified!' : '✕ Chain integrity check failed!');
    } catch (error) {
      console.error('[AuditLogViewer] Verification failed:', error);
      alert('Verification failed: ' + (error as Error).message);
    }
  };

  if (compact) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
          <span className="text-sm font-medium text-zinc-300">Audit Log</span>
          <span className="text-xs text-zinc-500">{entries.length} entries</span>
        </div>
        <div className="flex-1 overflow-auto">
          {entries.slice(0, 10).map(entry => (
            <div key={entry.id} className="px-3 py-1 border-b border-zinc-800/50 text-xs">
              <span className="text-zinc-500 font-mono">
                {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="mx-2">{typeConfig[entry.type].icon}</span>
              <span className="text-zinc-400">{getSummary(entry)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-zinc-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h2 className="font-medium text-zinc-200">Audit Log</h2>
        </div>
        <button
          onClick={loadEntries}
          className="p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filters */}
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        onExport={handleExport}
        onVerify={handleVerify}
      />

      {/* Entries */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-500">
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
            <span className="text-2xl mb-2">📭</span>
            <span>No entries found</span>
          </div>
        ) : (
          entries.map(entry => (
            <AuditEntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(prev => prev === entry.id ? null : entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default AuditLogViewer;
