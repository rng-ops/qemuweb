import { useState, useEffect, useCallback, useRef } from 'react';
import { QemuClient, type RuntimeCapabilities, type VmState } from '@qemuweb/runtime';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

export interface UseQemuClientOptions {
  onSerialOut?: (vmId: string, data: string) => void;
  onLog?: (level: string, message: string, vmId?: string) => void;
  onProgress?: (vmId: string | undefined, stage: string, percent: number, message: string) => void;
}

export interface UseQemuClientResult {
  client: QemuClient | null;
  capabilities: RuntimeCapabilities | null;
  vmState: VmState | null;
  isReady: boolean;
  error: string | null;
  startVm: (vmId: string, profile: VmProfile, inputs: VmInputs, overrides?: VmOverrides) => Promise<void>;
  stopVm: (vmId: string, force?: boolean) => Promise<void>;
  resetVm: (vmId: string) => Promise<void>;
  sendSerialIn: (vmId: string, data: string) => void;
}

export function useQemuClient(options: UseQemuClientOptions = {}): UseQemuClientResult {
  const [client, setClient] = useState<QemuClient | null>(null);
  const [capabilities, setCapabilities] = useState<RuntimeCapabilities | null>(null);
  const [vmState, setVmState] = useState<VmState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Initialize client
  useEffect(() => {
    const qemuClient = new QemuClient({
      onSerialOut: (vmId, data) => {
        optionsRef.current.onSerialOut?.(vmId, data);
      },
      onLog: (level, message, vmId) => {
        optionsRef.current.onLog?.(level, message, vmId);
        if (level === 'error') {
          console.error(`[QEMU${vmId ? ` ${vmId}` : ''}]`, message);
        } else if (level === 'warn') {
          console.warn(`[QEMU${vmId ? ` ${vmId}` : ''}]`, message);
        } else {
          console.info(`[QEMU${vmId ? ` ${vmId}` : ''}]`, message);
        }
      },
      onProgress: (vmId, stage, percent, message) => {
        optionsRef.current.onProgress?.(vmId, stage, percent, message);
      },
      onStateChange: (_vmId, state) => {
        setVmState(state);
      },
      onCapabilities: (caps) => {
        setCapabilities(caps);
      },
    });

    setClient(qemuClient);

    // Initialize
    qemuClient
      .init()
      .then((caps) => {
        setCapabilities(caps);
        setIsReady(true);
      })
      .catch((err) => {
        setError(err.message || 'Failed to initialize QEMU client');
      });

    return () => {
      qemuClient.terminate();
    };
  }, []);

  const startVm = useCallback(
    async (vmId: string, profile: VmProfile, inputs: VmInputs, overrides?: VmOverrides) => {
      if (!client) {
        throw new Error('Client not initialized');
      }
      await client.startVm(vmId, profile, inputs, overrides);
    },
    [client]
  );

  const stopVm = useCallback(
    async (vmId: string, force = false) => {
      if (!client) {
        throw new Error('Client not initialized');
      }
      await client.stopVm(vmId, force);
    },
    [client]
  );

  const resetVm = useCallback(
    async (vmId: string) => {
      if (!client) {
        throw new Error('Client not initialized');
      }
      await client.resetVm(vmId);
    },
    [client]
  );

  const sendSerialIn = useCallback(
    (vmId: string, data: string) => {
      if (!client) {
        throw new Error('Client not initialized');
      }
      client.sendSerialIn(vmId, data);
    },
    [client]
  );

  return {
    client,
    capabilities,
    vmState,
    isReady,
    error,
    startVm,
    stopVm,
    resetVm,
    sendSerialIn,
  };
}
