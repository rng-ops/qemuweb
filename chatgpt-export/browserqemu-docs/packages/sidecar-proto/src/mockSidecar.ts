/**
 * Mock Sidecar
 *
 * A mock sidecar implementation for testing that generates test patterns.
 * Used when WebGPU or real sidecar is not available.
 */

import type { Frame, FrameFormat, SidecarConfig, SidecarStats, ConnectionState } from './types.js';
import type { FrameTransport } from './transport.js';
import { createEmptyStats, calculateFps } from './transport.js';

/**
 * Test pattern types
 */
export type TestPattern =
  | 'solid'
  | 'gradient'
  | 'checkerboard'
  | 'colorBars'
  | 'noise';

/**
 * Mock sidecar that generates test patterns
 */
export class MockSidecar implements FrameTransport {
  private _state: ConnectionState = 'disconnected';
  private _config: SidecarConfig;
  private width = 640;
  private height = 480;
  private format: FrameFormat = 'rgba';
  private sequence = 0;
  private stats: SidecarStats;
  private frameTimestamps: number[] = [];
  private frameCallbacks: Array<(frame: Frame) => void> = [];
  private stateCallbacks: Array<(state: ConnectionState) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private animationFrame: number | null = null;
  private pattern: TestPattern = 'colorBars';

  constructor(config: Partial<SidecarConfig> = {}) {
    this._config = {
      mode: 'disabled',
      targetFps: 30,
      preferredFormat: 'rgba',
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
    this.setState('connecting');
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    this.stopGenerating();
    this.setState('disconnected');
  }

  async sendFrame(_frame: Frame): Promise<void> {
    // Mock sidecar doesn't accept frames
    throw new Error('MockSidecar does not accept frames');
  }

  async receiveFrame(): Promise<Frame | null> {
    if (this._state !== 'connected') {
      return null;
    }

    return this.generateFrame();
  }

  async setFormat(format: FrameFormat, width: number, height: number): Promise<void> {
    this.format = format;
    this.width = width;
    this.height = height;
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
   * Set the test pattern to generate
   */
  setPattern(pattern: TestPattern): void {
    this.pattern = pattern;
  }

  /**
   * Start generating frames at target FPS
   */
  startGenerating(): void {
    if (this.animationFrame !== null) return;

    const targetInterval = 1000 / (this._config.targetFps ?? 30);
    let lastFrame = performance.now();

    const generate = () => {
      const now = performance.now();
      if (now - lastFrame >= targetInterval) {
        const frame = this.generateFrame();
        for (const callback of this.frameCallbacks) {
          callback(frame);
        }
        lastFrame = now;
      }
      this.animationFrame = requestAnimationFrame(generate);
    };

    this.animationFrame = requestAnimationFrame(generate);
  }

  /**
   * Stop generating frames
   */
  stopGenerating(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Generate a single test frame
   */
  private generateFrame(): Frame {
    const bytesPerPixel = this.format === 'rgba' ? 4 : this.format === 'rgb565' ? 2 : 4;
    const data = new Uint8Array(this.width * this.height * bytesPerPixel);

    switch (this.pattern) {
      case 'solid':
        this.generateSolid(data);
        break;
      case 'gradient':
        this.generateGradient(data);
        break;
      case 'checkerboard':
        this.generateCheckerboard(data);
        break;
      case 'colorBars':
        this.generateColorBars(data);
        break;
      case 'noise':
        this.generateNoise(data);
        break;
    }

    const now = Date.now();
    this.frameTimestamps.push(now);
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps.shift();
    }

    this.stats.framesReceived++;
    this.stats.currentFps = calculateFps(this.frameTimestamps);
    this.stats.bytesTransferred += data.length;

    const frame: Frame = {
      metadata: {
        sequence: this.sequence++,
        timestamp: now,
        width: this.width,
        height: this.height,
        format: this.format,
        keyframe: true,
      },
      data: data.buffer,
    };

    return frame;
  }

  private generateSolid(data: Uint8Array): void {
    // Animate color over time
    const t = (Date.now() / 1000) % 6;
    const r = Math.floor(127 + 127 * Math.sin(t));
    const g = Math.floor(127 + 127 * Math.sin(t + 2));
    const b = Math.floor(127 + 127 * Math.sin(t + 4));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  private generateGradient(data: Uint8Array): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;
        data[i] = Math.floor((x / this.width) * 255);
        data[i + 1] = Math.floor((y / this.height) * 255);
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
  }

  private generateCheckerboard(data: Uint8Array): void {
    const blockSize = 32;
    const t = Math.floor(Date.now() / 500) % 2;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;
        const blockX = Math.floor(x / blockSize);
        const blockY = Math.floor(y / blockSize);
        const isWhite = (blockX + blockY + t) % 2 === 0;

        const color = isWhite ? 255 : 0;
        data[i] = color;
        data[i + 1] = color;
        data[i + 2] = color;
        data[i + 3] = 255;
      }
    }
  }

  private generateColorBars(data: Uint8Array): void {
    // SMPTE color bars
    const colors = [
      [255, 255, 255], // White
      [255, 255, 0],   // Yellow
      [0, 255, 255],   // Cyan
      [0, 255, 0],     // Green
      [255, 0, 255],   // Magenta
      [255, 0, 0],     // Red
      [0, 0, 255],     // Blue
      [0, 0, 0],       // Black
    ];

    const barWidth = Math.floor(this.width / colors.length);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;
        const barIndex = Math.min(Math.floor(x / barWidth), colors.length - 1);
        const color = colors[barIndex];

        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
      }
    }
  }

  private generateNoise(data: Uint8Array): void {
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    for (const callback of this.stateCallbacks) {
      callback(state);
    }
  }
}
