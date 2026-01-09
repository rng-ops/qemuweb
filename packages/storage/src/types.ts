/**
 * Block Device Type Definitions
 */

/** Default block size in bytes */
export const DEFAULT_BLOCK_SIZE = 65536; // 64 KiB

/**
 * Block device interface
 *
 * All block devices implement this interface for read/write operations.
 */
export interface BlockDevice {
  /** Unique identifier for this device */
  readonly id: string;

  /** Total size in bytes */
  readonly size: number;

  /** Block size in bytes */
  readonly blockSize: number;

  /** Whether the device is read-only */
  readonly readonly: boolean;

  /**
   * Read blocks from the device
   *
   * @param blockIndex - Starting block index
   * @param count - Number of blocks to read
   * @returns Uint8Array containing the data
   */
  readBlocks(blockIndex: number, count: number): Promise<Uint8Array>;

  /**
   * Write blocks to the device
   *
   * @param blockIndex - Starting block index
   * @param data - Data to write (must be aligned to block size)
   */
  writeBlocks(blockIndex: number, data: Uint8Array): Promise<void>;

  /**
   * Sync any pending writes
   */
  sync(): Promise<void>;

  /**
   * Close the device and release resources
   */
  close(): Promise<void>;
}

/**
 * Block range for tracking modifications
 */
export interface BlockRange {
  start: number;
  end: number;
}

/**
 * Statistics for a block device
 */
export interface BlockDeviceStats {
  readCount: number;
  writeCount: number;
  bytesRead: number;
  bytesWritten: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Options for creating a block device
 */
export interface BlockDeviceOptions {
  /** Unique ID for the device */
  id: string;

  /** Block size in bytes (default: 64 KiB) */
  blockSize?: number;

  /** Enable read caching */
  enableCache?: boolean;

  /** Cache size in blocks */
  cacheSize?: number;
}

/**
 * Options for HTTP block device
 */
export interface HttpBlockDeviceOptions extends BlockDeviceOptions {
  /** URL of the disk image */
  url: string;

  /** Expected total size (if known) */
  expectedSize?: number;

  /** Whether the server supports range requests */
  supportsRangeRequests?: boolean;

  /** Custom fetch options */
  fetchOptions?: RequestInit;
}

/**
 * Options for file-backed block device
 */
export interface FileBlockDeviceOptions extends BlockDeviceOptions {
  /** File or Blob to use as backing */
  file: File | Blob;
}

/**
 * Options for overlay block device
 */
export interface OverlayBlockDeviceOptions extends BlockDeviceOptions {
  /** The base (read-only) device */
  base: BlockDevice;

  /** VM ID for IndexedDB storage */
  vmId: string;

  /** Disk ID for IndexedDB storage */
  diskId: string;
}

/**
 * Overlay snapshot metadata
 */
export interface OverlaySnapshot {
  id: string;
  vmId: string;
  diskId: string;
  createdAt: Date;
  blockCount: number;
  totalBytes: number;
  description?: string;
}

/**
 * Exported overlay data
 */
export interface OverlayExport {
  metadata: OverlaySnapshot;
  blocks: Map<number, Uint8Array>;
}
