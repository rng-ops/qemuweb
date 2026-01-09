/**
 * @qemuweb/runtime
 *
 * QEMU WebAssembly runtime for browser workers
 */

// Protocol types
export type {
  WorkerCommand,
  WorkerEvent,
  StartVmCommand,
  StopVmCommand,
  ResetVmCommand,
  SerialInCommand,
  MountDiskCommand,
  MountKernelCommand,
  MountInitrdCommand,
  SyncOverlayCommand,
  ExportOverlayCommand,
  ImportOverlayCommand,
  VmStartedEvent,
  VmStoppedEvent,
  VmErrorEvent,
  SerialOutEvent,
  ProgressEvent,
  LogEvent,
  OverlayExportedEvent,
  CapabilitiesEvent,
  RuntimeCapabilities,
  VmState,
} from './protocol.js';

export { createRequestId } from './protocol.js';

// Capability detection
export {
  detectCapabilities,
  detectSharedArrayBuffer,
  detectWebAssembly,
  detectWasmSimd,
  detectWasmThreads,
  detectBigInt,
  detectIndexedDb,
  detectFileSystemAccess,
  detectWebGpu,
  detectMaxMemory,
  summarizeCapabilities,
  checkMinimumRequirements,
} from './capabilities.js';

// Client
export { QemuClient } from './client.js';
export type { QemuClientOptions } from './client.js';
