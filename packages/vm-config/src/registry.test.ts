import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileRegistry } from '../src/registry.js';
import type { VmProfile } from '../src/types.js';

describe('ProfileRegistry', () => {
  let registry: ProfileRegistry;

  beforeEach(() => {
    registry = new ProfileRegistry();
  });

  it('should load default profiles', () => {
    expect(registry.size).toBeGreaterThan(0);
    expect(registry.has('linux-x86_64-pc-nographic')).toBe(true);
  });

  it('should get profile by ID', () => {
    const profile = registry.get('linux-x86_64-pc-nographic');

    expect(profile).toBeDefined();
    expect(profile?.arch).toBe('x86_64');
  });

  it('should filter profiles by architecture', () => {
    const x86Profiles = registry.getByArch('x86_64');
    const armProfiles = registry.getByArch('aarch64');

    expect(x86Profiles.every((p) => p.arch === 'x86_64')).toBe(true);
    expect(armProfiles.every((p) => p.arch === 'aarch64')).toBe(true);
  });

  it('should register custom profile', () => {
    const customProfile: VmProfile = {
      id: 'custom-test',
      name: 'Custom Test',
      description: 'Test profile',
      arch: 'x86_64',
      machine: 'pc',
      memoryMiB: 256,
      smp: 1,
      supportsGraphics: false,
      defaultArgs: ['-nographic'],
      requiresKernel: false,
      devices: {
        diskInterface: 'virtio-blk',
        net: 'none',
        serial: 'stdio',
      },
    };

    registry.register(customProfile);

    expect(registry.has('custom-test')).toBe(true);
    expect(registry.get('custom-test')).toEqual(customProfile);
  });

  it('should throw when registering duplicate ID', () => {
    const customProfile: VmProfile = {
      id: 'linux-x86_64-pc-nographic', // Duplicate
      name: 'Duplicate',
      description: 'Test',
      arch: 'x86_64',
      machine: 'pc',
      memoryMiB: 256,
      smp: 1,
      supportsGraphics: false,
      defaultArgs: [],
      requiresKernel: false,
      devices: {
        diskInterface: 'virtio-blk',
        net: 'none',
        serial: 'stdio',
      },
    };

    expect(() => registry.register(customProfile)).toThrow();
  });

  it('should update existing profile', () => {
    registry.update('linux-x86_64-pc-nographic', { memoryMiB: 1024 });

    const profile = registry.get('linux-x86_64-pc-nographic');
    expect(profile?.memoryMiB).toBe(1024);
  });

  it('should remove profile', () => {
    const removed = registry.remove('linux-x86_64-pc-nographic');

    expect(removed).toBe(true);
    expect(registry.has('linux-x86_64-pc-nographic')).toBe(false);
  });

  it('should export and import profiles', () => {
    const exported = registry.export();
    const newRegistry = new ProfileRegistry();

    // Clear default profiles
    for (const p of newRegistry.getAll()) {
      newRegistry.remove(p.id);
    }

    const imported = newRegistry.import(exported);

    expect(imported).toBeGreaterThan(0);
  });
});
