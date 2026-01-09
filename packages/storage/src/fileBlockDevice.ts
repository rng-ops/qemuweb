/**
 * File-backed Block Device
 *
 * Read-only block device backed by a File or Blob.
 */

import type { BlockDevice, FileBlockDeviceOptions, BlockDeviceStats } from './types.js';
import { DEFAULT_BLOCK_SIZE } from './types.js';

export class FileBlockDevice implements BlockDevice {
  readonly id: string;
  readonly size: number;
  readonly blockSize: number;
  readonly readonly = true;

  private file: File | Blob;
  private stats: BlockDeviceStats;

  constructor(options: FileBlockDeviceOptions) {
    this.id = options.id;
    this.file = options.file;
    this.size = options.file.size;
    this.blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;

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
   * Get the number of blocks in this device
   */
  get blockCount(): number {
    return Math.ceil(this.size / this.blockSize);
  }

  /**
   * Read blocks from the file
   */
  async readBlocks(blockIndex: number, count: number): Promise<Uint8Array> {
    const startByte = blockIndex * this.blockSize;
    const endByte = Math.min(startByte + count * this.blockSize, this.size);
    const length = endByte - startByte;

    if (startByte >= this.size) {
      // Reading beyond end of file, return zeros
      return new Uint8Array(count * this.blockSize);
    }

    const slice = this.file.slice(startByte, endByte);
    const buffer = await slice.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Pad to full block count if needed
    if (data.length < count * this.blockSize) {
      const padded = new Uint8Array(count * this.blockSize);
      padded.set(data);
      this.stats.readCount++;
      this.stats.bytesRead += length;
      return padded;
    }

    this.stats.readCount++;
    this.stats.bytesRead += length;
    return data;
  }

  /**
   * Write is not supported for read-only device
   */
  async writeBlocks(_blockIndex: number, _data: Uint8Array): Promise<void> {
    throw new Error('FileBlockDevice is read-only');
  }

  /**
   * Sync (no-op for read-only device)
   */
  async sync(): Promise<void> {
    // No-op
  }

  /**
   * Close the device
   */
  async close(): Promise<void> {
    // Release reference to file
    this.file = new Blob([]);
  }

  /**
   * Get device statistics
   */
  getStats(): BlockDeviceStats {
    return { ...this.stats };
  }
}
