/**
 * QEMU Wasm Type Definitions
 * 
 * TypeScript types for the QEMU WebAssembly module
 */

export type QemuArch = 'x86_64' | 'aarch64';

export interface QemuModuleOptions {
  /** Pre-allocated memory buffer */
  wasmMemory?: WebAssembly.Memory;
  
  /** Print callback for stdout */
  print?: (text: string) => void;
  
  /** Print callback for stderr */
  printErr?: (text: string) => void;
  
  /** Canvas element for graphics output */
  canvas?: HTMLCanvasElement | null;
  
  /** Called before main() runs */
  preRun?: Array<(module: QemuModule) => void>;
  
  /** Called after main() runs */
  postRun?: Array<(module: QemuModule) => void>;
  
  /** Locates files (wasm, data, etc.) */
  locateFile?: (path: string, prefix: string) => string;
  
  /** Called on initialization */
  onRuntimeInitialized?: () => void;
  
  /** Command line arguments */
  arguments?: string[];
  
  /** Environment variables */
  ENV?: Record<string, string>;
  
  /** Don't run main automatically */
  noInitialRun?: boolean;
}

export interface EmscriptenFS {
  mkdir(path: string): void;
  rmdir(path: string): void;
  writeFile(path: string, data: ArrayBufferView | string, opts?: { encoding?: string }): void;
  readFile(path: string, opts?: { encoding?: string }): Uint8Array | string;
  unlink(path: string): void;
  stat(path: string): { size: number; mtime: Date };
  isFile(mode: number): boolean;
  isDir(mode: number): boolean;
  createDataFile(parent: string, name: string, data: ArrayBufferView, canRead: boolean, canWrite: boolean): void;
  createPreloadedFile(parent: string, name: string, url: string, canRead: boolean, canWrite: boolean): void;
  mount(type: unknown, opts: unknown, mountpoint: string): void;
  unmount(mountpoint: string): void;
  syncfs(populate: boolean, callback: (err: Error | null) => void): void;
}

export interface QemuModule {
  /** Emscripten filesystem API */
  FS: EmscriptenFS;
  
  /** Call the main function with arguments */
  callMain(args: string[]): number;
  
  /** Call a C function by name */
  ccall(
    name: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
    opts?: { async?: boolean }
  ): unknown;
  
  /** Get a C function wrapper */
  cwrap(
    name: string,
    returnType: string | null,
    argTypes: string[]
  ): (...args: unknown[]) => unknown;
  
  /** Convert C string to JS string */
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  
  /** Write string to C memory */
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  
  /** WebAssembly memory */
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  
  /** Allocate memory */
  _malloc(size: number): number;
  
  /** Free memory */
  _free(ptr: number): void;
  
  /** Set exit status handler */
  onExit?: (code: number) => void;
  
  /** Module ready promise */
  ready: Promise<QemuModule>;
}

export interface QemuBuildInfo {
  version: string;
  targets: QemuArch[];
  pthreads: boolean;
  buildDate: string;
  emscriptenVersion: string;
}

/**
 * Load a QEMU architecture module
 */
export async function loadQemu(arch: QemuArch, _options?: QemuModuleOptions): Promise<QemuModule> {
  // Stub implementation - actual QEMU wasm loading would happen here
  throw new Error(`QEMU WebAssembly module for ${arch} is not available. Build with Docker to generate the WASM files.`);
}

/**
 * Get list of available architectures
 */
export function getAvailableArchitectures(): QemuArch[] {
  return ['x86_64', 'aarch64'];
}

/**
 * Architecture constants
 */
export const QEMU_ARCH = {
  X86_64: 'x86_64' as const,
  AARCH64: 'aarch64' as const,
};
