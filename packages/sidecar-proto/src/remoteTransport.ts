/**
 * Remote Frame Transport (Stub)
 *
 * WebSocket/WebRTC transport for remote sidecar rendering.
 * TODO(step2): Implement full remote transport
 */

import type { Frame, FrameFormat, SidecarConfig, SidecarStats, ConnectionState } from './types.js';
import type { FrameTransport } from './transport.js';
import { createEmptyStats } from './transport.js';

/**
 * Remote transport using WebSocket
 *
 * TODO(step2): Full implementation
 * - WebSocket connection management
 * - Frame serialization/deserialization
 * - Compression support
 * - Reconnection logic
 * - WebRTC data channel alternative
 */
export class RemoteTransport implements FrameTransport {
  private _state: ConnectionState = 'disconnected';
  private _config: SidecarConfig;
  private stats: SidecarStats;
  private stateCallbacks: Array<(state: ConnectionState) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];

  constructor(config: Partial<SidecarConfig> = {}) {
    this._config = {
      mode: 'remote',
      targetFps: 30,
      preferredFormat: 'rgba',
      enableCompression: true,
      remoteUrl: 'ws://localhost:8080/sidecar',
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
    // TODO(step2): Implement WebSocket connection
    throw new Error(
      'RemoteTransport not implemented. ' +
      'Remote sidecar rendering will be available in Step 2.'
    );
  }

  async disconnect(): Promise<void> {
    this.setState('disconnected');
  }

  async sendFrame(_frame: Frame): Promise<void> {
    throw new Error('RemoteTransport not implemented');
  }

  async receiveFrame(): Promise<Frame | null> {
    throw new Error('RemoteTransport not implemented');
  }

  async setFormat(_format: FrameFormat, _width: number, _height: number): Promise<void> {
    throw new Error('RemoteTransport not implemented');
  }

  getStats(): SidecarStats {
    return { ...this.stats };
  }

  onFrame(_callback: (frame: Frame) => void): void {
    // TODO(step2): Implement
  }

  onStateChange(callback: (state: ConnectionState) => void): void {
    this.stateCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    for (const callback of this.stateCallbacks) {
      callback(state);
    }
  }
}
