import { useState, useEffect } from 'react';
import { IDELayout } from './components/IDELayout';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { ModelSelector, ModelEndpoint } from './components/model/ModelSelector';
import { ViewCustomizer } from './components/views/ViewCustomizer';
import { ApprovalWorkflowProvider } from './components/approval/ApprovalWorkflow';
import { AtlasFrame } from './components/agent/AtlasFrame';
import { OllamaManager } from './components/ollama/OllamaManager';
import { InternalBrowser } from './components/browser/InternalBrowser';
import { DocsView } from './components/docs/DocsView';
import { getEventTracker } from './services/eventTracker';
import { getMemoryStore } from './services/vectorMemory';
import { getAuditLog } from './services/auditLog';
import { initOllamaService } from './services/ollamaService';
import { initAtlasPersistence } from './services/atlasPersistence';
import { getA11yEvents } from './services/accessibilityEvents';

// Legacy imports for VM mode
import { VmLauncher } from './components/VmLauncher';
import { TerminalView } from './components/TerminalView';
import { StatusBar } from './components/StatusBar';
import { CapabilityWarnings } from './components/CapabilityWarnings';
import { useQemuClient } from './hooks/useQemuClient';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

type AppMode = 'dashboard' | 'ide' | 'vm' | 'network' | 'browser' | 'ollama' | 'docs';

function App() {
  const [mode, setMode] = useState<AppMode>('dashboard');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showViewCustomizer, setShowViewCustomizer] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelEndpoint | undefined>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [agentPanelWidth] = useState(400);
  const [agentPanelExpanded, setAgentPanelExpanded] = useState(true);

  // Initialize tracking systems and Ollama
  useEffect(() => {
    const init = async () => {
      try {
        await getMemoryStore();
        await getEventTracker();
        await getAuditLog();
        // Initialize Ollama service
        await initOllamaService();
        // Initialize Atlas persistence
        await initAtlasPersistence();
        // Start A11y event tracking
        getA11yEvents().start();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setIsInitialized(true); // Continue anyway
      }
    };
    init();
  }, []);

  // Track mode changes
  useEffect(() => {
    if (!isInitialized) return;
    getEventTracker().then(tracker => {
      tracker.trackViewChange(mode);
    });
    // Also log navigation to audit
    getAuditLog().then(log => {
      log.logNavigation('app', mode);
    });
  }, [mode, isInitialized]);

  // Listen for navigation events from agent
  useEffect(() => {
    const handleAgentNav = (event: CustomEvent<{ view: string }>) => {
      const view = event.detail.view as AppMode;
      if (['dashboard', 'ide', 'vm', 'network', 'browser', 'ollama', 'docs'].includes(view)) {
        setMode(view);
      }
    };
    window.addEventListener('agent:navigate', handleAgentNav as EventListener);
    return () => window.removeEventListener('agent:navigate', handleAgentNav as EventListener);
  }, []);

  const handleModelSelect = (model: ModelEndpoint) => {
    setCurrentModel(model);
    setShowModelSelector(false);
  };

  // Helper to get button class for nav items
  const getNavButtonClass = (targetMode: AppMode) => {
    return `px-3 py-1.5 rounded-lg text-sm font-medium ${
      mode === targetMode ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
    }`;
  };

  // Wrapper component that includes persistent floating Atlas panel
  const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ApprovalWorkflowProvider>
      <div className="flex h-screen bg-gray-900">
        {/* Main content area - add padding for floating panel */}
        <div 
          className="flex-1 flex flex-col min-w-0 transition-all duration-200"
          style={{ marginRight: agentPanelExpanded ? agentPanelWidth : 48 }}
        >
          {children}
        </div>
        {/* Floating Atlas Panel */}
        <AtlasFrame 
          defaultCollapsed={!agentPanelExpanded}
          defaultWidth={agentPanelWidth}
        />
      </div>
    </ApprovalWorkflowProvider>
  );

  // Render dashboard mode (default)
  if (mode === 'dashboard') {
    return (
      <AppShell>
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">🖥️ QemuWeb</h1>
            <nav className="flex gap-2">
              <button
                onClick={() => setMode('dashboard')}
                className={getNavButtonClass('dashboard')}
              >
                Dashboard
              </button>
              <button
                onClick={() => setMode('ide')}
                className={getNavButtonClass('ide')}
              >
                IDE
              </button>
              <button
                onClick={() => setMode('vm')}
                className={getNavButtonClass('vm')}
              >
                VM
              </button>
              <button
                onClick={() => setMode('network')}
                className={getNavButtonClass('network')}
              >
                Network
              </button>
              <button
                onClick={() => setMode('browser')}
                className={getNavButtonClass('browser')}
              >
                Browser
              </button>
              <button
                onClick={() => setMode('ollama')}
                className={getNavButtonClass('ollama')}
              >
                Ollama
              </button>
              <button
                onClick={() => setMode('docs')}
                className={getNavButtonClass('docs')}
              >
                📚 Docs
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {/* Model Status */}
            <button
              onClick={() => setShowModelSelector(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg text-sm hover:bg-gray-600"
            >
              <span className={`w-2 h-2 rounded-full ${
                currentModel?.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'
              }`} />
              <span className="text-gray-300">
                {currentModel?.name || 'No Model'}
              </span>
            </button>
            
            {/* Customize Views */}
            <button
              onClick={() => setShowViewCustomizer(true)}
              className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600"
            >
              ⚙️ Customize
            </button>

            {/* Toggle Agent Panel */}
            <button
              onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
              className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600"
            >
              🤖 {agentPanelExpanded ? 'Hide' : 'Show'} Agent
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden min-h-0">
          <MainDashboard />
        </main>

        {/* Model Selector Modal */}
        {showModelSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector(false)}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 rounded-full text-white hover:bg-gray-600 z-10"
                >
                  ×
                </button>
                <ModelSelector
                  currentModel={currentModel}
                  onModelSelect={handleModelSelect}
                />
              </div>
            </div>
          </div>
        )}

        {/* View Customizer Modal */}
        {showViewCustomizer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="relative">
                <button
                  onClick={() => setShowViewCustomizer(false)}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 rounded-full text-white hover:bg-gray-600 z-10"
                >
                  ×
                </button>
                <ViewCustomizer />
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }
  
  if (mode === 'ide') {
    return (
      <AppShell>
        {/* Minimal header for IDE mode */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModelSelector(true)}
              className="flex items-center gap-2 px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              <span className={`w-2 h-2 rounded-full ${
                currentModel?.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'
              }`} />
              {currentModel?.name || 'Select Model'}
            </button>
            <button
              onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
              className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              🤖
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden min-h-0">
          <IDELayout />
        </main>

        {showModelSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector(false)}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 rounded-full text-white hover:bg-gray-600 z-10"
                >
                  ×
                </button>
                <ModelSelector
                  currentModel={currentModel}
                  onModelSelect={handleModelSelect}
                />
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  if (mode === 'network') {
    return (
      <AppShell>
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <h2 className="text-lg font-medium text-white">Network Topology</h2>
          <button
            onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
            className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
          >
            🤖
          </button>
        </header>
        <main className="flex-1 overflow-hidden min-h-0 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-4">🌐</div>
            <p>Network topology view coming soon...</p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (mode === 'browser') {
    return (
      <AppShell>
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <h2 className="text-lg font-medium text-white">Internal Browser</h2>
          <button
            onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
            className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
          >
            🤖
          </button>
        </header>
        <main className="flex-1 overflow-hidden min-h-0">
          <InternalBrowser />
        </main>
      </AppShell>
    );
  }

  if (mode === 'ollama') {
    return (
      <AppShell>
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <h2 className="text-lg font-medium text-white">Ollama Manager</h2>
          <button
            onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
            className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
          >
            🤖
          </button>
        </header>
        <main className="flex-1 overflow-hidden min-h-0">
          <OllamaManager />
        </main>
      </AppShell>
    );
  }

  if (mode === 'docs') {
    return (
      <AppShell>
        <main className="flex-1 overflow-hidden min-h-0">
          <DocsView />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <VmMode 
        onSwitchMode={() => setMode('dashboard')} 
        agentPanelExpanded={agentPanelExpanded}
        onToggleAgent={() => setAgentPanelExpanded(!agentPanelExpanded)}
      />
    </AppShell>
  );
}

// Legacy VM Mode Component
interface VmModeProps {
  onSwitchMode: () => void;
  agentPanelExpanded: boolean;
  onToggleAgent: () => void;
}

function VmMode({ onSwitchMode, agentPanelExpanded, onToggleAgent }: VmModeProps) {
  const [vmId, setVmId] = useState<string | null>(null);
  const [serialOutput, setSerialOutput] = useState<string[]>([]);

  const {
    capabilities,
    vmState,
    isReady,
    error,
    startVm,
    stopVm,
    sendSerialIn,
  } = useQemuClient({
    onSerialOut: (id: string, data: string) => {
      if (id === vmId || vmId === null) {
        setSerialOutput((prev) => [...prev, data]);
      }
    },
  });

  const handleStart = async (profile: VmProfile, inputs: VmInputs, overrides?: VmOverrides) => {
    const id = `vm-${Date.now()}`;
    setVmId(id);
    setSerialOutput([]);
    await startVm(id, profile, inputs, overrides);
  };

  const handleStop = async () => {
    if (vmId) {
      await stopVm(vmId);
    }
  };

  const handleSerialInput = (data: string) => {
    if (vmId) {
      sendSerialIn(vmId, data);
    }
  };

  const isRunning = vmState?.status === 'running';
  const isStarting = vmState?.status === 'starting';

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        {/* Mode Switcher */}
        <div className="mb-4 flex justify-between">
          <button
            onClick={onSwitchMode}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            Switch to Dashboard
          </button>
          <button
            onClick={onToggleAgent}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            🤖 {agentPanelExpanded ? 'Hide' : 'Show'} Agent
          </button>
        </div>

        {!isReady ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Initializing runtime...</p>
            </div>
          </div>
        ) : error ? (
          <div className="card bg-red-900/50 border border-red-700">
            <h2 className="text-xl font-bold text-red-400 mb-2">Initialization Error</h2>
            <p className="text-red-200">{error}</p>
          </div>
        ) : (
          <>
            <CapabilityWarnings capabilities={capabilities} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: VM Launcher */}
              <div className="lg:col-span-1">
                <VmLauncher
                  onStart={handleStart}
                  onStop={handleStop}
                  isRunning={isRunning}
                  isStarting={isStarting}
                />
              </div>

              {/* Right: Terminal */}
              <div className="lg:col-span-2">
                <TerminalView
                  output={serialOutput}
                  onInput={handleSerialInput}
                  isRunning={isRunning}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <StatusBar
        vmState={vmState}
        capabilities={capabilities}
      />
    </div>
  );
}

export default App;
