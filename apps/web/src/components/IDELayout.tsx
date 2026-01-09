import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FileMetadata } from '@qemuweb/storage';
import type { MCPServerConfig, SSHConfig } from '@qemuweb/vm-config';
import { SplitLayout } from './layout/SplitLayout';
import { FileExplorer } from './layout/FileExplorer';
import { TabbedDocumentViewer } from './layout/TabbedDocumentViewer';
import { ContextBar, CommandPalette } from './layout/ContextBar';
import { ContainersView, SSHTerminal, ContainerFileBrowser } from './containers';
import { CredentialManager } from './credentials';
import { NetworkDiagram } from './atlas';
import { TasksView } from './tasks/TasksView';
import { getAIService } from '../services/aiService';
import { useContainers } from '../hooks/useContainers';
import { useDefaultImages } from '../hooks/useDefaultImages';
import { useAgent } from '../hooks/useAgent';
import { useCredentials } from '../hooks/useCredentials';
import { useSDN, type SecurityPolicy } from '../hooks/useSDN';
import { getFileTracker } from '../services/atlasFileTracker';

type CenterPanelMode = 'documents' | 'containers' | 'ssh' | 'files' | 'network' | 'tasks';

interface SSHSession {
  instanceId: string;
  instanceName: string;
  ipAddress: string;
  config: SSHConfig;
}

export const IDELayout: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [activeFile, setActiveFile] = useState<FileMetadata | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [centerMode, setCenterMode] = useState<CenterPanelMode>('containers');
  const [activeSSHSession, setActiveSSHSession] = useState<SSHSession | null>(null);
  const [browsingInstanceId, setBrowsingInstanceId] = useState<string | null>(null);
  const [credentialManagerOpen, setCredentialManagerOpen] = useState(false);

  // Initialize default images
  const { isInitialized: imagesInitialized } = useDefaultImages();

  // Credentials
  const { credentials } = useCredentials();

  // SDN Control Plane
  const {
    state: sdnState,
    addNode,
    removeNode,
    updateNode,
    selectNode,
    addLink,
    removeLink,
    selectLink,
    applyPolicy,
    suggestPolicies,
    setOpenFiles,
    getTerraform,
  } = useSDN();

  const [terraformConfig, setTerraformConfig] = useState<string | null>(null);
  const [policySuggestions, setPolicySuggestions] = useState<SecurityPolicy[]>([]);

  // Container management
  const {
    images,
    instances,
    selectedInstanceId,
    selectInstance,
    getImageForInstance,
    startInstance,
    stopInstance,
    configureMCP,
  } = useContainers({
    onSSHConnect: (instanceId, config) => {
      const instance = instances.find((i) => i.id === instanceId);
      if (instance) {
        setActiveSSHSession({
          instanceId,
          instanceName: instance.name,
          ipAddress: instance.ipAddress || '10.0.0.10',
          config,
        });
        setCenterMode('ssh');
      }
    },
    onBrowseFiles: (instanceId) => {
      setBrowsingInstanceId(instanceId);
      setCenterMode('files');
    },
  });

  // Agent system
  const { isInitialized: agentInitialized, introspection, mcp, terraform } = useAgent();

  // Handle file open from explorer - auto-switch to documents view
  const handleFileOpen = useCallback((file: FileMetadata) => {
    // Always switch to documents mode when opening a file
    setCenterMode('documents');
    
    // Track file open for Atlas
    getFileTracker().trackFileOpen(file);
    
    // Use a small delay to ensure the TabbedDocumentViewer is mounted
    setTimeout(() => {
      const viewer = (window as any).__tabbedViewer;
      if (viewer?.openFile) {
        viewer.openFile(file);
        setActiveFile(file);
      }
    }, 0);
  }, []);

  // Handle file select (single click)
  const handleFileSelect = useCallback((file: FileMetadata | null) => {
    setSelectedFile(file);
  }, []);

  // Handle container SSH connection
  const handleConnectSSH = useCallback((instanceId: string) => {
    const instance = instances.find((i) => i.id === instanceId);
    const image = getImageForInstance(instanceId);
    if (instance && image) {
      setActiveSSHSession({
        instanceId,
        instanceName: instance.name,
        ipAddress: instance.ipAddress || '10.0.0.10',
        config: image.ssh,
      });
      setCenterMode('ssh');
    }
  }, [instances, getImageForInstance]);

  // Handle container file browsing
  const handleBrowseFiles = useCallback((instanceId: string) => {
    setBrowsingInstanceId(instanceId);
    setCenterMode('files');
  }, []);

  // Handle generate requests from document viewer
  const handleGenerateRequest = useCallback(async (file: FileMetadata, type: string) => {
    setStatusMessage(`Generating ${type}...`);

    try {
      const ai = getAIService();

      switch (type) {
        case 'diagram':
          const diagram = await ai.generateDiagram(
            `Generate a diagram for the infrastructure in ${file.name}`
          );
          console.log('Generated diagram:', diagram);
          setStatusMessage('Diagram generated');
          break;

        case 'validate':
          setStatusMessage('Validating configuration...');
          setStatusMessage('Validation complete');
          break;

        case 'apply':
          setStatusMessage('Applying plan...');
          setStatusMessage('Plan applied');
          break;

        case 'terraform':
          // Generate Terraform for the file's associated container
          const containerType = file.tags?.find((t) => ['base', 'hypervisor', 'agent'].includes(t));
          const image = images.find((img) => img.type === containerType);
          if (image) {
            await terraform.generatePlan(image);
            setStatusMessage('Terraform plan generated');
          }
          break;

        default:
          setStatusMessage(`Unknown action: ${type}`);
      }
    } catch (error) {
      setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setTimeout(() => setStatusMessage(null), 3000);
  }, [images, terraform]);

  // Handle MCP configuration
  const handleConfigureMCP = useCallback((instanceId: string, server: MCPServerConfig) => {
    configureMCP(instanceId, server);
    // Also update agent MCP connections
    const isConnected = mcp.connections.get(server.name)?.status === 'connected';
    if (isConnected) {
      mcp.disconnectServer(server.name);
    } else {
      mcp.connectServer(server.name);
    }
  }, [configureMCP, mcp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setCredentialManagerOpen(false);
      }
      // Switch to containers view with Ctrl+Shift+C
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        setCenterMode('containers');
      }
      // Open credential manager with Ctrl+Shift+K
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setCredentialManagerOpen(true);
      }
      // Open network view with Ctrl+Shift+N
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setCenterMode('network');
      }
      // Open tasks view with Ctrl+Shift+T
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 't') {
        e.preventDefault();
        setCenterMode('tasks');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update terraform config when node is selected
  useEffect(() => {
    if (sdnState?.selectedNodeId) {
      getTerraform(sdnState.selectedNodeId).then(setTerraformConfig);
    } else {
      getTerraform().then(setTerraformConfig);
    }
  }, [sdnState?.selectedNodeId, getTerraform]);

  // Update open files in SDN for policy suggestions
  useEffect(() => {
    if (activeFile) {
      setOpenFiles([{
        id: activeFile.id,
        path: activeFile.name,
        nodeId: 'local',
        type: activeFile.type === 'config' ? 'config' : 'other',
        lastModified: new Date(activeFile.updatedAt || Date.now()),
      }]);
    }
  }, [activeFile, setOpenFiles]);

  // Network handlers
  const handleAddNetworkNode = useCallback(async () => {
    const nodeCount = sdnState?.nodes.length || 0;
    await addNode({
      type: 'vm',
      name: `VM ${nodeCount + 1}`,
      status: 'offline',
      position: { x: 200 + (nodeCount % 4) * 150, y: 150 + Math.floor(nodeCount / 4) * 120 },
      interfaces: [
        {
          id: 'eth0',
          name: 'eth0',
          mac: '',
          ip: `192.168.1.${100 + nodeCount}`,
          networkId: 'lan-default',
          isUp: true,
        },
      ],
      metadata: {},
    });
  }, [addNode, sdnState?.nodes.length]);

  const handleAddNetworkLink = useCallback(async (sourceId: string, targetId: string) => {
    const sourceNode = sdnState?.nodes.find((n) => n.id === sourceId);
    const targetNode = sdnState?.nodes.find((n) => n.id === targetId);
    
    if (sourceNode && targetNode) {
      await addLink({
        sourceNodeId: sourceId,
        sourceInterfaceId: sourceNode.interfaces[0]?.id || 'eth0',
        targetNodeId: targetId,
        targetInterfaceId: targetNode.interfaces[0]?.id || 'eth0',
        status: 'up',
      });
    }
  }, [addLink, sdnState?.nodes]);

  const handleApplyPolicy = useCallback(async (policyId: string) => {
    if (sdnState?.selectedNodeId) {
      await applyPolicy(policyId, [sdnState.selectedNodeId]);
    } else {
      // Apply to all nodes
      const nodeIds = sdnState?.nodes.map((n) => n.id) || [];
      await applyPolicy(policyId, nodeIds);
    }
  }, [applyPolicy, sdnState?.selectedNodeId, sdnState?.nodes]);

  // Request policy suggestions when network view is active
  useEffect(() => {
    if (centerMode === 'network' && sdnState) {
      suggestPolicies({
        openFiles: sdnState.openFiles,
        recentTraffic: [],
        currentPolicies: sdnState.policies.map((p) => p.id),
        nodeStatuses: new Map(sdnState.nodes.map((n) => [n.id, n.status])),
      }).then(setPolicySuggestions);
    }
  }, [centerMode, sdnState, suggestPolicies]);

  // Browsing instance and image
  const browsingInstance = useMemo(() => 
    instances.find((i) => i.id === browsingInstanceId),
    [instances, browsingInstanceId]
  );
  const browsingImage = useMemo(() =>
    browsingInstanceId ? getImageForInstance(browsingInstanceId) : undefined,
    [browsingInstanceId, getImageForInstance]
  );

  // Wrapper for startInstance to match ContainersView expected signature
  const handleStartInstance = useCallback(async (imageId: string, name?: string): Promise<void> => {
    await startInstance(imageId, name);
  }, [startInstance]);

  // Render center panel based on mode
  const renderCenterPanel = () => {
    switch (centerMode) {
      case 'containers':
        return (
          <ContainersView
            images={images}
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            onInstanceSelect={selectInstance}
            onStartInstance={handleStartInstance}
            onStopInstance={stopInstance}
            onConnectSSH={handleConnectSSH}
            onBrowseFiles={handleBrowseFiles}
            onConfigureMCP={handleConfigureMCP}
          />
        );
      case 'ssh':
        if (activeSSHSession) {
          return (
            <SSHTerminal
              instanceId={activeSSHSession.instanceId}
              instanceName={activeSSHSession.instanceName}
              ipAddress={activeSSHSession.ipAddress}
              sshConfig={activeSSHSession.config}
              onClose={() => {
                setActiveSSHSession(null);
                setCenterMode('containers');
              }}
              onDisconnect={() => {
                setActiveSSHSession(null);
              }}
            />
          );
        }
        return null;
      case 'files':
        if (browsingInstance && browsingImage) {
          return (
            <ContainerFileBrowser
              instance={browsingInstance}
              image={browsingImage}
              onFileOpen={(file) => {
                console.log('Open container file:', file.path);
              }}
              onClose={() => {
                setBrowsingInstanceId(null);
                setCenterMode('containers');
              }}
            />
          );
        }
        return null;
      case 'network':
        if (sdnState) {
          return (
            <NetworkDiagram
              state={sdnState}
              onNodeSelect={selectNode}
              onLinkSelect={selectLink}
              onNodeMove={(nodeId, position) => updateNode(nodeId, { position })}
              onAddNode={handleAddNetworkNode}
              onAddLink={handleAddNetworkLink}
              onRemoveNode={removeNode}
              onRemoveLink={removeLink}
              terraformConfig={terraformConfig}
              policySuggestions={policySuggestions}
              onApplyPolicy={handleApplyPolicy}
            />
          );
        }
        return <div className="flex items-center justify-center h-full text-gray-500">Initializing SDN...</div>;
      case 'tasks':
        return (
          <TasksView
            onTaskSelect={(task) => console.log('Selected task:', task)}
            onLinkContainer={(taskId) => {
              // Link selected container to task
              if (selectedInstanceId) {
                console.log('Link container', selectedInstanceId, 'to task', taskId);
              }
            }}
            onLinkNetworkNode={(taskId) => {
              // Link selected network node to task
              if (sdnState?.selectedNodeId) {
                console.log('Link network node', sdnState.selectedNodeId, 'to task', taskId);
              }
            }}
          />
        );
      case 'documents':
      default:
        return (
          <TabbedDocumentViewer
            onGenerateRequest={handleGenerateRequest}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Top Context Bar */}
      <ContextBar
        onNewFile={() => {}}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenSettings={() => {}}
        activeFileName={activeFile?.name}
      />

      {/* View Mode Tabs */}
      <div className="flex items-center h-8 bg-gray-800 border-b border-gray-700 px-2 gap-1">
        <ViewTab
          active={centerMode === 'containers'}
          onClick={() => setCenterMode('containers')}
          icon={<ContainerIcon className="w-3.5 h-3.5" />}
          label="Containers"
          count={instances.filter((i) => i.status === 'running').length}
        />
        <ViewTab
          active={centerMode === 'documents'}
          onClick={() => setCenterMode('documents')}
          icon={<DocumentIcon className="w-3.5 h-3.5" />}
          label="Documents"
        />
        <ViewTab
          active={centerMode === 'network'}
          onClick={() => setCenterMode('network')}
          icon={<NetworkIcon className="w-3.5 h-3.5" />}
          label="Network"
          count={sdnState?.nodes.filter((n) => n.status === 'online').length}
        />
        <ViewTab
          active={centerMode === 'tasks'}
          onClick={() => setCenterMode('tasks')}
          icon={<TasksIcon className="w-3.5 h-3.5" />}
          label="Tasks"
        />
        {activeSSHSession && (
          <ViewTab
            active={centerMode === 'ssh'}
            onClick={() => setCenterMode('ssh')}
            icon={<TerminalIcon className="w-3.5 h-3.5" />}
            label={`SSH: ${activeSSHSession.instanceName}`}
            closable
            onClose={() => {
              setActiveSSHSession(null);
              setCenterMode('containers');
            }}
          />
        )}
        {browsingInstance && (
          <ViewTab
            active={centerMode === 'files'}
            onClick={() => setCenterMode('files')}
            icon={<FolderIcon className="w-3.5 h-3.5" />}
            label={`Files: ${browsingInstance.name}`}
            closable
            onClose={() => {
              setBrowsingInstanceId(null);
              setCenterMode('containers');
            }}
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <SplitLayout
          leftPanel={
            <FileExplorer
              onFileOpen={handleFileOpen}
              onFileSelect={handleFileSelect}
              selectedFileId={selectedFile?.id}
            />
          }
          centerPanel={renderCenterPanel()}
          // Atlas chat is in AppShell - no right panel needed
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        message={statusMessage}
        activeFile={activeFile}
        runningContainers={instances.filter((i) => i.status === 'running').length}
        mcpServers={introspection?.mcpServers.filter((s) => s.status === 'connected').length || 0}
        agentInitialized={agentInitialized}
        imagesInitialized={imagesInitialized}
        credentialCount={credentials.length}
        onOpenCredentials={() => setCredentialManagerOpen(true)}
      />

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Credential Manager Modal */}
      {credentialManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg shadow-xl">
            <CredentialManager
              onClose={() => setCredentialManagerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// View Tab Component
interface ViewTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  closable?: boolean;
  onClose?: () => void;
}

const ViewTab: React.FC<ViewTabProps> = ({ active, onClick, icon, label, count, closable, onClose }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
      active
        ? 'bg-gray-700 text-white'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
    }`}
  >
    {icon}
    <span>{label}</span>
    {count !== undefined && count > 0 && (
      <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded-full">
        {count}
      </span>
    )}
    {closable && onClose && (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="ml-1 p-0.5 hover:bg-gray-600 rounded"
      >
        <CloseIcon className="w-3 h-3" />
      </span>
    )}
  </button>
);

// Status Bar Component
interface StatusBarProps {
  message?: string | null;
  activeFile?: FileMetadata | null;
  runningContainers: number;
  mcpServers: number;
  agentInitialized: boolean;
  imagesInitialized: boolean;
  credentialCount: number;
  onOpenCredentials: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  message, 
  activeFile, 
  runningContainers, 
  mcpServers,
  agentInitialized,
  imagesInitialized,
  credentialCount,
  onOpenCredentials,
}) => {
  return (
    <div className="flex items-center justify-between h-6 bg-indigo-600 px-3 text-xs text-white">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="w-3 h-3" />
          <span>main</span>
        </div>
        <div className="flex items-center gap-1">
          <ContainerIcon className="w-3 h-3" />
          <span>{runningContainers} running</span>
        </div>
        <div className="flex items-center gap-1">
          <MCPIcon className="w-3 h-3" />
          <span>{mcpServers} MCP</span>
        </div>
        <button
          onClick={onOpenCredentials}
          className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors"
          title="Manage Credentials (⌘⇧K)"
        >
          <KeyIcon className="w-3 h-3" />
          <span>{credentialCount} credentials</span>
        </button>
        {message && (
          <div className="flex items-center gap-2">
            <span className="animate-pulse">●</span>
            <span>{message}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {activeFile && (
          <>
            <span>{activeFile.type}</span>
            <span>{formatBytes(activeFile.size)}</span>
          </>
        )}
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${agentInitialized && imagesInitialized ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
          <span>Agent</span>
        </div>
        <div className="flex items-center gap-1">
          <OllamaIcon className="w-3 h-3" />
          <span>Ollama</span>
        </div>
      </div>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Icons
const GitBranchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const OllamaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

const ContainerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

const MCPIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const KeyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const NetworkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const TasksIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

export default IDELayout;
