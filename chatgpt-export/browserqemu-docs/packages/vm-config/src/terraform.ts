/**
 * Terraform-like Infrastructure Configuration
 *
 * Generates and parses infrastructure-as-code configurations
 * for browser-based virtual cloud environments.
 */

// These types are used for documentation purposes and future expansion
// import type { DiskImageConfig } from './diskImage.js';
// import type {
//   VirtualNetwork,
//   VirtualInterface,
//   VirtualRouter,
//   FirewallRule,
// } from './networking.js';
// import type { VmProfile } from './types.js';

// ============ Infrastructure Types ============

export interface InfrastructureConfig {
  /** Configuration version */
  version: '1.0';

  /** Provider configuration */
  provider: ProviderConfig;

  /** Resource definitions */
  resources: ResourceDefinition[];

  /** Variable definitions */
  variables: VariableDefinition[];

  /** Output definitions */
  outputs: OutputDefinition[];

  /** Metadata */
  metadata: InfraMetadata;
}

export interface ProviderConfig {
  name: 'qemuweb';
  version: string;
  settings: {
    defaultArchitecture: 'x86_64' | 'aarch64';
    defaultMemory: number;
    maxVms: number;
    maxNetworks: number;
    enablePersistence: boolean;
  };
}

export interface ResourceDefinition {
  type: ResourceType;
  name: string;
  config: ResourceConfig;
  dependsOn?: string[];
  count?: number;
  forEach?: string[];
  lifecycle?: LifecycleConfig;
}

export type ResourceType =
  | 'qemuweb_vm'
  | 'qemuweb_disk'
  | 'qemuweb_network'
  | 'qemuweb_interface'
  | 'qemuweb_router'
  | 'qemuweb_firewall_rule'
  | 'qemuweb_dns_record'
  | 'qemuweb_cloud_init';

export type ResourceConfig =
  | VmResourceConfig
  | DiskResourceConfig
  | NetworkResourceConfig
  | InterfaceResourceConfig
  | RouterResourceConfig
  | FirewallRuleConfig
  | DnsRecordConfig
  | CloudInitResourceConfig;

export interface VmResourceConfig {
  name: string;
  profile: string; // Reference to profile name
  memory: number;
  cpus: number;
  architecture?: 'x86_64' | 'aarch64';
  disks: string[]; // References to disk resources
  interfaces: string[]; // References to interface resources
  cloudInit?: string; // Reference to cloud-init resource
  bootOrder?: string[];
  tags?: string[];
}

export interface DiskResourceConfig {
  name: string;
  template?: string;
  format?: 'qcow2' | 'raw';
  sizeGb: number;
  bootable?: boolean;
  baseImage?: string;
  readonly?: boolean;
}

export interface NetworkResourceConfig {
  name: string;
  type: 'bridge' | 'nat' | 'isolated' | 'routed';
  cidr: string;
  gateway?: string;
  dhcpEnabled?: boolean;
  dhcpRange?: { start: string; end: string };
  dnsEnabled?: boolean;
  dnsDomain?: string;
}

export interface InterfaceResourceConfig {
  vm: string; // Reference to VM
  network: string; // Reference to network
  mac?: string;
  ipMode: 'dhcp' | 'static';
  staticIp?: string;
  gateway?: string;
}

export interface RouterResourceConfig {
  name: string;
  networks: string[]; // References to networks
  nat?: boolean;
  routes?: { destination: string; gateway: string }[];
}

export interface FirewallRuleConfig {
  name: string;
  network: string;
  priority: number;
  action: 'accept' | 'drop' | 'reject';
  direction: 'inbound' | 'outbound';
  protocol?: string;
  sourcePort?: string;
  destPort?: string;
  source?: string;
  destination?: string;
}

export interface DnsRecordConfig {
  network: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
  value: string;
  ttl?: number;
}

export interface CloudInitResourceConfig {
  hostname: string;
  users?: {
    name: string;
    sudo?: boolean;
    sshKeys?: string[];
  }[];
  packages?: string[];
  runcmd?: string[];
  files?: {
    path: string;
    content: string;
    permissions?: string;
  }[];
}

export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'bool' | 'list' | 'map';
  default?: unknown;
  description?: string;
  validation?: {
    condition: string;
    errorMessage: string;
  };
  sensitive?: boolean;
}

export interface OutputDefinition {
  name: string;
  value: string;
  description?: string;
  sensitive?: boolean;
}

export interface LifecycleConfig {
  createBeforeDestroy?: boolean;
  preventDestroy?: boolean;
  ignoreChanges?: string[];
}

export interface InfraMetadata {
  name: string;
  description?: string;
  author?: string;
  createdAt: Date;
  modifiedAt: Date;
  tags: string[];
}

// ============ Terraform Generator ============

/**
 * Generate Terraform-like HCL configuration
 */
export function generateTerraformConfig(config: InfrastructureConfig): string {
  const lines: string[] = [];

  // Header
  lines.push('# QemuWeb Infrastructure Configuration');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Terraform block
  lines.push('terraform {');
  lines.push('  required_providers {');
  lines.push('    qemuweb = {');
  lines.push('      source  = "qemuweb/qemuweb"');
  lines.push(`      version = "${config.provider.version}"`);
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Provider
  lines.push('provider "qemuweb" {');
  lines.push(`  default_architecture = "${config.provider.settings.defaultArchitecture}"`);
  lines.push(`  default_memory       = ${config.provider.settings.defaultMemory}`);
  lines.push(`  max_vms              = ${config.provider.settings.maxVms}`);
  lines.push(`  enable_persistence   = ${config.provider.settings.enablePersistence}`);
  lines.push('}');
  lines.push('');

  // Variables
  for (const variable of config.variables) {
    lines.push(`variable "${variable.name}" {`);
    lines.push(`  type        = ${variable.type}`);
    if (variable.description) {
      lines.push(`  description = "${variable.description}"`);
    }
    if (variable.default !== undefined) {
      const defaultVal =
        typeof variable.default === 'string'
          ? `"${variable.default}"`
          : JSON.stringify(variable.default);
      lines.push(`  default     = ${defaultVal}`);
    }
    if (variable.sensitive) {
      lines.push('  sensitive   = true');
    }
    lines.push('}');
    lines.push('');
  }

  // Resources
  for (const resource of config.resources) {
    lines.push(`resource "${resource.type}" "${resource.name}" {`);

    if (resource.count !== undefined) {
      lines.push(`  count = ${resource.count}`);
    }

    if (resource.dependsOn && resource.dependsOn.length > 0) {
      lines.push(`  depends_on = [${resource.dependsOn.join(', ')}]`);
    }

    // Resource-specific config
    const resourceLines = generateResourceConfig(resource.type, resource.config);
    for (const line of resourceLines) {
      lines.push(`  ${line}`);
    }

    if (resource.lifecycle) {
      lines.push('');
      lines.push('  lifecycle {');
      if (resource.lifecycle.createBeforeDestroy) {
        lines.push('    create_before_destroy = true');
      }
      if (resource.lifecycle.preventDestroy) {
        lines.push('    prevent_destroy = true');
      }
      lines.push('  }');
    }

    lines.push('}');
    lines.push('');
  }

  // Outputs
  for (const output of config.outputs) {
    lines.push(`output "${output.name}" {`);
    lines.push(`  value       = ${output.value}`);
    if (output.description) {
      lines.push(`  description = "${output.description}"`);
    }
    if (output.sensitive) {
      lines.push('  sensitive   = true');
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function generateResourceConfig(type: ResourceType, config: ResourceConfig): string[] {
  const lines: string[] = [];

  switch (type) {
    case 'qemuweb_vm': {
      const vm = config as VmResourceConfig;
      lines.push(`name         = "${vm.name}"`);
      lines.push(`profile      = "${vm.profile}"`);
      lines.push(`memory       = ${vm.memory}`);
      lines.push(`cpus         = ${vm.cpus}`);
      if (vm.architecture) {
        lines.push(`architecture = "${vm.architecture}"`);
      }
      if (vm.disks.length > 0) {
        lines.push(`disks        = [${vm.disks.map((d) => `"${d}"`).join(', ')}]`);
      }
      if (vm.interfaces.length > 0) {
        lines.push(`interfaces   = [${vm.interfaces.map((i) => `"${i}"`).join(', ')}]`);
      }
      if (vm.cloudInit) {
        lines.push(`cloud_init   = "${vm.cloudInit}"`);
      }
      if (vm.tags && vm.tags.length > 0) {
        lines.push(`tags         = [${vm.tags.map((t) => `"${t}"`).join(', ')}]`);
      }
      break;
    }

    case 'qemuweb_disk': {
      const disk = config as DiskResourceConfig;
      lines.push(`name     = "${disk.name}"`);
      if (disk.template) {
        lines.push(`template = "${disk.template}"`);
      }
      lines.push(`format   = "${disk.format ?? 'qcow2'}"`);
      lines.push(`size_gb  = ${disk.sizeGb}`);
      if (disk.bootable !== undefined) {
        lines.push(`bootable = ${disk.bootable}`);
      }
      if (disk.baseImage) {
        lines.push(`base_image = "${disk.baseImage}"`);
      }
      break;
    }

    case 'qemuweb_network': {
      const net = config as NetworkResourceConfig;
      lines.push(`name    = "${net.name}"`);
      lines.push(`type    = "${net.type}"`);
      lines.push(`cidr    = "${net.cidr}"`);
      if (net.gateway) {
        lines.push(`gateway = "${net.gateway}"`);
      }
      if (net.dhcpEnabled !== undefined) {
        lines.push(`dhcp_enabled = ${net.dhcpEnabled}`);
      }
      if (net.dhcpRange) {
        lines.push('dhcp_range {');
        lines.push(`  start = "${net.dhcpRange.start}"`);
        lines.push(`  end   = "${net.dhcpRange.end}"`);
        lines.push('}');
      }
      break;
    }

    case 'qemuweb_interface': {
      const iface = config as InterfaceResourceConfig;
      lines.push(`vm      = ${iface.vm}`);
      lines.push(`network = ${iface.network}`);
      if (iface.mac) {
        lines.push(`mac     = "${iface.mac}"`);
      }
      lines.push(`ip_mode = "${iface.ipMode}"`);
      if (iface.staticIp) {
        lines.push(`static_ip = "${iface.staticIp}"`);
      }
      break;
    }

    case 'qemuweb_cloud_init': {
      const ci = config as CloudInitResourceConfig;
      lines.push(`hostname = "${ci.hostname}"`);
      if (ci.packages && ci.packages.length > 0) {
        lines.push(`packages = [${ci.packages.map((p) => `"${p}"`).join(', ')}]`);
      }
      if (ci.users && ci.users.length > 0) {
        for (const user of ci.users) {
          lines.push('user {');
          lines.push(`  name = "${user.name}"`);
          if (user.sudo) {
            lines.push('  sudo = true');
          }
          if (user.sshKeys && user.sshKeys.length > 0) {
            lines.push(`  ssh_keys = [${user.sshKeys.map((k) => `"${k}"`).join(', ')}]`);
          }
          lines.push('}');
        }
      }
      if (ci.runcmd && ci.runcmd.length > 0) {
        lines.push(`runcmd = [`);
        for (const cmd of ci.runcmd) {
          lines.push(`  "${cmd.replace(/"/g, '\\"')}",`);
        }
        lines.push(']');
      }
      break;
    }

    default:
      lines.push(`# Configuration for ${type}`);
      lines.push(`config = ${JSON.stringify(config, null, 2)}`);
  }

  return lines;
}

/**
 * Parse Terraform-like configuration back to InfrastructureConfig
 */
export function parseTerraformConfig(hcl: string): InfrastructureConfig {
  // Simplified HCL parser for our subset
  const config: InfrastructureConfig = {
    version: '1.0',
    provider: {
      name: 'qemuweb',
      version: '0.1.0',
      settings: {
        defaultArchitecture: 'x86_64',
        defaultMemory: 512,
        maxVms: 10,
        maxNetworks: 5,
        enablePersistence: true,
      },
    },
    resources: [],
    variables: [],
    outputs: [],
    metadata: {
      name: 'Imported Configuration',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['imported'],
    },
  };

  // Parse resources
  const resourceRegex = /resource\s+"(\w+)"\s+"(\w+)"\s*{([^}]+)}/g;
  let match;

  while ((match = resourceRegex.exec(hcl)) !== null) {
    const [, type, name, body] = match;
    const resourceConfig = parseResourceBody(type as ResourceType, body);

    config.resources.push({
      type: type as ResourceType,
      name,
      config: resourceConfig,
    });
  }

  // Parse variables
  const varRegex = /variable\s+"(\w+)"\s*{([^}]+)}/g;
  while ((match = varRegex.exec(hcl)) !== null) {
    const [, name, body] = match;
    const typeMatch = body.match(/type\s*=\s*(\w+)/);
    const defaultMatch = body.match(/default\s*=\s*(.+)/);
    const descMatch = body.match(/description\s*=\s*"([^"]+)"/);

    config.variables.push({
      name,
      type: (typeMatch?.[1] as VariableDefinition['type']) ?? 'string',
      default: defaultMatch ? parseValue(defaultMatch[1].trim()) : undefined,
      description: descMatch?.[1],
    });
  }

  return config;
}

function parseResourceBody(type: ResourceType, body: string): ResourceConfig {
  const props: Record<string, unknown> = {};

  // Simple key = value parser
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*(\w+)\s*=\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      props[key] = parseValue(value.trim());
    }
  }

  // Convert to appropriate config type
  switch (type) {
    case 'qemuweb_vm':
      return {
        name: props.name as string,
        profile: props.profile as string,
        memory: props.memory as number,
        cpus: props.cpus as number,
        architecture: props.architecture as 'x86_64' | 'aarch64',
        disks: (props.disks as string[]) ?? [],
        interfaces: (props.interfaces as string[]) ?? [],
        cloudInit: props.cloud_init as string,
        tags: props.tags as string[],
      } as VmResourceConfig;

    case 'qemuweb_disk':
      return {
        name: props.name as string,
        template: props.template as string,
        format: (props.format as 'qcow2' | 'raw') ?? 'qcow2',
        sizeGb: props.size_gb as number,
        bootable: props.bootable as boolean,
        baseImage: props.base_image as string,
      } as DiskResourceConfig;

    case 'qemuweb_network':
      return {
        name: props.name as string,
        type: props.type as 'bridge' | 'nat' | 'isolated' | 'routed',
        cidr: props.cidr as string,
        gateway: props.gateway as string,
        dhcpEnabled: props.dhcp_enabled as boolean,
      } as NetworkResourceConfig;

    default:
      return props as unknown as ResourceConfig;
  }
}

function parseValue(value: string): unknown {
  // String
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  // Number
  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Array
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1);
    return inner.split(',').map((v) => parseValue(v.trim()));
  }

  return value;
}

// ============ Template Infrastructure Configs ============

/**
 * Create a basic single-VM infrastructure
 */
export function createSingleVmInfra(
  name: string,
  memory: number = 512,
  diskSizeGb: number = 10
): InfrastructureConfig {
  const now = new Date();

  return {
    version: '1.0',
    provider: {
      name: 'qemuweb',
      version: '0.1.0',
      settings: {
        defaultArchitecture: 'x86_64',
        defaultMemory: memory,
        maxVms: 1,
        maxNetworks: 1,
        enablePersistence: true,
      },
    },
    resources: [
      {
        type: 'qemuweb_network',
        name: 'default',
        config: {
          name: 'default-network',
          type: 'nat',
          cidr: '10.0.0.0/24',
          gateway: '10.0.0.1',
          dhcpEnabled: true,
          dhcpRange: { start: '10.0.0.100', end: '10.0.0.200' },
        } as NetworkResourceConfig,
      },
      {
        type: 'qemuweb_disk',
        name: 'boot',
        config: {
          name: 'boot-disk',
          format: 'qcow2',
          sizeGb: diskSizeGb,
          bootable: true,
        } as DiskResourceConfig,
      },
      {
        type: 'qemuweb_cloud_init',
        name: 'config',
        config: {
          hostname: name.toLowerCase().replace(/\s+/g, '-'),
          packages: ['curl', 'vim'],
          users: [{ name: 'admin', sudo: true }],
          runcmd: ['echo "VM initialized" > /var/log/init.log'],
        } as CloudInitResourceConfig,
      },
      {
        type: 'qemuweb_vm',
        name: 'main',
        config: {
          name,
          profile: 'minimal-linux',
          memory,
          cpus: 1,
          disks: ['qemuweb_disk.boot'],
          interfaces: ['qemuweb_interface.eth0'],
          cloudInit: 'qemuweb_cloud_init.config',
          tags: ['single-vm'],
        } as VmResourceConfig,
        dependsOn: ['qemuweb_disk.boot', 'qemuweb_network.default'],
      },
      {
        type: 'qemuweb_interface',
        name: 'eth0',
        config: {
          vm: 'qemuweb_vm.main',
          network: 'qemuweb_network.default',
          ipMode: 'dhcp',
        } as InterfaceResourceConfig,
      },
    ],
    variables: [
      {
        name: 'vm_memory',
        type: 'number',
        default: memory,
        description: 'Memory for the VM in MB',
      },
    ],
    outputs: [
      {
        name: 'vm_ip',
        value: 'qemuweb_interface.eth0.ip_address',
        description: 'IP address of the VM',
      },
    ],
    metadata: {
      name: `${name} Infrastructure`,
      description: 'Single VM infrastructure',
      createdAt: now,
      modifiedAt: now,
      tags: ['single-vm', 'basic'],
    },
  };
}

/**
 * Create a multi-tier web application infrastructure
 */
export function createWebAppInfra(
  name: string = 'Web Application'
): InfrastructureConfig {
  const now = new Date();

  return {
    version: '1.0',
    provider: {
      name: 'qemuweb',
      version: '0.1.0',
      settings: {
        defaultArchitecture: 'x86_64',
        defaultMemory: 512,
        maxVms: 5,
        maxNetworks: 3,
        enablePersistence: true,
      },
    },
    resources: [
      // Networks
      {
        type: 'qemuweb_network',
        name: 'frontend',
        config: {
          name: 'frontend-network',
          type: 'nat',
          cidr: '10.0.1.0/24',
          gateway: '10.0.1.1',
          dhcpEnabled: true,
        } as NetworkResourceConfig,
      },
      {
        type: 'qemuweb_network',
        name: 'backend',
        config: {
          name: 'backend-network',
          type: 'isolated',
          cidr: '10.0.2.0/24',
          gateway: '10.0.2.1',
          dhcpEnabled: true,
        } as NetworkResourceConfig,
      },
      {
        type: 'qemuweb_network',
        name: 'database',
        config: {
          name: 'database-network',
          type: 'isolated',
          cidr: '10.0.3.0/24',
          gateway: '10.0.3.1',
          dhcpEnabled: true,
        } as NetworkResourceConfig,
      },

      // Web Server
      {
        type: 'qemuweb_disk',
        name: 'web_disk',
        config: {
          name: 'web-disk',
          format: 'qcow2',
          sizeGb: 5,
          bootable: true,
        } as DiskResourceConfig,
      },
      {
        type: 'qemuweb_vm',
        name: 'web',
        config: {
          name: 'web-server',
          profile: 'alpine-base',
          memory: 256,
          cpus: 1,
          disks: ['qemuweb_disk.web_disk'],
          interfaces: ['qemuweb_interface.web_frontend', 'qemuweb_interface.web_backend'],
          tags: ['web', 'frontend'],
        } as VmResourceConfig,
      },

      // App Server
      {
        type: 'qemuweb_disk',
        name: 'app_disk',
        config: {
          name: 'app-disk',
          format: 'qcow2',
          sizeGb: 10,
          bootable: true,
        } as DiskResourceConfig,
      },
      {
        type: 'qemuweb_vm',
        name: 'app',
        config: {
          name: 'app-server',
          profile: 'alpine-base',
          memory: 512,
          cpus: 2,
          disks: ['qemuweb_disk.app_disk'],
          interfaces: ['qemuweb_interface.app_backend', 'qemuweb_interface.app_database'],
          tags: ['app', 'backend'],
        } as VmResourceConfig,
      },

      // Database Server
      {
        type: 'qemuweb_disk',
        name: 'db_disk',
        config: {
          name: 'db-disk',
          format: 'qcow2',
          sizeGb: 20,
          bootable: true,
        } as DiskResourceConfig,
      },
      {
        type: 'qemuweb_vm',
        name: 'database',
        config: {
          name: 'database-server',
          profile: 'alpine-base',
          memory: 1024,
          cpus: 2,
          disks: ['qemuweb_disk.db_disk'],
          interfaces: ['qemuweb_interface.db_database'],
          tags: ['database', 'backend'],
        } as VmResourceConfig,
      },

      // Interfaces
      {
        type: 'qemuweb_interface',
        name: 'web_frontend',
        config: {
          vm: 'qemuweb_vm.web',
          network: 'qemuweb_network.frontend',
          ipMode: 'static',
          staticIp: '10.0.1.10',
        } as InterfaceResourceConfig,
      },
      {
        type: 'qemuweb_interface',
        name: 'web_backend',
        config: {
          vm: 'qemuweb_vm.web',
          network: 'qemuweb_network.backend',
          ipMode: 'dhcp',
        } as InterfaceResourceConfig,
      },
      {
        type: 'qemuweb_interface',
        name: 'app_backend',
        config: {
          vm: 'qemuweb_vm.app',
          network: 'qemuweb_network.backend',
          ipMode: 'dhcp',
        } as InterfaceResourceConfig,
      },
      {
        type: 'qemuweb_interface',
        name: 'app_database',
        config: {
          vm: 'qemuweb_vm.app',
          network: 'qemuweb_network.database',
          ipMode: 'dhcp',
        } as InterfaceResourceConfig,
      },
      {
        type: 'qemuweb_interface',
        name: 'db_database',
        config: {
          vm: 'qemuweb_vm.database',
          network: 'qemuweb_network.database',
          ipMode: 'static',
          staticIp: '10.0.3.10',
        } as InterfaceResourceConfig,
      },

      // Firewall Rules
      {
        type: 'qemuweb_firewall_rule',
        name: 'allow_http',
        config: {
          name: 'allow-http',
          network: 'qemuweb_network.frontend',
          priority: 100,
          action: 'accept',
          direction: 'inbound',
          protocol: 'tcp',
          destPort: '80,443',
        } as FirewallRuleConfig,
      },
      {
        type: 'qemuweb_firewall_rule',
        name: 'deny_db_external',
        config: {
          name: 'deny-db-external',
          network: 'qemuweb_network.database',
          priority: 200,
          action: 'drop',
          direction: 'inbound',
          source: '0.0.0.0/0',
        } as FirewallRuleConfig,
      },
    ],
    variables: [],
    outputs: [
      {
        name: 'web_server_ip',
        value: 'qemuweb_interface.web_frontend.ip_address',
        description: 'Public IP of web server',
      },
    ],
    metadata: {
      name,
      description: 'Three-tier web application infrastructure',
      createdAt: now,
      modifiedAt: now,
      tags: ['web-app', 'multi-tier', 'production'],
    },
  };
}

/**
 * Create a Kubernetes-like cluster infrastructure
 */
export function createClusterInfra(
  name: string = 'K8s Cluster',
  workerCount: number = 3
): InfrastructureConfig {
  const now = new Date();
  const resources: ResourceDefinition[] = [];

  // Cluster network
  resources.push({
    type: 'qemuweb_network',
    name: 'cluster',
    config: {
      name: 'cluster-network',
      type: 'bridge',
      cidr: '10.244.0.0/16',
      gateway: '10.244.0.1',
      dhcpEnabled: true,
    } as NetworkResourceConfig,
  });

  // Control plane
  resources.push({
    type: 'qemuweb_disk',
    name: 'control_plane_disk',
    config: {
      name: 'control-plane-disk',
      format: 'qcow2',
      sizeGb: 20,
      bootable: true,
    } as DiskResourceConfig,
  });

  resources.push({
    type: 'qemuweb_vm',
    name: 'control_plane',
    config: {
      name: 'control-plane',
      profile: 'alpine-base',
      memory: 2048,
      cpus: 2,
      disks: ['qemuweb_disk.control_plane_disk'],
      interfaces: ['qemuweb_interface.control_plane_eth0'],
      tags: ['k8s', 'control-plane', 'master'],
    } as VmResourceConfig,
  });

  resources.push({
    type: 'qemuweb_interface',
    name: 'control_plane_eth0',
    config: {
      vm: 'qemuweb_vm.control_plane',
      network: 'qemuweb_network.cluster',
      ipMode: 'static',
      staticIp: '10.244.0.10',
    } as InterfaceResourceConfig,
  });

  // Worker nodes
  for (let i = 0; i < workerCount; i++) {
    resources.push({
      type: 'qemuweb_disk',
      name: `worker_${i}_disk`,
      config: {
        name: `worker-${i}-disk`,
        format: 'qcow2',
        sizeGb: 15,
        bootable: true,
      } as DiskResourceConfig,
    });

    resources.push({
      type: 'qemuweb_vm',
      name: `worker_${i}`,
      config: {
        name: `worker-${i}`,
        profile: 'alpine-base',
        memory: 1024,
        cpus: 2,
        disks: [`qemuweb_disk.worker_${i}_disk`],
        interfaces: [`qemuweb_interface.worker_${i}_eth0`],
        tags: ['k8s', 'worker'],
      } as VmResourceConfig,
      dependsOn: ['qemuweb_vm.control_plane'],
    });

    resources.push({
      type: 'qemuweb_interface',
      name: `worker_${i}_eth0`,
      config: {
        vm: `qemuweb_vm.worker_${i}`,
        network: 'qemuweb_network.cluster',
        ipMode: 'dhcp',
      } as InterfaceResourceConfig,
    });
  }

  return {
    version: '1.0',
    provider: {
      name: 'qemuweb',
      version: '0.1.0',
      settings: {
        defaultArchitecture: 'x86_64',
        defaultMemory: 1024,
        maxVms: workerCount + 1,
        maxNetworks: 1,
        enablePersistence: true,
      },
    },
    resources,
    variables: [
      {
        name: 'worker_count',
        type: 'number',
        default: workerCount,
        description: 'Number of worker nodes',
      },
    ],
    outputs: [
      {
        name: 'control_plane_ip',
        value: 'qemuweb_interface.control_plane_eth0.ip_address',
      },
    ],
    metadata: {
      name,
      description: 'Kubernetes-like cluster infrastructure',
      createdAt: now,
      modifiedAt: now,
      tags: ['kubernetes', 'cluster', 'container-orchestration'],
    },
  };
}
