/**
 * Agent Service
 *
 * Self-aware agent system with MCP server management, Terraform integration,
 * and automatic configuration capabilities.
 */

import type {
  AgentContext,
  AgentCapability,
  MCPServerConfig,
  MCPServerCapability,
  TerraformMetadata,
  ContainerImage,
} from '@qemuweb/vm-config';
import { createDefaultAgentContext, defaultContainerImages } from '@qemuweb/vm-config';
import { hashBlob, type ContentHash } from '@qemuweb/storage';

// ============ Types ============

export interface MCPConnection {
  server: MCPServerConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError?: string;
  connectedAt?: Date;
}

export interface TerraformPlan {
  id: string;
  config: TerraformMetadata;
  contentHash: ContentHash;
  createdAt: Date;
  status: 'pending' | 'applied' | 'failed';
}

export interface AgentAction {
  id: string;
  type: 'mcp_connect' | 'mcp_disconnect' | 'mcp_add' | 'mcp_remove' | 'terraform_plan' | 'terraform_apply' | 'capability_update';
  target: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface AgentState {
  context: AgentContext;
  mcpConnections: Map<string, MCPConnection>;
  terraformPlans: TerraformPlan[];
  actionHistory: AgentAction[];
  isInitialized: boolean;
}

// ============ Agent Service Class ============

export class AgentService {
  private state: AgentState;
  private listeners: Set<(state: AgentState) => void> = new Set();

  constructor() {
    this.state = {
      context: createDefaultAgentContext(),
      mcpConnections: new Map(),
      terraformPlans: [],
      actionHistory: [],
      isInitialized: false,
    };
  }

  // ============ State Management ============

  getState(): AgentState {
    return this.state;
  }

  getContext(): AgentContext {
    return this.state.context;
  }

  subscribe(listener: (state: AgentState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  private updateState(updates: Partial<AgentState>): void {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // ============ Initialization ============

  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;

    // Load agent context
    const context = await this.loadAgentContext();
    
    // Auto-connect to default MCP servers
    for (const image of defaultContainerImages) {
      for (const server of image.mcpServers) {
        if (server.autoStart && server.enabled) {
          this.state.mcpConnections.set(server.name, {
            server,
            status: 'disconnected',
          });
        }
      }
    }

    this.updateState({
      context,
      isInitialized: true,
    });

    console.log('[AgentService] Initialized with', this.state.mcpConnections.size, 'MCP servers');
  }

  private async loadAgentContext(): Promise<AgentContext> {
    // Try to load from localStorage
    const saved = localStorage.getItem('qemuweb:agent-context');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore parse errors
      }
    }
    return createDefaultAgentContext();
  }

  private saveAgentContext(): void {
    localStorage.setItem('qemuweb:agent-context', JSON.stringify(this.state.context));
  }

  // ============ Self-Awareness ============

  /**
   * Introspect current agent state and capabilities
   */
  introspect(): {
    name: string;
    version: string;
    capabilities: AgentCapability[];
    mcpServers: { name: string; status: string; capabilities: number }[];
    knownImages: string[];
    terraformPlans: number;
  } {
    return {
      name: this.state.context.name,
      version: this.state.context.version,
      capabilities: this.state.context.capabilities,
      mcpServers: Array.from(this.state.mcpConnections.entries()).map(([name, conn]) => ({
        name,
        status: conn.status,
        capabilities: conn.server.capabilities.length,
      })),
      knownImages: this.state.context.knownImages,
      terraformPlans: this.state.terraformPlans.length,
    };
  }

  /**
   * Get available actions based on current state
   */
  getAvailableActions(): string[] {
    const actions: string[] = [];

    // MCP actions
    if (this.hasCapability('mcp_connect')) {
      actions.push('mcp.list', 'mcp.connect', 'mcp.disconnect');
    }
    if (this.hasCapability('mcp_manage')) {
      actions.push('mcp.add', 'mcp.remove', 'mcp.configure');
    }

    // Terraform actions
    if (this.hasCapability('terraform_plan')) {
      actions.push('terraform.plan', 'terraform.validate');
    }
    if (this.hasCapability('terraform_apply')) {
      actions.push('terraform.apply', 'terraform.destroy');
    }

    // Container actions
    if (this.hasCapability('container_manage')) {
      actions.push('container.list', 'container.start', 'container.stop');
    }

    // Filesystem actions
    if (this.hasCapability('fs_read')) {
      actions.push('fs.read', 'fs.list');
    }
    if (this.hasCapability('fs_write')) {
      actions.push('fs.write', 'fs.delete');
    }

    return actions;
  }

  // ============ Capability Management ============

  hasCapability(capabilityId: string): boolean {
    return this.state.context.capabilities.some(
      (cap) => cap.id === capabilityId && cap.enabled
    );
  }

  enableCapability(capabilityId: string): boolean {
    const capability = this.state.context.capabilities.find((c) => c.id === capabilityId);
    if (!capability) return false;

    capability.enabled = true;
    this.saveAgentContext();
    this.notify();
    return true;
  }

  disableCapability(capabilityId: string): boolean {
    const capability = this.state.context.capabilities.find((c) => c.id === capabilityId);
    if (!capability) return false;

    capability.enabled = false;
    this.saveAgentContext();
    this.notify();
    return true;
  }

  addCapability(capability: AgentCapability): void {
    if (this.state.context.capabilities.some((c) => c.id === capability.id)) {
      return; // Already exists
    }

    this.state.context.capabilities.push(capability);
    this.saveAgentContext();
    this.notify();
  }

  // ============ MCP Server Management ============

  /**
   * Add a new MCP server configuration
   */
  async addMCPServer(config: MCPServerConfig): Promise<boolean> {
    const action = this.startAction('mcp_add', config.name);

    try {
      // Validate server config
      if (!config.name || !config.transport) {
        throw new Error('Invalid MCP server configuration');
      }

      // Add to context
      this.state.context.mcpServers.push(config);
      
      // Add to connections (disconnected)
      this.state.mcpConnections.set(config.name, {
        server: config,
        status: 'disconnected',
      });

      this.saveAgentContext();
      this.completeAction(action.id, true, { serverName: config.name });
      return true;
    } catch (error) {
      this.completeAction(action.id, false, undefined, String(error));
      return false;
    }
  }

  /**
   * Remove an MCP server
   */
  async removeMCPServer(serverName: string): Promise<boolean> {
    const action = this.startAction('mcp_remove', serverName);

    try {
      // Disconnect if connected
      const connection = this.state.mcpConnections.get(serverName);
      if (connection?.status === 'connected') {
        await this.disconnectMCPServer(serverName);
      }

      // Remove from context
      this.state.context.mcpServers = this.state.context.mcpServers.filter(
        (s) => s.name !== serverName
      );

      // Remove from connections
      this.state.mcpConnections.delete(serverName);

      this.saveAgentContext();
      this.completeAction(action.id, true, { serverName });
      return true;
    } catch (error) {
      this.completeAction(action.id, false, undefined, String(error));
      return false;
    }
  }

  /**
   * Connect to an MCP server
   */
  async connectMCPServer(serverName: string): Promise<boolean> {
    const action = this.startAction('mcp_connect', serverName);
    const connection = this.state.mcpConnections.get(serverName);

    if (!connection) {
      this.completeAction(action.id, false, undefined, 'Server not found');
      return false;
    }

    try {
      // Update status to connecting
      this.state.mcpConnections.set(serverName, {
        ...connection,
        status: 'connecting',
      });
      this.notify();

      // Simulate connection (in real implementation, this would establish actual connection)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update to connected
      this.state.mcpConnections.set(serverName, {
        ...connection,
        status: 'connected',
        connectedAt: new Date(),
      });

      this.completeAction(action.id, true, { 
        serverName,
        capabilities: connection.server.capabilities.length,
      });
      return true;
    } catch (error) {
      this.state.mcpConnections.set(serverName, {
        ...connection,
        status: 'error',
        lastError: String(error),
      });
      this.completeAction(action.id, false, undefined, String(error));
      return false;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectMCPServer(serverName: string): Promise<boolean> {
    const action = this.startAction('mcp_disconnect', serverName);
    const connection = this.state.mcpConnections.get(serverName);

    if (!connection) {
      this.completeAction(action.id, false, undefined, 'Server not found');
      return false;
    }

    try {
      this.state.mcpConnections.set(serverName, {
        ...connection,
        status: 'disconnected',
        connectedAt: undefined,
      });

      this.completeAction(action.id, true, { serverName });
      return true;
    } catch (error) {
      this.completeAction(action.id, false, undefined, String(error));
      return false;
    }
  }

  /**
   * Invoke a capability on an MCP server
   */
  async invokeMCPCapability(
    serverName: string,
    capabilityId: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const connection = this.state.mcpConnections.get(serverName);
    
    if (!connection) {
      throw new Error(`Server not found: ${serverName}`);
    }
    
    if (connection.status !== 'connected') {
      throw new Error(`Server not connected: ${serverName}`);
    }

    const capability = connection.server.capabilities.find((c) => c.id === capabilityId);
    if (!capability) {
      throw new Error(`Capability not found: ${capabilityId}`);
    }

    // Simulate capability invocation
    console.log(`[MCP] Invoking ${serverName}.${capabilityId}`, params);
    
    // Return simulated response based on capability
    return this.simulateMCPResponse(capability, params);
  }

  private simulateMCPResponse(capability: MCPServerCapability, params?: Record<string, unknown>): unknown {
    switch (capability.id) {
      case 'read_file':
        return { content: `# File: ${params?.path}\nSimulated file content` };
      case 'list_dir':
        return { entries: ['file1.txt', 'file2.txt', 'subdir/'] };
      case 'list_containers':
        return { containers: defaultContainerImages.map((img) => ({ id: img.id, name: img.name })) };
      case 'get_context':
        return this.introspect();
      default:
        return { success: true, capability: capability.id };
    }
  }

  // ============ Terraform Management ============

  /**
   * Generate a Terraform plan from container image configuration
   */
  async generateTerraformPlan(image: ContainerImage): Promise<TerraformPlan> {
    const action = this.startAction('terraform_plan', image.id);

    try {
      const config: TerraformMetadata = {
        providers: [
          { name: 'local', source: 'hashicorp/local', version: '2.4.0' },
          { name: 'null', source: 'hashicorp/null', version: '3.2.0' },
        ],
        resources: [
          {
            type: 'local_file',
            name: 'container_config',
            attributes: {
              filename: '/opt/container-config.json',
              content: JSON.stringify({
                image: image.id,
                memory: image.memoryMiB,
                ports: image.ports,
                ssh: image.ssh,
              }),
            },
          },
          ...image.mcpServers.map((server) => ({
            type: 'null_resource',
            name: `mcp_server_${server.name}`,
            attributes: {
              triggers: {
                server_name: server.name,
                transport: server.transport,
              },
            },
          })),
        ],
        variables: [
          { name: 'container_name', type: 'string', default: image.name },
          { name: 'memory_mb', type: 'number', default: image.memoryMiB },
          { name: 'enable_mcp', type: 'bool', default: true },
        ],
        outputs: [
          { name: 'container_id', value: '${local_file.container_config.id}' },
          { name: 'mcp_servers', value: '${jsonencode([for s in null_resource.mcp_server_* : s.triggers.server_name])}' },
        ],
      };

      // Generate content hash
      const configJson = JSON.stringify(config);
      const configBuffer = new TextEncoder().encode(configJson).buffer;
      const contentHash = await hashBlob(configBuffer);

      const plan: TerraformPlan = {
        id: `plan-${Date.now()}`,
        config,
        contentHash,
        createdAt: new Date(),
        status: 'pending',
      };

      this.state.terraformPlans.push(plan);
      this.completeAction(action.id, true, { planId: plan.id, contentHash });
      
      return plan;
    } catch (error) {
      this.completeAction(action.id, false, undefined, String(error));
      throw error;
    }
  }

  /**
   * Apply a Terraform plan
   */
  async applyTerraformPlan(planId: string): Promise<boolean> {
    const action = this.startAction('terraform_apply', planId);
    const plan = this.state.terraformPlans.find((p) => p.id === planId);

    if (!plan) {
      this.completeAction(action.id, false, undefined, 'Plan not found');
      return false;
    }

    try {
      // Simulate apply
      await new Promise((resolve) => setTimeout(resolve, 1000));

      plan.status = 'applied';
      plan.config.lastApplied = new Date();
      plan.config.planHash = plan.contentHash;

      this.completeAction(action.id, true, { 
        planId,
        resourcesCreated: plan.config.resources.length,
      });
      return true;
    } catch (error) {
      plan.status = 'failed';
      this.completeAction(action.id, false, undefined, String(error));
      return false;
    }
  }

  /**
   * Get Terraform metadata for an image
   */
  getTerraformMetadata(imageId: string): TerraformMetadata | null {
    const plan = this.state.terraformPlans
      .filter((p) => p.status === 'applied')
      .find((p) => p.config.resources.some((r) => 
        r.attributes && 'content' in r.attributes && 
        String(r.attributes.content).includes(imageId)
      ));

    return plan?.config || null;
  }

  // ============ Action Tracking ============

  private startAction(type: AgentAction['type'], target: string): AgentAction {
    const action: AgentAction = {
      id: `action-${Date.now()}`,
      type,
      target,
      status: 'running',
      startedAt: new Date(),
    };

    this.state.actionHistory.push(action);
    this.notify();
    return action;
  }

  private completeAction(actionId: string, success: boolean, result?: unknown, error?: string): void {
    const action = this.state.actionHistory.find((a) => a.id === actionId);
    if (action) {
      action.status = success ? 'success' : 'failed';
      action.completedAt = new Date();
      action.result = result;
      action.error = error;
    }
    this.notify();
  }

  getActionHistory(limit = 50): AgentAction[] {
    return this.state.actionHistory.slice(-limit);
  }

  // ============ Image Discovery ============

  discoverImages(): ContainerImage[] {
    return defaultContainerImages;
  }

  registerImage(imageId: string): void {
    if (!this.state.context.knownImages.includes(imageId)) {
      this.state.context.knownImages.push(imageId);
      this.saveAgentContext();
      this.notify();
    }
  }
}

// ============ Singleton Instance ============

let agentServiceInstance: AgentService | null = null;

export function getAgentService(): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService();
  }
  return agentServiceInstance;
}

export function createAgentService(): AgentService {
  return new AgentService();
}
