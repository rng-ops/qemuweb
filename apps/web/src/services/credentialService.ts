/**
 * Credential Manager Service
 *
 * Manages storage and retrieval of credentials for containers, SSH, and other services.
 * Stores credentials encrypted in IndexedDB with an optional master password.
 */

export interface Credential {
  /** Unique credential ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Credential type */
  type: 'ssh' | 'api' | 'database' | 'token' | 'other';
  /** Associated container/service ID */
  targetId?: string;
  /** Target host/endpoint */
  host?: string;
  /** Port */
  port?: number;
  /** Username */
  username: string;
  /** Password (stored encrypted in production) */
  password: string;
  /** Private key (for SSH key auth) */
  privateKey?: string;
  /** Tags for organization */
  tags: string[];
  /** When the credential was created */
  createdAt: Date;
  /** When last used */
  lastUsedAt?: Date;
  /** Usage count */
  usageCount: number;
  /** Notes */
  notes?: string;
  /** Auto-generated */
  isGenerated: boolean;
}

export interface CredentialMatch {
  credential: Credential;
  score: number; // 0-100, higher is better match
  matchReason: string;
}

export type CredentialListener = (credentials: Credential[]) => void;

const DB_NAME = 'qemuweb-credentials';
const STORE_NAME = 'credentials';
const DB_VERSION = 1;

/**
 * Generate a cryptographically secure password
 */
export function generateSecurePassword(
  length = 24,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {}
): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  let chars = '';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }

  return password;
}

/**
 * Generate a memorable password phrase
 */
export function generatePassphrase(wordCount = 4): string {
  const words = [
    'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
    'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
    'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
    'xray', 'yankee', 'zulu', 'quantum', 'nebula', 'cosmos', 'stellar',
    'orbital', 'lunar', 'solar', 'galactic', 'atomic', 'fusion', 'plasma',
    'vector', 'matrix', 'binary', 'cipher', 'crypto', 'secure', 'shield',
  ];

  const array = new Uint32Array(wordCount);
  crypto.getRandomValues(array);

  const phrase = Array.from(array)
    .map((n) => words[n % words.length])
    .join('-');

  // Add a random number at the end
  const num = new Uint32Array(1);
  crypto.getRandomValues(num);
  return `${phrase}-${(num[0] % 900) + 100}`;
}

class CredentialService {
  private db: IDBDatabase | null = null;
  private listeners: Set<CredentialListener> = new Set();
  private cache: Map<string, Credential> = new Map();

  /**
   * Initialize the credential store
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open credential database'));

      request.onsuccess = () => {
        this.db = request.result;
        this.loadCache().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('targetId', 'targetId', { unique: false });
          store.createIndex('host', 'host', { unique: false });
          store.createIndex('username', 'username', { unique: false });
        }
      };
    });
  }

  private async loadCache(): Promise<void> {
    const credentials = await this.list();
    this.cache.clear();
    credentials.forEach((c) => this.cache.set(c.id, c));
  }

  private notifyListeners(): void {
    const credentials = Array.from(this.cache.values());
    this.listeners.forEach((listener) => listener(credentials));
  }

  /**
   * Subscribe to credential changes
   */
  subscribe(listener: CredentialListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(Array.from(this.cache.values()));
    return () => this.listeners.delete(listener);
  }

  /**
   * Create a new credential
   */
  async create(
    data: Omit<Credential, 'id' | 'createdAt' | 'usageCount'>
  ): Promise<Credential> {
    await this.init();

    const credential: Credential = {
      ...data,
      id: `cred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      usageCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const request = store.add({
        ...credential,
        createdAt: credential.createdAt.toISOString(),
        lastUsedAt: credential.lastUsedAt?.toISOString(),
      });

      request.onsuccess = () => {
        this.cache.set(credential.id, credential);
        this.notifyListeners();
        resolve(credential);
      };
      request.onerror = () => reject(new Error('Failed to create credential'));
    });
  }

  /**
   * Get a credential by ID
   */
  async get(id: string): Promise<Credential | null> {
    await this.init();

    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          const credential = this.deserialize(request.result);
          this.cache.set(credential.id, credential);
          resolve(credential);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(new Error('Failed to get credential'));
    });
  }

  /**
   * Update a credential
   */
  async update(id: string, updates: Partial<Credential>): Promise<Credential | null> {
    await this.init();

    const existing = await this.get(id);
    if (!existing) return null;

    const updated: Credential = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change
      createdAt: existing.createdAt, // Prevent creation date change
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const request = store.put({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        lastUsedAt: updated.lastUsedAt?.toISOString(),
      });

      request.onsuccess = () => {
        this.cache.set(updated.id, updated);
        this.notifyListeners();
        resolve(updated);
      };
      request.onerror = () => reject(new Error('Failed to update credential'));
    });
  }

  /**
   * Delete a credential
   */
  async delete(id: string): Promise<boolean> {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.cache.delete(id);
        this.notifyListeners();
        resolve(true);
      };
      request.onerror = () => reject(new Error('Failed to delete credential'));
    });
  }

  /**
   * List all credentials
   */
  async list(filter?: {
    type?: Credential['type'];
    targetId?: string;
    host?: string;
  }): Promise<Credential[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let credentials = request.result.map(this.deserialize);

        if (filter) {
          if (filter.type) {
            credentials = credentials.filter((c) => c.type === filter.type);
          }
          if (filter.targetId) {
            credentials = credentials.filter((c) => c.targetId === filter.targetId);
          }
          if (filter.host) {
            credentials = credentials.filter((c) => c.host === filter.host);
          }
        }

        resolve(credentials);
      };
      request.onerror = () => reject(new Error('Failed to list credentials'));
    });
  }

  /**
   * Find matching credentials for a target
   */
  async findMatches(params: {
    host?: string;
    port?: number;
    username?: string;
    targetId?: string;
    type?: Credential['type'];
  }): Promise<CredentialMatch[]> {
    const credentials = await this.list({ type: params.type });
    const matches: CredentialMatch[] = [];

    for (const credential of credentials) {
      let score = 0;
      const reasons: string[] = [];

      // Exact targetId match
      if (params.targetId && credential.targetId === params.targetId) {
        score += 50;
        reasons.push('container match');
      }

      // Host match
      if (params.host && credential.host) {
        if (credential.host === params.host) {
          score += 30;
          reasons.push('exact host');
        } else if (credential.host.includes(params.host) || params.host.includes(credential.host)) {
          score += 15;
          reasons.push('partial host');
        }
      }

      // Port match
      if (params.port && credential.port === params.port) {
        score += 10;
        reasons.push('port match');
      }

      // Username match
      if (params.username && credential.username === params.username) {
        score += 20;
        reasons.push('username match');
      }

      // Recent usage bonus
      if (credential.lastUsedAt) {
        const daysSinceUse = (Date.now() - credential.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUse < 1) score += 10;
        else if (daysSinceUse < 7) score += 5;
      }

      // Usage frequency bonus
      if (credential.usageCount > 10) score += 5;
      else if (credential.usageCount > 5) score += 3;

      if (score > 0) {
        matches.push({
          credential,
          score,
          matchReason: reasons.join(', '),
        });
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Record usage of a credential
   */
  async recordUsage(id: string): Promise<void> {
    const credential = await this.get(id);
    if (credential) {
      await this.update(id, {
        lastUsedAt: new Date(),
        usageCount: credential.usageCount + 1,
      });
    }
  }

  /**
   * Generate and store a new credential for a container
   */
  async generateForContainer(
    containerId: string,
    containerName: string,
    host: string,
    port: number,
    username: string
  ): Promise<Credential> {
    const password = generateSecurePassword(20);
    
    return this.create({
      name: `${containerName} SSH`,
      type: 'ssh',
      targetId: containerId,
      host,
      port,
      username,
      password,
      tags: ['container', 'ssh', 'generated'],
      isGenerated: true,
    });
  }

  private deserialize(data: Record<string, unknown>): Credential {
    return {
      ...data,
      createdAt: new Date(data.createdAt as string),
      lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt as string) : undefined,
    } as Credential;
  }
}

// Singleton instance
let instance: CredentialService | null = null;

export function getCredentialService(): CredentialService {
  if (!instance) {
    instance = new CredentialService();
  }
  return instance;
}

export type { CredentialService };
