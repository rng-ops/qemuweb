/**
 * Infrastructure Images
 * 
 * Pre-configured VM profiles for infrastructure services:
 * - Busybox Router (NAT/DHCP/routing)
 * - HashiCorp Vault (secrets management)
 * - Alpine Linux (lightweight base)
 */

import type { VmProfile } from './types.js';

// ============ Busybox Router Profile ============

/**
 * Busybox Router
 * 
 * Lightweight router VM using busybox for:
 * - NAT gateway for internal VMs
 * - DHCP server for IP allocation
 * - DNS forwarding
 * - Port forwarding
 * - Terraform integration via API
 */
export const busyboxRouter: VmProfile = {
  id: 'busybox-router',
  name: 'Busybox Router',
  description: 'Lightweight NAT/DHCP router for virtual network infrastructure',
  arch: 'x86_64',
  machine: 'q35',
  cpu: 'qemu64',
  memoryMiB: 64,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: [
    '-nographic',
    '-serial', 'mon:stdio',
    // Multiple network interfaces
    '-device', 'virtio-net-pci,netdev=wan,mac=52:54:00:00:00:01',
    '-netdev', 'user,id=wan,hostfwd=tcp::8765-:8765,hostfwd=tcp::8080-:80',
    '-device', 'virtio-net-pci,netdev=lan,mac=52:54:00:00:00:02',
    '-netdev', 'socket,id=lan,listen=:1234',
  ],
  requiresKernel: true,
  kernelHelpText: 'Requires busybox-based initramfs with networking tools',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'user',
    rng: true,
    serial: 'stdio',
  },
  blockSizeBytes: 4096,
  maxMemoryMiB: 128,
};

/**
 * Busybox Router Configuration
 */
export interface BusyboxRouterConfig {
  // WAN interface (external network)
  wan: {
    mode: 'dhcp' | 'static';
    ip?: string;
    gateway?: string;
    dns?: string[];
  };
  
  // LAN interface (internal network)
  lan: {
    ip: string;
    netmask: string;
    dhcp: {
      enabled: boolean;
      rangeStart: string;
      rangeEnd: string;
      leaseTime: number;
    };
  };
  
  // NAT configuration
  nat: {
    enabled: boolean;
    masquerade: boolean;
  };
  
  // Port forwarding rules
  portForwards: Array<{
    protocol: 'tcp' | 'udp';
    externalPort: number;
    internalIp: string;
    internalPort: number;
    description?: string;
  }>;
  
  // DNS settings
  dns: {
    forwarders: string[];
    localDomain: string;
    staticHosts: Array<{ hostname: string; ip: string }>;
  };
  
  // Terraform API
  terraformApi: {
    enabled: boolean;
    port: number;
    authToken?: string;
  };
}

export const DEFAULT_ROUTER_CONFIG: BusyboxRouterConfig = {
  wan: {
    mode: 'dhcp',
  },
  lan: {
    ip: '10.0.0.1',
    netmask: '255.255.255.0',
    dhcp: {
      enabled: true,
      rangeStart: '10.0.0.10',
      rangeEnd: '10.0.0.200',
      leaseTime: 86400,
    },
  },
  nat: {
    enabled: true,
    masquerade: true,
  },
  portForwards: [],
  dns: {
    forwarders: ['8.8.8.8', '8.8.4.4'],
    localDomain: 'vm.local',
    staticHosts: [
      { hostname: 'router', ip: '10.0.0.1' },
    ],
  },
  terraformApi: {
    enabled: true,
    port: 8765,
  },
};

/**
 * Generate busybox router init script
 */
export function generateRouterInitScript(config: BusyboxRouterConfig): string {
  return `#!/bin/sh
# QemuWeb Busybox Router Init Script
set -e

echo "Starting QemuWeb Router..."

# Configure WAN interface
${config.wan.mode === 'dhcp' ? `
udhcpc -i eth0 -s /etc/udhcpc.script
` : `
ip addr add ${config.wan.ip}/24 dev eth0
ip route add default via ${config.wan.gateway}
`}

# Configure LAN interface
ip addr add ${config.lan.ip}/${config.lan.netmask === '255.255.255.0' ? '24' : '16'} dev eth1
ip link set eth1 up

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

${config.nat.enabled ? `
# Configure NAT
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -i eth1 -o eth0 -j ACCEPT
iptables -A FORWARD -i eth0 -o eth1 -m state --state RELATED,ESTABLISHED -j ACCEPT
` : ''}

${config.portForwards.map(pf => `
# Port forward: ${pf.description || `${pf.externalPort} -> ${pf.internalIp}:${pf.internalPort}`}
iptables -t nat -A PREROUTING -i eth0 -p ${pf.protocol} --dport ${pf.externalPort} -j DNAT --to-destination ${pf.internalIp}:${pf.internalPort}
`).join('')}

${config.lan.dhcp.enabled ? `
# Start DHCP server
cat > /tmp/udhcpd.conf << EOF
start ${config.lan.dhcp.rangeStart}
end ${config.lan.dhcp.rangeEnd}
interface eth1
lease_file /tmp/udhcpd.leases
opt dns ${config.dns.forwarders.join(' ')}
opt router ${config.lan.ip}
opt domain ${config.dns.localDomain}
EOF
udhcpd /tmp/udhcpd.conf
` : ''}

# Start DNS forwarder
cat > /tmp/dnsmasq.conf << EOF
port=53
interface=eth1
no-resolv
${config.dns.forwarders.map(f => `server=${f}`).join('\n')}
${config.dns.staticHosts.map(h => `address=/${h.hostname}.${config.dns.localDomain}/${h.ip}`).join('\n')}
EOF
dnsmasq -C /tmp/dnsmasq.conf

${config.terraformApi.enabled ? `
# Start Terraform API server
httpd -p ${config.terraformApi.port} -h /var/www/terraform
` : ''}

echo "Router ready."

# Keep running
exec /bin/sh
`;
}

// ============ HashiCorp Vault Profile ============

/**
 * HashiCorp Vault
 * 
 * Secrets management VM based on Vault Docker image.
 * Provides:
 * - Secure secrets storage
 * - Dynamic credentials
 * - PKI/certificate management
 * - SSH secrets engine
 */
export const hashicorpVault: VmProfile = {
  id: 'hashicorp-vault',
  name: 'HashiCorp Vault',
  description: 'Secrets management and PKI for virtual infrastructure',
  arch: 'x86_64',
  machine: 'q35',
  cpu: 'qemu64',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: [
    '-nographic',
    '-serial', 'mon:stdio',
    '-device', 'virtio-net-pci,netdev=net0,mac=52:54:00:00:01:01',
    '-netdev', 'user,id=net0,hostfwd=tcp::8200-:8200,hostfwd=tcp::8201-:8201',
  ],
  requiresKernel: false,
  kernelHelpText: 'Uses Alpine-based qcow2 with Vault pre-installed',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'user',
    rng: true,
    serial: 'stdio',
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 1024,
};

/**
 * Vault Configuration
 */
export interface VaultConfig {
  // Listener configuration
  listener: {
    address: string;
    port: number;
    tlsDisable: boolean;
    tlsCertFile?: string;
    tlsKeyFile?: string;
  };
  
  // Storage backend
  storage: {
    type: 'file' | 'raft' | 'inmem';
    path?: string;
    nodeId?: string;
  };
  
  // Cluster configuration
  cluster: {
    address?: string;
    port?: number;
  };
  
  // API address
  apiAddr: string;
  
  // UI
  ui: boolean;
  
  // Development mode (for testing)
  devMode: boolean;
  devRootToken?: string;
  
  // Secrets engines to enable
  secretsEngines: Array<{
    path: string;
    type: 'kv' | 'pki' | 'ssh' | 'database' | 'transit';
    config?: Record<string, unknown>;
  }>;
  
  // Auth methods to enable
  authMethods: Array<{
    path: string;
    type: 'token' | 'userpass' | 'approle' | 'kubernetes';
    config?: Record<string, unknown>;
  }>;
}

export const DEFAULT_VAULT_CONFIG: VaultConfig = {
  listener: {
    address: '0.0.0.0',
    port: 8200,
    tlsDisable: true,
  },
  storage: {
    type: 'file',
    path: '/vault/data',
  },
  cluster: {
    address: '127.0.0.1',
    port: 8201,
  },
  apiAddr: 'http://127.0.0.1:8200',
  ui: true,
  devMode: false,
  secretsEngines: [
    { path: 'secret', type: 'kv', config: { version: 2 } },
    { path: 'pki', type: 'pki' },
  ],
  authMethods: [
    { path: 'approle', type: 'approle' },
  ],
};

/**
 * Generate Vault configuration file
 */
export function generateVaultConfig(config: VaultConfig): string {
  return `
# QemuWeb Vault Configuration

ui = ${config.ui}
disable_mlock = true

listener "tcp" {
  address = "${config.listener.address}:${config.listener.port}"
  tls_disable = ${config.listener.tlsDisable ? 1 : 0}
  ${!config.listener.tlsDisable && config.listener.tlsCertFile ? `
  tls_cert_file = "${config.listener.tlsCertFile}"
  tls_key_file = "${config.listener.tlsKeyFile}"
  ` : ''}
}

storage "${config.storage.type}" {
  ${config.storage.type === 'file' ? `path = "${config.storage.path}"` : ''}
  ${config.storage.type === 'raft' ? `
  path = "${config.storage.path}"
  node_id = "${config.storage.nodeId || 'node1'}"
  ` : ''}
}

api_addr = "${config.apiAddr}"

${config.cluster.address ? `
cluster_addr = "https://${config.cluster.address}:${config.cluster.port || 8201}"
` : ''}
`;
}

/**
 * Generate Vault initialization script
 */
export function generateVaultInitScript(config: VaultConfig): string {
  return `#!/bin/sh
# QemuWeb Vault Init Script
set -e

echo "Starting HashiCorp Vault..."

# Create data directory
mkdir -p /vault/data
chown vault:vault /vault/data

# Write configuration
cat > /vault/config/vault.hcl << 'EOF'
${generateVaultConfig(config)}
EOF

${config.devMode ? `
# Start in dev mode
vault server -dev -dev-root-token-id="${config.devRootToken || 'root'}" &
` : `
# Start Vault server
vault server -config=/vault/config/vault.hcl &
`}

sleep 2

# Wait for Vault to be ready
until vault status 2>&1 | grep -q "Sealed.*false\\|Mode.*dev"; do
  echo "Waiting for Vault..."
  sleep 1
done

export VAULT_ADDR="${config.apiAddr}"
${config.devMode ? `export VAULT_TOKEN="${config.devRootToken || 'root'}"` : ''}

# Enable secrets engines
${config.secretsEngines.map(engine => `
echo "Enabling ${engine.type} secrets engine at ${engine.path}..."
vault secrets enable -path="${engine.path}" ${engine.type} || true
`).join('')}

# Enable auth methods
${config.authMethods.map(auth => `
echo "Enabling ${auth.type} auth method at ${auth.path}..."
vault auth enable -path="${auth.path}" ${auth.type} || true
`).join('')}

echo "Vault ready at ${config.apiAddr}"

# Keep running
wait
`;
}

// ============ Alpine Linux Base Profile ============

/**
 * Alpine Linux
 * 
 * Lightweight base VM for running containers and services.
 */
export const alpineLinux: VmProfile = {
  id: 'alpine-linux',
  name: 'Alpine Linux',
  description: 'Lightweight Linux base for containers and services',
  arch: 'x86_64',
  machine: 'q35',
  cpu: 'qemu64',
  memoryMiB: 256,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: [
    '-nographic',
    '-serial', 'mon:stdio',
    '-device', 'virtio-net-pci,netdev=net0',
    '-netdev', 'user,id=net0,hostfwd=tcp::2222-:22',
  ],
  requiresKernel: false,
  devices: {
    diskInterface: 'virtio-blk',
    net: 'user',
    rng: true,
    serial: 'stdio',
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 2048,
};

// ============ QCOW2 Generation ============

export interface Qcow2GenerationConfig {
  sourceType: 'docker' | 'url' | 'file';
  source: string;
  outputPath: string;
  diskSizeGB: number;
  format: 'qcow2' | 'raw';
  
  // For Docker sources
  dockerConfig?: {
    platform: string;
    extractLayers: boolean;
    entrypoint?: string[];
    cmd?: string[];
  };
  
  // Post-install scripts
  postInstall?: string[];
  
  // Additional files to include
  additionalFiles?: Array<{
    source: string;
    destination: string;
    mode?: string;
  }>;
}

/**
 * Generate qcow2 creation script from Docker image
 */
export function generateQcow2FromDockerScript(config: Qcow2GenerationConfig): string {
  if (config.sourceType !== 'docker') {
    throw new Error('This function only handles Docker sources');
  }

  return `#!/bin/bash
# QemuWeb QCOW2 Generator
# Converts Docker image to QCOW2 disk image
set -e

SOURCE_IMAGE="${config.source}"
OUTPUT_PATH="${config.outputPath}"
DISK_SIZE="${config.diskSizeGB}G"
PLATFORM="${config.dockerConfig?.platform || 'linux/amd64'}"

echo "Creating QCOW2 from Docker image: $SOURCE_IMAGE"

# Create temporary directory
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Pull and export Docker image
echo "Pulling Docker image..."
docker pull --platform=$PLATFORM $SOURCE_IMAGE

echo "Creating container and exporting filesystem..."
CONTAINER_ID=$(docker create --platform=$PLATFORM $SOURCE_IMAGE)
docker export $CONTAINER_ID > $TMPDIR/rootfs.tar
docker rm $CONTAINER_ID

# Create raw disk image
echo "Creating disk image..."
qemu-img create -f raw $TMPDIR/disk.raw $DISK_SIZE

# Create partition and filesystem
echo "Creating partition..."
parted $TMPDIR/disk.raw --script mklabel gpt
parted $TMPDIR/disk.raw --script mkpart primary ext4 1MiB 100%

# Set up loop device
LOOP_DEV=$(losetup --find --show --partscan $TMPDIR/disk.raw)
PART_DEV="\${LOOP_DEV}p1"

# Format filesystem
mkfs.ext4 -L root $PART_DEV

# Mount and extract
mkdir -p $TMPDIR/mnt
mount $PART_DEV $TMPDIR/mnt

echo "Extracting rootfs..."
tar -xf $TMPDIR/rootfs.tar -C $TMPDIR/mnt

# Install bootloader and kernel (for Alpine/busybox)
echo "Installing boot components..."
mkdir -p $TMPDIR/mnt/boot/grub
cat > $TMPDIR/mnt/boot/grub/grub.cfg << 'GRUBEOF'
set default=0
set timeout=1

menuentry "Linux" {
  linux /boot/vmlinuz root=/dev/vda1 console=ttyS0
  initrd /boot/initramfs
}
GRUBEOF

${config.postInstall?.map(script => `
# Post-install script
chroot $TMPDIR/mnt /bin/sh -c '${script}'
`).join('\n') || ''}

${config.additionalFiles?.map(file => `
# Add file: ${file.destination}
cp "${file.source}" "$TMPDIR/mnt${file.destination}"
${file.mode ? `chmod ${file.mode} "$TMPDIR/mnt${file.destination}"` : ''}
`).join('\n') || ''}

# Cleanup
sync
umount $TMPDIR/mnt
losetup -d $LOOP_DEV

# Convert to QCOW2
echo "Converting to QCOW2..."
qemu-img convert -f raw -O qcow2 -c $TMPDIR/disk.raw "$OUTPUT_PATH"

echo "Done: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"
`;
}

// ============ All Infrastructure Profiles ============

export const infrastructureProfiles: VmProfile[] = [
  busyboxRouter,
  hashicorpVault,
  alpineLinux,
];

/**
 * Get infrastructure profile by ID
 */
export function getInfrastructureProfile(id: string): VmProfile | undefined {
  return infrastructureProfiles.find(p => p.id === id);
}
