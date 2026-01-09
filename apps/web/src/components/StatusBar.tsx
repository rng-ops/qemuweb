import type { VmState, RuntimeCapabilities } from '@qemuweb/runtime';

interface StatusBarProps {
  vmState: VmState | null;
  capabilities: RuntimeCapabilities | null;
}

export function StatusBar({ vmState, capabilities }: StatusBarProps) {
  const getStatusColor = () => {
    if (!vmState) return 'bg-gray-600';
    switch (vmState.status) {
      case 'running':
        return 'bg-green-500';
      case 'starting':
        return 'bg-yellow-500';
      case 'stopping':
        return 'bg-orange-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusText = () => {
    if (!vmState) return 'No VM';
    switch (vmState.status) {
      case 'running':
        return 'Running';
      case 'starting':
        return 'Starting...';
      case 'stopping':
        return 'Stopping...';
      case 'stopped':
        return 'Stopped';
      case 'error':
        return `Error: ${vmState.errorMessage}`;
      default:
        return 'Idle';
    }
  };

  const formatUptime = () => {
    if (!vmState?.startTime) return null;
    const seconds = Math.floor((Date.now() - vmState.startTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-2 px-4">
      <div className="container mx-auto flex items-center justify-between text-sm">
        {/* Left: VM Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            <span className="text-gray-400">{getStatusText()}</span>
          </div>

          {vmState?.status === 'running' && vmState.startTime && (
            <div className="text-gray-500">
              Uptime: {formatUptime()}
            </div>
          )}

          {vmState?.profile && (
            <div className="text-gray-500">
              {vmState.profile.arch} • {vmState.profile.machine}
            </div>
          )}
        </div>

        {/* Right: Capabilities */}
        <div className="flex items-center gap-4 text-gray-500">
          {capabilities && (
            <>
              <div className="flex items-center gap-2">
                <span className={capabilities.wasmSimd ? 'text-green-500' : 'text-gray-600'}>
                  SIMD
                </span>
                <span className={capabilities.wasmThreads ? 'text-green-500' : 'text-gray-600'}>
                  Threads
                </span>
                <span className={capabilities.webGpu ? 'text-green-500' : 'text-gray-600'}>
                  WebGPU
                </span>
              </div>
              <div className="text-gray-600">
                Max: {Math.floor(capabilities.maxMemory / (1024 * 1024 * 1024))} GB
              </div>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
