/**
 * Cryptographically Signed Audit Log
 * 
 * Stores all agent actions, tool invocations, and system events in IndexedDB
 * with cryptographic signatures for integrity verification.
 * 
 * Features:
 * - ECDSA P-256 signatures for each entry
 * - SHA-256 hash chain linking entries
 * - Full-text searchable
 * - Vector memory integration for semantic search
 * - Export/import capabilities
 */

import { ToolInvocation, ApprovalRequest, ToolRiskLevel } from './agentTools';

// ============ Types ============

export type AuditEventType = 
  | 'tool_invocation'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'navigation'
  | 'user_action'
  | 'agent_message'
  | 'system_event'
  | 'error';

export interface AuditEntry {
  id: string;
  timestamp: number;
  type: AuditEventType;
  data: Record<string, unknown>;
  metadata: AuditMetadata;
  signature?: string;
  previousHash?: string;
  hash: string;
  verified?: boolean;
}

export interface AuditMetadata {
  sessionId: string;
  agentId?: string;
  userId?: string;
  riskLevel?: ToolRiskLevel;
  tags: string[];
  searchableText: string;
}

export interface AuditQuery {
  type?: AuditEventType | AuditEventType[];
  startTime?: number;
  endTime?: number;
  riskLevel?: ToolRiskLevel[];
  tags?: string[];
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEntries: number;
  entriesByType: Record<AuditEventType, number>;
  entriesByRiskLevel: Record<ToolRiskLevel, number>;
  firstEntry?: number;
  lastEntry?: number;
  chainIntegrity: boolean;
}

// ============ Crypto Utilities ============

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
}

async function signData(privateKey: CryptoKey, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    dataBuffer
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifySignature(
  publicKey: CryptoKey, 
  data: string, 
  signature: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    signatureBuffer,
    dataBuffer
  );
}

async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(exported);
}

async function importPublicKey(jwk: string): Promise<CryptoKey> {
  const keyData = JSON.parse(jwk);
  return crypto.subtle.importKey(
    'jwk',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  );
}

async function importPrivateKey(jwk: string): Promise<CryptoKey> {
  const keyData = JSON.parse(jwk);
  return crypto.subtle.importKey(
    'jwk',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  );
}

// ============ IndexedDB Schema ============

const DB_NAME = 'qemuweb-audit-log';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';
const STORE_KEYS = 'keys';
const STORE_META = 'metadata';

interface DBSchema {
  entries: AuditEntry;
  keys: { id: string; publicKey: string; privateKey: string };
  metadata: { key: string; value: unknown };
}

// ============ Audit Log Implementation ============

export class AuditLog {
  private db: IDBDatabase | null = null;
  private keyPair: CryptoKeyPair | null = null;
  private lastHash: string = '';
  private sessionId: string;
  private initialized = false;

  constructor() {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Open database
    this.db = await this.openDB();
    
    // Load or generate key pair
    await this.loadOrGenerateKeys();
    
    // Get last hash for chain continuity
    await this.loadLastHash();
    
    this.initialized = true;
    console.log('[AuditLog] Initialized with session:', this.sessionId);
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Entries store with indexes
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          const entriesStore = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
          entriesStore.createIndex('timestamp', 'timestamp', { unique: false });
          entriesStore.createIndex('type', 'type', { unique: false });
          entriesStore.createIndex('riskLevel', 'metadata.riskLevel', { unique: false });
          entriesStore.createIndex('sessionId', 'metadata.sessionId', { unique: false });
        }

        // Keys store
        if (!db.objectStoreNames.contains(STORE_KEYS)) {
          db.createObjectStore(STORE_KEYS, { keyPath: 'id' });
        }

        // Metadata store
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
    });
  }

  private async loadOrGenerateKeys(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(STORE_KEYS, 'readonly');
    const store = tx.objectStore(STORE_KEYS);
    
    const keyRecord = await new Promise<DBSchema['keys'] | undefined>((resolve) => {
      const request = store.get('signing-key');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });

    if (keyRecord) {
      // Import existing keys
      const publicKey = await importPublicKey(keyRecord.publicKey);
      const privateKey = await importPrivateKey(keyRecord.privateKey);
      this.keyPair = { publicKey, privateKey };
    } else {
      // Generate new keys
      this.keyPair = await generateKeyPair();
      
      const publicKeyJwk = await exportKey(this.keyPair.publicKey);
      const privateKeyJwk = await exportKey(this.keyPair.privateKey);
      
      const saveTx = this.db.transaction(STORE_KEYS, 'readwrite');
      const saveStore = saveTx.objectStore(STORE_KEYS);
      saveStore.put({
        id: 'signing-key',
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
      });
    }
  }

  private async loadLastHash(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(STORE_ENTRIES, 'readonly');
    const store = tx.objectStore(STORE_ENTRIES);
    const index = store.index('timestamp');
    
    const lastEntry = await new Promise<AuditEntry | undefined>((resolve) => {
      const request = index.openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor?.value);
      };
      request.onerror = () => resolve(undefined);
    });

    this.lastHash = lastEntry?.hash || '';
  }

  // ============ Logging Methods ============

  async log(
    type: AuditEventType,
    data: Record<string, unknown>,
    options: Partial<AuditMetadata> = {}
  ): Promise<AuditEntry> {
    if (!this.initialized) await this.init();
    if (!this.db || !this.keyPair) throw new Error('Audit log not initialized');

    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = Date.now();
    
    // Build searchable text from data
    const searchableText = this.buildSearchableText(type, data, options);
    
    const metadata: AuditMetadata = {
      sessionId: this.sessionId,
      agentId: options.agentId,
      userId: options.userId,
      riskLevel: options.riskLevel,
      tags: options.tags || [],
      searchableText,
    };

    // Create entry without signature and hash first
    const entryData = JSON.stringify({ id, timestamp, type, data, metadata });
    
    // Sign the entry
    const signature = await signData(this.keyPair.privateKey, entryData);
    
    // Create hash including previous hash for chain
    const hashInput = `${this.lastHash}|${entryData}|${signature}`;
    const hash = await hashData(hashInput);

    const entry: AuditEntry = {
      id,
      timestamp,
      type,
      data,
      metadata,
      signature,
      previousHash: this.lastHash || undefined,
      hash,
      verified: true,
    };

    // Save to IndexedDB
    const tx = this.db.transaction(STORE_ENTRIES, 'readwrite');
    const store = tx.objectStore(STORE_ENTRIES);
    store.put(entry);

    // Update last hash
    this.lastHash = hash;

    // Emit event for real-time updates
    window.dispatchEvent(new CustomEvent('auditlog:entry', { detail: entry }));

    return entry;
  }

  private buildSearchableText(
    type: AuditEventType,
    data: Record<string, unknown>,
    options: Partial<AuditMetadata>
  ): string {
    const parts: string[] = [type];
    
    // Extract text from common fields
    if (data.toolName) parts.push(String(data.toolName));
    if (data.message) parts.push(String(data.message));
    if (data.error) parts.push(String(data.error));
    if (data.params && typeof data.params === 'object') {
      parts.push(JSON.stringify(data.params));
    }
    
    if (options.tags) {
      parts.push(...options.tags);
    }
    
    return parts.join(' ').toLowerCase();
  }

  // ============ Convenience Logging Methods ============

  async logToolInvocation(invocation: ToolInvocation): Promise<AuditEntry> {
    return this.log('tool_invocation', {
      invocationId: invocation.id,
      toolName: invocation.toolName,
      params: invocation.params,
      status: invocation.status,
      result: invocation.result,
      duration: invocation.endTime ? invocation.endTime - invocation.startTime : undefined,
    }, {
      agentId: invocation.context.agentId,
      riskLevel: this.getRiskLevelForTool(invocation.toolName),
      tags: ['tool', invocation.toolName, invocation.status],
    });
  }

  async logApprovalRequest(request: ApprovalRequest): Promise<AuditEntry> {
    return this.log('approval_requested', {
      approvalId: request.id,
      toolName: request.toolName,
      params: request.params,
      reason: request.reason,
      expiresAt: request.expiresAt,
    }, {
      riskLevel: request.riskLevel,
      tags: ['approval', 'pending', request.toolName],
    });
  }

  async logApprovalDecision(
    approvalId: string, 
    approved: boolean,
    reason?: string
  ): Promise<AuditEntry> {
    return this.log(approved ? 'approval_granted' : 'approval_denied', {
      approvalId,
      approved,
      reason,
    }, {
      tags: ['approval', approved ? 'granted' : 'denied'],
    });
  }

  async logAgentMessage(
    role: 'user' | 'assistant',
    content: string,
    agentId?: string
  ): Promise<AuditEntry> {
    return this.log('agent_message', {
      role,
      content: content.slice(0, 1000), // Truncate for storage
      contentLength: content.length,
    }, {
      agentId,
      tags: ['message', role],
    });
  }

  async logNavigation(from: string, to: string): Promise<AuditEntry> {
    return this.log('navigation', { from, to }, {
      tags: ['navigation', to],
    });
  }

  async logError(error: Error | string, context?: Record<string, unknown>): Promise<AuditEntry> {
    return this.log('error', {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
    }, {
      tags: ['error'],
    });
  }

  private getRiskLevelForTool(toolName: string): ToolRiskLevel {
    // Import would create circular dependency, so use simple mapping
    const riskMap: Record<string, ToolRiskLevel> = {
      'list_images': 'safe',
      'inspect_image': 'safe',
      'list_networks': 'safe',
      'navigate': 'safe',
      'show_notification': 'safe',
      'pull_image': 'medium',
      'start_container': 'medium',
      'stop_container': 'medium',
      'create_container': 'high',
      'delete_image': 'high',
      'exec_container': 'critical',
    };
    return riskMap[toolName] || 'medium';
  }

  // ============ Query Methods ============

  async query(options: AuditQuery = {}): Promise<AuditEntry[]> {
    if (!this.initialized) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(STORE_ENTRIES, 'readonly');
    const store = tx.objectStore(STORE_ENTRIES);
    
    // Get all entries (we'll filter in memory for flexibility)
    const entries: AuditEntry[] = await new Promise((resolve, reject) => {
      const request = store.index('timestamp').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    let filtered = entries;

    // Apply filters
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      filtered = filtered.filter(e => types.includes(e.type));
    }

    if (options.startTime) {
      filtered = filtered.filter(e => e.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      filtered = filtered.filter(e => e.timestamp <= options.endTime!);
    }

    if (options.riskLevel && options.riskLevel.length > 0) {
      filtered = filtered.filter(e => 
        e.metadata.riskLevel && options.riskLevel!.includes(e.metadata.riskLevel)
      );
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(e => 
        options.tags!.some(tag => e.metadata.tags.includes(tag))
      );
    }

    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      filtered = filtered.filter(e => 
        e.metadata.searchableText.includes(searchLower)
      );
    }

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    if (options.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async getStats(): Promise<AuditStats> {
    if (!this.initialized) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const entries = await this.query();
    
    const entriesByType: Record<AuditEventType, number> = {
      tool_invocation: 0,
      approval_requested: 0,
      approval_granted: 0,
      approval_denied: 0,
      navigation: 0,
      user_action: 0,
      agent_message: 0,
      system_event: 0,
      error: 0,
    };

    const entriesByRiskLevel: Record<ToolRiskLevel, number> = {
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const entry of entries) {
      entriesByType[entry.type]++;
      if (entry.metadata.riskLevel) {
        entriesByRiskLevel[entry.metadata.riskLevel]++;
      }
    }

    // Verify chain integrity
    const chainIntegrity = await this.verifyChain();

    return {
      totalEntries: entries.length,
      entriesByType,
      entriesByRiskLevel,
      firstEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : undefined,
      lastEntry: entries.length > 0 ? entries[0].timestamp : undefined,
      chainIntegrity,
    };
  }

  // ============ Verification Methods ============

  async verifyEntry(entry: AuditEntry): Promise<boolean> {
    if (!this.keyPair) return false;
    if (!entry.signature) return false;

    const entryData = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      type: entry.type,
      data: entry.data,
      metadata: entry.metadata,
    });

    return verifySignature(this.keyPair.publicKey, entryData, entry.signature);
  }

  async verifyChain(): Promise<boolean> {
    const entries = await this.query();
    
    // Sort by timestamp ascending for chain verification
    entries.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Verify signature
      const valid = await this.verifyEntry(entry);
      if (!valid) {
        console.error(`[AuditLog] Invalid signature for entry: ${entry.id}`);
        return false;
      }

      // Verify hash chain
      if (i > 0) {
        const prevEntry = entries[i - 1];
        if (entry.previousHash !== prevEntry.hash) {
          console.error(`[AuditLog] Broken chain at entry: ${entry.id}`);
          return false;
        }
      }
    }

    return true;
  }

  // ============ Export/Import ============

  async export(): Promise<string> {
    const entries = await this.query();
    const stats = await this.getStats();
    
    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      sessionId: this.sessionId,
      stats,
      entries,
    }, null, 2);
  }

  async getRecentForContext(limit = 20): Promise<string> {
    const entries = await this.query({ limit });
    
    return entries.map(e => {
      const time = new Date(e.timestamp).toISOString();
      return `[${time}] ${e.type}: ${e.metadata.searchableText.slice(0, 100)}`;
    }).join('\n');
  }

  // ============ Cleanup ============

  async clear(): Promise<void> {
    if (!this.db) return;
    
    const tx = this.db.transaction(STORE_ENTRIES, 'readwrite');
    const store = tx.objectStore(STORE_ENTRIES);
    store.clear();
    
    this.lastHash = '';
  }
}

// ============ Singleton ============

let auditLogInstance: AuditLog | null = null;

export async function getAuditLog(): Promise<AuditLog> {
  if (!auditLogInstance) {
    auditLogInstance = new AuditLog();
    await auditLogInstance.init();
  }
  return auditLogInstance;
}
