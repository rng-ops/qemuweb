/**
 * Runtime Protocol
 *
 * Message types for communication between UI and QEMU worker.
 */

import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

/** Message types from UI to Worker */
export type WorkerCommand =
  | StartVmCommand
  | StopVmCommand
  | ResetVmCommand
  | SerialInCommand
  | MountDiskCommand
  | MountKernelCommand
  | MountInitrdCommand
  | SyncOverlayCommand
  | ExportOverlayCommand
  | ImportOverlayCommand;

/** Message types from Worker to UI */
export type WorkerEvent =
  | VmStartedEvent
  | VmStoppedEvent
  | VmErrorEvent
  | SerialOutEvent
  | ProgressEvent
  | LogEvent
  | OverlayExportedEvent
  | CapabilitiesEvent;

// ============ Commands (UI → Worker) ============

export interface StartVmCommand {
  type: 'startVm';
  id: string;
  vmId: string;
  profile: VmProfile;
  inputs: VmInputs;
  overrides?: VmOverrides;
}

export interface StopVmCommand {
  type: 'stopVm';
  id: string;
  vmId: string;
  force?: boolean;
}

export interface ResetVmCommand {
  type: 'resetVm';
  id: string;
  vmId: string;
}

export interface SerialInCommand {
  type: 'serialIn';
  vmId: string;
  data: string;
}

export interface MountDiskCommand {
  type: 'mountDisk';
  id: string;
  vmId: string;
  diskIndex: number;
  file?: File | Blob;
  url?: string;
  readonly?: boolean;
}

export interface MountKernelCommand {
  type: 'mountKernel';
  id: string;
  vmId: string;
  file?: File | Blob;
  url?: string;
}

export interface MountInitrdCommand {
  type: 'mountInitrd';
  id: string;
  vmId: string;
  file?: File | Blob;
  url?: string;
}

export interface SyncOverlayCommand {
  type: 'syncOverlay';
  id: string;
  vmId: string;
}

export interface ExportOverlayCommand {
  type: 'exportOverlay';
  id: string;
  vmId: string;
  diskId: string;
}

export interface ImportOverlayCommand {
  type: 'importOverlay';
  id: string;
  vmId: string;
  diskId: string;
  data: ArrayBuffer;
}

// ============ Events (Worker → UI) ============

export interface VmStartedEvent {
  type: 'vmStarted';
  vmId: string;
  requestId: string;
}

export interface VmStoppedEvent {
  type: 'vmStopped';
  vmId: string;
  requestId?: string;
  exitCode?: number;
}

export interface VmErrorEvent {
  type: 'vmError';
  vmId?: string;
  requestId?: string;
  error: string;
  fatal: boolean;
}

export interface SerialOutEvent {
  type: 'serialOut';
  vmId: string;
  data: string;
}

export interface ProgressEvent {
  type: 'progress';
  vmId?: string;
  requestId?: string;
  stage: 'loading' | 'mounting' | 'starting' | 'running';
  percent?: number;
  message: string;
}

export interface LogEvent {
  type: 'log';
  vmId?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface OverlayExportedEvent {
  type: 'overlayExported';
  vmId: string;
  diskId: string;
  requestId: string;
  data: ArrayBuffer;
  blockCount: number;
}

export interface CapabilitiesEvent {
  type: 'capabilities';
  capabilities: RuntimeCapabilities;
}

// ============ Shared Types ============

export interface RuntimeCapabilities {
  /** SharedArrayBuffer available */
  sharedArrayBuffer: boolean;

  /** WebAssembly available */
  webAssembly: boolean;

  /** WebAssembly SIMD available */
  wasmSimd: boolean;

  /** WebAssembly threads available */
  wasmThreads: boolean;

  /** BigInt support */
  bigInt: boolean;

  /** IndexedDB available */
  indexedDb: boolean;

  /** File System Access API available */
  fileSystemAccess: boolean;

  /** WebGPU available */
  webGpu: boolean;

  /** Maximum memory in bytes (from browser limits) */
  maxMemory: number;
}

export interface VmState {
  vmId: string;
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  profile?: VmProfile;
  startTime?: number;
  exitCode?: number;
  errorMessage?: string;
}

/**
 * Create a unique request ID
 */
export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
