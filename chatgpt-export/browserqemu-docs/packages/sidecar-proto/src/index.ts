/**
 * @qemuweb/sidecar-proto
 *
 * WebGPU sidecar protocol for accelerated rendering
 */

// Types
export type {
  SidecarMode,
  FrameFormat,
  ConnectionState,
  FrameMetadata,
  Frame,
  SidecarConfig,
  SidecarStats,
  EmulatorToSidecarMessage,
  SidecarToEmulatorMessage,
  SetModeMessage,
  ModeAckMessage,
  SetFormatMessage,
  FormatAckMessage,
  FrameMessage,
  FrameAckMessage,
  PingMessage,
  PongMessage,
  ErrorMessage,
} from './types.js';

// Transport
export type { FrameTransport } from './transport.js';
export { createEmptyStats, calculateFps } from './transport.js';

// Implementations
export { LocalTransport } from './localTransport.js';
export { RemoteTransport } from './remoteTransport.js';
export { MockSidecar } from './mockSidecar.js';
export type { TestPattern } from './mockSidecar.js';
