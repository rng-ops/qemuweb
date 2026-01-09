/**
 * @qemuweb/vm-config
 *
 * VM profile configuration and QEMU argument builder
 */

// Types
export type {
  VmArch,
  DiskInterface,
  NetworkMode,
  SerialMode,
  VmDeviceConfig,
  VmProfile,
  VmInputs,
  VmOverrides,
  QemuArgsResult,
} from './types.js';

// Default profiles
export {
  defaultProfiles,
  linuxX86_64PcNographic,
  linuxX86_64PcGraphics,
  linuxAarch64VirtNographic,
  linuxAarch64VirtGraphics,
  minimalX86_64,
  getProfileById,
  getProfilesByArch,
  getGraphicsProfiles,
  getSerialProfiles,
} from './profiles.js';

// Argument builder
export {
  buildQemuArgs,
  validateInputs,
  summarizeConfig,
  VIRT_PATHS,
} from './builder.js';

// Profile registry
export { ProfileRegistry, profileRegistry } from './registry.js';

// Disk image configuration
export type {
  DiskImageConfig,
  DiskImageMetadata,
  CloudInitConfig,
  CloudInitUser,
  CloudInitNetwork,
  CloudInitEthernet,
  CloudInitWriteFile,
} from './diskImage.js';

export {
  DEFAULT_DISK_CONFIGS,
  generateDiskId,
  createDiskConfig,
  generateCloudInitUserData,
  generateCloudInitMetaData,
  generateCloudInitNetworkConfig,
  parseQcow2Header,
  estimateQemuConfigFromDisk,
} from './diskImage.js';

// Virtual networking
export type {
  VirtualNetwork,
  VirtualInterface,
  VirtualSwitch,
  VirtualRouter,
  RouterInterface,
  Route,
  DhcpConfig,
  DnsConfig,
  DnsRecord,
  IpConfig,
  QosConfig,
  NetworkTopology,
  TopologyConnection,
  FirewallConfig,
  FirewallRule,
  NatConfig,
  NatRule,
} from './networking.js';

export {
  generateMac,
  generateNetworkId,
  generateInterfaceId,
  parseCidr,
  isIpInCidr,
  ipToNumber,
  numberToIp,
  getNextAvailableIp,
  createDefaultNetwork,
  createVirtualInterface,
  generateQemuNetworkArgs,
  DEFAULT_NETWORKS,
} from './networking.js';

// Terraform-like infrastructure configuration
export type {
  InfrastructureConfig,
  ProviderConfig,
  ResourceDefinition,
  ResourceType,
  ResourceConfig,
  VmResourceConfig,
  DiskResourceConfig,
  NetworkResourceConfig,
  InterfaceResourceConfig,
  RouterResourceConfig,
  CloudInitResourceConfig,
  VariableDefinition,
  OutputDefinition,
} from './terraform.js';

export {
  generateTerraformConfig,
  parseTerraformConfig,
  createSingleVmInfra,
  createWebAppInfra,
  createClusterInfra,
} from './terraform.js';

// Image registry
export type { RegistryImage, ImageCategory } from './imageRegistry.js';

export {
  REGISTRY_IMAGES,
  IMAGE_CATEGORIES,
  getImagesByCategory,
  getImagesByTag,
  getImageById,
  searchImages,
  getVerifiedImages,
  getImagesByArchitecture,
  getImagesForMemory,
  createDiskFromRegistryImage,
} from './imageRegistry.js';

// Container definitions
export type {
  ContainerStatus,
  SSHConfig,
  MCPServerCapability,
  MCPServerConfig,
  TerraformMetadata,
  PortMapping,
  VolumeMount,
  ContainerImage,
  ContainerInstance,
  AgentContext,
  AgentCapability,
} from './containers.js';

export {
  baseContainerImage,
  hypervisorContainerImage,
  agentContainerImage,
  busyboxRouterImage,
  defaultContainerImages,
  getContainerImageById,
  getContainerImagesByType,
  createDefaultAgentContext,
} from './containers.js';

// Infrastructure VM profiles (Router, Vault, etc.)
export type {
  BusyboxRouterConfig,
  VaultConfig,
  Qcow2GenerationConfig,
} from './infrastructure.js';

export {
  busyboxRouter,
  hashicorpVault,
  alpineLinux,
  DEFAULT_ROUTER_CONFIG,
  DEFAULT_VAULT_CONFIG,
  generateRouterInitScript,
  generateVaultConfig,
  generateVaultInitScript,
  generateQcow2FromDockerScript,
  infrastructureProfiles,
  getInfrastructureProfile,
} from './infrastructure.js';
