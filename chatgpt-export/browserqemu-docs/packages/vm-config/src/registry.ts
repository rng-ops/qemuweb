/**
 * Profile Registry
 *
 * Manages VM profiles with support for custom profiles.
 */

import type { VmProfile, VmArch } from './types.js';
import { defaultProfiles } from './profiles.js';

/**
 * Profile Registry for managing VM configurations
 */
export class ProfileRegistry {
  private profiles: Map<string, VmProfile>;

  constructor() {
    this.profiles = new Map();
    // Load default profiles
    for (const profile of defaultProfiles) {
      this.profiles.set(profile.id, profile);
    }
  }

  /**
   * Get a profile by ID
   */
  get(id: string): VmProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get all profiles
   */
  getAll(): VmProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profiles filtered by architecture
   */
  getByArch(arch: VmArch): VmProfile[] {
    return this.getAll().filter((p) => p.arch === arch);
  }

  /**
   * Get profiles that support graphics
   */
  getGraphicsProfiles(): VmProfile[] {
    return this.getAll().filter((p) => p.supportsGraphics);
  }

  /**
   * Get profiles for serial console
   */
  getSerialProfiles(): VmProfile[] {
    return this.getAll().filter((p) => !p.supportsGraphics);
  }

  /**
   * Register a custom profile
   */
  register(profile: VmProfile): void {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Profile with ID "${profile.id}" already exists`);
    }
    this.validateProfile(profile);
    this.profiles.set(profile.id, profile);
  }

  /**
   * Update an existing profile
   */
  update(id: string, updates: Partial<VmProfile>): void {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Profile with ID "${id}" not found`);
    }
    const updated = { ...existing, ...updates };
    this.validateProfile(updated);
    this.profiles.set(id, updated);
  }

  /**
   * Remove a profile
   */
  remove(id: string): boolean {
    return this.profiles.delete(id);
  }

  /**
   * Check if a profile exists
   */
  has(id: string): boolean {
    return this.profiles.has(id);
  }

  /**
   * Get profile count
   */
  get size(): number {
    return this.profiles.size;
  }

  /**
   * Export all profiles as JSON
   */
  export(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * Import profiles from JSON
   */
  import(json: string, overwrite = false): number {
    const profiles = JSON.parse(json) as VmProfile[];
    let imported = 0;

    for (const profile of profiles) {
      try {
        if (this.profiles.has(profile.id)) {
          if (overwrite) {
            this.update(profile.id, profile);
            imported++;
          }
        } else {
          this.register(profile);
          imported++;
        }
      } catch (e) {
        console.warn(`Failed to import profile "${profile.id}":`, e);
      }
    }

    return imported;
  }

  /**
   * Validate a profile
   */
  private validateProfile(profile: VmProfile): void {
    if (!profile.id || typeof profile.id !== 'string') {
      throw new Error('Profile must have a valid ID');
    }
    if (!profile.arch || !['x86_64', 'aarch64'].includes(profile.arch)) {
      throw new Error('Profile must have a valid architecture (x86_64 or aarch64)');
    }
    if (!profile.machine || typeof profile.machine !== 'string') {
      throw new Error('Profile must have a valid machine type');
    }
    if (typeof profile.memoryMiB !== 'number' || profile.memoryMiB < 16) {
      throw new Error('Profile must have valid memory (>= 16 MiB)');
    }
    if (typeof profile.smp !== 'number' || profile.smp < 1) {
      throw new Error('Profile must have valid SMP count (>= 1)');
    }
    if (!profile.devices) {
      throw new Error('Profile must have device configuration');
    }
  }
}

/**
 * Default global registry instance
 */
export const profileRegistry = new ProfileRegistry();
