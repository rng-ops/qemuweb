/**
 * HTTP Block Device
 *
 * Read-only block device backed by HTTP range requests.
 */

import type { BlockDevice, HttpBlockDeviceOptions, BlockDeviceStats } from './types.js';
import { DEFAULT_BLOCK_SIZE } from './types.js';

export class HttpBlockDevice implements BlockDevice {
  readonly id: string;
  readonly blockSize: number;
  readonly readonly = true;

  private url: string;
  private fetchOptions: RequestInit;
  private _size: number = 0;
  private supportsRangeRequests: boolean;
  private initialized: boolean = false;
  private cache: Map<number, Uint8Array>;
  private cacheMaxSize: number;
  private stats: BlockDeviceStats;

  constructor(options: HttpBlockDeviceOptions) {
    this.id = options.id;
    this.url = options.url;
    this.blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;
    this.fetchOptions = options.fetchOptions ?? {};
    this.supportsRangeRequests = options.supportsRangeRequests ?? true;
    this._size = options.expectedSize ?? 0;

    // Simple LRU cache
    this.cache = new Map();
    this.cacheMaxSize = options.cacheSize ?? 64;

    this.stats = {
      readCount: 0,
      writeCount: 0,
      bytesRead: 0,
      bytesWritten: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  get size(): number {
    return this._size;
  }

  /**
   * Initialize the device by fetching headers
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await fetch(this.url, {
        ...this.fetchOptions,
        method: 'HEAD',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content length
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        this._size = parseInt(contentLength, 10);
      }

      // Check for range support
      const acceptRanges = response.headers.get('accept-ranges');
      this.supportsRangeRequests = acceptRanges === 'bytes';

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize HTTP block device: ${error}`);
    }
  }

  /**
   * Read blocks via HTTP range request
   */
  async readBlocks(blockIndex: number, count: number): Promise<Uint8Array> {
    if (!this.initialized) {
      await this.init();
    }

    // Check cache first
    if (count === 1 && this.cache.has(blockIndex)) {
      this.stats.cacheHits++;
      return this.cache.get(blockIndex)!;
    }

    this.stats.cacheMisses++;

    const startByte = blockIndex * this.blockSize;
    const endByte = Math.min(startByte + count * this.blockSize - 1, this._size - 1);

    if (startByte >= this._size) {
      return new Uint8Array(count * this.blockSize);
    }

    let data: Uint8Array;

    if (this.supportsRangeRequests) {
      const response = await fetch(this.url, {
        ...this.fetchOptions,
        headers: {
          ...this.fetchOptions.headers,
          Range: `bytes=${startByte}-${endByte}`,
        },
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      data = new Uint8Array(buffer);
    } else {
      // No range support - fetch entire file (not recommended for large files)
      console.warn('HTTP server does not support range requests. Fetching entire file.');

      const response = await fetch(this.url, this.fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const fullData = new Uint8Array(buffer);
      data = fullData.slice(startByte, endByte + 1);
    }

    // Pad to full block count if needed
    const result =
      data.length < count * this.blockSize
        ? (() => {
            const padded = new Uint8Array(count * this.blockSize);
            padded.set(data);
            return padded;
          })()
        : data;

    // Cache single blocks
    if (count === 1) {
      this.addToCache(blockIndex, result);
    }

    this.stats.readCount++;
    this.stats.bytesRead += data.length;

    return result;
  }

  /**
   * Write is not supported for HTTP device
   */
  async writeBlocks(_blockIndex: number, _data: Uint8Array): Promise<void> {
    throw new Error('HttpBlockDevice is read-only');
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
    this.cache.clear();
  }

  /**
   * Add block to cache with LRU eviction
   */
  private addToCache(blockIndex: number, data: Uint8Array): void {
    if (this.cache.size >= this.cacheMaxSize) {
      // Evict oldest entry (first in map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(blockIndex, data);
  }

  /**
   * Get device statistics
   */
  getStats(): BlockDeviceStats {
    return { ...this.stats };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
