/**
 * QEMU Runtime Client
 *
 * Client-side API for controlling QEMU workers from the UI.
 */

import type {
  WorkerCommand,
  WorkerEvent,
  RuntimeCapabilities,
  VmState,
  StartVmCommand,
  StopVmCommand,
  SerialInCommand,
  CapabilitiesEvent,
  VmStartedEvent,
  VmStoppedEvent,
  VmErrorEvent,
  SerialOutEvent,
  ProgressEvent,
  LogEvent,
} from './protocol.js';
import { createRequestId } from './protocol.js';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

export interface QemuClientOptions {
  /** URL to the worker script */
  workerUrl?: string | URL;

  /** Called when serial output is received */
  onSerialOut?: (vmId: string, data: string) => void;

  /** Called on progress updates */
  onProgress?: (vmId: string | undefined, stage: string, percent: number, message: string) => void;

  /** Called on log messages */
  onLog?: (level: string, message: string, vmId?: string) => void;

  /** Called when VM state changes */
  onStateChange?: (vmId: string, state: VmState) => void;

  /** Called when capabilities are detected */
  onCapabilities?: (capabilities: RuntimeCapabilities) => void;
}

/**
 * Client for controlling QEMU workers
 */
export class QemuClient {
  private worker: Worker | null = null;
  private options: QemuClientOptions;
  private vmStates: Map<string, VmState>;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>;
  private capabilities: RuntimeCapabilities | null = null;

  constructor(options: QemuClientOptions = {}) {
    this.options = options;
    this.vmStates = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Initialize the worker
   */
  async init(): Promise<RuntimeCapabilities> {
    if (this.worker) {
      throw new Error('QemuClient already initialized');
    }

    const workerUrl = this.options.workerUrl ?? new URL('./worker.js', import.meta.url);
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);

    // Wait for capabilities
    return new Promise((resolve) => {
      const handler = (event: MessageEvent<WorkerEvent>) => {
        if (event.data.type === 'capabilities') {
          this.capabilities = (event.data as CapabilitiesEvent).capabilities;
          this.options.onCapabilities?.(this.capabilities);
          resolve(this.capabilities);
        }
      };
      this.worker!.addEventListener('message', handler, { once: true });
    });
  }

  /**
   * Start a VM
   */
  async startVm(
    vmId: string,
    profile: VmProfile,
    inputs: VmInputs,
    overrides?: VmOverrides
  ): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    this.updateVmState(vmId, {
      vmId,
      status: 'starting',
      profile,
    });

    return this.sendRequest<StartVmCommand>({
      type: 'startVm',
      id: requestId,
      vmId,
      profile,
      inputs,
      overrides,
    }, requestId) as Promise<void>;
  }

  /**
   * Stop a VM
   */
  async stopVm(vmId: string, force = false): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    this.updateVmState(vmId, {
      ...this.vmStates.get(vmId)!,
      status: 'stopping',
    });

    return this.sendRequest<StopVmCommand>({
      type: 'stopVm',
      id: requestId,
      vmId,
      force,
    }, requestId) as Promise<void>;
  }

  /**
   * Reset a VM
   */
  async resetVm(vmId: string): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'resetVm',
      id: requestId,
      vmId,
    }, requestId) as Promise<void>;
  }

  /**
   * Send serial input to a VM
   */
  sendSerialIn(vmId: string, data: string): void {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const command: SerialInCommand = {
      type: 'serialIn',
      vmId,
      data,
    };

    this.worker.postMessage(command);
  }

  /**
   * Sync overlay to IndexedDB
   */
  async syncOverlay(vmId: string): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'syncOverlay',
      id: requestId,
      vmId,
    }, requestId) as Promise<void>;
  }

  /**
   * Export overlay data
   */
  async exportOverlay(vmId: string, diskId: string): Promise<ArrayBuffer> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'exportOverlay',
      id: requestId,
      vmId,
      diskId,
    }, requestId) as Promise<ArrayBuffer>;
  }

  /**
   * Import overlay data
   */
  async importOverlay(vmId: string, diskId: string, data: ArrayBuffer): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'importOverlay',
      id: requestId,
      vmId,
      diskId,
      data,
    }, requestId) as Promise<void>;
  }

  /**
   * Get current VM state
   */
  getVmState(vmId: string): VmState | undefined {
    return this.vmStates.get(vmId);
  }

  /**
   * Get all VM states
   */
  getAllVmStates(): Map<string, VmState> {
    return new Map(this.vmStates);
  }

  /**
   * Get detected capabilities
   */
  getCapabilities(): RuntimeCapabilities | null {
    return this.capabilities;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.vmStates.clear();
    this.pendingRequests.clear();
  }

  // ============ Private Methods ============

  private sendRequest<T extends WorkerCommand>(
    command: T,
    requestId: string
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker!.postMessage(command);
    });
  }

  private handleMessage(event: MessageEvent<WorkerEvent>): void {
    const message = event.data;

    switch (message.type) {
      case 'vmStarted':
        this.handleVmStarted(message as VmStartedEvent);
        break;

      case 'vmStopped':
        this.handleVmStopped(message as VmStoppedEvent);
        break;

      case 'vmError':
        this.handleVmError(message as VmErrorEvent);
        break;

      case 'serialOut':
        this.handleSerialOut(message as SerialOutEvent);
        break;

      case 'progress':
        this.handleProgress(message as ProgressEvent);
        break;

      case 'log':
        this.handleLog(message as LogEvent);
        break;

      case 'capabilities':
        this.capabilities = (message as CapabilitiesEvent).capabilities;
        this.options.onCapabilities?.(this.capabilities);
        break;

      case 'overlayExported':
        this.resolveRequest(message.requestId, message.data);
        break;
    }
  }

  private handleVmStarted(event: VmStartedEvent): void {
    const state = this.vmStates.get(event.vmId);
    this.updateVmState(event.vmId, {
      ...state!,
      status: 'running',
      startTime: Date.now(),
    });
    this.resolveRequest(event.requestId, undefined);
  }

  private handleVmStopped(event: VmStoppedEvent): void {
    this.updateVmState(event.vmId, {
      ...this.vmStates.get(event.vmId)!,
      status: 'stopped',
      exitCode: event.exitCode,
    });
    if (event.requestId) {
      this.resolveRequest(event.requestId, undefined);
    }
  }

  private handleVmError(event: VmErrorEvent): void {
    if (event.vmId) {
      this.updateVmState(event.vmId, {
        ...this.vmStates.get(event.vmId)!,
        status: 'error',
        errorMessage: event.error,
      });
    }
    if (event.requestId) {
      this.rejectRequest(event.requestId, new Error(event.error));
    }
  }

  private handleSerialOut(event: SerialOutEvent): void {
    this.options.onSerialOut?.(event.vmId, event.data);
  }

  private handleProgress(event: ProgressEvent): void {
    this.options.onProgress?.(
      event.vmId,
      event.stage,
      event.percent ?? 0,
      event.message
    );
  }

  private handleLog(event: LogEvent): void {
    this.options.onLog?.(event.level, event.message, event.vmId);
  }

  private handleError(event: ErrorEvent): void {
    console.error('Worker error:', event);
    this.options.onLog?.('error', `Worker error: ${event.message}`);
  }

  private updateVmState(vmId: string, state: VmState): void {
    this.vmStates.set(vmId, state);
    this.options.onStateChange?.(vmId, state);
  }

  private resolveRequest(requestId: string, value: unknown): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      this.pendingRequests.delete(requestId);
      pending.resolve(value);
    }
  }

  private rejectRequest(requestId: string, error: Error): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      this.pendingRequests.delete(requestId);
      pending.reject(error);
    }
  }
}
