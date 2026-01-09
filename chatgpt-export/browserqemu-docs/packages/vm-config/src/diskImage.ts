/**
 * Disk Image Generation and Configuration
 *
 * Utilities for creating, configuring, and managing virtual disk images.
 */

export interface DiskImageConfig {
  /** Unique identifier for the disk */
  id: string;

  /** Human-readable name */
  name: string;

  /** Disk format */
  format: 'qcow2' | 'raw' | 'vmdk' | 'vdi';

  /** Size in bytes */
  sizeBytes: number;

  /** Block size for I/O operations */
  blockSize: number;

  /** Whether the disk is bootable */
  bootable: boolean;

  /** Filesystem type (if formatted) */
  filesystem?: 'ext4' | 'xfs' | 'btrfs' | 'fat32' | 'ntfs' | 'none';

  /** Partition table type */
  partitionTable?: 'gpt' | 'mbr' | 'none';

  /** Cloud-init configuration */
  cloudInit?: CloudInitConfig;

  /** Base image URL (for layered images) */
  baseImageUrl?: string;

  /** Image metadata */
  metadata: DiskImageMetadata;
}

export interface DiskImageMetadata {
  createdAt: Date;
  modifiedAt: Date;
  description?: string;
  os?: string;
  osVersion?: string;
  architecture?: 'x86_64' | 'aarch64' | 'riscv64';
  tags: string[];
  checksum?: string;
  checksumType?: 'sha256' | 'sha512' | 'md5';
}

export interface CloudInitConfig {
  /** Hostname for the VM */
  hostname: string;

  /** User configuration */
  users: CloudInitUser[];

  /** SSH authorized keys */
  sshAuthorizedKeys: string[];

  /** Network configuration */
  network?: CloudInitNetwork;

  /** Packages to install */
  packages: string[];

  /** Commands to run on first boot */
  runcmd: string[];

  /** Write files */
  writeFiles: CloudInitWriteFile[];
}

export interface CloudInitUser {
  name: string;
  groups?: string[];
  sudo?: string;
  shell?: string;
  sshAuthorizedKeys?: string[];
  passwd?: string;
  lockPasswd?: boolean;
}

export interface CloudInitNetwork {
  version: 2;
  ethernets: Record<string, CloudInitEthernet>;
}

export interface CloudInitEthernet {
  dhcp4?: boolean;
  dhcp6?: boolean;
  addresses?: string[];
  gateway4?: string;
  gateway6?: string;
  nameservers?: {
    addresses: string[];
    search?: string[];
  };
}

export interface CloudInitWriteFile {
  path: string;
  content: string;
  permissions?: string;
  owner?: string;
}

/**
 * Default disk image configurations for common use cases
 */
export const DEFAULT_DISK_CONFIGS: Record<string, Partial<DiskImageConfig>> = {
  'minimal-linux': {
    name: 'Minimal Linux',
    format: 'qcow2',
    sizeBytes: 2 * 1024 * 1024 * 1024, // 2GB
    blockSize: 65536,
    bootable: true,
    filesystem: 'ext4',
    partitionTable: 'gpt',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Minimal Linux system for testing',
      os: 'linux',
      architecture: 'x86_64',
      tags: ['minimal', 'linux', 'testing'],
    },
  },
  'alpine-base': {
    name: 'Alpine Linux Base',
    format: 'qcow2',
    sizeBytes: 512 * 1024 * 1024, // 512MB
    blockSize: 65536,
    bootable: true,
    filesystem: 'ext4',
    partitionTable: 'gpt',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Alpine Linux minimal base image',
      os: 'alpine',
      osVersion: '3.19',
      architecture: 'x86_64',
      tags: ['alpine', 'minimal', 'container-optimized'],
    },
  },
  'ubuntu-server': {
    name: 'Ubuntu Server',
    format: 'qcow2',
    sizeBytes: 10 * 1024 * 1024 * 1024, // 10GB
    blockSize: 65536,
    bootable: true,
    filesystem: 'ext4',
    partitionTable: 'gpt',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Ubuntu Server LTS base image',
      os: 'ubuntu',
      osVersion: '24.04',
      architecture: 'x86_64',
      tags: ['ubuntu', 'server', 'lts'],
    },
  },
  'data-disk': {
    name: 'Data Disk',
    format: 'qcow2',
    sizeBytes: 20 * 1024 * 1024 * 1024, // 20GB
    blockSize: 65536,
    bootable: false,
    filesystem: 'ext4',
    partitionTable: 'gpt',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Additional data storage disk',
      tags: ['storage', 'data'],
    },
  },
  'scratch': {
    name: 'Scratch Disk',
    format: 'raw',
    sizeBytes: 1 * 1024 * 1024 * 1024, // 1GB
    blockSize: 4096,
    bootable: false,
    filesystem: 'none',
    partitionTable: 'none',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Temporary scratch disk',
      tags: ['scratch', 'temporary'],
    },
  },
};

/**
 * Generate a unique disk ID
 */
export function generateDiskId(): string {
  return `disk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new disk image configuration
 */
export function createDiskConfig(
  template: keyof typeof DEFAULT_DISK_CONFIGS | 'custom',
  overrides: Partial<DiskImageConfig> = {}
): DiskImageConfig {
  const base = template === 'custom' ? {} : DEFAULT_DISK_CONFIGS[template];
  const now = new Date();

  return {
    id: generateDiskId(),
    name: 'New Disk',
    format: 'qcow2',
    sizeBytes: 2 * 1024 * 1024 * 1024,
    blockSize: 65536,
    bootable: false,
    ...base,
    ...overrides,
    metadata: {
      createdAt: base?.metadata?.createdAt ?? now,
      modifiedAt: now,
      tags: [...(base?.metadata?.tags ?? []), ...(overrides.metadata?.tags ?? [])],
      ...base?.metadata,
      ...overrides.metadata,
    },
  } as DiskImageConfig;
}

/**
 * Generate cloud-init user-data YAML
 */
export function generateCloudInitUserData(config: CloudInitConfig): string {
  const lines: string[] = ['#cloud-config', ''];

  // Hostname
  lines.push(`hostname: ${config.hostname}`);
  lines.push('');

  // Users
  if (config.users.length > 0) {
    lines.push('users:');
    for (const user of config.users) {
      lines.push(`  - name: ${user.name}`);
      if (user.groups) lines.push(`    groups: ${user.groups.join(', ')}`);
      if (user.sudo) lines.push(`    sudo: ${user.sudo}`);
      if (user.shell) lines.push(`    shell: ${user.shell}`);
      if (user.lockPasswd !== undefined) lines.push(`    lock_passwd: ${user.lockPasswd}`);
      if (user.sshAuthorizedKeys && user.sshAuthorizedKeys.length > 0) {
        lines.push('    ssh_authorized_keys:');
        for (const key of user.sshAuthorizedKeys) {
          lines.push(`      - ${key}`);
        }
      }
    }
    lines.push('');
  }

  // Packages
  if (config.packages.length > 0) {
    lines.push('packages:');
    for (const pkg of config.packages) {
      lines.push(`  - ${pkg}`);
    }
    lines.push('');
  }

  // Write files
  if (config.writeFiles.length > 0) {
    lines.push('write_files:');
    for (const file of config.writeFiles) {
      lines.push(`  - path: ${file.path}`);
      if (file.permissions) lines.push(`    permissions: '${file.permissions}'`);
      if (file.owner) lines.push(`    owner: ${file.owner}`);
      lines.push(`    content: |`);
      for (const line of file.content.split('\n')) {
        lines.push(`      ${line}`);
      }
    }
    lines.push('');
  }

  // Run commands
  if (config.runcmd.length > 0) {
    lines.push('runcmd:');
    for (const cmd of config.runcmd) {
      lines.push(`  - ${cmd}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate cloud-init meta-data
 */
export function generateCloudInitMetaData(instanceId: string, hostname: string): string {
  return `instance-id: ${instanceId}\nlocal-hostname: ${hostname}\n`;
}

/**
 * Generate cloud-init network-config
 */
export function generateCloudInitNetworkConfig(network: CloudInitNetwork): string {
  const lines: string[] = ['network:', `  version: ${network.version}`, '  ethernets:'];

  for (const [name, eth] of Object.entries(network.ethernets)) {
    lines.push(`    ${name}:`);
    if (eth.dhcp4 !== undefined) lines.push(`      dhcp4: ${eth.dhcp4}`);
    if (eth.dhcp6 !== undefined) lines.push(`      dhcp6: ${eth.dhcp6}`);
    if (eth.addresses && eth.addresses.length > 0) {
      lines.push('      addresses:');
      for (const addr of eth.addresses) {
        lines.push(`        - ${addr}`);
      }
    }
    if (eth.gateway4) lines.push(`      gateway4: ${eth.gateway4}`);
    if (eth.gateway6) lines.push(`      gateway6: ${eth.gateway6}`);
    if (eth.nameservers) {
      lines.push('      nameservers:');
      lines.push(`        addresses: [${eth.nameservers.addresses.join(', ')}]`);
      if (eth.nameservers.search) {
        lines.push(`        search: [${eth.nameservers.search.join(', ')}]`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Parse QCOW2 header to extract metadata
 */
export async function parseQcow2Header(data: ArrayBuffer): Promise<{
  version: number;
  backingFile?: string;
  virtualSize: bigint;
  clusterBits: number;
  refcountOrder: number;
  features: string[];
} | null> {
  const view = new DataView(data);

  // Check magic number
  const magic = view.getUint32(0, false);
  if (magic !== 0x514649fb) {
    // 'QFI\xfb'
    return null;
  }

  const version = view.getUint32(4, false);
  if (version < 2 || version > 3) {
    return null;
  }

  const backingFileOffset = view.getBigUint64(8, false);
  const backingFileSize = view.getUint32(16, false);

  let backingFile: string | undefined;
  if (backingFileOffset > 0n && backingFileSize > 0) {
    const offset = Number(backingFileOffset);
    const bytes = new Uint8Array(data, offset, backingFileSize);
    backingFile = new TextDecoder().decode(bytes);
  }

  const clusterBits = view.getUint32(20, false);
  const virtualSize = view.getBigUint64(24, false);

  const features: string[] = [];

  if (version >= 3) {
    const incompatibleFeatures = view.getBigUint64(72, false);
    const compatibleFeatures = view.getBigUint64(80, false);
    const autoclearFeatures = view.getBigUint64(88, false);

    if (incompatibleFeatures & 1n) features.push('dirty');
    if (incompatibleFeatures & 2n) features.push('corrupt');
    if (incompatibleFeatures & 4n) features.push('external-data-file');
    if (incompatibleFeatures & 8n) features.push('compression');
    if (incompatibleFeatures & 16n) features.push('extended-l2');
    if (compatibleFeatures & 1n) features.push('lazy-refcounts');
    if (autoclearFeatures & 1n) features.push('bitmaps');
    if (autoclearFeatures & 2n) features.push('raw-external');
  }

  const refcountOrder = version >= 3 ? view.getUint32(96, false) : 4;

  return {
    version,
    backingFile,
    virtualSize,
    clusterBits,
    refcountOrder,
    features,
  };
}

/**
 * Estimate QEMU configuration from disk image
 */
export function estimateQemuConfigFromDisk(
  diskConfig: DiskImageConfig,
  _qcow2Info?: Awaited<ReturnType<typeof parseQcow2Header>>
): {
  recommendedMemory: number;
  recommendedCpus: number;
  bootDevice: string;
  diskInterface: string;
  architecture: string;
} {
  const sizeGB = diskConfig.sizeBytes / (1024 * 1024 * 1024);

  // Estimate based on disk size and OS
  let recommendedMemory = 256; // MB
  let recommendedCpus = 1;

  if (diskConfig.metadata.os === 'ubuntu' || diskConfig.metadata.os === 'debian') {
    recommendedMemory = sizeGB >= 10 ? 2048 : 1024;
    recommendedCpus = sizeGB >= 10 ? 2 : 1;
  } else if (diskConfig.metadata.os === 'alpine') {
    recommendedMemory = 256;
    recommendedCpus = 1;
  } else if (sizeGB >= 20) {
    recommendedMemory = 4096;
    recommendedCpus = 4;
  } else if (sizeGB >= 10) {
    recommendedMemory = 2048;
    recommendedCpus = 2;
  } else if (sizeGB >= 5) {
    recommendedMemory = 1024;
    recommendedCpus = 1;
  }

  return {
    recommendedMemory,
    recommendedCpus,
    bootDevice: diskConfig.bootable ? 'c' : 'n',
    diskInterface: 'virtio',
    architecture: diskConfig.metadata.architecture ?? 'x86_64',
  };
}

export type { DiskImageConfig as DiskConfig };
