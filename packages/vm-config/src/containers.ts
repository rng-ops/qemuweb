/**
 * Container Definitions
 *
 * Pre-configured container images for QemuWeb with metadata,
 * MCP server support, and Terraform integration.
 */

/**
 * Container status
 */
export type ContainerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'
  | 'paused';

/**
 * SSH connection configuration
 */
export interface SSHConfig {
  /** Port for SSH (usually 22 inside container) */
  port: number;
  /** Default username */
  username: string;
  /** Authentication method */
  authMethod: 'password' | 'key' | 'none';
  /** Default password (for demo containers) */
  defaultPassword?: string;
}

/**
 * MCP Server capability definition
 */
export interface MCPServerCapability {
  /** Unique capability ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this capability does */
  description: string;
  /** Category (tools, resources, prompts) */
  category: 'tools' | 'resources' | 'prompts';
  /** Required parameters */
  parameters?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
    default?: unknown;
  }>;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Transport type */
  transport: 'stdio' | 'http' | 'websocket';
  /** Endpoint (for http/websocket) */
  endpoint?: string;
  /** Command to start (for stdio) */
  command?: string;
  /** Server capabilities */
  capabilities: MCPServerCapability[];
  /** Whether server is enabled */
  enabled: boolean;
  /** Auto-start with container */
  autoStart: boolean;
}

/**
 * Terraform metadata from builds
 */
export interface TerraformMetadata {
  /** Provider configurations */
  providers: Array<{
    name: string;
    source: string;
    version: string;
  }>;
  /** Resources defined */
  resources: Array<{
    type: string;
    name: string;
    attributes: Record<string, unknown>;
  }>;
  /** Variables */
  variables: Array<{
    name: string;
    type: string;
    default?: unknown;
    description?: string;
  }>;
  /** Outputs */
  outputs: Array<{
    name: string;
    value: string;
    description?: string;
  }>;
  /** Content hash of the plan */
  planHash?: string;
  /** Last applied timestamp */
  lastApplied?: Date;
}

/**
 * Container exposed ports
 */
export interface PortMapping {
  /** Container port */
  containerPort: number;
  /** Host port (mapped) */
  hostPort: number;
  /** Protocol */
  protocol: 'tcp' | 'udp';
  /** Service description */
  service?: string;
}

/**
 * Container volume mount
 */
export interface VolumeMount {
  /** Host path or volume name */
  source: string;
  /** Container mount path */
  target: string;
  /** Read-only flag */
  readonly?: boolean;
}

/**
 * Container image definition
 */
export interface ContainerImage {
  /** Unique image ID */
  id: string;
  /** Image name */
  name: string;
  /** Image version/tag */
  version: string;
  /** Description */
  description: string;
  /** Image type */
  type: 'base' | 'hypervisor' | 'agent' | 'custom';
  /** Architecture */
  arch: 'x86_64' | 'aarch64';
  /** Base VM profile to use */
  profileId: string;
  /** Memory requirement in MiB */
  memoryMiB: number;
  /** SSH configuration */
  ssh: SSHConfig;
  /** Exposed ports */
  ports: PortMapping[];
  /** Volume mounts */
  volumes?: VolumeMount[];
  /** Environment variables */
  environment?: Record<string, string>;
  /** MCP servers available */
  mcpServers: MCPServerConfig[];
  /** Terraform metadata */
  terraform?: TerraformMetadata;
  /** Icon identifier */
  icon: 'container' | 'server' | 'agent' | 'cloud' | 'database' | 'custom';
  /** Tags for categorization */
  tags: string[];
  /** Creation date */
  createdAt: Date;
  /** Content hash of the image manifest */
  manifestHash?: string;
}

/**
 * Running container instance
 */
export interface ContainerInstance {
  /** Instance ID */
  id: string;
  /** Source image ID */
  imageId: string;
  /** Instance name */
  name: string;
  /** Current status */
  status: ContainerStatus;
  /** Start time */
  startedAt?: Date;
  /** Uptime in seconds */
  uptime?: number;
  /** Resource usage */
  resources?: {
    cpuPercent: number;
    memoryUsedMiB: number;
    memoryTotalMiB: number;
    diskUsedMiB?: number;
  };
  /** Active SSH sessions */
  sshSessions: number;
  /** Active MCP servers */
  activeMcpServers: string[];
  /** Last error message */
  error?: string;
  /** IP address (virtual) */
  ipAddress?: string;
}

/**
 * Agent self-context definition
 */
export interface AgentContext {
  /** Agent name */
  name: string;
  /** Agent version */
  version: string;
  /** Current capabilities */
  capabilities: AgentCapability[];
  /** Installed MCP servers */
  mcpServers: MCPServerConfig[];
  /** Known container images */
  knownImages: string[];
  /** Terraform state */
  terraformState?: {
    workspaceDir: string;
    stateFile: string;
    lastPlan?: TerraformMetadata;
  };
  /** Self-modification allowed */
  selfModificationEnabled: boolean;
  /** Learning enabled */
  learningEnabled: boolean;
}

/**
 * Agent capability
 */
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'network' | 'process' | 'mcp' | 'terraform' | 'container';
  enabled: boolean;
  parameters?: Record<string, unknown>;
}

// ============ Default Container Images ============

/**
 * Base container image
 *
 * Minimal Alpine-based container with SSH and basic tools.
 */
export const baseContainerImage: ContainerImage = {
  id: 'base-container-v1',
  name: 'QemuWeb Base',
  version: '1.0.0',
  description: 'Minimal container with SSH, shell, and basic utilities',
  type: 'base',
  arch: 'x86_64',
  profileId: 'linux-x86_64-pc-nographic',
  memoryMiB: 256,
  ssh: {
    port: 22,
    username: 'root',
    authMethod: 'password',
    defaultPassword: 'qemuweb',
  },
  ports: [
    { containerPort: 22, hostPort: 2222, protocol: 'tcp', service: 'SSH' },
  ],
  environment: {
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
  },
  mcpServers: [
    {
      name: 'filesystem',
      version: '1.0.0',
      transport: 'stdio',
      command: '/usr/local/bin/mcp-filesystem',
      capabilities: [
        {
          id: 'read_file',
          name: 'Read File',
          description: 'Read contents of a file',
          category: 'tools',
          parameters: {
            path: { type: 'string', description: 'File path', required: true },
          },
        },
        {
          id: 'write_file',
          name: 'Write File',
          description: 'Write contents to a file',
          category: 'tools',
          parameters: {
            path: { type: 'string', description: 'File path', required: true },
            content: { type: 'string', description: 'File content', required: true },
          },
        },
        {
          id: 'list_dir',
          name: 'List Directory',
          description: 'List directory contents',
          category: 'tools',
          parameters: {
            path: { type: 'string', description: 'Directory path', required: true },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
  ],
  icon: 'container',
  tags: ['base', 'minimal', 'ssh'],
  createdAt: new Date('2025-01-01'),
};

/**
 * Hypervisor container image
 *
 * Container for managing other containers with full MCP and Terraform support.
 */
export const hypervisorContainerImage: ContainerImage = {
  id: 'hypervisor-v1',
  name: 'QemuWeb Hypervisor',
  version: '1.0.0',
  description: 'Container orchestration with MCP servers and Terraform support',
  type: 'hypervisor',
  arch: 'x86_64',
  profileId: 'linux-x86_64-pc-nographic',
  memoryMiB: 512,
  ssh: {
    port: 22,
    username: 'admin',
    authMethod: 'password',
    defaultPassword: 'hypervisor',
  },
  ports: [
    { containerPort: 22, hostPort: 2223, protocol: 'tcp', service: 'SSH' },
    { containerPort: 8080, hostPort: 8080, protocol: 'tcp', service: 'MCP HTTP' },
    { containerPort: 9090, hostPort: 9090, protocol: 'tcp', service: 'Metrics' },
  ],
  environment: {
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    MCP_SERVER_URL: 'http://localhost:8080',
    TERRAFORM_DIR: '/opt/terraform',
  },
  mcpServers: [
    {
      name: 'container-manager',
      version: '1.0.0',
      transport: 'http',
      endpoint: 'http://localhost:8080/mcp',
      capabilities: [
        {
          id: 'list_containers',
          name: 'List Containers',
          description: 'List all managed containers',
          category: 'tools',
        },
        {
          id: 'start_container',
          name: 'Start Container',
          description: 'Start a container by ID',
          category: 'tools',
          parameters: {
            containerId: { type: 'string', description: 'Container ID', required: true },
          },
        },
        {
          id: 'stop_container',
          name: 'Stop Container',
          description: 'Stop a container by ID',
          category: 'tools',
          parameters: {
            containerId: { type: 'string', description: 'Container ID', required: true },
          },
        },
        {
          id: 'create_container',
          name: 'Create Container',
          description: 'Create a new container from image',
          category: 'tools',
          parameters: {
            imageId: { type: 'string', description: 'Image ID', required: true },
            name: { type: 'string', description: 'Container name', required: true },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
    {
      name: 'terraform',
      version: '1.0.0',
      transport: 'stdio',
      command: '/usr/local/bin/mcp-terraform',
      capabilities: [
        {
          id: 'plan',
          name: 'Terraform Plan',
          description: 'Generate a Terraform execution plan',
          category: 'tools',
          parameters: {
            workDir: { type: 'string', description: 'Working directory', required: true },
          },
        },
        {
          id: 'apply',
          name: 'Terraform Apply',
          description: 'Apply a Terraform plan',
          category: 'tools',
          parameters: {
            workDir: { type: 'string', description: 'Working directory', required: true },
            autoApprove: { type: 'boolean', description: 'Auto-approve', default: false },
          },
        },
        {
          id: 'state',
          name: 'Terraform State',
          description: 'Get current Terraform state',
          category: 'resources',
          parameters: {
            workDir: { type: 'string', description: 'Working directory', required: true },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
    {
      name: 'agent-self',
      version: '1.0.0',
      transport: 'stdio',
      command: '/usr/local/bin/mcp-agent',
      capabilities: [
        {
          id: 'get_context',
          name: 'Get Agent Context',
          description: 'Get current agent context and capabilities',
          category: 'resources',
        },
        {
          id: 'add_mcp_server',
          name: 'Add MCP Server',
          description: 'Add a new MCP server to the agent',
          category: 'tools',
          parameters: {
            config: { type: 'object', description: 'MCP server configuration', required: true },
          },
        },
        {
          id: 'remove_mcp_server',
          name: 'Remove MCP Server',
          description: 'Remove an MCP server from the agent',
          category: 'tools',
          parameters: {
            name: { type: 'string', description: 'Server name', required: true },
          },
        },
        {
          id: 'update_capabilities',
          name: 'Update Capabilities',
          description: 'Update agent capabilities',
          category: 'tools',
          parameters: {
            capabilities: { type: 'array', description: 'New capabilities', required: true },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
  ],
  terraform: {
    providers: [
      { name: 'local', source: 'hashicorp/local', version: '2.4.0' },
      { name: 'null', source: 'hashicorp/null', version: '3.2.0' },
    ],
    resources: [],
    variables: [
      { name: 'container_count', type: 'number', default: 1, description: 'Number of containers' },
    ],
    outputs: [],
  },
  icon: 'server',
  tags: ['hypervisor', 'orchestration', 'mcp', 'terraform'],
  createdAt: new Date('2025-01-01'),
};

/**
 * Agent container image
 *
 * Self-aware agent with full MCP integration and learning capabilities.
 */
export const agentContainerImage: ContainerImage = {
  id: 'agent-v1',
  name: 'QemuWeb Agent',
  version: '1.0.0',
  description: 'Self-aware agent with MCP servers and automatic configuration',
  type: 'agent',
  arch: 'x86_64',
  profileId: 'linux-x86_64-pc-nographic',
  memoryMiB: 384,
  ssh: {
    port: 22,
    username: 'agent',
    authMethod: 'password',
    defaultPassword: 'agent123',
  },
  ports: [
    { containerPort: 22, hostPort: 2224, protocol: 'tcp', service: 'SSH' },
    { containerPort: 8081, hostPort: 8081, protocol: 'tcp', service: 'Agent API' },
  ],
  environment: {
    TERM: 'xterm-256color',
    AGENT_MODE: 'autonomous',
    MCP_AUTO_DISCOVER: 'true',
  },
  mcpServers: [
    {
      name: 'self-awareness',
      version: '1.0.0',
      transport: 'stdio',
      command: '/usr/local/bin/mcp-self',
      capabilities: [
        {
          id: 'introspect',
          name: 'Introspect',
          description: 'Introspect current agent state and capabilities',
          category: 'resources',
        },
        {
          id: 'learn',
          name: 'Learn',
          description: 'Learn from interaction and update knowledge base',
          category: 'tools',
          parameters: {
            experience: { type: 'object', description: 'Experience to learn from', required: true },
          },
        },
        {
          id: 'plan_action',
          name: 'Plan Action',
          description: 'Plan an action based on goals and context',
          category: 'tools',
          parameters: {
            goal: { type: 'string', description: 'Goal to achieve', required: true },
            context: { type: 'object', description: 'Current context', required: false },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
    {
      name: 'mcp-manager',
      version: '1.0.0',
      transport: 'stdio',
      command: '/usr/local/bin/mcp-manager',
      capabilities: [
        {
          id: 'discover_servers',
          name: 'Discover Servers',
          description: 'Discover available MCP servers',
          category: 'tools',
        },
        {
          id: 'connect_server',
          name: 'Connect Server',
          description: 'Connect to an MCP server',
          category: 'tools',
          parameters: {
            url: { type: 'string', description: 'Server URL', required: true },
          },
        },
        {
          id: 'configure_server',
          name: 'Configure Server',
          description: 'Auto-configure an MCP server',
          category: 'tools',
          parameters: {
            serverId: { type: 'string', description: 'Server ID', required: true },
            config: { type: 'object', description: 'Configuration', required: true },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
  ],
  icon: 'agent',
  tags: ['agent', 'autonomous', 'mcp', 'learning'],
  createdAt: new Date('2025-01-01'),
};

/**
 * BusyBox Router container image
 *
 * Minimal BusyBox-based router for SDN control plane.
 * Acts as gateway for all virtual network traffic.
 */
export const busyboxRouterImage: ContainerImage = {
  id: 'busybox-router-v1',
  name: 'BusyBox Router',
  version: '1.0.0',
  description: 'Minimal BusyBox router for software-defined networking with MCP control plane',
  type: 'base',
  arch: 'x86_64',
  profileId: 'linux-x86_64-pc-nographic',
  memoryMiB: 64, // Very minimal
  ssh: {
    port: 22,
    username: 'root',
    authMethod: 'password',
    defaultPassword: 'router',
  },
  ports: [
    { containerPort: 22, hostPort: 2225, protocol: 'tcp', service: 'SSH' },
    { containerPort: 80, hostPort: 8088, protocol: 'tcp', service: 'MCP Control Plane' },
    { containerPort: 53, hostPort: 5353, protocol: 'udp', service: 'DNS' },
    { containerPort: 67, hostPort: 6767, protocol: 'udp', service: 'DHCP' },
  ],
  volumes: [
    { source: 'router-config', target: '/etc/router', readonly: false },
    { source: 'router-logs', target: '/var/log/router', readonly: false },
  ],
  environment: {
    TERM: 'xterm-256color',
    ROUTER_MODE: 'gateway',
    SDN_CONTROL_PLANE: 'enabled',
    MCP_ENDPOINT: 'http://localhost:80/mcp',
    ENABLE_IP_FORWARD: '1',
    ENABLE_MASQUERADE: '1',
  },
  mcpServers: [
    {
      name: 'sdn-control-plane',
      version: '1.0.0',
      transport: 'http',
      endpoint: 'http://localhost:80/mcp',
      capabilities: [
        {
          id: 'get_topology',
          name: 'Get Network Topology',
          description: 'Get current SDN topology with all nodes, links, and routes',
          category: 'resources',
        },
        {
          id: 'add_network',
          name: 'Add Network',
          description: 'Create a new virtual network segment',
          category: 'tools',
          parameters: {
            name: { type: 'string', description: 'Network name', required: true },
            cidr: { type: 'string', description: 'Network CIDR', required: true },
            type: { type: 'string', description: 'Network type (bridge|nat|isolated|routed)', required: false },
          },
        },
        {
          id: 'remove_network',
          name: 'Remove Network',
          description: 'Remove a virtual network segment',
          category: 'tools',
          parameters: {
            networkId: { type: 'string', description: 'Network ID', required: true },
          },
        },
        {
          id: 'add_link',
          name: 'Add Link',
          description: 'Create a network link between two nodes',
          category: 'tools',
          parameters: {
            sourceId: { type: 'string', description: 'Source node ID', required: true },
            targetId: { type: 'string', description: 'Target node ID', required: true },
            networkId: { type: 'string', description: 'Network to connect through', required: false },
          },
        },
        {
          id: 'remove_link',
          name: 'Remove Link',
          description: 'Remove a network link',
          category: 'tools',
          parameters: {
            linkId: { type: 'string', description: 'Link ID', required: true },
          },
        },
        {
          id: 'add_route',
          name: 'Add Route',
          description: 'Add a static route to the routing table',
          category: 'tools',
          parameters: {
            destination: { type: 'string', description: 'Destination CIDR', required: true },
            gateway: { type: 'string', description: 'Gateway IP', required: true },
            metric: { type: 'number', description: 'Route metric', required: false },
          },
        },
        {
          id: 'remove_route',
          name: 'Remove Route',
          description: 'Remove a route from the routing table',
          category: 'tools',
          parameters: {
            destination: { type: 'string', description: 'Destination CIDR', required: true },
          },
        },
        {
          id: 'set_qos',
          name: 'Set QoS',
          description: 'Configure Quality of Service for a link',
          category: 'tools',
          parameters: {
            linkId: { type: 'string', description: 'Link ID', required: true },
            bandwidth: { type: 'number', description: 'Bandwidth limit in bps', required: false },
            latency: { type: 'number', description: 'Latency in ms', required: false },
            packetLoss: { type: 'number', description: 'Packet loss %', required: false },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
    {
      name: 'firewall',
      version: '1.0.0',
      transport: 'stdio',
      command: '/usr/local/bin/mcp-firewall',
      capabilities: [
        {
          id: 'get_rules',
          name: 'Get Firewall Rules',
          description: 'Get all firewall rules',
          category: 'resources',
        },
        {
          id: 'add_rule',
          name: 'Add Firewall Rule',
          description: 'Add a new firewall rule',
          category: 'tools',
          parameters: {
            name: { type: 'string', description: 'Rule name', required: true },
            action: { type: 'string', description: 'Action (accept|drop|reject)', required: true },
            direction: { type: 'string', description: 'Direction (inbound|outbound|forward)', required: true },
            source: { type: 'string', description: 'Source CIDR', required: false },
            destination: { type: 'string', description: 'Destination CIDR', required: false },
            protocol: { type: 'string', description: 'Protocol (tcp|udp|icmp|all)', required: false },
            port: { type: 'string', description: 'Port or range', required: false },
            priority: { type: 'number', description: 'Rule priority', required: false },
          },
        },
        {
          id: 'remove_rule',
          name: 'Remove Firewall Rule',
          description: 'Remove a firewall rule',
          category: 'tools',
          parameters: {
            ruleId: { type: 'string', description: 'Rule ID', required: true },
          },
        },
        {
          id: 'enable_rule',
          name: 'Enable Firewall Rule',
          description: 'Enable a disabled firewall rule',
          category: 'tools',
          parameters: {
            ruleId: { type: 'string', description: 'Rule ID', required: true },
          },
        },
        {
          id: 'disable_rule',
          name: 'Disable Firewall Rule',
          description: 'Disable a firewall rule without removing it',
          category: 'tools',
          parameters: {
            ruleId: { type: 'string', description: 'Rule ID', required: true },
          },
        },
      ],
      enabled: true,
      autoStart: true,
    },
    {
      name: 'policy-engine',
      version: '1.0.0',
      transport: 'http',
      endpoint: 'http://localhost:80/mcp/policy',
      capabilities: [
        {
          id: 'get_policies',
          name: 'Get Security Policies',
          description: 'Get all security policies',
          category: 'resources',
        },
        {
          id: 'analyze_traffic',
          name: 'Analyze Traffic',
          description: 'Analyze network traffic patterns and suggest policies',
          category: 'tools',
        },
        {
          id: 'suggest_policy',
          name: 'Suggest Policy',
          description: 'AI-driven policy suggestion based on traffic analysis',
          category: 'tools',
          parameters: {
            context: { type: 'object', description: 'Current network context', required: false },
          },
        },
        {
          id: 'apply_policy',
          name: 'Apply Policy',
          description: 'Apply a security policy',
          category: 'tools',
          parameters: {
            policyId: { type: 'string', description: 'Policy ID', required: true },
          },
        },
        {
          id: 'rollback_policy',
          name: 'Rollback Policy',
          description: 'Rollback to previous policy state',
          category: 'tools',
          parameters: {
            snapshotId: { type: 'string', description: 'Snapshot ID to rollback to', required: false },
          },
        },
        {
          id: 'get_open_files',
          name: 'Get Open Files',
          description: 'Get files currently open by user for context-aware policy suggestions',
          category: 'resources',
        },
      ],
      enabled: true,
      autoStart: true,
    },
  ],
  terraform: {
    providers: [
      { name: 'local', source: 'hashicorp/local', version: '2.4.0' },
      { name: 'null', source: 'hashicorp/null', version: '3.2.0' },
    ],
    resources: [
      {
        type: 'local_file',
        name: 'router_config',
        attributes: {
          filename: '/etc/router/config.json',
        },
      },
    ],
    variables: [
      { name: 'enable_nat', type: 'bool', default: true, description: 'Enable NAT' },
      { name: 'enable_dhcp', type: 'bool', default: true, description: 'Enable DHCP server' },
      { name: 'enable_dns', type: 'bool', default: true, description: 'Enable DNS server' },
      { name: 'networks', type: 'list(string)', default: [], description: 'Networks to route' },
    ],
    outputs: [
      { name: 'router_ip', value: '${var.gateway_ip}', description: 'Router IP address' },
      { name: 'managed_networks', value: '${var.networks}', description: 'Managed networks' },
    ],
  },
  icon: 'server',
  tags: ['router', 'busybox', 'sdn', 'gateway', 'firewall', 'minimal'],
  createdAt: new Date('2025-01-01'),
};

/**
 * All default container images
 */
export const defaultContainerImages: ContainerImage[] = [
  baseContainerImage,
  hypervisorContainerImage,
  agentContainerImage,
  busyboxRouterImage,
];

/**
 * Get container image by ID
 */
export function getContainerImageById(id: string): ContainerImage | undefined {
  return defaultContainerImages.find((img) => img.id === id);
}

/**
 * Get container images by type
 */
export function getContainerImagesByType(type: ContainerImage['type']): ContainerImage[] {
  return defaultContainerImages.filter((img) => img.type === type);
}

/**
 * Create default agent context
 */
export function createDefaultAgentContext(): AgentContext {
  return {
    name: 'QemuWeb Agent',
    version: '1.0.0',
    capabilities: [
      {
        id: 'fs_read',
        name: 'Filesystem Read',
        description: 'Read files from containers',
        category: 'filesystem',
        enabled: true,
      },
      {
        id: 'fs_write',
        name: 'Filesystem Write',
        description: 'Write files to containers',
        category: 'filesystem',
        enabled: true,
      },
      {
        id: 'process_exec',
        name: 'Execute Processes',
        description: 'Execute commands in containers',
        category: 'process',
        enabled: true,
      },
      {
        id: 'mcp_connect',
        name: 'MCP Connect',
        description: 'Connect to MCP servers',
        category: 'mcp',
        enabled: true,
      },
      {
        id: 'mcp_manage',
        name: 'MCP Manage',
        description: 'Add/remove MCP servers',
        category: 'mcp',
        enabled: true,
      },
      {
        id: 'terraform_plan',
        name: 'Terraform Plan',
        description: 'Generate Terraform plans',
        category: 'terraform',
        enabled: true,
      },
      {
        id: 'terraform_apply',
        name: 'Terraform Apply',
        description: 'Apply Terraform configurations',
        category: 'terraform',
        enabled: true,
      },
      {
        id: 'container_manage',
        name: 'Container Manage',
        description: 'Start/stop/create containers',
        category: 'container',
        enabled: true,
      },
    ],
    mcpServers: [],
    knownImages: defaultContainerImages.map((img) => img.id),
    selfModificationEnabled: true,
    learningEnabled: true,
  };
}
