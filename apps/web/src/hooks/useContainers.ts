/**
 * Container State Management Hook
 *
 * Manages container instances, lifecycle, and integration with the VM runtime.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ContainerImage,
  ContainerInstance,
  ContainerStatus,
  MCPServerConfig,
} from '@qemuweb/vm-config';
import { defaultContainerImages } from '@qemuweb/vm-config';

interface UseContainersOptions {
  /** Callback when SSH connection is requested */
  onSSHConnect?: (instanceId: string, config: ContainerImage['ssh']) => void;
  /** Callback when file browsing is requested */
  onBrowseFiles?: (instanceId: string) => void;
}

interface UseContainersReturn {
  /** Available container images */
  images: ContainerImage[];
  /** Running container instances */
  instances: ContainerInstance[];
  /** Currently selected instance ID */
  selectedInstanceId: string | null;
  /** Select an instance */
  selectInstance: (id: string | null) => void;
  /** Get selected instance */
  selectedInstance: ContainerInstance | null;
  /** Get image for instance */
  getImageForInstance: (instanceId: string) => ContainerImage | undefined;
  /** Start a new instance from an image */
  startInstance: (imageId: string, name?: string) => Promise<ContainerInstance>;
  /** Stop an instance */
  stopInstance: (instanceId: string) => Promise<void>;
  /** Request SSH connection to instance */
  connectSSH: (instanceId: string) => void;
  /** Request file browsing for instance */
  browseFiles: (instanceId: string) => void;
  /** Configure MCP server for instance */
  configureMCP: (instanceId: string, server: MCPServerConfig) => void;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Generate unique instance ID
 */
function generateInstanceId(): string {
  return `inst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate virtual IP address
 */
function generateIP(index: number): string {
  return `10.0.0.${10 + index}`;
}

export function useContainers(options: UseContainersOptions = {}): UseContainersReturn {
  const { onSSHConnect, onBrowseFiles } = options;

  const [images] = useState<ContainerImage[]>(defaultContainerImages);
  const [instances, setInstances] = useState<ContainerInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track uptime with intervals
  const uptimeIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      uptimeIntervals.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // Get selected instance
  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) || null;

  // Get image for instance
  const getImageForInstance = useCallback(
    (instanceId: string): ContainerImage | undefined => {
      const instance = instances.find((i) => i.id === instanceId);
      if (!instance) return undefined;
      return images.find((img) => img.id === instance.imageId);
    },
    [instances, images]
  );

  // Start a new instance
  const startInstance = useCallback(
    async (imageId: string, name?: string): Promise<ContainerInstance> => {
      setLoading(true);
      setError(null);

      try {
        const image = images.find((img) => img.id === imageId);
        if (!image) {
          throw new Error(`Image not found: ${imageId}`);
        }

        const instanceId = generateInstanceId();
        const instanceName = name || `${image.name.toLowerCase().replace(/\s+/g, '-')}-${instanceId.slice(-4)}`;

        // Create instance in starting state
        const newInstance: ContainerInstance = {
          id: instanceId,
          imageId,
          name: instanceName,
          status: 'starting',
          sshSessions: 0,
          activeMcpServers: [],
          ipAddress: generateIP(instances.length),
        };

        setInstances((prev) => [...prev, newInstance]);

        // Simulate startup time (in real implementation, this would start the VM)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Update to running state
        const startedAt = new Date();
        setInstances((prev) =>
          prev.map((inst) =>
            inst.id === instanceId
              ? {
                  ...inst,
                  status: 'running' as ContainerStatus,
                  startedAt,
                  uptime: 0,
                  resources: {
                    cpuPercent: Math.random() * 20,
                    memoryUsedMiB: Math.floor(image.memoryMiB * 0.3),
                    memoryTotalMiB: image.memoryMiB,
                  },
                  activeMcpServers: image.mcpServers
                    .filter((s) => s.autoStart)
                    .map((s) => s.name),
                }
              : inst
          )
        );

        // Start uptime counter
        const interval = setInterval(() => {
          setInstances((prev) =>
            prev.map((inst) =>
              inst.id === instanceId && inst.status === 'running'
                ? {
                    ...inst,
                    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
                    resources: {
                      cpuPercent: Math.min(100, Math.random() * 30),
                      memoryUsedMiB: Math.floor(image.memoryMiB * (0.3 + Math.random() * 0.2)),
                      memoryTotalMiB: image.memoryMiB,
                    },
                  }
                : inst
            )
          );
        }, 1000);

        uptimeIntervals.current.set(instanceId, interval);

        // Return the final instance
        return {
          ...newInstance,
          status: 'running',
          startedAt,
          uptime: 0,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start instance';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [images, instances.length]
  );

  // Stop an instance
  const stopInstance = useCallback(async (instanceId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Update to stopping state
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instanceId ? { ...inst, status: 'stopping' as ContainerStatus } : inst
        )
      );

      // Stop uptime counter
      const interval = uptimeIntervals.current.get(instanceId);
      if (interval) {
        clearInterval(interval);
        uptimeIntervals.current.delete(instanceId);
      }

      // Simulate shutdown time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update to stopped state
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instanceId
            ? {
                ...inst,
                status: 'stopped' as ContainerStatus,
                uptime: undefined,
                resources: undefined,
                sshSessions: 0,
                activeMcpServers: [],
              }
            : inst
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop instance';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect SSH
  const connectSSH = useCallback(
    (instanceId: string) => {
      const instance = instances.find((i) => i.id === instanceId);
      if (!instance || instance.status !== 'running') {
        setError('Instance is not running');
        return;
      }

      const image = images.find((img) => img.id === instance.imageId);
      if (!image) {
        setError('Image not found');
        return;
      }

      // Increment SSH session count
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instanceId ? { ...inst, sshSessions: inst.sshSessions + 1 } : inst
        )
      );

      onSSHConnect?.(instanceId, image.ssh);
    },
    [instances, images, onSSHConnect]
  );

  // Browse files
  const browseFiles = useCallback(
    (instanceId: string) => {
      const instance = instances.find((i) => i.id === instanceId);
      if (!instance || instance.status !== 'running') {
        setError('Instance is not running');
        return;
      }

      onBrowseFiles?.(instanceId);
    },
    [instances, onBrowseFiles]
  );

  // Configure MCP server
  const configureMCP = useCallback(
    (instanceId: string, server: MCPServerConfig) => {
      setInstances((prev) =>
        prev.map((inst) => {
          if (inst.id !== instanceId) return inst;

          const isActive = inst.activeMcpServers.includes(server.name);
          return {
            ...inst,
            activeMcpServers: isActive
              ? inst.activeMcpServers.filter((s) => s !== server.name)
              : [...inst.activeMcpServers, server.name],
          };
        })
      );
    },
    []
  );

  return {
    images,
    instances,
    selectedInstanceId,
    selectInstance: setSelectedInstanceId,
    selectedInstance,
    getImageForInstance,
    startInstance,
    stopInstance,
    connectSSH,
    browseFiles,
    configureMCP,
    loading,
    error,
  };
}

export default useContainers;
