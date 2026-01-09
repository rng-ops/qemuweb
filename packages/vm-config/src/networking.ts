/**
 * Virtual Network Configuration
 *
 * Software-defined networking for browser-based virtual machines.
 * Enables VM-to-VM communication via Web Workers and virtual switches.
 */

export interface VirtualNetwork {
  /** Unique network identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Network type */
  type: 'bridge' | 'nat' | 'isolated' | 'routed';

  /** CIDR notation for the network */
  cidr: string;

  /** Gateway IP address */
  gateway?: string;

  /** DHCP configuration */
  dhcp?: DhcpConfig;

  /** DNS configuration */
  dns?: DnsConfig;

  /** Connected VM interfaces */
  interfaces: VirtualInterface[];

  /** Network metadata */
  metadata: NetworkMetadata;
}

export interface DhcpConfig {
  enabled: boolean;
  rangeStart: string;
  rangeEnd: string;
  leaseTime: number; // seconds
  reservations: DhcpReservation[];
}

export interface DhcpReservation {
  mac: string;
  ip: string;
  hostname?: string;
}

export interface DnsConfig {
  enabled: boolean;
  domain: string;
  forwarders: string[];
  records: DnsRecord[];
}

export interface DnsRecord {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'PTR' | 'MX' | 'TXT';
  value: string;
  ttl?: number;
}

export interface VirtualInterface {
  /** Unique interface identifier */
  id: string;

  /** VM this interface belongs to */
  vmId: string;

  /** MAC address */
  mac: string;

  /** Interface name in guest (e.g., eth0) */
  guestName: string;

  /** IP configuration */
  ipConfig: IpConfig;

  /** QoS settings */
  qos?: QosConfig;

  /** VLAN tag */
  vlan?: number;

  /** Whether interface is up */
  isUp: boolean;
}

export interface IpConfig {
  mode: 'dhcp' | 'static' | 'none';
  addresses?: string[]; // CIDR notation
  gateway?: string;
  dns?: string[];
  mtu?: number;
}

export interface QosConfig {
  /** Bandwidth limit in bits per second */
  bandwidthLimit?: number;

  /** Latency in milliseconds */
  latency?: number;

  /** Packet loss percentage (0-100) */
  packetLoss?: number;

  /** Jitter in milliseconds */
  jitter?: number;
}

export interface NetworkMetadata {
  createdAt: Date;
  modifiedAt: Date;
  description?: string;
  tags: string[];
}

/**
 * Virtual Switch for connecting VMs
 */
export interface VirtualSwitch {
  id: string;
  name: string;
  networkId: string;
  ports: SwitchPort[];
  macTable: Map<string, string>; // MAC -> portId
  stp: boolean; // Spanning Tree Protocol
}

export interface SwitchPort {
  id: string;
  interfaceId: string;
  vlan?: number;
  mode: 'access' | 'trunk';
  allowedVlans?: number[];
}

/**
 * Router for inter-network communication
 */
export interface VirtualRouter {
  id: string;
  name: string;
  interfaces: RouterInterface[];
  routes: Route[];
  nat?: NatConfig;
  firewall?: FirewallConfig;
}

export interface RouterInterface {
  id: string;
  networkId: string;
  ip: string;
  isGateway: boolean;
}

export interface Route {
  destination: string; // CIDR
  gateway: string;
  metric: number;
}

export interface NatConfig {
  enabled: boolean;
  rules: NatRule[];
}

export interface NatRule {
  type: 'snat' | 'dnat' | 'masquerade';
  source?: string;
  destination?: string;
  toSource?: string;
  toDestination?: string;
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number;
  toPort?: number;
}

export interface FirewallConfig {
  enabled: boolean;
  defaultPolicy: 'accept' | 'drop' | 'reject';
  rules: FirewallRule[];
}

export interface FirewallRule {
  id: string;
  name: string;
  priority: number;
  action: 'accept' | 'drop' | 'reject' | 'log';
  direction: 'inbound' | 'outbound' | 'forward';
  source?: string;
  destination?: string;
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
  sourcePort?: string;
  destinationPort?: string;
  state?: ('new' | 'established' | 'related' | 'invalid')[];
}

/**
 * Network Topology - Complete network graph
 */
export interface NetworkTopology {
  networks: VirtualNetwork[];
  switches: VirtualSwitch[];
  routers: VirtualRouter[];
  connections: TopologyConnection[];
}

export interface TopologyConnection {
  id: string;
  sourceType: 'vm' | 'switch' | 'router';
  sourceId: string;
  sourcePort: string;
  targetType: 'vm' | 'switch' | 'router';
  targetId: string;
  targetPort: string;
}

// ============ Utility Functions ============

/**
 * Generate a random MAC address
 */
export function generateMac(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  // Set locally administered bit and unicast bit
  bytes[0] = (bytes[0] | 0x02) & 0xfe;
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

/**
 * Generate a unique network ID
 */
export function generateNetworkId(): string {
  return `net_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique interface ID
 */
export function generateInterfaceId(): string {
  return `if_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse CIDR notation
 */
export function parseCidr(cidr: string): { network: string; prefix: number; mask: string } | null {
  const match = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (!match) return null;

  const [, network, prefixStr] = match;
  const prefix = parseInt(prefixStr, 10);

  if (prefix < 0 || prefix > 32) return null;

  // Validate IP
  const parts = network.split('.').map((p) => parseInt(p, 10));
  if (parts.some((p) => p < 0 || p > 255)) return null;

  // Calculate mask
  const maskNum = prefix === 0 ? 0 : ~((1 << (32 - prefix)) - 1) >>> 0;
  const mask = [
    (maskNum >>> 24) & 255,
    (maskNum >>> 16) & 255,
    (maskNum >>> 8) & 255,
    maskNum & 255,
  ].join('.');

  return { network, prefix, mask };
}

/**
 * Check if IP is in CIDR range
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed) return false;

  const ipNum = ipToNumber(ip);
  const netNum = ipToNumber(parsed.network);
  const maskNum = ipToNumber(parsed.mask);

  return (ipNum & maskNum) === (netNum & maskNum);
}

/**
 * Convert IP to number
 */
export function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert number to IP
 */
export function numberToIp(num: number): string {
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
}

/**
 * Get next available IP in CIDR
 */
export function getNextAvailableIp(cidr: string, usedIps: string[]): string | null {
  const parsed = parseCidr(cidr);
  if (!parsed) return null;

  const netNum = ipToNumber(parsed.network);
  const maskNum = ipToNumber(parsed.mask);
  const broadcastNum = (netNum | ~maskNum) >>> 0;

  const usedSet = new Set(usedIps.map(ipToNumber));

  // Skip network address and start from first usable
  for (let i = netNum + 1; i < broadcastNum; i++) {
    if (!usedSet.has(i)) {
      return numberToIp(i);
    }
  }

  return null;
}

/**
 * Create a default network configuration
 */
export function createDefaultNetwork(
  name: string,
  type: VirtualNetwork['type'] = 'nat',
  cidr: string = '10.0.0.0/24'
): VirtualNetwork {
  const now = new Date();
  const parsed = parseCidr(cidr);
  const gateway = parsed ? numberToIp(ipToNumber(parsed.network) + 1) : undefined;

  return {
    id: generateNetworkId(),
    name,
    type,
    cidr,
    gateway,
    dhcp: {
      enabled: true,
      rangeStart: parsed ? numberToIp(ipToNumber(parsed.network) + 100) : '10.0.0.100',
      rangeEnd: parsed ? numberToIp(ipToNumber(parsed.network) + 200) : '10.0.0.200',
      leaseTime: 3600,
      reservations: [],
    },
    dns: {
      enabled: true,
      domain: 'vm.local',
      forwarders: ['8.8.8.8', '8.8.4.4'],
      records: [],
    },
    interfaces: [],
    metadata: {
      createdAt: now,
      modifiedAt: now,
      tags: [],
    },
  };
}

/**
 * Create a virtual interface for a VM
 */
export function createVirtualInterface(
  vmId: string,
  _networkId: string,
  config: Partial<VirtualInterface> = {}
): VirtualInterface {
  return {
    id: generateInterfaceId(),
    vmId,
    mac: generateMac(),
    guestName: config.guestName ?? 'eth0',
    ipConfig: config.ipConfig ?? { mode: 'dhcp' },
    isUp: true,
    ...config,
  };
}

/**
 * Generate QEMU network arguments
 */
export function generateQemuNetworkArgs(
  iface: VirtualInterface,
  network: VirtualNetwork,
  index: number
): string[] {
  const args: string[] = [];

  // Network backend
  const netdevId = `net${index}`;
  if (network.type === 'nat' || network.type === 'bridge') {
    args.push('-netdev', `user,id=${netdevId}`);
  } else {
    args.push('-netdev', `socket,id=${netdevId},mcast=230.0.0.1:${1234 + index}`);
  }

  // Device frontend
  args.push(
    '-device',
    `virtio-net-pci,netdev=${netdevId},mac=${iface.mac},id=nic${index}`
  );

  return args;
}

// ============ Default Networks ============

export const DEFAULT_NETWORKS: Record<string, Partial<VirtualNetwork>> = {
  'management': {
    name: 'Management Network',
    type: 'nat',
    cidr: '10.0.0.0/24',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Default management network with NAT',
      tags: ['management', 'default'],
    },
  },
  'internal': {
    name: 'Internal Network',
    type: 'isolated',
    cidr: '192.168.100.0/24',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Isolated internal network',
      tags: ['internal', 'isolated'],
    },
  },
  'dmz': {
    name: 'DMZ Network',
    type: 'routed',
    cidr: '172.16.0.0/24',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'DMZ for public-facing services',
      tags: ['dmz', 'public'],
    },
  },
};
