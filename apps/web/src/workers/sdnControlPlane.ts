/**
 * SDN Control Plane Web Worker
 *
 * Software-defined networking control plane that manages virtual network
 * devices, links, routing, and policies across multiple VM instances.
 *
 * This worker acts as the central controller for:
 * - Virtual switches and routers
 * - Network topology management
 * - Traffic routing and QoS
 * - Firewall rules and policies
 * - Inter-VM communication via message passing
 */

/// <reference lib="webworker" />

import type {
  VirtualNetwork,
  VirtualSwitch,
  VirtualRouter,
  NetworkTopology,
  TopologyConnection,
  Route,
  FirewallRule,
  QosConfig,
} from '@qemuweb/vm-config';

// ============ Types ============

export interface SDNNode {
  id: string;
  type: 'vm' | 'router' | 'switch' | 'external';
  name: string;
  status: 'online' | 'offline' | 'starting' | 'stopping';
  position: { x: number; y: number };
  interfaces: NodeInterface[];
  metadata: Record<string, unknown>;
}

export interface NodeInterface {
  id: string;
  name: string;
  mac: string;
  ip?: string;
  networkId?: string;
  linkId?: string;
  isUp: boolean;
}

export interface SDNLink {
  id: string;
  sourceNodeId: string;
  sourceInterfaceId: string;
  targetNodeId: string;
  targetInterfaceId: string;
  networkId?: string;
  qos?: QosConfig;
  status: 'up' | 'down' | 'degraded';
  stats: LinkStats;
}

export interface LinkStats {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  errorsIn: number;
  errorsOut: number;
  latencyMs: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: FirewallRule[];
  enabled: boolean;
  appliedTo: string[]; // Node IDs
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'user' | 'agent' | 'system';
  suggestion?: PolicySuggestion;
}

export interface PolicySuggestion {
  reason: string;
  confidence: number;
  basedOn: string[]; // Evidence/context
  impact: 'low' | 'medium' | 'high';
}

export interface SDNState {
  nodes: Map<string, SDNNode>;
  links: Map<string, SDNLink>;
  networks: Map<string, VirtualNetwork>;
  routers: Map<string, VirtualRouter>;
  switches: Map<string, VirtualSwitch>;
  policies: Map<string, SecurityPolicy>;
  routingTable: Route[];
  openFiles: OpenFile[];
  selectedNodeId: string | null;
  selectedLinkId: string | null;
}

export interface OpenFile {
  id: string;
  path: string;
  nodeId: string;
  type: 'config' | 'log' | 'data' | 'script' | 'other';
  lastModified: Date;
}

// ============ Commands ============

export type SDNCommand =
  | { type: 'init' }
  | { type: 'get_state' }
  | { type: 'add_node'; node: Omit<SDNNode, 'id'> }
  | { type: 'remove_node'; nodeId: string }
  | { type: 'update_node'; nodeId: string; updates: Partial<SDNNode> }
  | { type: 'add_link'; link: Omit<SDNLink, 'id' | 'stats'> }
  | { type: 'remove_link'; linkId: string }
  | { type: 'update_link'; linkId: string; updates: Partial<SDNLink> }
  | { type: 'add_network'; network: Omit<VirtualNetwork, 'id'> }
  | { type: 'remove_network'; networkId: string }
  | { type: 'add_route'; route: Route }
  | { type: 'remove_route'; destination: string }
  | { type: 'add_policy'; policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'remove_policy'; policyId: string }
  | { type: 'apply_policy'; policyId: string; nodeIds: string[] }
  | { type: 'suggest_policies'; context: PolicyContext }
  | { type: 'set_open_files'; files: OpenFile[] }
  | { type: 'select_node'; nodeId: string | null }
  | { type: 'select_link'; linkId: string | null }
  | { type: 'get_topology' }
  | { type: 'get_terraform'; nodeId?: string }
  | { type: 'packet'; from: string; to: string; data: ArrayBuffer };

export interface PolicyContext {
  openFiles: OpenFile[];
  recentTraffic: TrafficPattern[];
  currentPolicies: string[];
  nodeStatuses: Map<string, string>;
}

export interface TrafficPattern {
  sourceIp: string;
  destIp: string;
  protocol: string;
  port: number;
  bytesTotal: number;
  packetsTotal: number;
  flags?: string[];
}

export type SDNResponse =
  | { type: 'state'; state: SerializedSDNState }
  | { type: 'topology'; topology: NetworkTopology }
  | { type: 'terraform'; config: string; nodeId?: string }
  | { type: 'policy_suggestions'; suggestions: SecurityPolicy[] }
  | { type: 'error'; message: string }
  | { type: 'ok'; id?: string }
  | { type: 'node_added'; node: SDNNode }
  | { type: 'node_removed'; nodeId: string }
  | { type: 'link_added'; link: SDNLink }
  | { type: 'link_removed'; linkId: string }
  | { type: 'policy_applied'; policyId: string; nodeIds: string[] };

// Serializable version of state for transfer
export interface SerializedSDNState {
  nodes: SDNNode[];
  links: SDNLink[];
  networks: VirtualNetwork[];
  routers: VirtualRouter[];
  switches: VirtualSwitch[];
  policies: SecurityPolicy[];
  routingTable: Route[];
  openFiles: OpenFile[];
  selectedNodeId: string | null;
  selectedLinkId: string | null;
}

// ============ State Management ============

const state: SDNState = {
  nodes: new Map(),
  links: new Map(),
  networks: new Map(),
  routers: new Map(),
  switches: new Map(),
  policies: new Map(),
  routingTable: [],
  openFiles: [],
  selectedNodeId: null,
  selectedLinkId: null,
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function serializeState(): SerializedSDNState {
  return {
    nodes: Array.from(state.nodes.values()),
    links: Array.from(state.links.values()),
    networks: Array.from(state.networks.values()),
    routers: Array.from(state.routers.values()),
    switches: Array.from(state.switches.values()),
    policies: Array.from(state.policies.values()),
    routingTable: [...state.routingTable],
    openFiles: [...state.openFiles],
    selectedNodeId: state.selectedNodeId,
    selectedLinkId: state.selectedLinkId,
  };
}

// ============ Command Handlers ============

function handleInit(): SDNResponse {
  // Initialize with a default router node (BusyBox gateway)
  const routerNode: SDNNode = {
    id: 'router-gateway',
    type: 'router',
    name: 'BusyBox Gateway',
    status: 'online',
    position: { x: 400, y: 300 },
    interfaces: [
      {
        id: 'eth0',
        name: 'eth0 (WAN)',
        mac: generateMac(),
        ip: '10.0.0.1',
        isUp: true,
      },
      {
        id: 'eth1',
        name: 'eth1 (LAN)',
        mac: generateMac(),
        ip: '192.168.1.1',
        networkId: 'lan-default',
        isUp: true,
      },
    ],
    metadata: {
      isGateway: true,
      mcpEndpoint: 'http://localhost:80/mcp',
    },
  };

  state.nodes.set(routerNode.id, routerNode);

  // Default LAN network
  const lanNetwork: VirtualNetwork = {
    id: 'lan-default',
    name: 'Default LAN',
    type: 'nat',
    cidr: '192.168.1.0/24',
    gateway: '192.168.1.1',
    dhcp: {
      enabled: true,
      rangeStart: '192.168.1.100',
      rangeEnd: '192.168.1.200',
      leaseTime: 3600,
      reservations: [],
    },
    dns: {
      enabled: true,
      domain: 'vm.local',
      forwarders: ['8.8.8.8'],
      records: [],
    },
    interfaces: [],
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['default', 'lan'],
    },
  };

  state.networks.set(lanNetwork.id, lanNetwork);

  // Default security policy
  const defaultPolicy: SecurityPolicy = {
    id: 'policy-default',
    name: 'Default Security Policy',
    description: 'Allow established connections, block unsolicited inbound',
    rules: [
      {
        id: 'rule-allow-established',
        name: 'Allow Established',
        priority: 100,
        action: 'accept',
        direction: 'inbound',
        state: ['established', 'related'],
      },
      {
        id: 'rule-allow-ssh',
        name: 'Allow SSH',
        priority: 200,
        action: 'accept',
        direction: 'inbound',
        protocol: 'tcp',
        destinationPort: '22',
      },
      {
        id: 'rule-allow-icmp',
        name: 'Allow ICMP',
        priority: 300,
        action: 'accept',
        direction: 'inbound',
        protocol: 'icmp',
      },
      {
        id: 'rule-drop-default',
        name: 'Drop Default',
        priority: 1000,
        action: 'drop',
        direction: 'inbound',
      },
    ],
    enabled: true,
    appliedTo: ['router-gateway'],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  };

  state.policies.set(defaultPolicy.id, defaultPolicy);

  return { type: 'state', state: serializeState() };
}

function handleAddNode(node: Omit<SDNNode, 'id'>): SDNResponse {
  const id = generateId('node');
  const newNode: SDNNode = { ...node, id };

  // Auto-assign position if not specified
  if (!newNode.position.x && !newNode.position.y) {
    const nodeCount = state.nodes.size;
    newNode.position = {
      x: 200 + (nodeCount % 4) * 200,
      y: 100 + Math.floor(nodeCount / 4) * 150,
    };
  }

  // Generate MACs for interfaces without them
  newNode.interfaces = newNode.interfaces.map((iface) => ({
    ...iface,
    mac: iface.mac || generateMac(),
  }));

  state.nodes.set(id, newNode);

  return { type: 'node_added', node: newNode };
}

function handleRemoveNode(nodeId: string): SDNResponse {
  if (!state.nodes.has(nodeId)) {
    return { type: 'error', message: `Node ${nodeId} not found` };
  }

  // Remove all links connected to this node
  for (const [linkId, link] of state.links) {
    if (link.sourceNodeId === nodeId || link.targetNodeId === nodeId) {
      state.links.delete(linkId);
    }
  }

  state.nodes.delete(nodeId);

  if (state.selectedNodeId === nodeId) {
    state.selectedNodeId = null;
  }

  return { type: 'node_removed', nodeId };
}

function handleAddLink(link: Omit<SDNLink, 'id' | 'stats'>): SDNResponse {
  const sourceNode = state.nodes.get(link.sourceNodeId);
  const targetNode = state.nodes.get(link.targetNodeId);

  if (!sourceNode) {
    return { type: 'error', message: `Source node ${link.sourceNodeId} not found` };
  }
  if (!targetNode) {
    return { type: 'error', message: `Target node ${link.targetNodeId} not found` };
  }

  const id = generateId('link');
  const newLink: SDNLink = {
    ...link,
    id,
    status: 'up',
    stats: {
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0,
      errorsIn: 0,
      errorsOut: 0,
      latencyMs: link.qos?.latency || 1,
    },
  };

  state.links.set(id, newLink);

  // Update interface linkId references
  const sourceIface = sourceNode.interfaces.find((i) => i.id === link.sourceInterfaceId);
  const targetIface = targetNode.interfaces.find((i) => i.id === link.targetInterfaceId);

  if (sourceIface) sourceIface.linkId = id;
  if (targetIface) targetIface.linkId = id;

  return { type: 'link_added', link: newLink };
}

function handleRemoveLink(linkId: string): SDNResponse {
  if (!state.links.has(linkId)) {
    return { type: 'error', message: `Link ${linkId} not found` };
  }

  state.links.delete(linkId);

  if (state.selectedLinkId === linkId) {
    state.selectedLinkId = null;
  }

  return { type: 'link_removed', linkId };
}

function handleAddNetwork(network: Omit<VirtualNetwork, 'id'>): SDNResponse {
  const id = generateId('net');
  const newNetwork: VirtualNetwork = {
    ...network,
    id,
    metadata: {
      ...network.metadata,
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
  };

  state.networks.set(id, newNetwork);

  return { type: 'ok', id };
}

function handleAddRoute(route: Route): SDNResponse {
  // Check for existing route to same destination
  const existingIndex = state.routingTable.findIndex((r) => r.destination === route.destination);
  if (existingIndex >= 0) {
    state.routingTable[existingIndex] = route;
  } else {
    state.routingTable.push(route);
  }

  // Sort by metric
  state.routingTable.sort((a, b) => a.metric - b.metric);

  return { type: 'ok' };
}

function handleRemoveRoute(destination: string): SDNResponse {
  const index = state.routingTable.findIndex((r) => r.destination === destination);
  if (index >= 0) {
    state.routingTable.splice(index, 1);
    return { type: 'ok' };
  }
  return { type: 'error', message: `Route to ${destination} not found` };
}

function handleAddPolicy(policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>): SDNResponse {
  const id = generateId('policy');
  const now = new Date();
  const newPolicy: SecurityPolicy = {
    ...policy,
    id,
    createdAt: now,
    updatedAt: now,
  };

  state.policies.set(id, newPolicy);

  return { type: 'ok', id };
}

function handleApplyPolicy(policyId: string, nodeIds: string[]): SDNResponse {
  const policy = state.policies.get(policyId);
  if (!policy) {
    return { type: 'error', message: `Policy ${policyId} not found` };
  }

  policy.appliedTo = [...new Set([...policy.appliedTo, ...nodeIds])];
  policy.updatedAt = new Date();

  return { type: 'policy_applied', policyId, nodeIds };
}

function handleSuggestPolicies(context: PolicyContext): SDNResponse {
  const suggestions: SecurityPolicy[] = [];

  // Analyze open files for security implications
  const configFiles = context.openFiles.filter((f) => f.type === 'config');
  const hasSSHConfig = configFiles.some((f) => f.path.includes('ssh'));
  const hasFirewallConfig = configFiles.some((f) => 
    f.path.includes('iptables') || f.path.includes('firewall') || f.path.includes('nftables')
  );

  // Suggest SSH hardening if SSH config is open
  if (hasSSHConfig) {
    suggestions.push({
      id: generateId('suggestion'),
      name: 'SSH Hardening Policy',
      description: 'Restrict SSH access to specific IPs and disable password auth',
      rules: [
        {
          id: 'ssh-restrict',
          name: 'Restrict SSH Sources',
          priority: 150,
          action: 'accept',
          direction: 'inbound',
          protocol: 'tcp',
          destinationPort: '22',
          source: '192.168.1.0/24', // Only from LAN
        },
        {
          id: 'ssh-block-external',
          name: 'Block External SSH',
          priority: 151,
          action: 'drop',
          direction: 'inbound',
          protocol: 'tcp',
          destinationPort: '22',
        },
      ],
      enabled: false,
      appliedTo: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'agent',
      suggestion: {
        reason: 'SSH configuration file is open - consider hardening access',
        confidence: 0.85,
        basedOn: configFiles.map((f) => f.path),
        impact: 'medium',
      },
    });
  }

  // Suggest firewall review if firewall config is open
  if (hasFirewallConfig) {
    suggestions.push({
      id: generateId('suggestion'),
      name: 'Firewall Audit Policy',
      description: 'Enable logging for dropped packets to audit firewall rules',
      rules: [
        {
          id: 'log-drops',
          name: 'Log Dropped Packets',
          priority: 999,
          action: 'log',
          direction: 'inbound',
        },
      ],
      enabled: false,
      appliedTo: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'agent',
      suggestion: {
        reason: 'Firewall configuration is open - enable logging for audit',
        confidence: 0.75,
        basedOn: configFiles.map((f) => f.path),
        impact: 'low',
      },
    });
  }

  // Analyze traffic patterns for anomalies
  for (const pattern of context.recentTraffic) {
    // Suggest blocking high-frequency traffic to unusual ports
    if (pattern.packetsTotal > 1000 && ![22, 80, 443, 53].includes(pattern.port)) {
      suggestions.push({
        id: generateId('suggestion'),
        name: `Rate Limit Port ${pattern.port}`,
        description: `High traffic detected on port ${pattern.port} - consider rate limiting`,
        rules: [
          {
            id: `rate-limit-${pattern.port}`,
            name: `Rate Limit ${pattern.port}`,
            priority: 500,
            action: 'drop',
            direction: 'inbound',
            protocol: pattern.protocol as 'tcp' | 'udp',
            destinationPort: String(pattern.port),
            // Note: actual rate limiting would be more complex
          },
        ],
        enabled: false,
        appliedTo: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'agent',
        suggestion: {
          reason: `Unusual traffic volume (${pattern.packetsTotal} packets) on port ${pattern.port}`,
          confidence: 0.6,
          basedOn: [`Traffic from ${pattern.sourceIp} to ${pattern.destIp}`],
          impact: 'high',
        },
      });
    }
  }

  return { type: 'policy_suggestions', suggestions };
}

function handleGetTopology(): SDNResponse {
  const topology: NetworkTopology = {
    networks: Array.from(state.networks.values()),
    switches: Array.from(state.switches.values()),
    routers: Array.from(state.routers.values()),
    connections: Array.from(state.links.values()).map((link) => ({
      id: link.id,
      sourceType: state.nodes.get(link.sourceNodeId)?.type || 'vm',
      sourceId: link.sourceNodeId,
      sourcePort: link.sourceInterfaceId,
      targetType: state.nodes.get(link.targetNodeId)?.type || 'vm',
      targetId: link.targetNodeId,
      targetPort: link.targetInterfaceId,
    })) as TopologyConnection[],
  };

  return { type: 'topology', topology };
}

function handleGetTerraform(nodeId?: string): SDNResponse {
  const nodes = nodeId
    ? [state.nodes.get(nodeId)].filter(Boolean)
    : Array.from(state.nodes.values());

  const tfConfig = {
    terraform: {
      required_providers: {
        local: { source: 'hashicorp/local', version: '~> 2.4' },
        null: { source: 'hashicorp/null', version: '~> 3.2' },
      },
    },
    variable: {
      network_cidr: {
        type: 'string',
        default: '192.168.1.0/24',
        description: 'Network CIDR for virtual machines',
      },
    },
    locals: {
      nodes: Object.fromEntries(
        nodes.map((n) => [
          n!.id,
          {
            name: n!.name,
            type: n!.type,
            interfaces: n!.interfaces.map((i) => ({
              name: i.name,
              ip: i.ip,
              mac: i.mac,
            })),
          },
        ])
      ),
      networks: Object.fromEntries(
        Array.from(state.networks.values()).map((net) => [
          net.id,
          {
            name: net.name,
            cidr: net.cidr,
            gateway: net.gateway,
          },
        ])
      ),
      links: Array.from(state.links.values()).map((link) => ({
        source: link.sourceNodeId,
        target: link.targetNodeId,
        network: link.networkId,
      })),
    },
    resource: {
      null_resource: Object.fromEntries(
        nodes.map((n) => [
          n!.id.replace(/-/g, '_'),
          {
            triggers: {
              node_id: n!.id,
              node_type: n!.type,
              interfaces: JSON.stringify(n!.interfaces),
            },
          },
        ])
      ),
    },
    output: {
      topology: {
        value: {
          nodes: '${local.nodes}',
          networks: '${local.networks}',
          links: '${local.links}',
        },
        description: 'Network topology configuration',
      },
    },
  };

  return { type: 'terraform', config: JSON.stringify(tfConfig, null, 2), nodeId };
}

// ============ Utilities ============

function generateMac(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  bytes[0] = (bytes[0] | 0x02) & 0xfe;
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

// ============ Message Handler ============

console.log('[SDN Worker] Setting up message handler');

self.onmessage = (event: MessageEvent<SDNCommand>) => {
  const command = event.data;
  console.log('[SDN Worker] Received command:', command.type);
  let response: SDNResponse;

  try {
    switch (command.type) {
      case 'init':
        console.log('[SDN Worker] Handling init');
        response = handleInit();
        console.log('[SDN Worker] Init response:', response);
        break;
      case 'get_state':
        response = { type: 'state', state: serializeState() };
        break;
      case 'add_node':
        response = handleAddNode(command.node);
        break;
      case 'remove_node':
        response = handleRemoveNode(command.nodeId);
        break;
      case 'update_node':
        const nodeToUpdate = state.nodes.get(command.nodeId);
        if (nodeToUpdate) {
          Object.assign(nodeToUpdate, command.updates);
          response = { type: 'ok' };
        } else {
          response = { type: 'error', message: `Node ${command.nodeId} not found` };
        }
        break;
      case 'add_link':
        response = handleAddLink(command.link);
        break;
      case 'remove_link':
        response = handleRemoveLink(command.linkId);
        break;
      case 'update_link':
        const linkToUpdate = state.links.get(command.linkId);
        if (linkToUpdate) {
          Object.assign(linkToUpdate, command.updates);
          response = { type: 'ok' };
        } else {
          response = { type: 'error', message: `Link ${command.linkId} not found` };
        }
        break;
      case 'add_network':
        response = handleAddNetwork(command.network);
        break;
      case 'remove_network':
        if (state.networks.has(command.networkId)) {
          state.networks.delete(command.networkId);
          response = { type: 'ok' };
        } else {
          response = { type: 'error', message: `Network ${command.networkId} not found` };
        }
        break;
      case 'add_route':
        response = handleAddRoute(command.route);
        break;
      case 'remove_route':
        response = handleRemoveRoute(command.destination);
        break;
      case 'add_policy':
        response = handleAddPolicy(command.policy);
        break;
      case 'remove_policy':
        if (state.policies.has(command.policyId)) {
          state.policies.delete(command.policyId);
          response = { type: 'ok' };
        } else {
          response = { type: 'error', message: `Policy ${command.policyId} not found` };
        }
        break;
      case 'apply_policy':
        response = handleApplyPolicy(command.policyId, command.nodeIds);
        break;
      case 'suggest_policies':
        response = handleSuggestPolicies(command.context);
        break;
      case 'set_open_files':
        state.openFiles = command.files;
        response = { type: 'ok' };
        break;
      case 'select_node':
        state.selectedNodeId = command.nodeId;
        state.selectedLinkId = null;
        response = { type: 'state', state: serializeState() };
        break;
      case 'select_link':
        state.selectedLinkId = command.linkId;
        state.selectedNodeId = null;
        response = { type: 'state', state: serializeState() };
        break;
      case 'get_topology':
        response = handleGetTopology();
        break;
      case 'get_terraform':
        response = handleGetTerraform(command.nodeId);
        break;
      case 'packet':
        // Handle virtual packet routing - for now just acknowledge
        response = { type: 'ok' };
        break;
      default:
        response = { type: 'error', message: `Unknown command: ${(command as any).type}` };
    }
  } catch (error) {
    console.error('[SDN Worker] Error handling command:', error);
    response = { type: 'error', message: error instanceof Error ? error.message : String(error) };
  }

  console.log('[SDN Worker] Sending response:', response);
  self.postMessage(response);
};

// Initialize on load
console.log('[SDN Worker] Worker loaded, sending ready message');
self.postMessage({ type: 'ok', id: 'worker-ready' });
