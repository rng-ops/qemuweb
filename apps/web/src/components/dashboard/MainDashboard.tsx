/**
 * Main Dashboard
 * 
 * Split view with running services at the top and images at the bottom.
 * Provides provisioning and editing capabilities for both.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getEventTracker, EventTracker } from '../../services/eventTracker';

// ============ Types ============

export interface RunningService {
  id: string;
  name: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  type: 'container' | 'vm' | 'mcp-server' | 'agent';
  ports: number[];
  cpu?: number;
  memory?: number;
  uptime?: number;
  image?: string;
  capabilities?: string[];
  connections?: string[];
}

export interface ContainerImage {
  id: string;
  name: string;
  tag: string;
  size: number;
  created: number;
  digest?: string;
  labels?: Record<string, string>;
  architecture?: string;
  provenance?: ImageProvenance;
}

export interface ImageProvenance {
  builder?: string;
  source?: string;
  commit?: string;
  signature?: string;
  attestations?: string[];
}

// ============ Mock Data (replace with real data sources) ============

const mockServices: RunningService[] = [
  {
    id: 'svc-1',
    name: 'alpine-agent',
    status: 'running',
    type: 'container',
    ports: [8080],
    cpu: 12,
    memory: 256,
    uptime: 3600,
    image: 'alpine:latest',
    capabilities: ['shell', 'file-ops'],
  },
  {
    id: 'svc-2',
    name: 'mcp-filesystem',
    status: 'running',
    type: 'mcp-server',
    ports: [9000],
    capabilities: ['read_file', 'write_file', 'list_directory'],
    connections: ['alpine-agent'],
  },
  {
    id: 'svc-3',
    name: 'dom-agent',
    status: 'running',
    type: 'agent',
    ports: [],
    capabilities: ['dom_manipulation', 'code_execution'],
  },
];

const mockImages: ContainerImage[] = [
  {
    id: 'img-1',
    name: 'alpine',
    tag: 'latest',
    size: 7_800_000,
    created: Date.now() - 86400000,
    digest: 'sha256:abc123...',
    architecture: 'amd64',
    provenance: {
      builder: 'docker-official',
      source: 'https://github.com/alpinelinux/docker-alpine',
    },
  },
  {
    id: 'img-2',
    name: 'qemuweb/agent',
    tag: 'v1.0.0',
    size: 45_000_000,
    created: Date.now() - 3600000,
    digest: 'sha256:def456...',
    architecture: 'wasm32',
    provenance: {
      builder: 'local',
      commit: 'abc123def',
      signature: 'cosign-verified',
    },
  },
  {
    id: 'img-3',
    name: 'busybox',
    tag: 'latest',
    size: 4_900_000,
    created: Date.now() - 172800000,
    digest: 'sha256:ghi789...',
    architecture: 'amd64',
  },
];

// ============ Utility Functions ============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ============ Status Badge Component ============

interface StatusBadgeProps {
  status: RunningService['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const colors = {
    starting: 'bg-yellow-500',
    running: 'bg-green-500',
    stopping: 'bg-orange-500',
    stopped: 'bg-gray-500',
    error: 'bg-red-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'animate-pulse' : ''} bg-white/50`} />
      {status}
    </span>
  );
}

// ============ Service Card Component ============

interface ServiceCardProps {
  service: RunningService;
  onSelect: (id: string) => void;
  onAction: (id: string, action: 'start' | 'stop' | 'restart' | 'logs' | 'shell' | 'edit') => void;
  isSelected: boolean;
}

function ServiceCard({ service, onSelect, onAction, isSelected }: ServiceCardProps) {
  const typeIcons = {
    container: '📦',
    vm: '🖥️',
    'mcp-server': '🔌',
    agent: '🤖',
  };

  return (
    <div
      onClick={() => onSelect(service.id)}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{typeIcons[service.type]}</span>
          <div>
            <h3 className="font-medium text-white">{service.name}</h3>
            <p className="text-sm text-gray-400">
              {service.type} {service.image && `• ${service.image}`}
            </p>
          </div>
        </div>
        <StatusBadge status={service.status} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
        {service.ports.length > 0 && (
          <span>🔗 {service.ports.map(p => `:${p}`).join(', ')}</span>
        )}
        {service.cpu !== undefined && (
          <span>CPU: {service.cpu}%</span>
        )}
        {service.memory !== undefined && (
          <span>RAM: {formatBytes(service.memory * 1024 * 1024)}</span>
        )}
        {service.uptime !== undefined && (
          <span>⏱️ {formatUptime(service.uptime)}</span>
        )}
      </div>

      {service.capabilities && service.capabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {service.capabilities.slice(0, 4).map(cap => (
            <span key={cap} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
              {cap}
            </span>
          ))}
          {service.capabilities.length > 4 && (
            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
              +{service.capabilities.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
        {service.status === 'running' ? (
          <>
            <button
              onClick={() => onAction(service.id, 'stop')}
              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
            >
              Stop
            </button>
            <button
              onClick={() => onAction(service.id, 'restart')}
              className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30"
            >
              Restart
            </button>
            <button
              onClick={() => onAction(service.id, 'logs')}
              className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded hover:bg-gray-600/30"
            >
              Logs
            </button>
            {service.type === 'container' && (
              <button
                onClick={() => onAction(service.id, 'shell')}
                className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded hover:bg-gray-600/30"
              >
                Shell
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onAction(service.id, 'start')}
            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
          >
            Start
          </button>
        )}
        <button
          onClick={() => onAction(service.id, 'edit')}
          className="px-2 py-1 text-xs bg-indigo-600/20 text-indigo-400 rounded hover:bg-indigo-600/30"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ============ Image Card Component ============

interface ImageCardProps {
  image: ContainerImage;
  onSelect: (id: string) => void;
  onAction: (id: string, action: 'run' | 'inspect' | 'delete' | 'push' | 'provenance') => void;
  isSelected: boolean;
}

function ImageCard({ image, onSelect, onAction, isSelected }: ImageCardProps) {
  return (
    <div
      onClick={() => onSelect(image.id)}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-white">
            {image.name}
            <span className="ml-2 text-sm text-indigo-400">:{image.tag}</span>
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {formatBytes(image.size)} • {image.architecture || 'unknown'} • {formatRelativeTime(image.created)}
          </p>
        </div>
        {image.provenance?.signature && (
          <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-xs">
            ✓ Verified
          </span>
        )}
      </div>

      {image.digest && (
        <p className="mt-2 text-xs text-gray-500 font-mono truncate">
          {image.digest}
        </p>
      )}

      {image.provenance && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
          {image.provenance.builder && (
            <span>Builder: {image.provenance.builder}</span>
          )}
          {image.provenance.commit && (
            <span>Commit: {image.provenance.commit.slice(0, 7)}</span>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onAction(image.id, 'run')}
          className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
        >
          Run
        </button>
        <button
          onClick={() => onAction(image.id, 'inspect')}
          className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded hover:bg-gray-600/30"
        >
          Inspect
        </button>
        {image.provenance && (
          <button
            onClick={() => onAction(image.id, 'provenance')}
            className="px-2 py-1 text-xs bg-indigo-600/20 text-indigo-400 rounded hover:bg-indigo-600/30"
          >
            Provenance
          </button>
        )}
        <button
          onClick={() => onAction(image.id, 'delete')}
          className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ============ Section Header Component ============

interface SectionHeaderProps {
  title: string;
  count: number;
  actions: { label: string; icon: string; onClick: () => void }[];
}

function SectionHeader({ title, count, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-white">
        {title}
        <span className="ml-2 text-sm text-gray-400">({count})</span>
      </h2>
      <div className="flex gap-2">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1"
          >
            <span>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ Provision Modal Component ============

interface ProvisionModalProps {
  type: 'service' | 'image';
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}

function ProvisionModal({ type, isOpen, onClose, onSubmit }: ProvisionModalProps) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [ports, setPorts] = useState('');
  const [tag, setTag] = useState('latest');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'service') {
      onSubmit({
        name,
        image,
        ports: ports.split(',').map(p => parseInt(p.trim())).filter(Boolean),
      });
    } else {
      onSubmit({ name, tag });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">
          {type === 'service' ? 'Start New Service' : 'Pull Image'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'service' ? (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="my-service"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image</label>
                <input
                  type="text"
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="alpine:latest"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ports (comma-separated)</label>
                <input
                  type="text"
                  value={ports}
                  onChange={e => setPorts(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="8080, 9000"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="alpine"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tag</label>
                <input
                  type="text"
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="latest"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {type === 'service' ? 'Start' : 'Pull'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ Main Dashboard Component ============

export function MainDashboard() {
  const [services, setServices] = useState<RunningService[]>(mockServices);
  const [images, setImages] = useState<ContainerImage[]>(mockImages);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [provisionModal, setProvisionModal] = useState<{ type: 'service' | 'image'; isOpen: boolean }>({
    type: 'service',
    isOpen: false,
  });
  const [eventTracker, setEventTracker] = useState<EventTracker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize event tracker
  useEffect(() => {
    getEventTracker().then(setEventTracker);
  }, []);

  // Filter services and images
  const filteredServices = useMemo(() => {
    if (!searchQuery) return services;
    const q = searchQuery.toLowerCase();
    return services.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.image?.toLowerCase().includes(q) ||
      s.capabilities?.some(c => c.toLowerCase().includes(q))
    );
  }, [services, searchQuery]);

  const filteredImages = useMemo(() => {
    if (!searchQuery) return images;
    const q = searchQuery.toLowerCase();
    return images.filter(i => 
      i.name.toLowerCase().includes(q) ||
      i.tag.toLowerCase().includes(q) ||
      i.architecture?.toLowerCase().includes(q)
    );
  }, [images, searchQuery]);

  // Handle split drag
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const container = document.getElementById('split-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const ratio = ((e.clientY - rect.top) / rect.height) * 100;
    setSplitRatio(Math.max(20, Math.min(80, ratio)));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle service actions
  const handleServiceAction = useCallback((id: string, action: 'start' | 'stop' | 'restart' | 'logs' | 'shell' | 'edit') => {
    const service = services.find(s => s.id === id);
    if (!service) return;

    eventTracker?.trackServiceConnect({
      serviceId: id,
      serviceName: service.name,
      status: action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'running',
      capabilities: service.capabilities,
    });

    // Update service status based on action
    if (action === 'start') {
      setServices(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'starting' as const } : s
      ));
      // Simulate startup delay
      setTimeout(() => {
        setServices(prev => prev.map(s => 
          s.id === id ? { ...s, status: 'running' as const } : s
        ));
      }, 1500);
    } else if (action === 'stop') {
      setServices(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'stopping' as const } : s
      ));
      setTimeout(() => {
        setServices(prev => prev.map(s => 
          s.id === id ? { ...s, status: 'stopped' as const } : s
        ));
      }, 1000);
    } else if (action === 'restart') {
      setServices(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'stopping' as const } : s
      ));
      setTimeout(() => {
        setServices(prev => prev.map(s => 
          s.id === id ? { ...s, status: 'starting' as const } : s
        ));
        setTimeout(() => {
          setServices(prev => prev.map(s => 
            s.id === id ? { ...s, status: 'running' as const } : s
          ));
        }, 1500);
      }, 1000);
    }

    console.log(`Service action: ${action} on ${id}`);
  }, [services, eventTracker]);

  // Handle image actions
  const handleImageAction = useCallback((id: string, action: 'run' | 'inspect' | 'delete' | 'push' | 'provenance') => {
    const image = images.find(i => i.id === id);
    if (!image) return;

    if (action === 'run') {
      // Create a new service from this image
      const newService: RunningService = {
        id: `svc-${Date.now()}`,
        name: `${image.name}-${Math.random().toString(36).slice(2, 6)}`,
        status: 'starting',
        type: 'container',
        ports: [],
        image: `${image.name}:${image.tag}`,
      };
      setServices(prev => [...prev, newService]);
      
      setTimeout(() => {
        setServices(prev => prev.map(s => 
          s.id === newService.id ? { ...s, status: 'running' as const } : s
        ));
      }, 2000);

      eventTracker?.trackContainerStart({
        containerId: newService.id,
        imageName: `${image.name}:${image.tag}`,
        status: 'starting',
      });
    } else if (action === 'delete') {
      setImages(prev => prev.filter(i => i.id !== id));
    } else if (action === 'provenance') {
      // Show provenance details
      console.log('Image provenance:', image.provenance);
    }

    console.log(`Image action: ${action} on ${id}`);
  }, [images, eventTracker]);

  // Handle provisioning
  const handleProvision = useCallback((data: Record<string, unknown>) => {
    if (provisionModal.type === 'service') {
      const newService: RunningService = {
        id: `svc-${Date.now()}`,
        name: data.name as string,
        status: 'starting',
        type: 'container',
        ports: data.ports as number[] || [],
        image: data.image as string,
      };
      setServices(prev => [...prev, newService]);
      
      setTimeout(() => {
        setServices(prev => prev.map(s => 
          s.id === newService.id ? { ...s, status: 'running' as const } : s
        ));
      }, 2000);

      eventTracker?.trackContainerStart({
        containerId: newService.id,
        imageName: data.image as string,
        status: 'starting',
      });
    } else {
      const newImage: ContainerImage = {
        id: `img-${Date.now()}`,
        name: data.name as string,
        tag: data.tag as string || 'latest',
        size: 0, // Will be updated after pull
        created: Date.now(),
      };
      setImages(prev => [...prev, newImage]);

      eventTracker?.trackImagePull({
        name: data.name as string,
        tag: data.tag as string || 'latest',
      });
    }
  }, [provisionModal.type, eventTracker]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search services and images..."
            className="w-64 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Split View Container */}
      <div id="split-container" className="flex-1 flex flex-col overflow-hidden">
        {/* Services Section (Top) */}
        <div 
          className="overflow-auto p-4"
          style={{ height: `${splitRatio}%` }}
        >
          <SectionHeader
            title="Running Services"
            count={filteredServices.length}
            actions={[
              { label: 'New Service', icon: '➕', onClick: () => setProvisionModal({ type: 'service', isOpen: true }) },
            ]}
          />
          
          {filteredServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <p>No services running</p>
              <button
                onClick={() => setProvisionModal({ type: 'service', isOpen: true })}
                className="mt-2 text-indigo-400 hover:text-indigo-300"
              >
                Start a new service
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  isSelected={selectedServiceId === service.id}
                  onSelect={setSelectedServiceId}
                  onAction={handleServiceAction}
                />
              ))}
            </div>
          )}
        </div>

        {/* Draggable Divider */}
        <div
          className={`
            h-2 bg-gray-800 border-y border-gray-700 cursor-row-resize
            flex items-center justify-center hover:bg-gray-700
            ${isDragging ? 'bg-indigo-600' : ''}
          `}
          onMouseDown={handleMouseDown}
        >
          <div className="w-8 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Images Section (Bottom) */}
        <div 
          className="overflow-auto p-4"
          style={{ height: `${100 - splitRatio}%` }}
        >
          <SectionHeader
            title="Images"
            count={filteredImages.length}
            actions={[
              { label: 'Pull Image', icon: '📥', onClick: () => setProvisionModal({ type: 'image', isOpen: true }) },
            ]}
          />
          
          {filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <p>No images available</p>
              <button
                onClick={() => setProvisionModal({ type: 'image', isOpen: true })}
                className="mt-2 text-indigo-400 hover:text-indigo-300"
              >
                Pull an image
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredImages.map(image => (
                <ImageCard
                  key={image.id}
                  image={image}
                  isSelected={selectedImageId === image.id}
                  onSelect={setSelectedImageId}
                  onAction={handleImageAction}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Provision Modal */}
      <ProvisionModal
        type={provisionModal.type}
        isOpen={provisionModal.isOpen}
        onClose={() => setProvisionModal(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleProvision}
      />
    </div>
  );
}

export default MainDashboard;
