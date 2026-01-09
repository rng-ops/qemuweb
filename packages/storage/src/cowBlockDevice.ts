/**
 * Copy-on-Write Block Device
 *
 * Merges a read-only base device with a writable overlay.
 * Reads fall through to base if not in overlay.
 * Writes always go to overlay.
 */

import type { BlockDevice, OverlayBlockDeviceOptions, BlockDeviceStats } from './types.js';
import { DEFAULT_BLOCK_SIZE } from './types.js';
import { IndexedDBOverlay } from './indexeddbOverlay.js';

export class CowBlockDevice implements BlockDevice {
  readonly id: string;
  readonly blockSize: number;
  readonly readonly = false;

  private base: BlockDevice;
  private overlay: IndexedDBOverlay;
  private initialized: boolean = false;
  private stats: BlockDeviceStats;

  constructor(options: OverlayBlockDeviceOptions) {
    this.id = options.id;
    this.base = options.base;
    this.blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;

    if (this.base.blockSize !== this.blockSize) {
      throw new Error(
        `Block size mismatch: base=${this.base.blockSize}, overlay=${this.blockSize}`
      );
    }

    this.overlay = new IndexedDBOverlay(options.vmId, options.diskId, this.blockSize);

    this.stats = {
      readCount: 0,
      writeCount: 0,
      bytesRead: 0,
      bytesWritten: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Total size equals base device size
   */
  get size(): number {
    return this.base.size;
  }

  /**
   * Number of blocks
   */
  get blockCount(): number {
    return Math.ceil(this.size / this.blockSize);
  }

  /**
   * Initialize the COW device
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.overlay.init();
    this.initialized = true;
  }

  /**
   * Read blocks with COW logic
   *
   * 1. Check overlay for each block
   * 2. For blocks not in overlay, read from base
   * 3. Merge results
   */
  async readBlocks(blockIndex: number, count: number): Promise<Uint8Array> {
    if (!this.initialized) {
      await this.init();
    }

    const result = new Uint8Array(count * this.blockSize);
    const blockIndices = Array.from({ length: count }, (_, i) => blockIndex + i);

    // Check overlay for all blocks
    const overlayData = await this.overlay.readBlocks(blockIndices);

    // Collect blocks that need to be read from base
    const baseBlocksNeeded: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!overlayData.has(blockIndex + i)) {
        baseBlocksNeeded.push(blockIndex + i);
      }
    }

    // Read missing blocks from base
    if (baseBlocksNeeded.length > 0) {
      // For efficiency, read contiguous ranges from base
      const ranges = this.findContiguousRanges(baseBlocksNeeded);

      for (const range of ranges) {
        const rangeCount = range.end - range.start + 1;
        const baseData = await this.base.readBlocks(range.start, rangeCount);

        // Copy base data to result
        for (let i = 0; i < rangeCount; i++) {
          const resultOffset = (range.start + i - blockIndex) * this.blockSize;
          const baseOffset = i * this.blockSize;
          result.set(baseData.slice(baseOffset, baseOffset + this.blockSize), resultOffset);
        }

        this.stats.cacheMisses += rangeCount;
      }
    }

    // Copy overlay data to result
    for (const [idx, data] of overlayData) {
      const resultOffset = (idx - blockIndex) * this.blockSize;
      result.set(data, resultOffset);
      this.stats.cacheHits++;
    }

    this.stats.readCount++;
    this.stats.bytesRead += count * this.blockSize;

    return result;
  }

  /**
   * Write blocks to overlay
   */
  async writeBlocks(blockIndex: number, data: Uint8Array): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    if (data.length % this.blockSize !== 0) {
      throw new Error(`Data length must be a multiple of block size (${this.blockSize})`);
    }

    const blockCount = data.length / this.blockSize;

    for (let i = 0; i < blockCount; i++) {
      const blockData = data.slice(i * this.blockSize, (i + 1) * this.blockSize);
      await this.overlay.writeBlock(blockIndex + i, blockData);
    }

    this.stats.writeCount++;
    this.stats.bytesWritten += data.length;
  }

  /**
   * Sync overlay to IndexedDB
   */
  async sync(): Promise<void> {
    await this.overlay.flush();
  }

  /**
   * Close both base and overlay
   */
  async close(): Promise<void> {
    await this.overlay.close();
    await this.base.close();
  }

  /**
   * Get overlay statistics
   */
  async getOverlayStats(): Promise<{ blockCount: number; totalBytes: number }> {
    return this.overlay.getStats();
  }

  /**
   * Get device statistics
   */
  getStats(): BlockDeviceStats {
    return { ...this.stats };
  }

  /**
   * Export overlay data
   */
  async exportOverlay() {
    return this.overlay.export();
  }

  /**
   * Import overlay data
   */
  async importOverlay(data: {
    metadata: { id: string; vmId: string; diskId: string; createdAt: Date; blockCount: number; totalBytes: number };
    blocks: Array<[number, Uint8Array]>;
  }) {
    await this.overlay.import(data);
  }

  /**
   * Clear all overlay data
   */
  async clearOverlay(): Promise<void> {
    await this.overlay.clear();
  }

  /**
   * Check if there are uncommitted changes
   */
  get isDirty(): boolean {
    return this.overlay.isDirty;
  }

  /**
   * Find contiguous block ranges for efficient base reads
   */
  private findContiguousRanges(blocks: number[]): Array<{ start: number; end: number }> {
    if (blocks.length === 0) return [];

    const sorted = [...blocks].sort((a, b) => a - b);
    const ranges: Array<{ start: number; end: number }> = [];

    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push({ start, end });
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push({ start, end });

    return ranges;
  }
}
