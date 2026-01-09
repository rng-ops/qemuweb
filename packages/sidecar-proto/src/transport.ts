/**
 * Frame Transport Interface
 *
 * Abstract interface for frame transmission between emulator and renderer.
 */

import type {
  Frame,
  FrameFormat,
  SidecarConfig,
  SidecarStats,
  ConnectionState,
} from './types.js';

/**
 * Frame transport abstraction
 *
 * Implementations handle the actual transmission mechanism:
 * - LocalTransport: SharedArrayBuffer ring buffer
 * - RemoteTransport: WebSocket or WebRTC
 */
export interface FrameTransport {
  /** Current connection state */
  readonly state: ConnectionState;

  /** Transport configuration */
  readonly config: SidecarConfig;

  /**
   * Connect to the transport
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the transport
   */
  disconnect(): Promise<void>;

  /**
   * Send a frame
   */
  sendFrame(frame: Frame): Promise<void>;

  /**
   * Receive the next frame (blocks until available)
   */
  receiveFrame(): Promise<Frame | null>;

  /**
   * Set the frame format
   */
  setFormat(format: FrameFormat, width: number, height: number): Promise<void>;

  /**
   * Get transport statistics
   */
  getStats(): SidecarStats;

  /**
   * Register a callback for incoming frames
   */
  onFrame(callback: (frame: Frame) => void): void;

  /**
   * Register a callback for state changes
   */
  onStateChange(callback: (state: ConnectionState) => void): void;

  /**
   * Register a callback for errors
   */
  onError(callback: (error: Error) => void): void;
}

/**
 * Create default transport statistics
 */
export function createEmptyStats(): SidecarStats {
  return {
    framesReceived: 0,
    framesDropped: 0,
    avgLatency: 0,
    currentFps: 0,
    bytesTransferred: 0,
  };
}

/**
 * Calculate FPS from frame timestamps
 */
export function calculateFps(timestamps: number[]): number {
  if (timestamps.length < 2) return 0;

  const duration = timestamps[timestamps.length - 1] - timestamps[0];
  if (duration <= 0) return 0;

  return ((timestamps.length - 1) * 1000) / duration;
}
