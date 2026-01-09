/**
 * Local Frame Transport
 *
 * Uses SharedArrayBuffer ring buffer for zero-copy frame transfer
 * between QEMU worker and main thread renderer.
 */

import type { Frame, FrameFormat, SidecarConfig, SidecarStats, ConnectionState } from './types.js';
import type { FrameTransport } from './transport.js';
import { createEmptyStats, calculateFps } from './transport.js';

/** Ring buffer header size in bytes */
const HEADER_SIZE = 64;

/** Header offsets */
const HEADER = {
  WRITE_INDEX: 0,
  READ_INDEX: 4,
  FRAME_COUNT: 8,
  FRAME_SIZE: 12,
  WIDTH: 16,
  HEIGHT: 20,
  FORMAT: 24,
  SEQUENCE: 28,
};

/**
 * Local transport using SharedArrayBuffer
 *
 * WARNING: Requires SharedArrayBuffer support (COOP/COEP headers)
 */
export class LocalTransport implements FrameTransport {
  private _state: ConnectionState = 'disconnected';
  private _config: SidecarConfig;
  private buffer: SharedArrayBuffer | null = null;
  private headerView: DataView | null = null;
  private dataView: Uint8Array | null = null;
  private frameCallbacks: Array<(frame: Frame) => void> = [];
  private stateCallbacks: Array<(state: ConnectionState) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private stats: SidecarStats;
  private frameTimestamps: number[] = [];
  private pollInterval: number | null = null;

  constructor(config: Partial<SidecarConfig> = {}) {
    this._config = {
      mode: 'local',
      targetFps: 60,
      preferredFormat: 'rgba',
      ringBufferSize: 3,
      ...config,
    };
    this.stats = createEmptyStats();
  }

  get state(): ConnectionState {
    return this._state;
  }

  get config(): SidecarConfig {
    return this._config;
  }

  async connect(): Promise<void> {
    if (typeof SharedArrayBuffer === 'undefined') {
      this.setState('error');
      throw new Error(
        'SharedArrayBuffer not available. Ensure COOP/COEP headers are set.'
      );
    }

    this.setState('connecting');

    try {
      // Calculate buffer size
      // Default: 1920x1080 RGBA = 8MB per frame, 3 frames = 24MB + header
      const width = 1920;
      const height = 1080;
      const bytesPerPixel = 4; // RGBA
      const frameSize = width * height * bytesPerPixel;
      const totalSize = HEADER_SIZE + frameSize * this._config.ringBufferSize!;

      this.buffer = new SharedArrayBuffer(totalSize);
      this.headerView = new DataView(this.buffer, 0, HEADER_SIZE);
      this.dataView = new Uint8Array(this.buffer, HEADER_SIZE);

      // Initialize header
      this.headerView.setUint32(HEADER.WRITE_INDEX, 0, true);
      this.headerView.setUint32(HEADER.READ_INDEX, 0, true);
      this.headerView.setUint32(HEADER.FRAME_COUNT, this._config.ringBufferSize!, true);
      this.headerView.setUint32(HEADER.FRAME_SIZE, frameSize, true);
      this.headerView.setUint32(HEADER.WIDTH, width, true);
      this.headerView.setUint32(HEADER.HEIGHT, height, true);
      this.headerView.setUint32(HEADER.FORMAT, 0, true); // RGBA = 0
      this.headerView.setUint32(HEADER.SEQUENCE, 0, true);

      this.setState('connected');
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.buffer = null;
    this.headerView = null;
    this.dataView = null;
    this.setState('disconnected');
  }

  async sendFrame(frame: Frame): Promise<void> {
    if (!this.buffer || !this.headerView || !this.dataView) {
      throw new Error('Transport not connected');
    }

    const writeIndex = this.headerView.getUint32(HEADER.WRITE_INDEX, true);
    const readIndex = this.headerView.getUint32(HEADER.READ_INDEX, true);
    const frameCount = this.headerView.getUint32(HEADER.FRAME_COUNT, true);
    const frameSize = this.headerView.getUint32(HEADER.FRAME_SIZE, true);

    // Check if buffer is full
    const nextWrite = (writeIndex + 1) % frameCount;
    if (nextWrite === readIndex) {
      // Buffer full, drop oldest frame
      this.stats.framesDropped++;
      this.headerView.setUint32(HEADER.READ_INDEX, (readIndex + 1) % frameCount, true);
    }

    // Write frame data
    const offset = writeIndex * frameSize;
    const frameData = new Uint8Array(frame.data);
    this.dataView.set(frameData.slice(0, frameSize), offset);

    // Update write index and sequence
    this.headerView.setUint32(HEADER.WRITE_INDEX, nextWrite, true);
    this.headerView.setUint32(HEADER.SEQUENCE, frame.metadata.sequence, true);

    this.stats.bytesTransferred += frameData.length;
  }

  async receiveFrame(): Promise<Frame | null> {
    if (!this.buffer || !this.headerView || !this.dataView) {
      return null;
    }

    const writeIndex = this.headerView.getUint32(HEADER.WRITE_INDEX, true);
    const readIndex = this.headerView.getUint32(HEADER.READ_INDEX, true);

    // Check if buffer is empty
    if (readIndex === writeIndex) {
      return null;
    }

    const frameCount = this.headerView.getUint32(HEADER.FRAME_COUNT, true);
    const frameSize = this.headerView.getUint32(HEADER.FRAME_SIZE, true);
    const width = this.headerView.getUint32(HEADER.WIDTH, true);
    const height = this.headerView.getUint32(HEADER.HEIGHT, true);
    const sequence = this.headerView.getUint32(HEADER.SEQUENCE, true);

    // Read frame data
    const offset = readIndex * frameSize;
    const data = this.dataView.slice(offset, offset + frameSize);

    // Update read index
    this.headerView.setUint32(HEADER.READ_INDEX, (readIndex + 1) % frameCount, true);

    const now = Date.now();
    this.frameTimestamps.push(now);
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps.shift();
    }

    this.stats.framesReceived++;
    this.stats.currentFps = calculateFps(this.frameTimestamps);

    const frame: Frame = {
      metadata: {
        sequence,
        timestamp: now,
        width,
        height,
        format: 'rgba',
        keyframe: true,
      },
      data: data.buffer,
    };

    // Notify callbacks
    for (const callback of this.frameCallbacks) {
      callback(frame);
    }

    return frame;
  }

  async setFormat(format: FrameFormat, width: number, height: number): Promise<void> {
    if (!this.headerView) {
      throw new Error('Transport not connected');
    }

    const formatCode = format === 'rgba' ? 0 : format === 'rgb565' ? 1 : 2;
    this.headerView.setUint32(HEADER.FORMAT, formatCode, true);
    this.headerView.setUint32(HEADER.WIDTH, width, true);
    this.headerView.setUint32(HEADER.HEIGHT, height, true);
  }

  getStats(): SidecarStats {
    return { ...this.stats };
  }

  onFrame(callback: (frame: Frame) => void): void {
    this.frameCallbacks.push(callback);
  }

  onStateChange(callback: (state: ConnectionState) => void): void {
    this.stateCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Get the shared buffer for passing to worker
   */
  getSharedBuffer(): SharedArrayBuffer | null {
    return this.buffer;
  }

  /**
   * Start polling for frames
   */
  startPolling(intervalMs = 16): void {
    if (this.pollInterval !== null) return;

    this.pollInterval = setInterval(() => {
      this.receiveFrame().catch((err) => {
        for (const callback of this.errorCallbacks) {
          callback(err);
        }
      });
    }, intervalMs) as unknown as number;
  }

  /**
   * Stop polling for frames
   */
  stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    for (const callback of this.stateCallbacks) {
      callback(state);
    }
  }
}
