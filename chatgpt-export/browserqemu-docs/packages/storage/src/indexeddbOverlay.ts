/**
 * IndexedDB Overlay Storage
 *
 * Stores sparse block modifications in IndexedDB.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { OverlaySnapshot, BlockRange } from './types.js';

const DB_NAME = 'qemuweb-storage';
const DB_VERSION = 1;
const BLOCKS_STORE = 'blocks';
const METADATA_STORE = 'metadata';

/**
 * Key format: vmId:diskId:blockIndex
 */
function makeBlockKey(vmId: string, diskId: string, blockIndex: number): string {
  return `${vmId}:${diskId}:${blockIndex}`;
}

/**
 * Parse a block key
 */
function parseBlockKey(key: string): { vmId: string; diskId: string; blockIndex: number } | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  return {
    vmId: parts[0],
    diskId: parts[1],
    blockIndex: parseInt(parts[2], 10),
  };
}

/**
 * Block entry stored in IndexedDB
 */
interface BlockEntry {
  key: string;
  vmId: string;
  diskId: string;
  blockIndex: number;
  data: Uint8Array;
  timestamp: number;
}

/**
 * IndexedDB Overlay Storage
 *
 * Provides persistent storage for block overlays using IndexedDB.
 */
export class IndexedDBOverlay {
  private db: IDBPDatabase | null = null;
  private vmId: string;
  private diskId: string;
  private blockSize: number;
  private dirtyBlocks: Set<number>;
  private writeBuffer: Map<number, Uint8Array>;
  private bufferFlushThreshold: number;

  constructor(vmId: string, diskId: string, blockSize: number = 65536) {
    this.vmId = vmId;
    this.diskId = diskId;
    this.blockSize = blockSize;
    this.dirtyBlocks = new Set();
    this.writeBuffer = new Map();
    this.bufferFlushThreshold = 16; // Flush after 16 blocks
  }

  /**
   * Initialize the IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Blocks store
        if (!db.objectStoreNames.contains(BLOCKS_STORE)) {
          const blocksStore = db.createObjectStore(BLOCKS_STORE, { keyPath: 'key' });
          blocksStore.createIndex('vmDisk', ['vmId', 'diskId']);
          blocksStore.createIndex('vmId', 'vmId');
        }

        // Metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        }
      },
    });
  }

  /**
   * Read a block from the overlay
   *
   * @returns The block data, or null if not in overlay
   */
  async readBlock(blockIndex: number): Promise<Uint8Array | null> {
    // Check write buffer first
    if (this.writeBuffer.has(blockIndex)) {
      return this.writeBuffer.get(blockIndex)!;
    }

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
    const entry = await this.db.get(BLOCKS_STORE, key);

    if (entry) {
      return entry.data;
    }

    return null;
  }

  /**
   * Read multiple blocks from the overlay
   *
   * @returns Map of blockIndex to data (only blocks present in overlay)
   */
  async readBlocks(blockIndices: number[]): Promise<Map<number, Uint8Array>> {
    const result = new Map<number, Uint8Array>();

    // Check write buffer first
    for (const index of blockIndices) {
      if (this.writeBuffer.has(index)) {
        result.set(index, this.writeBuffer.get(index)!);
      }
    }

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    // Fetch remaining from IndexedDB
    const remainingIndices = blockIndices.filter((i) => !result.has(i));
    if (remainingIndices.length === 0) {
      return result;
    }

    const tx = this.db.transaction(BLOCKS_STORE, 'readonly');
    const store = tx.objectStore(BLOCKS_STORE);

    await Promise.all(
      remainingIndices.map(async (blockIndex) => {
        const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
        const entry = await store.get(key);
        if (entry) {
          result.set(blockIndex, entry.data);
        }
      })
    );

    await tx.done;
    return result;
  }

  /**
   * Write a block to the overlay
   */
  async writeBlock(blockIndex: number, data: Uint8Array): Promise<void> {
    if (data.length !== this.blockSize) {
      throw new Error(`Block data must be exactly ${this.blockSize} bytes`);
    }

    // Add to write buffer
    this.writeBuffer.set(blockIndex, data);
    this.dirtyBlocks.add(blockIndex);

    // Flush if buffer is large enough
    if (this.writeBuffer.size >= this.bufferFlushThreshold) {
      await this.flush();
    }
  }

  /**
   * Write multiple blocks to the overlay
   */
  async writeBlocks(startBlockIndex: number, data: Uint8Array): Promise<void> {
    const blockCount = Math.ceil(data.length / this.blockSize);

    for (let i = 0; i < blockCount; i++) {
      const start = i * this.blockSize;
      const end = Math.min(start + this.blockSize, data.length);
      const blockData = new Uint8Array(this.blockSize);
      blockData.set(data.slice(start, end));
      await this.writeBlock(startBlockIndex + i, blockData);
    }
  }

  /**
   * Flush write buffer to IndexedDB
   */
  async flush(): Promise<void> {
    if (this.writeBuffer.size === 0) return;

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const tx = this.db.transaction(BLOCKS_STORE, 'readwrite');
    const store = tx.objectStore(BLOCKS_STORE);
    const now = Date.now();

    for (const [blockIndex, data] of this.writeBuffer) {
      const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
      const entry: BlockEntry = {
        key,
        vmId: this.vmId,
        diskId: this.diskId,
        blockIndex,
        data,
        timestamp: now,
      };
      await store.put(entry);
    }

    await tx.done;
    this.writeBuffer.clear();
    this.dirtyBlocks.clear();
  }

  /**
   * Check if a block exists in the overlay
   */
  async hasBlock(blockIndex: number): Promise<boolean> {
    if (this.writeBuffer.has(blockIndex)) {
      return true;
    }

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
    const entry = await this.db.get(BLOCKS_STORE, key);
    return entry !== undefined;
  }

  /**
   * Get all modified block indices
   */
  async getModifiedBlocks(): Promise<number[]> {
    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const indices = new Set<number>(this.writeBuffer.keys());

    const tx = this.db.transaction(BLOCKS_STORE, 'readonly');
    const store = tx.objectStore(BLOCKS_STORE);
    const index = store.index('vmDisk');

    for await (const cursor of index.iterate([this.vmId, this.diskId])) {
      const entry = cursor.value as BlockEntry;
      indices.add(entry.blockIndex);
    }

    await tx.done;
    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Get modified block ranges (for compaction)
   */
  async getModifiedRanges(): Promise<BlockRange[]> {
    const blocks = await this.getModifiedBlocks();
    if (blocks.length === 0) return [];

    const ranges: BlockRange[] = [];
    let start = blocks[0];
    let end = blocks[0];

    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i] === end + 1) {
        end = blocks[i];
      } else {
        ranges.push({ start, end });
        start = blocks[i];
        end = blocks[i];
      }
    }
    ranges.push({ start, end });

    return ranges;
  }

  /**
   * Get overlay statistics
   */
  async getStats(): Promise<{ blockCount: number; totalBytes: number }> {
    const blocks = await this.getModifiedBlocks();
    return {
      blockCount: blocks.length,
      totalBytes: blocks.length * this.blockSize,
    };
  }

  /**
   * Create a snapshot of the current overlay state
   */
  async createSnapshot(description?: string): Promise<OverlaySnapshot> {
    await this.flush();
    const stats = await this.getStats();

    const snapshot: OverlaySnapshot = {
      id: `${this.vmId}:${this.diskId}:${Date.now()}`,
      vmId: this.vmId,
      diskId: this.diskId,
      createdAt: new Date(),
      blockCount: stats.blockCount,
      totalBytes: stats.totalBytes,
      description,
    };

    return snapshot;
  }

  /**
   * Export overlay data for backup
   */
  async export(): Promise<{ metadata: OverlaySnapshot; blocks: Array<[number, Uint8Array]> }> {
    await this.flush();

    const metadata = await this.createSnapshot('Export');
    const blocks: Array<[number, Uint8Array]> = [];

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const tx = this.db.transaction(BLOCKS_STORE, 'readonly');
    const store = tx.objectStore(BLOCKS_STORE);
    const index = store.index('vmDisk');

    for await (const cursor of index.iterate([this.vmId, this.diskId])) {
      const entry = cursor.value as BlockEntry;
      blocks.push([entry.blockIndex, entry.data]);
    }

    await tx.done;
    return { metadata, blocks };
  }

  /**
   * Import overlay data from backup
   */
  async import(data: {
    metadata: OverlaySnapshot;
    blocks: Array<[number, Uint8Array]>;
  }): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    // Clear existing data
    await this.clear();

    // Import blocks
    const tx = this.db.transaction(BLOCKS_STORE, 'readwrite');
    const store = tx.objectStore(BLOCKS_STORE);
    const now = Date.now();

    for (const [blockIndex, blockData] of data.blocks) {
      const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
      const entry: BlockEntry = {
        key,
        vmId: this.vmId,
        diskId: this.diskId,
        blockIndex,
        data: blockData,
        timestamp: now,
      };
      await store.put(entry);
    }

    await tx.done;
  }

  /**
   * Clear all overlay data for this VM/disk
   */
  async clear(): Promise<void> {
    this.writeBuffer.clear();
    this.dirtyBlocks.clear();

    if (!this.db) return;

    const tx = this.db.transaction(BLOCKS_STORE, 'readwrite');
    const store = tx.objectStore(BLOCKS_STORE);
    const index = store.index('vmDisk');

    for await (const cursor of index.iterate([this.vmId, this.diskId])) {
      cursor.delete();
    }

    await tx.done;
  }
  async close(): Promise<void> {
    await this.flush();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Getter for dirty state
  get isDirty(): boolean {
    return this.writeBuffer.size > 0 || this.dirtyBlocks.size > 0;
  }
}

/**
 * Delete all overlay data for a VM
 */
export async function deleteVmOverlays(vmId: string): Promise<void> {
  const db = await openDB(DB_NAME, DB_VERSION);

  const tx = db.transaction(BLOCKS_STORE, 'readwrite');
  const store = tx.objectStore(BLOCKS_STORE);
  const index = store.index('vmId');

  for await (const cursor of index.iterate(vmId)) {
    cursor.delete();
  }

  await tx.done;
  db.close();
}
export async function listVmsWithOverlays(): Promise<string[]> {
  const db = await openDB(DB_NAME, DB_VERSION);

  const tx = db.transaction(BLOCKS_STORE, 'readonly');
  const store = tx.objectStore(BLOCKS_STORE);
  const index = store.index('vmId');

  const vmIds = new Set<string>();
  for await (const cursor of index.iterate()) {
    const entry = cursor.value as BlockEntry;
    vmIds.add(entry.vmId);
  }

  await tx.done;
  db.close();

  return Array.from(vmIds);
}

export { parseBlockKey, makeBlockKey };
