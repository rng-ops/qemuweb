/**
 * Sidecar Protocol Types
 *
 * Defines interfaces for WebGPU sidecar communication.
 * The sidecar can run locally (same machine) or remotely (server/peer).
 */

/** Sidecar operating mode */
export type SidecarMode = 'local' | 'remote' | 'disabled';

/** Frame format for transmission */
export type FrameFormat = 'rgba' | 'rgb565' | 'yuv420' | 'compressed';

/** Sidecar connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Frame metadata
 */
export interface FrameMetadata {
  /** Frame sequence number */
  sequence: number;

  /** Timestamp in milliseconds */
  timestamp: number;

  /** Frame width in pixels */
  width: number;

  /** Frame height in pixels */
  height: number;

  /** Pixel format */
  format: FrameFormat;

  /** Whether this is a keyframe (full frame vs delta) */
  keyframe: boolean;
}

/**
 * Frame data container
 */
export interface Frame {
  metadata: FrameMetadata;

  /** Raw frame data */
  data: ArrayBuffer | SharedArrayBuffer;
}

/**
 * Sidecar configuration
 */
export interface SidecarConfig {
  /** Operating mode */
  mode: SidecarMode;

  /** Target frame rate (frames per second) */
  targetFps?: number;

  /** Preferred frame format */
  preferredFormat?: FrameFormat;

  /** WebSocket URL for remote mode */
  remoteUrl?: string;

  /** Enable frame compression for remote mode */
  enableCompression?: boolean;

  /** Ring buffer size in frames (for local mode) */
  ringBufferSize?: number;
}

/**
 * Sidecar statistics
 */
export interface SidecarStats {
  /** Frames received */
  framesReceived: number;

  /** Frames dropped */
  framesDropped: number;

  /** Average frame latency in ms */
  avgLatency: number;

  /** Current FPS */
  currentFps: number;

  /** Total bytes transferred */
  bytesTransferred: number;
}

// ============ Protocol Messages ============

/** Messages from QEMU/Emulator to Sidecar */
export type EmulatorToSidecarMessage =
  | SetModeMessage
  | SetFormatMessage
  | FrameMessage
  | PingMessage;

/** Messages from Sidecar to QEMU/Emulator */
export type SidecarToEmulatorMessage =
  | ModeAckMessage
  | FormatAckMessage
  | FrameAckMessage
  | PongMessage
  | ErrorMessage;

export interface SetModeMessage {
  type: 'setMode';
  mode: SidecarMode;
  config?: Partial<SidecarConfig>;
}

export interface ModeAckMessage {
  type: 'modeAck';
  mode: SidecarMode;
  success: boolean;
  error?: string;
}

export interface SetFormatMessage {
  type: 'setFormat';
  format: FrameFormat;
  width: number;
  height: number;
}

export interface FormatAckMessage {
  type: 'formatAck';
  format: FrameFormat;
  success: boolean;
}

export interface FrameMessage {
  type: 'frame';
  metadata: FrameMetadata;
  // Data is sent separately for efficiency
}

export interface FrameAckMessage {
  type: 'frameAck';
  sequence: number;
  latency: number;
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
  serverTime: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}
