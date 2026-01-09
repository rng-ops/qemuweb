/**
 * Atlas Store - Browser Implementation
 *
 * Content-addressed storage using IndexedDB with chunking
 * and provenance tracking.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  AtlasStore,
  ContentHash,
  FileManifest,
  FileMetadata,
  FileFilter,
  ProvenanceRecord,
  VerificationResult,
  ImportResult,
  StoreStats,
  AtlasBundleManifest,
  BundleFileEntry,
  DEFAULT_CHUNK_SIZE,
  hashBlob,
  generateId,
  isValidContentHash,
  BlobChunk,
} from './types';

// ============ IndexedDB Schema ============

interface AtlasDBSchema extends DBSchema {
  /** Raw blobs (CAS) */
  blobs: {
    key: ContentHash;
    value: {
      hash: ContentHash;
      data: ArrayBuffer;
      size: number;
      createdAt: Date;
      refCount: number;
    };
  };

  /** File manifests (CAS) */
  manifests: {
    key: ContentHash;
    value: {
      hash: ContentHash;
      manifest: FileManifest;
      createdAt: Date;
      refCount: number;
    };
  };

  /** File metadata registry */
  files: {
    key: string; // file ID
    value: FileMetadata;
    indexes: {
      'by-name': string;
      'by-manifest': ContentHash;
      'by-type': string;
      'by-created': Date;
    };
  };

  /** Provenance records */
  provenance: {
    key: string; // provenance ID
    value: ProvenanceRecord;
    indexes: {
      'by-manifest': ContentHash;
      'by-previous': string;
      'by-timestamp': Date;
    };
  };

  /** Store metadata */
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'atlas-store';
const DB_VERSION = 1;

// ============ Browser Implementation ============

export class BrowserAtlasStore implements AtlasStore {
  private db: IDBPDatabase<AtlasDBSchema> | null = null;
  private chunkSize: number;

  constructor(chunkSize: number = DEFAULT_CHUNK_SIZE) {
    this.chunkSize = chunkSize;
  }

  /**
   * Initialize the store (opens/creates IndexedDB)
   */
  async init(): Promise<void> {
    this.db = await openDB<AtlasDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create blobs store
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'hash' });
        }

        // Create manifests store
        if (!db.objectStoreNames.contains('manifests')) {
          db.createObjectStore('manifests', { keyPath: 'hash' });
        }

        // Create files store with indexes
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('by-name', 'name', { unique: true });
          fileStore.createIndex('by-manifest', 'manifestHash', { unique: false });
          fileStore.createIndex('by-type', 'type', { unique: false });
          fileStore.createIndex('by-created', 'createdAt', { unique: false });
        }

        // Create provenance store with indexes
        if (!db.objectStoreNames.contains('provenance')) {
          const provStore = db.createObjectStore('provenance', { keyPath: 'id' });
          provStore.createIndex('by-manifest', 'manifestHash', { unique: false });
          provStore.createIndex('by-previous', 'previousId', { unique: false });
          provStore.createIndex('by-timestamp', 'timestamp', { unique: false });
        }

        // Create meta store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }

  private ensureDb(): IDBPDatabase<AtlasDBSchema> {
    if (!this.db) {
      throw new Error('AtlasStore not initialized. Call init() first.');
    }
    return this.db;
  }

  // ============ Blob Operations ============

  async putBlob(data: ArrayBuffer): Promise<ContentHash> {
    const db = this.ensureDb();
    const hash = await hashBlob(data);

    const existing = await db.get('blobs', hash);
    if (existing) {
      // Increment ref count
      await db.put('blobs', {
        ...existing,
        refCount: existing.refCount + 1,
      });
      return hash;
    }

    await db.put('blobs', {
      hash,
      data,
      size: data.byteLength,
      createdAt: new Date(),
      refCount: 1,
    });

    return hash;
  }

  async getBlob(hash: ContentHash): Promise<ArrayBuffer | null> {
    const db = this.ensureDb();
    const blob = await db.get('blobs', hash);
    return blob?.data ?? null;
  }

  async hasBlob(hash: ContentHash): Promise<boolean> {
    const db = this.ensureDb();
    const blob = await db.get('blobs', hash);
    return blob !== undefined;
  }

  async deleteBlob(hash: ContentHash): Promise<boolean> {
    const db = this.ensureDb();
    const blob = await db.get('blobs', hash);

    if (!blob) return false;

    if (blob.refCount > 1) {
      await db.put('blobs', {
        ...blob,
        refCount: blob.refCount - 1,
      });
      return false; // Still referenced
    }

    await db.delete('blobs', hash);
    return true;
  }

  // ============ Manifest Operations ============

  async putManifest(manifest: FileManifest): Promise<ContentHash> {
    const db = this.ensureDb();
    const manifestJson = JSON.stringify(manifest);
    const manifestBuffer = new TextEncoder().encode(manifestJson).buffer;
    const hash = await hashBlob(manifestBuffer);

    const existing = await db.get('manifests', hash);
    if (existing) {
      await db.put('manifests', {
        ...existing,
        refCount: existing.refCount + 1,
      });
      return hash;
    }

    await db.put('manifests', {
      hash,
      manifest,
      createdAt: new Date(),
      refCount: 1,
    });

    return hash;
  }

  async getManifest(hash: ContentHash): Promise<FileManifest | null> {
    const db = this.ensureDb();
    const entry = await db.get('manifests', hash);
    return entry?.manifest ?? null;
  }

  // ============ File Operations ============

  async registerFile(
    name: string,
    manifestHash: ContentHash,
    metadata: Partial<FileMetadata>
  ): Promise<FileMetadata> {
    const db = this.ensureDb();

    // Check if name already exists
    const existing = await db.getFromIndex('files', 'by-name', name);
    if (existing) {
      throw new Error(`File "${name}" already exists`);
    }

    // Get manifest for type and size
    const manifest = await this.getManifest(manifestHash);
    if (!manifest) {
      throw new Error(`Manifest ${manifestHash} not found`);
    }

    const now = new Date();
    const file: FileMetadata = {
      id: generateId(),
      name,
      manifestHash,
      type: manifest.type,
      size: manifest.totalSize,
      mimeType: manifest.mimeType,
      origin: metadata.origin ?? 'uploaded',
      originDetails: metadata.originDetails,
      tags: metadata.tags ?? [],
      createdAt: now,
      updatedAt: now,
      sharedWithAssistant: metadata.sharedWithAssistant ?? false,
      provenanceId: metadata.provenanceId,
    };

    await db.put('files', file);
    return file;
  }

  async getFile(name: string): Promise<FileMetadata | null> {
    const db = this.ensureDb();
    const file = await db.getFromIndex('files', 'by-name', name);
    return file ?? null;
  }

  async getFileById(id: string): Promise<FileMetadata | null> {
    const db = this.ensureDb();
    const file = await db.get('files', id);
    return file ?? null;
  }

  async listFiles(filter?: FileFilter): Promise<FileMetadata[]> {
    const db = this.ensureDb();
    let files = await db.getAll('files');

    if (filter) {
      files = files.filter((f) => {
        if (filter.type) {
          const types = Array.isArray(filter.type) ? filter.type : [filter.type];
          if (!types.includes(f.type)) return false;
        }
        if (filter.origin && f.origin !== filter.origin) return false;
        if (filter.sharedWithAssistant !== undefined && f.sharedWithAssistant !== filter.sharedWithAssistant) {
          return false;
        }
        if (filter.tags && filter.tags.length > 0) {
          if (!filter.tags.every((t) => f.tags.includes(t))) return false;
        }
        if (filter.namePattern) {
          const regex = new RegExp(filter.namePattern, 'i');
          if (!regex.test(f.name)) return false;
        }
        if (filter.createdAfter && f.createdAt < filter.createdAfter) return false;
        if (filter.createdBefore && f.createdAt > filter.createdBefore) return false;
        return true;
      });
    }

    // Sort by name
    files.sort((a, b) => a.name.localeCompare(b.name));
    return files;
  }

  async updateFile(name: string, updates: Partial<FileMetadata>): Promise<FileMetadata> {
    const db = this.ensureDb();
    const file = await db.getFromIndex('files', 'by-name', name);

    if (!file) {
      throw new Error(`File "${name}" not found`);
    }

    const updated: FileMetadata = {
      ...file,
      ...updates,
      id: file.id, // Cannot change ID
      name: file.name, // Use renameFile() to change name
      updatedAt: new Date(),
    };

    await db.put('files', updated);
    return updated;
  }

  async deleteFile(name: string): Promise<boolean> {
    const db = this.ensureDb();
    const file = await db.getFromIndex('files', 'by-name', name);

    if (!file) return false;

    // Delete file record
    await db.delete('files', file.id);

    // Decrement manifest ref count
    const manifestEntry = await db.get('manifests', file.manifestHash);
    if (manifestEntry) {
      if (manifestEntry.refCount <= 1) {
        await db.delete('manifests', file.manifestHash);
      } else {
        await db.put('manifests', {
          ...manifestEntry,
          refCount: manifestEntry.refCount - 1,
        });
      }
    }

    return true;
  }

  async renameFile(oldName: string, newName: string): Promise<FileMetadata> {
    const db = this.ensureDb();
    const file = await db.getFromIndex('files', 'by-name', oldName);

    if (!file) {
      throw new Error(`File "${oldName}" not found`);
    }

    const existingNew = await db.getFromIndex('files', 'by-name', newName);
    if (existingNew) {
      throw new Error(`File "${newName}" already exists`);
    }

    const updated: FileMetadata = {
      ...file,
      name: newName,
      updatedAt: new Date(),
    };

    await db.put('files', updated);
    return updated;
  }

  // ============ Provenance Operations ============

  async addProvenance(record: Omit<ProvenanceRecord, 'id'>): Promise<ProvenanceRecord> {
    const db = this.ensureDb();

    const fullRecord: ProvenanceRecord = {
      ...record,
      id: generateId(),
    };

    await db.put('provenance', fullRecord);
    return fullRecord;
  }

  async getProvenance(id: string): Promise<ProvenanceRecord | null> {
    const db = this.ensureDb();
    const record = await db.get('provenance', id);
    return record ?? null;
  }

  async getProvenanceForManifest(manifestHash: ContentHash): Promise<ProvenanceRecord[]> {
    const db = this.ensureDb();
    const records = await db.getAllFromIndex('provenance', 'by-manifest', manifestHash);
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return records;
  }

  async getProvenanceChain(id: string): Promise<ProvenanceRecord[]> {
    const db = this.ensureDb();
    const chain: ProvenanceRecord[] = [];
    let currentId: string | undefined = id;

    while (currentId) {
      const record: ProvenanceRecord | undefined = await db.get('provenance', currentId);
      if (!record) break;
      chain.push(record);
      currentId = record.previousId;
    }

    return chain;
  }

  // ============ Verification ============

  async verify(nameOrHash: string | ContentHash): Promise<VerificationResult> {
    const manifestHash = isValidContentHash(nameOrHash)
      ? nameOrHash
      : (await this.getFile(nameOrHash))?.manifestHash;

    if (!manifestHash) {
      throw new Error(`File or manifest not found: ${nameOrHash}`);
    }

    const manifest = await this.getManifest(manifestHash);
    if (!manifest) {
      throw new Error(`Manifest not found: ${manifestHash}`);
    }

    const missingBlobs: ContentHash[] = [];
    const mismatchedBlobs: ContentHash[] = [];

    for (const chunk of manifest.chunks) {
      const blob = await this.getBlob(chunk.hash);
      if (!blob) {
        missingBlobs.push(chunk.hash);
        continue;
      }

      // Verify hash
      const actualHash = await hashBlob(blob);
      if (actualHash !== chunk.hash) {
        mismatchedBlobs.push(chunk.hash);
      }
    }

    return {
      ok: missingBlobs.length === 0 && mismatchedBlobs.length === 0,
      manifestHash,
      totalChunks: manifest.chunks.length,
      missingBlobs,
      mismatchedBlobs,
      verifiedAt: new Date(),
    };
  }

  // ============ Bundle Operations ============

  async exportBundle(fileNames: string[]): Promise<Blob> {
    const files: BundleFileEntry[] = [];
    const blobMap = new Map<ContentHash, ArrayBuffer>();
    const manifestMap = new Map<ContentHash, FileManifest>();
    let totalSize = 0;

    for (const name of fileNames) {
      const file = await this.getFile(name);
      if (!file) {
        throw new Error(`File "${name}" not found`);
      }

      const manifest = await this.getManifest(file.manifestHash);
      if (!manifest) {
        throw new Error(`Manifest for "${name}" not found`);
      }

      manifestMap.set(file.manifestHash, manifest);

      // Collect all blobs
      for (const chunk of manifest.chunks) {
        if (!blobMap.has(chunk.hash)) {
          const blob = await this.getBlob(chunk.hash);
          if (!blob) {
            throw new Error(`Blob ${chunk.hash} not found for file "${name}"`);
          }
          blobMap.set(chunk.hash, blob);
          totalSize += blob.byteLength;
        }
      }

      // Get provenance
      const provenance = await this.getProvenanceForManifest(file.manifestHash);

      const { id: _id, ...metadataWithoutId } = file;
      files.push({
        name: file.name,
        metadata: metadataWithoutId,
        manifestHash: file.manifestHash,
        provenance,
      });
    }

    // Create bundle manifest
    const bundleManifest: AtlasBundleManifest = {
      version: 1,
      createdAt: new Date(),
      files,
      totalSize,
    };

    // Build the bundle as a simple JSON container
    // In production, this could be a tar.gz or zip
    const bundleData = {
      manifest: bundleManifest,
      manifests: Object.fromEntries(manifestMap),
      blobs: Object.fromEntries(
        Array.from(blobMap.entries()).map(([hash, data]) => [
          hash,
          btoa(String.fromCharCode(...new Uint8Array(data))),
        ])
      ),
    };

    return new Blob([JSON.stringify(bundleData)], {
      type: 'application/x-atlasbundle+json',
    });
  }

  async importBundle(bundle: Blob | ArrayBuffer): Promise<ImportResult> {
    const imported: FileMetadata[] = [];
    const skipped: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];
    let bytesImported = 0;

    try {
      const text =
        bundle instanceof Blob
          ? await bundle.text()
          : new TextDecoder().decode(bundle);

      const bundleData = JSON.parse(text);
      const bundleManifest: AtlasBundleManifest = bundleData.manifest;

      // Import blobs
      for (const [_hash, base64] of Object.entries(bundleData.blobs as Record<string, string>)) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        await this.putBlob(bytes.buffer);
        bytesImported += bytes.length;
      }

      // Import manifests
      for (const [_hash, manifest] of Object.entries(bundleData.manifests as Record<string, FileManifest>)) {
        await this.putManifest(manifest);
      }

      // Import files
      for (const entry of bundleManifest.files) {
        try {
          const existing = await this.getFile(entry.name);
          if (existing) {
            skipped.push(entry.name);
            continue;
          }

          // Import provenance first
          let lastProvenanceId: string | undefined;
          for (const prov of entry.provenance.reverse()) {
            const newProv = await this.addProvenance({
              ...prov,
              previousId: lastProvenanceId,
            });
            lastProvenanceId = newProv.id;
          }

          // Add sync provenance
          const syncProv = await this.addProvenance({
            manifestHash: entry.manifestHash,
            type: 'import',
            actor: 'system',
            timestamp: new Date(),
            syncSource: 'browser',
            previousId: lastProvenanceId,
            notes: 'Imported from bundle',
          });

          const file = await this.registerFile(entry.name, entry.manifestHash, {
            ...entry.metadata,
            origin: 'imported',
            originDetails: 'Bundle import',
            provenanceId: syncProv.id,
          });

          imported.push(file);
        } catch (err) {
          failed.push({
            name: entry.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      throw new Error(`Failed to parse bundle: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { imported, skipped, failed, bytesImported };
  }

  // ============ Maintenance ============

  async garbageCollect(): Promise<{ deletedBlobs: number; freedBytes: number }> {
    const db = this.ensureDb();
    const allManifests = await db.getAll('manifests');
    const referencedBlobs = new Set<ContentHash>();

    // Collect all referenced blob hashes
    for (const entry of allManifests) {
      for (const chunk of entry.manifest.chunks) {
        referencedBlobs.add(chunk.hash);
      }
    }

    // Find unreferenced blobs
    const allBlobs = await db.getAll('blobs');
    let deletedBlobs = 0;
    let freedBytes = 0;

    for (const blob of allBlobs) {
      if (!referencedBlobs.has(blob.hash)) {
        freedBytes += blob.size;
        await db.delete('blobs', blob.hash);
        deletedBlobs++;
      }
    }

    // Update last GC time
    await db.put('meta', new Date(), 'lastGC');

    return { deletedBlobs, freedBytes };
  }

  async getStats(): Promise<StoreStats> {
    const db = this.ensureDb();

    const files = await db.count('files');
    const blobs = await db.count('blobs');
    const manifests = await db.count('manifests');
    const provenance = await db.count('provenance');

    // Calculate total storage
    let totalBytes = 0;
    const allBlobs = await db.getAll('blobs');
    for (const blob of allBlobs) {
      totalBytes += blob.size;
    }

    const lastGC = (await db.get('meta', 'lastGC')) as Date | undefined;

    // Try to get storage estimate
    let quotaBytes: number | undefined;
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota;
    }

    return {
      totalFiles: files,
      totalBlobs: blobs,
      totalManifests: manifests,
      totalProvenance: provenance,
      totalBytes,
      quotaBytes,
      lastGC,
    };
  }

  // ============ Helpers ============

  /**
   * Store a file from raw data (handles chunking)
   */
  async storeFile(
    name: string,
    data: ArrayBuffer,
    options: {
      type: FileManifest['type'];
      mimeType?: string;
      origin?: FileMetadata['origin'];
      originDetails?: string;
      tags?: string[];
      sharedWithAssistant?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<FileMetadata> {
    // Chunk the data
    const chunks: BlobChunk[] = [];
    const totalSize = data.byteLength;
    let offset = 0;

    while (offset < totalSize) {
      const end = Math.min(offset + this.chunkSize, totalSize);
      const chunkData = data.slice(offset, end);
      const hash = await this.putBlob(chunkData);

      chunks.push({
        hash,
        offset,
        size: end - offset,
      });

      offset = end;
    }

    // Create manifest
    const manifest: FileManifest = {
      version: 1,
      type: options.type,
      totalSize,
      chunks,
      mimeType: options.mimeType,
      metadata: options.metadata,
    };

    const manifestHash = await this.putManifest(manifest);

    // Add creation provenance
    const prov = await this.addProvenance({
      manifestHash,
      type: 'create',
      actor: 'user',
      timestamp: new Date(),
    });

    // Register file
    return this.registerFile(name, manifestHash, {
      origin: options.origin ?? 'uploaded',
      originDetails: options.originDetails,
      tags: options.tags,
      sharedWithAssistant: options.sharedWithAssistant,
      provenanceId: prov.id,
    });
  }

  /**
   * Read file data (reassembles from chunks)
   */
  async readFile(name: string): Promise<ArrayBuffer | null> {
    const file = await this.getFile(name);
    if (!file) return null;

    const manifest = await this.getManifest(file.manifestHash);
    if (!manifest) return null;

    // Reassemble from chunks
    const result = new Uint8Array(manifest.totalSize);

    for (const chunk of manifest.chunks) {
      const blob = await this.getBlob(chunk.hash);
      if (!blob) {
        throw new Error(`Missing blob: ${chunk.hash}`);
      }
      result.set(new Uint8Array(blob), chunk.offset);
    }

    return result.buffer;
  }

  /**
   * Close the store
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Create and initialize a browser Atlas store
 */
export async function createBrowserAtlasStore(
  chunkSize?: number
): Promise<BrowserAtlasStore> {
  const store = new BrowserAtlasStore(chunkSize);
  await store.init();
  return store;
}
