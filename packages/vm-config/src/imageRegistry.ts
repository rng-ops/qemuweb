/**
 * Image Registry - Base Images and Templates
 *
 * Registry of verified base images and templates for VMs.
 */

import type { DiskImageConfig } from './diskImage.js';

export interface RegistryImage {
  /** Unique image identifier */
  id: string;

  /** Image name */
  name: string;

  /** Image version */
  version: string;

  /** Image description */
  description: string;

  /** Operating system */
  os: string;

  /** OS version */
  osVersion?: string;

  /** Architecture */
  architecture: 'x86_64' | 'aarch64' | 'riscv64';

  /** Image size in bytes */
  sizeBytes: number;

  /** Download URL */
  url?: string;

  /** SHA256 checksum */
  checksum: string;

  /** Whether image is verified */
  verified: boolean;

  /** Image category */
  category: ImageCategory;

  /** Features and capabilities */
  features: string[];

  /** Minimum memory requirement (MB) */
  minMemory: number;

  /** Recommended memory (MB) */
  recommendedMemory: number;

  /** Minimum disk size (GB) */
  minDiskGb: number;

  /** Creation date */
  createdAt: Date;

  /** Last updated */
  updatedAt: Date;

  /** Tags */
  tags: string[];
}

export type ImageCategory =
  | 'os-minimal'
  | 'os-server'
  | 'os-desktop'
  | 'container-runtime'
  | 'networking'
  | 'database'
  | 'web-server'
  | 'development'
  | 'security'
  | 'custom';

/**
 * Built-in verified base images
 */
export const REGISTRY_IMAGES: RegistryImage[] = [
  {
    id: 'alpine-3.19-minimal',
    name: 'Alpine Linux',
    version: '3.19',
    description: 'Minimal Alpine Linux - lightweight and security-focused',
    os: 'alpine',
    osVersion: '3.19',
    architecture: 'x86_64',
    sizeBytes: 50 * 1024 * 1024, // ~50MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'os-minimal',
    features: ['musl', 'busybox', 'apk', 'openrc'],
    minMemory: 64,
    recommendedMemory: 256,
    minDiskGb: 1,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-12-01'),
    tags: ['minimal', 'lightweight', 'security', 'container-optimized'],
  },
  {
    id: 'alpine-3.19-docker',
    name: 'Alpine Linux with Docker',
    version: '3.19-docker',
    description: 'Alpine Linux with Docker pre-installed',
    os: 'alpine',
    osVersion: '3.19',
    architecture: 'x86_64',
    sizeBytes: 150 * 1024 * 1024, // ~150MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'container-runtime',
    features: ['docker', 'containerd', 'runc'],
    minMemory: 512,
    recommendedMemory: 1024,
    minDiskGb: 5,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-12-01'),
    tags: ['docker', 'containers', 'devops'],
  },
  {
    id: 'ubuntu-24.04-server',
    name: 'Ubuntu Server',
    version: '24.04 LTS',
    description: 'Ubuntu Server LTS - stable and widely supported',
    os: 'ubuntu',
    osVersion: '24.04',
    architecture: 'x86_64',
    sizeBytes: 500 * 1024 * 1024, // ~500MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'os-server',
    features: ['apt', 'systemd', 'netplan', 'cloud-init'],
    minMemory: 512,
    recommendedMemory: 2048,
    minDiskGb: 10,
    createdAt: new Date('2024-04-25'),
    updatedAt: new Date('2024-12-01'),
    tags: ['ubuntu', 'server', 'lts', 'enterprise'],
  },
  {
    id: 'debian-12-minimal',
    name: 'Debian',
    version: '12 (Bookworm)',
    description: 'Debian stable - the universal operating system',
    os: 'debian',
    osVersion: '12',
    architecture: 'x86_64',
    sizeBytes: 300 * 1024 * 1024, // ~300MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'os-server',
    features: ['apt', 'systemd'],
    minMemory: 256,
    recommendedMemory: 1024,
    minDiskGb: 5,
    createdAt: new Date('2023-06-10'),
    updatedAt: new Date('2024-12-01'),
    tags: ['debian', 'stable', 'server'],
  },
  {
    id: 'nginx-alpine',
    name: 'Nginx on Alpine',
    version: '1.25',
    description: 'High-performance web server on Alpine Linux',
    os: 'alpine',
    osVersion: '3.19',
    architecture: 'x86_64',
    sizeBytes: 80 * 1024 * 1024, // ~80MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'web-server',
    features: ['nginx', 'http2', 'ssl'],
    minMemory: 64,
    recommendedMemory: 256,
    minDiskGb: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-12-01'),
    tags: ['nginx', 'web-server', 'reverse-proxy'],
  },
  {
    id: 'postgres-16-alpine',
    name: 'PostgreSQL on Alpine',
    version: '16',
    description: 'PostgreSQL database server on Alpine Linux',
    os: 'alpine',
    osVersion: '3.19',
    architecture: 'x86_64',
    sizeBytes: 100 * 1024 * 1024, // ~100MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'database',
    features: ['postgresql', 'replication', 'ssl'],
    minMemory: 256,
    recommendedMemory: 1024,
    minDiskGb: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-12-01'),
    tags: ['postgresql', 'database', 'sql'],
  },
  {
    id: 'redis-7-alpine',
    name: 'Redis on Alpine',
    version: '7',
    description: 'Redis in-memory data store on Alpine Linux',
    os: 'alpine',
    osVersion: '3.19',
    architecture: 'x86_64',
    sizeBytes: 60 * 1024 * 1024, // ~60MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'database',
    features: ['redis', 'cluster', 'persistence'],
    minMemory: 64,
    recommendedMemory: 256,
    minDiskGb: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-12-01'),
    tags: ['redis', 'cache', 'nosql'],
  },
  {
    id: 'openwrt-23.05',
    name: 'OpenWrt',
    version: '23.05',
    description: 'OpenWrt router/firewall distribution',
    os: 'openwrt',
    osVersion: '23.05',
    architecture: 'x86_64',
    sizeBytes: 30 * 1024 * 1024, // ~30MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'networking',
    features: ['luci', 'firewall', 'opkg', 'routing'],
    minMemory: 64,
    recommendedMemory: 128,
    minDiskGb: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-12-01'),
    tags: ['router', 'firewall', 'networking', 'openwrt'],
  },
  {
    id: 'vyos-1.4',
    name: 'VyOS',
    version: '1.4',
    description: 'VyOS network operating system',
    os: 'vyos',
    osVersion: '1.4',
    architecture: 'x86_64',
    sizeBytes: 400 * 1024 * 1024, // ~400MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'networking',
    features: ['routing', 'vpn', 'firewall', 'nat'],
    minMemory: 512,
    recommendedMemory: 1024,
    minDiskGb: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-12-01'),
    tags: ['router', 'firewall', 'vpn', 'networking'],
  },
  {
    id: 'buildroot-minimal',
    name: 'Buildroot Minimal',
    version: '2024.02',
    description: 'Custom minimal Linux for embedded and testing',
    os: 'buildroot',
    osVersion: '2024.02',
    architecture: 'x86_64',
    sizeBytes: 10 * 1024 * 1024, // ~10MB
    checksum: 'sha256:placeholder',
    verified: true,
    category: 'os-minimal',
    features: ['busybox', 'minimal'],
    minMemory: 32,
    recommendedMemory: 64,
    minDiskGb: 1,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-12-01'),
    tags: ['minimal', 'embedded', 'testing', 'buildroot'],
  },
];

/**
 * Get images by category
 */
export function getImagesByCategory(category: ImageCategory): RegistryImage[] {
  return REGISTRY_IMAGES.filter((img) => img.category === category);
}

/**
 * Get images by tag
 */
export function getImagesByTag(tag: string): RegistryImage[] {
  return REGISTRY_IMAGES.filter((img) => img.tags.includes(tag));
}

/**
 * Get image by ID
 */
export function getImageById(id: string): RegistryImage | undefined {
  return REGISTRY_IMAGES.find((img) => img.id === id);
}

/**
 * Search images
 */
export function searchImages(query: string): RegistryImage[] {
  const q = query.toLowerCase();
  return REGISTRY_IMAGES.filter(
    (img) =>
      img.name.toLowerCase().includes(q) ||
      img.description.toLowerCase().includes(q) ||
      img.tags.some((t) => t.includes(q)) ||
      img.os.toLowerCase().includes(q)
  );
}

/**
 * Get verified images only
 */
export function getVerifiedImages(): RegistryImage[] {
  return REGISTRY_IMAGES.filter((img) => img.verified);
}

/**
 * Filter images by architecture
 */
export function getImagesByArchitecture(
  arch: RegistryImage['architecture']
): RegistryImage[] {
  return REGISTRY_IMAGES.filter((img) => img.architecture === arch);
}

/**
 * Get images suitable for given memory constraint
 */
export function getImagesForMemory(availableMemoryMb: number): RegistryImage[] {
  return REGISTRY_IMAGES.filter((img) => img.minMemory <= availableMemoryMb);
}

/**
 * Create disk config from registry image
 */
export function createDiskFromRegistryImage(
  image: RegistryImage,
  overrides: Partial<DiskImageConfig> = {}
): DiskImageConfig {
  const now = new Date();

  return {
    id: `disk_${image.id}_${Date.now()}`,
    name: `${image.name} Disk`,
    format: 'qcow2',
    sizeBytes: Math.max(image.minDiskGb * 1024 * 1024 * 1024, image.sizeBytes * 2),
    blockSize: 65536,
    bootable: true,
    baseImageUrl: image.url,
    metadata: {
      createdAt: now,
      modifiedAt: now,
      description: `Disk created from ${image.name} ${image.version}`,
      os: image.os,
      osVersion: image.osVersion,
      architecture: image.architecture,
      tags: [...image.tags, 'from-registry'],
      checksum: image.checksum,
      checksumType: 'sha256',
    },
    ...overrides,
  };
}

/**
 * Image categories with metadata
 */
export const IMAGE_CATEGORIES: Record<
  ImageCategory,
  { name: string; description: string; icon: string }
> = {
  'os-minimal': {
    name: 'Minimal OS',
    description: 'Lightweight operating systems',
    icon: '📦',
  },
  'os-server': {
    name: 'Server OS',
    description: 'Full-featured server operating systems',
    icon: '🖥️',
  },
  'os-desktop': {
    name: 'Desktop OS',
    description: 'Desktop operating systems with GUI',
    icon: '🖥️',
  },
  'container-runtime': {
    name: 'Container Runtime',
    description: 'Docker and container platforms',
    icon: '🐳',
  },
  'networking': {
    name: 'Networking',
    description: 'Routers, firewalls, and network appliances',
    icon: '🌐',
  },
  'database': {
    name: 'Database',
    description: 'Database servers and data stores',
    icon: '🗄️',
  },
  'web-server': {
    name: 'Web Server',
    description: 'Web servers and reverse proxies',
    icon: '🌍',
  },
  'development': {
    name: 'Development',
    description: 'Development environments and tools',
    icon: '💻',
  },
  'security': {
    name: 'Security',
    description: 'Security testing and tools',
    icon: '🔒',
  },
  'custom': {
    name: 'Custom',
    description: 'User-created custom images',
    icon: '⚙️',
  },
};
