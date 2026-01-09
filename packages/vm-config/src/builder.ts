/**
 * QEMU Argument Builder
 *
 * Constructs QEMU command-line arguments from a profile and inputs.
 */

import type { VmProfile, VmInputs, VmOverrides, QemuArgsResult } from './types.js';

/** Virtual filesystem paths used for mounting */
export const VIRT_PATHS = {
  DISK_PREFIX: '/vm/disk',
  KERNEL: '/vm/kernel',
  INITRD: '/vm/initrd',
} as const;

/**
 * Build QEMU arguments from profile, inputs, and overrides
 */
export function buildQemuArgs(
  profile: VmProfile,
  inputs: VmInputs,
  overrides?: VmOverrides
): QemuArgsResult {
  const args: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const filesToMount: QemuArgsResult['filesToMount'] = [];

  // Merge overrides with profile defaults
  const memoryMiB = overrides?.memoryMiB ?? profile.memoryMiB;
  const smp = overrides?.smp ?? profile.smp;
  const netMode = overrides?.net ?? profile.devices.net;
  const enableGraphics = overrides?.enableGraphics ?? profile.supportsGraphics;

  // Machine type
  args.push('-machine', profile.machine);

  // CPU
  if (profile.cpu) {
    args.push('-cpu', profile.cpu);
  }

  // Memory
  args.push('-m', `${memoryMiB}M`);

  // SMP
  if (smp > 1) {
    args.push('-smp', `${smp}`);
  }

  // Handle kernel requirement
  if (profile.requiresKernel) {
    if (!inputs.kernel) {
      if (inputs.disk) {
        warnings.push(
          `Profile "${profile.name}" recommends a kernel image. ` +
            `Disk-only boot may not work. ${profile.kernelHelpText ?? ''}`
        );
      } else {
        errors.push(
          `Profile "${profile.name}" requires a kernel image. ${profile.kernelHelpText ?? ''}`
        );
      }
    }
  }

  // Kernel
  if (inputs.kernel) {
    args.push('-kernel', VIRT_PATHS.KERNEL);
    filesToMount.push({ path: VIRT_PATHS.KERNEL, source: 'kernel' });
  }

  // Initrd
  if (inputs.initrd) {
    args.push('-initrd', VIRT_PATHS.INITRD);
    filesToMount.push({ path: VIRT_PATHS.INITRD, source: 'initrd' });
  }

  // Kernel command line
  if (inputs.kernelCmdline) {
    args.push('-append', inputs.kernelCmdline);
  } else if (inputs.kernel) {
    // Default kernel command line for serial console
    const defaultCmdline = enableGraphics
      ? 'console=tty0 root=/dev/vda rw'
      : 'console=ttyS0,115200 root=/dev/vda rw';
    args.push('-append', defaultCmdline);
  }

  // Main disk
  if (inputs.disk) {
    const diskPath = `${VIRT_PATHS.DISK_PREFIX}0`;
    const diskOpts = buildDiskArgs(profile, diskPath, 0, inputs.disk.readonly);
    args.push(...diskOpts);
    filesToMount.push({ path: diskPath, source: 'disk', index: 0 });
  } else if (!inputs.kernel) {
    errors.push('Either a disk image or kernel must be provided.');
  }

  // Additional disks
  if (inputs.additionalDisks) {
    inputs.additionalDisks.forEach((disk, i) => {
      const diskPath = `${VIRT_PATHS.DISK_PREFIX}${i + 1}`;
      const diskOpts = buildDiskArgs(profile, diskPath, i + 1, disk.readonly);
      args.push(...diskOpts);
      filesToMount.push({ path: diskPath, source: 'additional', index: i });
    });
  }

  // Network
  if (netMode === 'user') {
    args.push('-netdev', 'user,id=net0');
    args.push('-device', 'virtio-net-pci,netdev=net0');
    warnings.push(
      'User networking enabled. Performance may be limited. ' +
        'Some protocols (e.g., ICMP ping) may not work.'
    );
  } else {
    args.push('-net', 'none');
  }

  // Random number generator
  if (profile.devices.rng) {
    args.push('-object', 'rng-random,id=rng0,filename=/dev/urandom');
    args.push('-device', 'virtio-rng-pci,rng=rng0');
  }

  // Graphics or nographic
  if (!enableGraphics) {
    // Only add -nographic if it's not already in default args
    if (!profile.defaultArgs.includes('-nographic')) {
      args.push('-nographic');
    }
  }

  // Add profile's default args
  args.push(...profile.defaultArgs);

  // Add extra args from overrides
  if (overrides?.extraArgs) {
    args.push(...overrides.extraArgs);
  }

  // Deduplicate and clean up args
  const cleanedArgs = deduplicateArgs(args);

  return {
    args: cleanedArgs,
    arch: profile.arch,
    filesToMount,
    warnings,
    errors,
  };
}

/**
 * Build disk device arguments based on profile's disk interface
 */
function buildDiskArgs(
  profile: VmProfile,
  diskPath: string,
  index: number,
  readonly?: boolean
): string[] {
  const args: string[] = [];
  const iface = profile.devices.diskInterface;
  const driveId = `drive${index}`;
  const readonlyOpt = readonly ? ',readonly=on' : '';

  switch (iface) {
    case 'virtio-blk':
      args.push('-drive', `file=${diskPath},format=raw,if=none,id=${driveId}${readonlyOpt}`);
      args.push('-device', `virtio-blk-pci,drive=${driveId}`);
      break;

    case 'ide':
      args.push(
        '-drive',
        `file=${diskPath},format=raw,if=ide,index=${index}${readonlyOpt}`
      );
      break;

    case 'scsi':
      if (index === 0) {
        args.push('-device', 'virtio-scsi-pci,id=scsi0');
      }
      args.push('-drive', `file=${diskPath},format=raw,if=none,id=${driveId}${readonlyOpt}`);
      args.push('-device', `scsi-hd,drive=${driveId},bus=scsi0.0`);
      break;
  }

  return args;
}

/**
 * Remove duplicate arguments, keeping the last occurrence
 */
function deduplicateArgs(args: string[]): string[] {
  // Arguments that should only appear once
  const uniqueFlags = new Set(['-m', '-smp', '-machine', '-cpu', '-kernel', '-initrd', '-append']);

  const result: string[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (uniqueFlags.has(arg) && i + 1 < args.length) {
      // This is a flag with a value
      if (seen.has(arg)) {
        // Remove previous occurrence
        const prevIndex = seen.get(arg)!;
        result.splice(prevIndex, 2);
        // Update indices in seen map
        for (const [key, idx] of seen.entries()) {
          if (idx > prevIndex) {
            seen.set(key, idx - 2);
          }
        }
      }
      seen.set(arg, result.length);
      result.push(arg, args[++i]);
    } else {
      result.push(arg);
    }
  }

  return result;
}

/**
 * Validate that required inputs are provided for a profile
 */
export function validateInputs(
  profile: VmProfile,
  inputs: VmInputs
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (profile.requiresKernel && !inputs.kernel) {
    errors.push(`Profile "${profile.name}" requires a kernel image.`);
  }

  if (!inputs.disk && !inputs.kernel) {
    errors.push('Either a disk image or kernel must be provided.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a human-readable summary of the QEMU configuration
 */
export function summarizeConfig(profile: VmProfile, overrides?: VmOverrides): string {
  const memoryMiB = overrides?.memoryMiB ?? profile.memoryMiB;
  const smp = overrides?.smp ?? profile.smp;
  const net = overrides?.net ?? profile.devices.net;

  const lines = [
    `Profile: ${profile.name}`,
    `Architecture: ${profile.arch}`,
    `Machine: ${profile.machine}`,
    `CPU: ${profile.cpu ?? 'default'}`,
    `Memory: ${memoryMiB} MiB`,
    `CPUs: ${smp}`,
    `Disk Interface: ${profile.devices.diskInterface}`,
    `Network: ${net}`,
    `Graphics: ${profile.supportsGraphics ? 'yes' : 'no'}`,
  ];

  return lines.join('\n');
}
