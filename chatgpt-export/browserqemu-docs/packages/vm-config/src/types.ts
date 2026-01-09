/**
 * VM Profile Type Definitions
 *
 * Defines the schema for machine profiles that configure
 * QEMU for different architectures and use cases.
 */

/** Supported CPU architectures */
export type VmArch = 'x86_64' | 'aarch64';

/** Disk interface types */
export type DiskInterface = 'virtio-blk' | 'ide' | 'scsi';

/** Network modes */
export type NetworkMode = 'user' | 'none';

/** Serial console modes */
export type SerialMode = 'stdio' | 'ttyS0' | 'pty';

/**
 * Device configuration for a VM profile
 */
export interface VmDeviceConfig {
  /** Disk interface type */
  diskInterface: DiskInterface;

  /** Network mode */
  net: NetworkMode;

  /** Enable virtio-rng for guest entropy */
  rng?: boolean;

  /** Serial console configuration */
  serial: SerialMode;

  /** Enable USB controller */
  usb?: boolean;

  /** Enable keyboard input */
  keyboard?: boolean;
}

/**
 * VM Profile Definition
 *
 * Complete configuration for a virtual machine type,
 * including hardware settings and QEMU options.
 */
export interface VmProfile {
  /** Unique identifier for this profile */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of the profile */
  description: string;

  /** CPU architecture */
  arch: VmArch;

  /** QEMU machine type (e.g., "q35", "virt") */
  machine: string;

  /** CPU model (optional, uses QEMU default if not specified) */
  cpu?: string;

  /** Memory size in MiB */
  memoryMiB: number;

  /** Number of CPU cores */
  smp: number;

  /** Whether this profile supports graphics output */
  supportsGraphics: boolean;

  /** Default QEMU arguments for this profile */
  defaultArgs: string[];

  /** Whether a kernel image is required (vs booting from disk) */
  requiresKernel: boolean;

  /** Help text for kernel requirement */
  kernelHelpText?: string;

  /** Device configuration */
  devices: VmDeviceConfig;

  /** Block size for disk I/O in bytes */
  blockSizeBytes?: number;

  /** Maximum memory in MiB (for memory growth) */
  maxMemoryMiB?: number;
}

/**
 * Input files for starting a VM
 */
export interface VmInputs {
  /** Main disk image (required) */
  disk?: {
    /** File/Blob for local disk */
    file?: File | Blob;
    /** URL for remote disk */
    url?: string;
    /** Whether the disk is read-only */
    readonly?: boolean;
  };

  /** Kernel image (for direct kernel boot) */
  kernel?: {
    file?: File | Blob;
    url?: string;
  };

  /** Initial ramdisk */
  initrd?: {
    file?: File | Blob;
    url?: string;
  };

  /** Kernel command line */
  kernelCmdline?: string;

  /** Additional disk images */
  additionalDisks?: Array<{
    file?: File | Blob;
    url?: string;
    readonly?: boolean;
  }>;
}

/**
 * Runtime overrides for profile defaults
 */
export interface VmOverrides {
  /** Override memory size */
  memoryMiB?: number;

  /** Override CPU count */
  smp?: number;

  /** Override network mode */
  net?: NetworkMode;

  /** Additional QEMU arguments */
  extraArgs?: string[];

  /** Override graphics setting */
  enableGraphics?: boolean;
}

/**
 * Result of building QEMU arguments
 */
export interface QemuArgsResult {
  /** The final argument list */
  args: string[];

  /** Architecture to use */
  arch: VmArch;

  /** Files that need to be mounted */
  filesToMount: Array<{
    path: string;
    source: 'disk' | 'kernel' | 'initrd' | 'additional';
    index?: number;
  }>;

  /** Validation warnings */
  warnings: string[];

  /** Validation errors (if any, args should not be used) */
  errors: string[];
}
