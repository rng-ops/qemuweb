/**
 * useCredentials Hook
 *
 * React hook for accessing the credential service with state subscriptions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCredentialService,
  type Credential,
  type CredentialMatch,
  generateSecurePassword,
  generatePassphrase,
} from '../services/credentialService';

interface UseCredentialsReturn {
  /** All credentials */
  credentials: Credential[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Create a new credential */
  create: (data: Omit<Credential, 'id' | 'createdAt' | 'usageCount'>) => Promise<Credential>;
  /** Update a credential */
  update: (id: string, updates: Partial<Credential>) => Promise<Credential | null>;
  /** Delete a credential */
  remove: (id: string) => Promise<boolean>;
  /** Find matching credentials for a target */
  findMatches: (params: {
    host?: string;
    port?: number;
    username?: string;
    targetId?: string;
    type?: Credential['type'];
  }) => Promise<CredentialMatch[]>;
  /** Record usage of a credential */
  recordUsage: (id: string) => Promise<void>;
  /** Generate a new password */
  generatePassword: (length?: number) => string;
  /** Generate a passphrase */
  generatePassphrase: (wordCount?: number) => string;
  /** Generate and store credential for container */
  generateForContainer: (
    containerId: string,
    containerName: string,
    host: string,
    port: number,
    username: string
  ) => Promise<Credential>;
  /** Get credential by ID */
  getById: (id: string) => Credential | undefined;
  /** Get credentials for a container */
  getForContainer: (containerId: string) => Credential[];
}

export function useCredentials(): UseCredentialsReturn {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(() => getCredentialService(), []);

  // Initialize and subscribe
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await service.init();
        const creds = await service.list();
        if (mounted) {
          setCredentials(creds);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load credentials');
          setLoading(false);
        }
      }
    };

    init();

    const unsubscribe = service.subscribe((creds) => {
      if (mounted) {
        setCredentials(creds);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [service]);

  const create = useCallback(
    async (data: Omit<Credential, 'id' | 'createdAt' | 'usageCount'>) => {
      return service.create(data);
    },
    [service]
  );

  const update = useCallback(
    async (id: string, updates: Partial<Credential>) => {
      return service.update(id, updates);
    },
    [service]
  );

  const remove = useCallback(
    async (id: string) => {
      return service.delete(id);
    },
    [service]
  );

  const findMatches = useCallback(
    async (params: {
      host?: string;
      port?: number;
      username?: string;
      targetId?: string;
      type?: Credential['type'];
    }) => {
      return service.findMatches(params);
    },
    [service]
  );

  const recordUsage = useCallback(
    async (id: string) => {
      return service.recordUsage(id);
    },
    [service]
  );

  const generateForContainer = useCallback(
    async (
      containerId: string,
      containerName: string,
      host: string,
      port: number,
      username: string
    ) => {
      return service.generateForContainer(containerId, containerName, host, port, username);
    },
    [service]
  );

  const getById = useCallback(
    (id: string) => credentials.find((c) => c.id === id),
    [credentials]
  );

  const getForContainer = useCallback(
    (containerId: string) => credentials.filter((c) => c.targetId === containerId),
    [credentials]
  );

  return {
    credentials,
    loading,
    error,
    create,
    update,
    remove,
    findMatches,
    recordUsage,
    generatePassword: generateSecurePassword,
    generatePassphrase,
    generateForContainer,
    getById,
    getForContainer,
  };
}

export default useCredentials;
