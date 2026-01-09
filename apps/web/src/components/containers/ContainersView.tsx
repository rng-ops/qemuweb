/**
 * ContainersView Component
 *
 * Dashboard showing available container images and running instances.
 * Replaces the welcome screen in the center panel.
 */

import React, { useState, useCallback } from 'react';
import type {
  ContainerImage,
  ContainerInstance,
  ContainerStatus,
  MCPServerConfig,
} from '@qemuweb/vm-config';

interface ContainersViewProps {
  images: ContainerImage[];
  instances: ContainerInstance[];
  selectedInstanceId: string | null;
  onInstanceSelect: (instanceId: string | null) => void;
  onStartInstance: (imageId: string, name?: string) => Promise<void>;
  onStopInstance: (instanceId: string) => Promise<void>;
  onConnectSSH: (instanceId: string) => void;
  onBrowseFiles: (instanceId: string) => void;
  onConfigureMCP: (instanceId: string, server: MCPServerConfig) => void;
}

export const ContainersView: React.FC<ContainersViewProps> = ({
  images,
  instances,
  selectedInstanceId,
  onInstanceSelect,
  onStartInstance,
  onStopInstance,
  onConnectSSH,
  onBrowseFiles,
  onConfigureMCP,
}) => {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [startingImage, setStartingImage] = useState<string | null>(null);

  const handleStart = useCallback(async (imageId: string) => {
    setStartingImage(imageId);
    try {
      await onStartInstance(imageId);
    } finally {
      setStartingImage(null);
    }
  }, [onStartInstance]);

  const filteredInstances = instances.filter((inst) => {
    if (filter === 'running') return inst.status === 'running';
    if (filter === 'stopped') return inst.status === 'stopped';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Containers</h2>
          <span className="px-2 py-0.5 text-xs bg-gray-700 rounded-full text-gray-300">
            {instances.length} instance{instances.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200"
          >
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
          </select>

          {/* View Toggle */}
          <div className="flex border border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 ${view === 'grid' ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              <GridIcon className="w-4 h-4 text-gray-300" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 ${view === 'list' ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              <ListIcon className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Available Images Section */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Available Images
          </h3>
          <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                view={view}
                isStarting={startingImage === image.id}
                onStart={() => handleStart(image.id)}
              />
            ))}
          </div>
        </section>

        {/* Running Instances Section */}
        <section>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Instances
          </h3>
          {filteredInstances.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ContainerIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No container instances</p>
              <p className="text-sm mt-1">Start an image above to create an instance</p>
            </div>
          ) : (
            <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
              {filteredInstances.map((instance) => (
                <InstanceCard
                  key={instance.id}
                  instance={instance}
                  image={images.find((img) => img.id === instance.imageId)}
                  view={view}
                  isSelected={selectedInstanceId === instance.id}
                  onSelect={() => onInstanceSelect(instance.id)}
                  onStop={() => onStopInstance(instance.id)}
                  onSSH={() => onConnectSSH(instance.id)}
                  onBrowse={() => onBrowseFiles(instance.id)}
                  onConfigureMCP={(server) => onConfigureMCP(instance.id, server)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// ============ Sub-Components ============

interface ImageCardProps {
  image: ContainerImage;
  view: 'grid' | 'list';
  isStarting: boolean;
  onStart: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, view, isStarting, onStart }) => {
  if (view === 'list') {
    return (
      <div className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
        <ImageTypeIcon type={image.type} className="w-8 h-8" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{image.name}</h4>
          <p className="text-sm text-gray-400 truncate">{image.description}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{image.memoryMiB} MiB</span>
          <span>•</span>
          <span>{image.mcpServers.length} MCP</span>
        </div>
        <button
          onClick={onStart}
          disabled={isStarting}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isStarting ? 'Starting...' : 'Start'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <ImageTypeIcon type={image.type} className="w-10 h-10" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white">{image.name}</h4>
            <p className="text-xs text-gray-400">{image.version}</p>
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{image.description}</p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {image.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <MemoryIcon className="w-3 h-3" />
            {image.memoryMiB} MiB
          </span>
          <span className="flex items-center gap-1">
            <PortIcon className="w-3 h-3" />
            {image.ports.length} ports
          </span>
          <span className="flex items-center gap-1">
            <MCPIcon className="w-3 h-3" />
            {image.mcpServers.length} MCP
          </span>
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700">
        <button
          onClick={onStart}
          disabled={isStarting}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isStarting ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <PlayIcon className="w-4 h-4" />
              Start Instance
            </>
          )}
        </button>
      </div>
    </div>
  );
};

interface InstanceCardProps {
  instance: ContainerInstance;
  image?: ContainerImage;
  view: 'grid' | 'list';
  isSelected: boolean;
  onSelect: () => void;
  onStop: () => void;
  onSSH: () => void;
  onBrowse: () => void;
  onConfigureMCP: (server: MCPServerConfig) => void;
}

const InstanceCard: React.FC<InstanceCardProps> = ({
  instance,
  image,
  view,
  isSelected,
  onSelect,
  onStop,
  onSSH,
  onBrowse,
  onConfigureMCP: _onConfigureMCP,
}) => {
  const [showMCPMenu, setShowMCPMenu] = useState(false);

  if (view === 'list') {
    return (
      <div
        onClick={onSelect}
        className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected
            ? 'bg-indigo-900/30 border-indigo-500'
            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
        }`}
      >
        <StatusIndicator status={instance.status} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{instance.name}</h4>
          <p className="text-sm text-gray-400 truncate">{image?.name || instance.imageId}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {instance.ipAddress && <span>{instance.ipAddress}</span>}
          {instance.uptime !== undefined && (
            <span>{formatUptime(instance.uptime)}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {instance.status === 'running' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onSSH(); }}
                className="p-1.5 hover:bg-gray-700 rounded"
                title="SSH Terminal"
              >
                <TerminalIcon className="w-4 h-4 text-gray-300" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onBrowse(); }}
                className="p-1.5 hover:bg-gray-700 rounded"
                title="Browse Files"
              >
                <FolderIcon className="w-4 h-4 text-gray-300" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onStop(); }}
                className="p-1.5 hover:bg-gray-700 rounded"
                title="Stop"
              >
                <StopIcon className="w-4 h-4 text-red-400" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border overflow-hidden cursor-pointer transition-colors ${
        isSelected
          ? 'bg-indigo-900/30 border-indigo-500'
          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <StatusIndicator status={instance.status} size="lg" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white">{instance.name}</h4>
            <p className="text-xs text-gray-400">{image?.name || instance.imageId}</p>
          </div>
        </div>

        {/* Resource Usage */}
        {instance.status === 'running' && instance.resources && (
          <div className="mb-3 space-y-2">
            <ResourceBar
              label="CPU"
              value={instance.resources.cpuPercent}
              max={100}
              unit="%"
            />
            <ResourceBar
              label="Memory"
              value={instance.resources.memoryUsedMiB}
              max={instance.resources.memoryTotalMiB}
              unit="MiB"
            />
          </div>
        )}

        {/* Info */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {instance.ipAddress && (
            <span className="flex items-center gap-1">
              <NetworkIcon className="w-3 h-3" />
              {instance.ipAddress}
            </span>
          )}
          {instance.uptime !== undefined && (
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {formatUptime(instance.uptime)}
            </span>
          )}
          {instance.activeMcpServers.length > 0 && (
            <span className="flex items-center gap-1">
              <MCPIcon className="w-3 h-3" />
              {instance.activeMcpServers.length} active
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700 flex items-center gap-2">
        {instance.status === 'running' ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onSSH(); }}
              className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium flex items-center justify-center gap-1.5"
            >
              <TerminalIcon className="w-4 h-4" />
              SSH
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBrowse(); }}
              className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium flex items-center justify-center gap-1.5"
            >
              <FolderIcon className="w-4 h-4" />
              Files
            </button>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMCPMenu(!showMCPMenu); }}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
              >
                <MCPIcon className="w-4 h-4 text-gray-300" />
              </button>
              {showMCPMenu && image && (
                <MCPMenu
                  servers={image.mcpServers}
                  activeServers={instance.activeMcpServers}
                  onClose={() => setShowMCPMenu(false)}
                />
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onStop(); }}
              className="p-1.5 bg-red-600/20 hover:bg-red-600/40 rounded"
            >
              <StopIcon className="w-4 h-4 text-red-400" />
            </button>
          </>
        ) : instance.status === 'stopped' ? (
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <PlayIcon className="w-4 h-4" />
            Restart
          </button>
        ) : (
          <div className="flex-1 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <SpinnerIcon className="w-4 h-4 animate-spin" />
            {instance.status === 'starting' ? 'Starting...' : 'Stopping...'}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ Helper Components ============

const StatusIndicator: React.FC<{ status: ContainerStatus; size?: 'sm' | 'lg' }> = ({
  status,
  size = 'sm',
}) => {
  const colors: Record<ContainerStatus, string> = {
    running: 'bg-green-500',
    starting: 'bg-yellow-500 animate-pulse',
    stopping: 'bg-yellow-500 animate-pulse',
    stopped: 'bg-gray-500',
    paused: 'bg-blue-500',
    error: 'bg-red-500',
  };

  const sizeClass = size === 'lg' ? 'w-3 h-3' : 'w-2 h-2';

  return (
    <div className={`${sizeClass} rounded-full ${colors[status]}`} title={status} />
  );
};

const ResourceBar: React.FC<{
  label: string;
  value: number;
  max: number;
  unit: string;
}> = ({ label, value, max, unit }) => {
  const percent = Math.min(100, (value / max) * 100);
  const color = percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(0)}/{max} {unit}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const MCPMenu: React.FC<{
  servers: MCPServerConfig[];
  activeServers: string[];
  onClose: () => void;
}> = ({ servers, activeServers, onClose }) => (
  <div
    className="absolute right-0 bottom-full mb-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-2 z-10"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">MCP Servers</div>
    {servers.map((server) => (
      <div
        key={server.name}
        className="px-3 py-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2"
      >
        <div
          className={`w-2 h-2 rounded-full ${
            activeServers.includes(server.name) ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
        <div className="flex-1">
          <div className="text-sm text-white">{server.name}</div>
          <div className="text-xs text-gray-400">{server.capabilities.length} capabilities</div>
        </div>
      </div>
    ))}
    <div className="border-t border-gray-700 mt-1 pt-1">
      <button
        onClick={onClose}
        className="w-full px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 text-left"
      >
        Close
      </button>
    </div>
  </div>
);

const ImageTypeIcon: React.FC<{ type: ContainerImage['type']; className?: string }> = ({
  type,
  className,
}) => {
  const icons: Record<ContainerImage['type'], JSX.Element> = {
    base: <ContainerIcon className={className} />,
    hypervisor: <ServerIcon className={className} />,
    agent: <AgentIcon className={className} />,
    custom: <ContainerIcon className={className} />,
  };
  return icons[type];
};

// ============ Utility Functions ============

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// ============ Icons ============

const GridIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ListIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const ContainerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const ServerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const AgentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </svg>
);

const TerminalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const MemoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const PortIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

const MCPIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const NetworkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default ContainersView;
