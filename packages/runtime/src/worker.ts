/**
 * QEMU Worker Runtime
 *
 * Web Worker that loads and runs QEMU WebAssembly.
 */

/// <reference lib="webworker" />

import type {
  WorkerCommand,
  WorkerEvent,
  SerialOutEvent,
  ProgressEvent,
  LogEvent,
  VmStartedEvent,
  VmStoppedEvent,
  VmErrorEvent,
  CapabilitiesEvent,
} from './protocol.js';
import { detectCapabilities } from './capabilities.js';
import { buildQemuArgs } from '@qemuweb/vm-config';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

declare const self: DedicatedWorkerGlobalScope;

// ============ Worker State ============

interface VmInstance {
  vmId: string;
  profile: VmProfile;
  qemuModule: QemuModule | null;
  running: boolean;
  startTime: number;
}

interface QemuModule {
  callMain: (args: string[]) => number;
  FS: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  ready: Promise<QemuModule>;
}

const vmInstances = new Map<string, VmInstance>();
let qemuModuleFactory: ((options: unknown) => Promise<QemuModule>) | null = null;

// ============ Message Handlers ============

self.onmessage = async (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;

  try {
    switch (command.type) {
      case 'startVm':
        await handleStartVm(command.id, command.vmId, command.profile, command.inputs, command.overrides);
        break;

      case 'stopVm':
        await handleStopVm(command.id, command.vmId, command.force);
        break;

      case 'resetVm':
        await handleResetVm(command.id, command.vmId);
        break;

      case 'serialIn':
        handleSerialIn(command.vmId, command.data);
        break;

      case 'syncOverlay':
        await handleSyncOverlay(command.id, command.vmId);
        break;

      case 'exportOverlay':
        await handleExportOverlay(command.id, command.vmId, command.diskId);
        break;

      case 'importOverlay':
        await handleImportOverlay(command.id, command.vmId, command.diskId, command.data);
        break;

      default:
        log('warn', `Unknown command type: ${(command as { type: string }).type}`);
    }
  } catch (error) {
    const commandId = 'id' in command ? command.id : undefined;
    sendError(undefined, commandId, String(error), false);
  }
};

// ============ Command Handlers ============

async function handleStartVm(
  requestId: string,
  vmId: string,
  profile: VmProfile,
  inputs: VmInputs,
  overrides?: VmOverrides
): Promise<void> {
  if (vmInstances.has(vmId)) {
    sendError(vmId, requestId, `VM ${vmId} is already running`, false);
    return;
  }

  sendProgress(vmId, requestId, 'loading', 0, 'Initializing QEMU...');

  try {
    // Build QEMU arguments
    const result = buildQemuArgs(profile, inputs, overrides);

    if (result.errors.length > 0) {
      sendError(vmId, requestId, result.errors.join('; '), true);
      return;
    }

    for (const warning of result.warnings) {
      log('warn', warning, vmId);
    }

    sendProgress(vmId, requestId, 'loading', 20, 'Loading QEMU module...');

    // Load QEMU module
    const qemuModule = await loadQemuModule(profile.arch);

    sendProgress(vmId, requestId, 'mounting', 40, 'Mounting files...');

    // Create virtual filesystem directories
    try {
      qemuModule.FS.mkdir('/vm');
    } catch {
      // Directory may already exist
    }

    // Mount files
    await mountFiles(qemuModule, inputs, result.filesToMount);

    sendProgress(vmId, requestId, 'starting', 80, 'Starting QEMU...');

    // Create VM instance
    const instance: VmInstance = {
      vmId,
      profile,
      qemuModule,
      running: true,
      startTime: Date.now(),
    };
    vmInstances.set(vmId, instance);

    // Start QEMU
    log('info', `Starting QEMU with args: ${result.args.join(' ')}`, vmId);

    // Note: In real implementation, callMain would be called in a way that
    // doesn't block the worker. This is simplified for the MVP.
    setTimeout(() => {
      try {
        const exitCode = qemuModule.callMain(result.args);
        handleVmExit(vmId, exitCode);
      } catch (error) {
        handleVmError(vmId, String(error));
      }
    }, 0);

    sendProgress(vmId, requestId, 'running', 100, 'VM started');
    sendEvent<VmStartedEvent>({
      type: 'vmStarted',
      vmId,
      requestId,
    });

  } catch (error) {
    vmInstances.delete(vmId);
    sendError(vmId, requestId, `Failed to start VM: ${error}`, true);
  }
}

async function handleStopVm(
  requestId: string,
  vmId: string,
  _force?: boolean
): Promise<void> {
  const instance = vmInstances.get(vmId);

  if (!instance) {
    sendError(vmId, requestId, `VM ${vmId} not found`, false);
    return;
  }

  log('info', 'Stopping VM...', vmId);
  instance.running = false;

  // TODO: Implement graceful shutdown via QEMU monitor
  // For now, just mark as stopped

  vmInstances.delete(vmId);

  sendEvent<VmStoppedEvent>({
    type: 'vmStopped',
    vmId,
    requestId,
    exitCode: 0,
  });
}

async function handleResetVm(requestId: string, vmId: string): Promise<void> {
  const instance = vmInstances.get(vmId);

  if (!instance) {
    sendError(vmId, requestId, `VM ${vmId} not found`, false);
    return;
  }

  log('info', 'Resetting VM...', vmId);

  // TODO: Implement reset via QEMU monitor
  // For now, this is a stub

  sendEvent<VmStoppedEvent>({
    type: 'vmStopped',
    vmId,
    requestId,
  });
}

function handleSerialIn(vmId: string, data: string): void {
  const instance = vmInstances.get(vmId);

  if (!instance) {
    log('warn', `Serial input for unknown VM: ${vmId}`);
    return;
  }

  // TODO: Write to QEMU's stdin
  // This requires proper stdin pipe setup in the Emscripten module
  log('debug', `Serial in: ${data}`, vmId);
}

async function handleSyncOverlay(requestId: string, vmId: string): Promise<void> {
  // TODO: Implement overlay sync
  log('info', 'Syncing overlay...', vmId);
  sendProgress(vmId, requestId, 'running', 100, 'Overlay synced');
}

async function handleExportOverlay(
  requestId: string,
  vmId: string,
  diskId: string
): Promise<void> {
  // TODO: Implement overlay export
  log('info', `Exporting overlay for disk ${diskId}...`, vmId);

  // Placeholder: send empty export
  sendEvent({
    type: 'overlayExported',
    vmId,
    diskId,
    requestId,
    data: new ArrayBuffer(0),
    blockCount: 0,
  });
}

async function handleImportOverlay(
  requestId: string,
  vmId: string,
  diskId: string,
  _data: ArrayBuffer
): Promise<void> {
  // TODO: Implement overlay import
  log('info', `Importing overlay for disk ${diskId}...`, vmId);
  sendProgress(vmId, requestId, 'running', 100, 'Overlay imported');
}

// ============ QEMU Module Loading ============

async function loadQemuModule(arch: 'x86_64' | 'aarch64'): Promise<QemuModule> {
  if (!qemuModuleFactory) {
    // In production, this would dynamically import the correct architecture
    // For MVP, we create a mock module
    qemuModuleFactory = createMockQemuModule;
  }

  const module = await qemuModuleFactory({
    print: (text: string) => handleQemuOutput(text),
    printErr: (text: string) => handleQemuError(text),
    locateFile: (path: string) => {
      // Return URL to wasm/js files based on architecture
      return `/qemu-wasm/qemu-system-${arch}${path.includes('.wasm') ? '.wasm' : '.js'}`;
    },
  });

  await module.ready;
  return module;
}

/**
 * Create a mock QEMU module for testing without actual QEMU build
 */
async function createMockQemuModule(_options: unknown): Promise<QemuModule> {
  const fs = new Map<string, Uint8Array>();

  const module: QemuModule = {
    callMain: (args: string[]) => {
      log('info', `[Mock QEMU] Running with args: ${args.join(' ')}`);

      // Simulate boot output
      const bootMessages = [
        'QEMU emulator version 8.2.0',
        'Copyright (c) 2003-2023 Fabrice Bellard and the QEMU Project developers',
        '',
        'Booting from disk...',
        '',
        'Linux version 6.1.0 (buildroot@buildroot) (gcc 12.3.0)',
        'Command line: console=ttyS0,115200 root=/dev/vda rw',
        '',
        'Initializing cgroup subsys cpuset',
        'Initializing cgroup subsys cpu',
        'Linux version 6.1.0',
        'CPU: ARMv8 Processor [000000] revision 0',
        'Machine model: linux,dummy-virt',
        '',
        'Memory: 512MB',
        'Virtual kernel memory layout:',
        '',
        'Mounting devtmpfs on /dev',
        'Mounted root filesystem',
        '',
        'Welcome to QemuWeb!',
        '',
        '/ # ',
      ];

      let messageIndex = 0;
      const interval = setInterval(() => {
        if (messageIndex < bootMessages.length) {
          sendSerialOut('mock-vm', bootMessages[messageIndex] + '\n');
          messageIndex++;
        } else {
          clearInterval(interval);
        }
      }, 100);

      return 0;
    },
    FS: {
      mkdir: (path: string) => {
        log('debug', `[Mock FS] mkdir: ${path}`);
      },
      writeFile: (path: string, data: Uint8Array) => {
        fs.set(path, data);
        log('debug', `[Mock FS] writeFile: ${path} (${data.length} bytes)`);
      },
      readFile: (path: string) => {
        const data = fs.get(path);
        if (!data) {
          throw new Error(`File not found: ${path}`);
        }
        return data;
      },
      unlink: (path: string) => {
        fs.delete(path);
        log('debug', `[Mock FS] unlink: ${path}`);
      },
    },
    ready: Promise.resolve(null as unknown as QemuModule),
  };

  module.ready = Promise.resolve(module);
  return module;
}

// ============ File Mounting ============

async function mountFiles(
  qemuModule: QemuModule,
  inputs: VmInputs,
  filesToMount: Array<{ path: string; source: string; index?: number }>
): Promise<void> {
  for (const mount of filesToMount) {
    let data: Uint8Array | null = null;

    switch (mount.source) {
      case 'disk':
        if (inputs.disk?.file) {
          data = await readFileAsUint8Array(inputs.disk.file);
        } else if (inputs.disk?.url) {
          data = await fetchFileAsUint8Array(inputs.disk.url);
        }
        break;

      case 'kernel':
        if (inputs.kernel?.file) {
          data = await readFileAsUint8Array(inputs.kernel.file);
        } else if (inputs.kernel?.url) {
          data = await fetchFileAsUint8Array(inputs.kernel.url);
        }
        break;

      case 'initrd':
        if (inputs.initrd?.file) {
          data = await readFileAsUint8Array(inputs.initrd.file);
        } else if (inputs.initrd?.url) {
          data = await fetchFileAsUint8Array(inputs.initrd.url);
        }
        break;

      case 'additional':
        if (mount.index !== undefined && inputs.additionalDisks?.[mount.index]) {
          const disk = inputs.additionalDisks[mount.index];
          if (disk.file) {
            data = await readFileAsUint8Array(disk.file);
          } else if (disk.url) {
            data = await fetchFileAsUint8Array(disk.url);
          }
        }
        break;
    }

    if (data) {
      qemuModule.FS.writeFile(mount.path, data);
      log('info', `Mounted ${mount.source} at ${mount.path} (${data.length} bytes)`);
    }
  }
}

async function readFileAsUint8Array(file: File | Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function fetchFileAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// ============ QEMU Output Handlers ============

function handleQemuOutput(text: string): void {
  // Find active VM and send serial output
  const vmId = getActiveVmId();
  if (vmId) {
    sendSerialOut(vmId, text);
  }
}

function handleQemuError(text: string): void {
  log('error', `QEMU stderr: ${text}`);
}

function handleVmExit(vmId: string, exitCode: number): void {
  const instance = vmInstances.get(vmId);
  if (instance) {
    instance.running = false;
  }
  vmInstances.delete(vmId);

  sendEvent<VmStoppedEvent>({
    type: 'vmStopped',
    vmId,
    exitCode,
  });
}

function handleVmError(vmId: string, error: string): void {
  vmInstances.delete(vmId);

  sendEvent<VmErrorEvent>({
    type: 'vmError',
    vmId,
    error,
    fatal: true,
  });
}

function getActiveVmId(): string | undefined {
  // Return first running VM
  for (const [vmId, instance] of vmInstances) {
    if (instance.running) {
      return vmId;
    }
  }
  return undefined;
}

// ============ Event Sending ============

function sendEvent<T extends WorkerEvent>(event: T): void {
  self.postMessage(event);
}

function sendSerialOut(vmId: string, data: string): void {
  sendEvent<SerialOutEvent>({
    type: 'serialOut',
    vmId,
    data,
  });
}

function sendProgress(
  vmId: string | undefined,
  requestId: string | undefined,
  stage: 'loading' | 'mounting' | 'starting' | 'running',
  percent: number,
  message: string
): void {
  sendEvent<ProgressEvent>({
    type: 'progress',
    vmId,
    requestId,
    stage,
    percent,
    message,
  });
}

function sendError(
  vmId: string | undefined,
  requestId: string | undefined,
  error: string,
  fatal: boolean
): void {
  sendEvent<VmErrorEvent>({
    type: 'vmError',
    vmId,
    requestId,
    error,
    fatal,
  });
}

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, vmId?: string): void {
  sendEvent<LogEvent>({
    type: 'log',
    vmId,
    level,
    message,
  });
}

// ============ Initialization ============

// Send capabilities on worker start
sendEvent<CapabilitiesEvent>({
  type: 'capabilities',
  capabilities: detectCapabilities(),
});

log('info', 'QEMU Worker initialized');
