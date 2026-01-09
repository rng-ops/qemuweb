/**
 * useSDN Hook
 *
 * React hook for interacting with the SDN control plane worker.
 * Manages network topology, nodes, links, and security policies.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { VirtualNetwork, Route } from '@qemuweb/vm-config';
import type {
  SDNNode,
  SDNLink,
  SecurityPolicy,
  OpenFile,
  SerializedSDNState,
  SDNCommand,
  SDNResponse,
  PolicyContext,
} from '../workers/sdnControlPlane';

export type { SDNNode, SDNLink, SecurityPolicy, OpenFile, SerializedSDNState };

interface UseSDNReturn {
  /** Current SDN state */
  state: SerializedSDNState | null;
  /** Whether the worker is initialized */
  isInitialized: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;

  // Node operations
  addNode: (node: Omit<SDNNode, 'id'>) => Promise<SDNNode | null>;
  removeNode: (nodeId: string) => Promise<boolean>;
  updateNode: (nodeId: string, updates: Partial<SDNNode>) => Promise<boolean>;
  selectNode: (nodeId: string | null) => void;

  // Link operations
  addLink: (link: Omit<SDNLink, 'id' | 'stats'>) => Promise<SDNLink | null>;
  removeLink: (linkId: string) => Promise<boolean>;
  updateLink: (linkId: string, updates: Partial<SDNLink>) => Promise<boolean>;
  selectLink: (linkId: string | null) => void;

  // Network operations
  addNetwork: (network: Omit<VirtualNetwork, 'id'>) => Promise<string | null>;
  removeNetwork: (networkId: string) => Promise<boolean>;

  // Routing
  addRoute: (route: Route) => Promise<boolean>;
  removeRoute: (destination: string) => Promise<boolean>;

  // Policy operations
  addPolicy: (policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  removePolicy: (policyId: string) => Promise<boolean>;
  applyPolicy: (policyId: string, nodeIds: string[]) => Promise<boolean>;
  suggestPolicies: (context: PolicyContext) => Promise<SecurityPolicy[]>;

  // Context
  setOpenFiles: (files: OpenFile[]) => void;

  // Terraform
  getTerraform: (nodeId?: string) => Promise<string | null>;

  // Refresh
  refresh: () => void;
}

export function useSDN(): UseSDNReturn {
  const [state, setState] = useState<SerializedSDNState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Send command to worker and wait for response
  const sendCommand = useCallback(<T extends SDNResponse>(command: SDNCommand): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handler = (event: MessageEvent<SDNResponse>) => {
        clearTimeout(timeoutId);
        workerRef.current?.removeEventListener('message', handler);
        resolve(event.data as T);
      };

      workerRef.current.addEventListener('message', handler);
      workerRef.current.postMessage(command);
    });
  }, []);

  // Initialize worker
  useEffect(() => {
    console.log('[useSDN] Creating worker');
    const worker = new Worker(
      new URL('../workers/sdnControlPlane.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current = worker;

    // Handler for worker-ready message
    const initHandler = (event: MessageEvent<SDNResponse>) => {
      console.log('[useSDN] Received message:', event.data);
      if (event.data.type === 'ok' && (event.data as any).id === 'worker-ready') {
        console.log('[useSDN] Worker ready, sending init');
        worker.removeEventListener('message', initHandler);

        // Set up init response handler
        const stateHandler = (stateEvent: MessageEvent<SDNResponse>) => {
          console.log('[useSDN] Init response:', stateEvent.data);
          worker.removeEventListener('message', stateHandler);
          
          if (stateEvent.data.type === 'state') {
            setState((stateEvent.data as { type: 'state'; state: SerializedSDNState }).state);
            setIsInitialized(true);
          } else if (stateEvent.data.type === 'error') {
            setError((stateEvent.data as { type: 'error'; message: string }).message);
          }
          setLoading(false);
        };

        worker.addEventListener('message', stateHandler);
        worker.postMessage({ type: 'init' });
      }
    };

    worker.addEventListener('message', initHandler);

    // Error handler
    worker.addEventListener('error', (e) => {
      console.error('[SDN Worker Error]', e);
      setError('SDN worker failed to load');
      setLoading(false);
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Refresh state from worker
  const refresh = useCallback(async () => {
    try {
      const response = await sendCommand<{ type: 'state'; state: SerializedSDNState }>({
        type: 'get_state',
      });
      if (response.type === 'state') {
        setState(response.state);
      }
    } catch (err) {
      console.error('Failed to refresh SDN state:', err);
    }
  }, [sendCommand]);

  // Node operations
  const addNode = useCallback(
    async (node: Omit<SDNNode, 'id'>): Promise<SDNNode | null> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'add_node', node });
        if (response.type === 'node_added') {
          await refresh();
          return response.node;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add node');
        return null;
      }
    },
    [sendCommand, refresh]
  );

  const removeNode = useCallback(
    async (nodeId: string): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'remove_node', nodeId });
        if (response.type === 'node_removed') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove node');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  const updateNode = useCallback(
    async (nodeId: string, updates: Partial<SDNNode>): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'update_node', nodeId, updates });
        if (response.type === 'ok') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update node');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  const selectNode = useCallback(
    async (nodeId: string | null) => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'select_node', nodeId });
        if (response.type === 'state') {
          setState(response.state);
        }
      } catch (err) {
        console.error('Failed to select node:', err);
      }
    },
    [sendCommand]
  );

  // Link operations
  const addLink = useCallback(
    async (link: Omit<SDNLink, 'id' | 'stats'>): Promise<SDNLink | null> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'add_link', link });
        if (response.type === 'link_added') {
          await refresh();
          return response.link;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add link');
        return null;
      }
    },
    [sendCommand, refresh]
  );

  const removeLink = useCallback(
    async (linkId: string): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'remove_link', linkId });
        if (response.type === 'link_removed') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove link');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  const updateLink = useCallback(
    async (linkId: string, updates: Partial<SDNLink>): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'update_link', linkId, updates });
        if (response.type === 'ok') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update link');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  const selectLink = useCallback(
    async (linkId: string | null) => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'select_link', linkId });
        if (response.type === 'state') {
          setState(response.state);
        }
      } catch (err) {
        console.error('Failed to select link:', err);
      }
    },
    [sendCommand]
  );

  // Network operations
  const addNetwork = useCallback(
    async (network: Omit<VirtualNetwork, 'id'>): Promise<string | null> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'add_network', network });
        if (response.type === 'ok' && response.id) {
          await refresh();
          return response.id;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add network');
        return null;
      }
    },
    [sendCommand, refresh]
  );

  const removeNetwork = useCallback(
    async (networkId: string): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'remove_network', networkId });
        if (response.type === 'ok') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove network');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  // Routing
  const addRoute = useCallback(
    async (route: Route): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'add_route', route });
        if (response.type === 'ok') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add route');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  const removeRoute = useCallback(
    async (destination: string): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'remove_route', destination });
        if (response.type === 'ok') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove route');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  // Policy operations
  const addPolicy = useCallback(
    async (
      policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string | null> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'add_policy', policy });
        if (response.type === 'ok' && response.id) {
          await refresh();
          return response.id;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add policy');
        return null;
      }
    },
    [sendCommand, refresh]
  );

  const removePolicy = useCallback(
    async (policyId: string): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'remove_policy', policyId });
        if (response.type === 'ok') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove policy');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  const applyPolicy = useCallback(
    async (policyId: string, nodeIds: string[]): Promise<boolean> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'apply_policy', policyId, nodeIds });
        if (response.type === 'policy_applied') {
          await refresh();
          return true;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply policy');
        return false;
      }
    },
    [sendCommand, refresh]
  );

  const suggestPolicies = useCallback(
    async (context: PolicyContext): Promise<SecurityPolicy[]> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'suggest_policies', context });
        if (response.type === 'policy_suggestions') {
          return response.suggestions;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return [];
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get policy suggestions');
        return [];
      }
    },
    [sendCommand]
  );

  // Context
  const setOpenFiles = useCallback(
    (files: OpenFile[]) => {
      sendCommand({ type: 'set_open_files', files }).catch(console.error);
    },
    [sendCommand]
  );

  // Terraform
  const getTerraform = useCallback(
    async (nodeId?: string): Promise<string | null> => {
      try {
        const response = await sendCommand<SDNResponse>({ type: 'get_terraform', nodeId });
        if (response.type === 'terraform') {
          return response.config;
        }
        if (response.type === 'error') {
          setError(response.message);
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get Terraform');
        return null;
      }
    },
    [sendCommand]
  );

  return {
    state,
    isInitialized,
    loading,
    error,
    addNode,
    removeNode,
    updateNode,
    selectNode,
    addLink,
    removeLink,
    updateLink,
    selectLink,
    addNetwork,
    removeNetwork,
    addRoute,
    removeRoute,
    addPolicy,
    removePolicy,
    applyPolicy,
    suggestPolicies,
    setOpenFiles,
    getTerraform,
    refresh,
  };
}

export default useSDN;
