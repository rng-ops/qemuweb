/**
 * Capability Detection
 *
 * Detects browser capabilities for QEMU Wasm runtime.
 */

import type { RuntimeCapabilities } from './protocol.js';

/**
 * Detect all runtime capabilities
 */
export function detectCapabilities(): RuntimeCapabilities {
  return {
    sharedArrayBuffer: detectSharedArrayBuffer(),
    webAssembly: detectWebAssembly(),
    wasmSimd: detectWasmSimd(),
    wasmThreads: detectWasmThreads(),
    bigInt: detectBigInt(),
    indexedDb: detectIndexedDb(),
    fileSystemAccess: detectFileSystemAccess(),
    webGpu: detectWebGpu(),
    maxMemory: detectMaxMemory(),
  };
}

/**
 * Check if SharedArrayBuffer is available
 */
export function detectSharedArrayBuffer(): boolean {
  try {
    // SharedArrayBuffer requires secure context and COOP/COEP headers
    if (typeof SharedArrayBuffer === 'undefined') {
      return false;
    }
    // Try to create one to verify it's actually usable
    new SharedArrayBuffer(1);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if WebAssembly is available
 */
export function detectWebAssembly(): boolean {
  try {
    if (typeof WebAssembly !== 'object') {
      return false;
    }
    // Check for basic WebAssembly support
    const module = new WebAssembly.Module(
      new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
    );
    return module instanceof WebAssembly.Module;
  } catch {
    return false;
  }
}

/**
 * Check if WebAssembly SIMD is available
 */
export function detectWasmSimd(): boolean {
  try {
    // SIMD detection via feature test
    // This module uses a v128.const instruction
    const simdTest = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
      0x03, 0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0b,
    ]);
    return WebAssembly.validate(simdTest);
  } catch {
    return false;
  }
}

/**
 * Check if WebAssembly threads are available
 */
export function detectWasmThreads(): boolean {
  try {
    // Threads require SharedArrayBuffer
    if (!detectSharedArrayBuffer()) {
      return false;
    }

    // Check for atomic wait instruction support
    const threadsTest = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03,
      0x02, 0x01, 0x00, 0x05, 0x04, 0x01, 0x03, 0x01, 0x01, 0x0a, 0x0b, 0x01, 0x09, 0x00, 0x41,
      0x00, 0x41, 0x00, 0xfe, 0x00, 0x02, 0x40, 0x1a, 0x0b,
    ]);
    return WebAssembly.validate(threadsTest);
  } catch {
    return false;
  }
}

/**
 * Check if BigInt is available
 */
export function detectBigInt(): boolean {
  try {
    return typeof BigInt !== 'undefined' && typeof BigInt(0) === 'bigint';
  } catch {
    return false;
  }
}

/**
 * Check if IndexedDB is available
 */
export function detectIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Check if File System Access API is available
 */
export function detectFileSystemAccess(): boolean {
  try {
    return 'showOpenFilePicker' in globalThis;
  } catch {
    return false;
  }
}

/**
 * Check if WebGPU is available
 */
export function detectWebGpu(): boolean {
  try {
    return 'gpu' in navigator && navigator.gpu !== undefined;
  } catch {
    return false;
  }
}

/**
 * Detect approximate maximum WebAssembly memory
 */
export function detectMaxMemory(): number {
  // Default conservative estimate: 2GB
  let maxBytes = 2 * 1024 * 1024 * 1024;

  try {
    // Try to detect actual limit by probing
    // Most browsers support at least 2GB, some support 4GB
    const pageSize = 65536; // 64KB per page
    const pages2GB = (2 * 1024 * 1024 * 1024) / pageSize;
    const pages4GB = (4 * 1024 * 1024 * 1024) / pageSize;

    // Try 4GB first
    try {
      new WebAssembly.Memory({ initial: 1, maximum: pages4GB });
      maxBytes = 4 * 1024 * 1024 * 1024;
    } catch {
      // Fall back to 2GB
      try {
        new WebAssembly.Memory({ initial: 1, maximum: pages2GB });
        maxBytes = 2 * 1024 * 1024 * 1024;
      } catch {
        // Very limited environment
        maxBytes = 512 * 1024 * 1024;
      }
    }
  } catch {
    // Ignore errors, use default
  }

  return maxBytes;
}

/**
 * Get a human-readable summary of capabilities
 */
export function summarizeCapabilities(caps: RuntimeCapabilities): string {
  const lines: string[] = [];

  lines.push('Browser Capabilities:');
  lines.push(`  WebAssembly: ${caps.webAssembly ? '✓' : '✗'}`);
  lines.push(`  Wasm SIMD: ${caps.wasmSimd ? '✓' : '✗'}`);
  lines.push(`  Wasm Threads: ${caps.wasmThreads ? '✓' : '✗'}`);
  lines.push(`  SharedArrayBuffer: ${caps.sharedArrayBuffer ? '✓' : '✗'}`);
  lines.push(`  BigInt: ${caps.bigInt ? '✓' : '✗'}`);
  lines.push(`  IndexedDB: ${caps.indexedDb ? '✓' : '✗'}`);
  lines.push(`  File System Access: ${caps.fileSystemAccess ? '✓' : '✗'}`);
  lines.push(`  WebGPU: ${caps.webGpu ? '✓' : '✗'}`);
  lines.push(`  Max Memory: ${Math.floor(caps.maxMemory / (1024 * 1024))} MB`);

  return lines.join('\n');
}

/**
 * Check minimum requirements for running QEMU
 */
export function checkMinimumRequirements(caps: RuntimeCapabilities): {
  satisfied: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required
  if (!caps.webAssembly) {
    missing.push('WebAssembly support is required');
  }
  if (!caps.bigInt) {
    missing.push('BigInt support is required');
  }
  if (!caps.indexedDb) {
    missing.push('IndexedDB is required for persistent storage');
  }

  // Recommended
  if (!caps.sharedArrayBuffer) {
    warnings.push(
      'SharedArrayBuffer not available. Multi-threading disabled. ' +
        'Ensure COOP/COEP headers are set for better performance.'
    );
  }
  if (!caps.wasmSimd) {
    warnings.push('WebAssembly SIMD not available. Performance may be reduced.');
  }

  return {
    satisfied: missing.length === 0,
    missing,
    warnings,
  };
}
