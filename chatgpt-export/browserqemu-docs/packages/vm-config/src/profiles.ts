/**
 * Default VM Profiles
 *
 * Pre-configured machine profiles for common use cases.
 */

import type { VmProfile } from './types.js';

/**
 * Linux x86_64 PC profile (nographic mode)
 *
 * Standard PC with Q35 chipset, suitable for most Linux distributions.
 * Uses serial console for output.
 */
export const linuxX86_64PcNographic: VmProfile = {
  id: 'linux-x86_64-pc-nographic',
  name: 'Linux x86_64 (Serial Console)',
  description: 'Standard x86_64 PC with Q35 chipset, serial console output',
  arch: 'x86_64',
  machine: 'q35',
  cpu: 'qemu64',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: ['-nographic', '-serial', 'mon:stdio'],
  requiresKernel: false,
  kernelHelpText:
    'You can boot directly from a disk image, or provide a kernel and initrd for faster boot.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'stdio',
  },
  blockSizeBytes: 65536, // 64 KiB
  maxMemoryMiB: 2048,
};

/**
 * Linux x86_64 PC profile with graphics
 *
 * Standard PC with basic VGA output to canvas.
 */
export const linuxX86_64PcGraphics: VmProfile = {
  id: 'linux-x86_64-pc-graphics',
  name: 'Linux x86_64 (Graphics)',
  description: 'Standard x86_64 PC with Q35 chipset, VGA graphics output',
  arch: 'x86_64',
  machine: 'q35',
  cpu: 'qemu64',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: true,
  defaultArgs: ['-vga', 'std', '-display', 'sdl'],
  requiresKernel: false,
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'ttyS0',
    keyboard: true,
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 2048,
};

/**
 * Linux aarch64 virt profile (nographic mode)
 *
 * ARM64 virtual machine using the "virt" platform.
 * Requires kernel + initrd for boot (no BIOS/UEFI in simple mode).
 */
export const linuxAarch64VirtNographic: VmProfile = {
  id: 'linux-aarch64-virt-nographic',
  name: 'Linux aarch64 (Serial Console)',
  description: 'ARM64 virtual machine with virt platform, serial console output',
  arch: 'aarch64',
  machine: 'virt',
  cpu: 'cortex-a57',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: ['-nographic', '-serial', 'mon:stdio'],
  requiresKernel: true,
  kernelHelpText:
    'The aarch64 virt machine requires a kernel and initrd. ' +
    'Disk-only boot is not supported without UEFI firmware.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'stdio',
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 2048,
};

/**
 * Linux aarch64 virt profile with graphics
 *
 * ARM64 with virtio-gpu for graphics output.
 */
export const linuxAarch64VirtGraphics: VmProfile = {
  id: 'linux-aarch64-virt-graphics',
  name: 'Linux aarch64 (Graphics)',
  description: 'ARM64 virtual machine with virt platform, virtio-gpu graphics',
  arch: 'aarch64',
  machine: 'virt',
  cpu: 'cortex-a57',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: true,
  defaultArgs: ['-device', 'virtio-gpu-pci', '-display', 'sdl'],
  requiresKernel: true,
  kernelHelpText:
    'The aarch64 virt machine requires a kernel and initrd. ' +
    'Disk-only boot is not supported without UEFI firmware.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'ttyS0',
    keyboard: true,
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 2048,
};

/**
 * Minimal x86_64 profile for testing
 *
 * Very lightweight configuration for quick testing.
 */
export const minimalX86_64: VmProfile = {
  id: 'minimal-x86_64',
  name: 'Minimal x86_64',
  description: 'Minimal x86_64 configuration for testing',
  arch: 'x86_64',
  machine: 'q35',
  memoryMiB: 128,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: ['-nographic', '-no-reboot'],
  requiresKernel: true,
  kernelHelpText: 'Provide a minimal kernel for quick boot testing.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    serial: 'stdio',
  },
  blockSizeBytes: 4096,
  maxMemoryMiB: 512,
};

/**
 * All default profiles
 */
export const defaultProfiles: VmProfile[] = [
  linuxX86_64PcNographic,
  linuxX86_64PcGraphics,
  linuxAarch64VirtNographic,
  linuxAarch64VirtGraphics,
  minimalX86_64,
];

/**
 * Get a profile by ID
 */
export function getProfileById(id: string): VmProfile | undefined {
  return defaultProfiles.find((p) => p.id === id);
}

/**
 * Get profiles by architecture
 */
export function getProfilesByArch(arch: 'x86_64' | 'aarch64'): VmProfile[] {
  return defaultProfiles.filter((p) => p.arch === arch);
}

/**
 * Get profiles that support graphics
 */
export function getGraphicsProfiles(): VmProfile[] {
  return defaultProfiles.filter((p) => p.supportsGraphics);
}

/**
 * Get profiles for serial console (nographic)
 */
export function getSerialProfiles(): VmProfile[] {
  return defaultProfiles.filter((p) => !p.supportsGraphics);
}
