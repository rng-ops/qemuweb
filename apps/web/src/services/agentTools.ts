/**
 * Agent Tools System
 * 
 * Defines tools available to the DOM agent for performing actions:
 * - Image management (list, pull, inspect, delete)
 * - Container management (create, start, stop, exec)
 * - Network operations
 * - UI navigation
 */

import { getEventTracker } from './eventTracker';

// ============ Types ============

export type ToolRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export type ToolCategory = 
  | 'images'
  | 'containers'
  | 'files'
  | 'network'
  | 'mcp'
  | 'system'
  | 'ui';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolContext {
  agentId: string;
  sessionId: string;
  userId?: string;
  approvalToken?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresApproval?: boolean;
  approvalRequest?: ApprovalRequest;
}

export interface ApprovalRequest {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  reason: string;
  timestamp: number;
  expiresAt: number;
  context: ToolContext;
}

export interface ToolInvocation {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  context: ToolContext;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  result?: ToolResult;
  approvalRequest?: ApprovalRequest;
  startTime: number;
  endTime?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

// ============ Mock Data Store ============

interface ImageInfo {
  id: string;
  name: string;
  tag: string;
  size: number;
  created: number;
  digest: string;
  architecture: string;
}

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused';
  ports: number[];
  created: number;
}

// Simulated data store
const dataStore = {
  images: new Map<string, ImageInfo>([
    ['img-1', { id: 'img-1', name: 'alpine', tag: 'latest', size: 7800000, created: Date.now() - 86400000, digest: 'sha256:abc123', architecture: 'amd64' }],
    ['img-2', { id: 'img-2', name: 'ubuntu', tag: '22.04', size: 77000000, created: Date.now() - 172800000, digest: 'sha256:def456', architecture: 'amd64' }],
    ['img-3', { id: 'img-3', name: 'nginx', tag: 'latest', size: 142000000, created: Date.now() - 259200000, digest: 'sha256:ghi789', architecture: 'amd64' }],
  ]),
  containers: new Map<string, ContainerInfo>(),
  pendingApprovals: new Map<string, ApprovalRequest>(),
};

// ============ Tool Implementations ============

async function listImages(params: Record<string, unknown>): Promise<ToolResult> {
  const filter = params.filter as string | undefined;
  let images = Array.from(dataStore.images.values());
  
  if (filter) {
    images = images.filter(img => img.name.includes(filter) || img.tag.includes(filter));
  }
  
  return { success: true, data: images };
}

async function pullImage(params: Record<string, unknown>): Promise<ToolResult> {
  const name = params.name as string;
  const tag = (params.tag as string) || 'latest';
  
  const newImage: ImageInfo = {
    id: `img-${Date.now()}`,
    name,
    tag,
    size: Math.floor(Math.random() * 100000000),
    created: Date.now(),
    digest: `sha256:${Math.random().toString(36).slice(2)}`,
    architecture: 'amd64',
  };
  
  dataStore.images.set(newImage.id, newImage);
  
  const tracker = await getEventTracker();
  tracker.trackImagePull({ name, tag, size: newImage.size, digest: newImage.digest });
  
  return { success: true, data: newImage };
}

async function inspectImage(params: Record<string, unknown>): Promise<ToolResult> {
  const imageId = params.imageId as string;
  
  let image = dataStore.images.get(imageId);
  if (!image) {
    for (const img of dataStore.images.values()) {
      if (`${img.name}:${img.tag}` === imageId) {
        image = img;
        break;
      }
    }
  }
  
  if (!image) {
    return { success: false, error: `Image not found: ${imageId}` };
  }
  
  return { success: true, data: image };
}

async function deleteImage(params: Record<string, unknown>): Promise<ToolResult> {
  const imageId = params.imageId as string;
  
  if (!dataStore.images.has(imageId)) {
    return { success: false, error: `Image not found: ${imageId}` };
  }
  
  dataStore.images.delete(imageId);
  return { success: true, data: { deleted: imageId } };
}

async function createContainer(params: Record<string, unknown>): Promise<ToolResult> {
  const image = params.image as string;
  const name = (params.name as string) || `container-${Date.now()}`;
  const ports = (params.ports as number[]) || [];
  
  const container: ContainerInfo = {
    id: `ctr-${Date.now()}`,
    name,
    image,
    status: 'stopped',
    ports,
    created: Date.now(),
  };
  
  dataStore.containers.set(container.id, container);
  
  const tracker = await getEventTracker();
  tracker.trackContainerStart({
    containerId: container.id,
    imageName: image,
    status: 'stopped',
  });
  
  return { success: true, data: container };
}

async function startContainer(params: Record<string, unknown>): Promise<ToolResult> {
  const containerId = params.containerId as string;
  const container = dataStore.containers.get(containerId);
  
  if (!container) {
    return { success: false, error: `Container not found: ${containerId}` };
  }
  
  container.status = 'running';
  return { success: true, data: container };
}

async function stopContainer(params: Record<string, unknown>): Promise<ToolResult> {
  const containerId = params.containerId as string;
  const container = dataStore.containers.get(containerId);
  
  if (!container) {
    return { success: false, error: `Container not found: ${containerId}` };
  }
  
  container.status = 'stopped';
  
  const tracker = await getEventTracker();
  tracker.trackContainerStop(containerId, 'user requested');
  
  return { success: true, data: container };
}

async function execContainer(params: Record<string, unknown>): Promise<ToolResult> {
  const containerId = params.containerId as string;
  const command = params.command as string;
  
  const container = dataStore.containers.get(containerId);
  if (!container) {
    return { success: false, error: `Container not found: ${containerId}` };
  }
  
  if (container.status !== 'running') {
    return { success: false, error: 'Container is not running' };
  }
  
  return { 
    success: true, 
    data: { 
      exitCode: 0, 
      stdout: `Executed: ${command}`,
      stderr: '',
    } 
  };
}

async function listNetworks(): Promise<ToolResult> {
  return { 
    success: true, 
    data: [
      { id: 'net-1', name: 'default', subnet: '172.17.0.0/16', gateway: '172.17.0.1' },
      { id: 'net-2', name: 'bridge', subnet: '172.18.0.0/16', gateway: '172.18.0.1' },
    ] 
  };
}

async function navigate(params: Record<string, unknown>): Promise<ToolResult> {
  const view = params.view as string;
  window.dispatchEvent(new CustomEvent('agent:navigate', { detail: { view } }));
  return { success: true, data: { navigatedTo: view } };
}

async function showNotification(params: Record<string, unknown>): Promise<ToolResult> {
  const message = params.message as string;
  const type = (params.type as string) || 'info';
  window.dispatchEvent(new CustomEvent('agent:notification', { detail: { message, type } }));
  return { success: true };
}

// ============ Tool Registry ============

const toolDefinitions: ToolDefinition[] = [
  {
    name: 'list_images',
    description: 'List all available container images',
    category: 'images',
    riskLevel: 'safe',
    requiresApproval: false,
    parameters: [
      { name: 'filter', type: 'string', description: 'Filter by name', required: false },
    ],
    execute: listImages,
  },
  {
    name: 'pull_image',
    description: 'Pull/download a container image from a registry',
    category: 'images',
    riskLevel: 'medium',
    requiresApproval: true,
    parameters: [
      { name: 'name', type: 'string', description: 'Image name (e.g., alpine)', required: true },
      { name: 'tag', type: 'string', description: 'Image tag (e.g., latest)', required: false, default: 'latest' },
    ],
    execute: pullImage,
  },
  {
    name: 'inspect_image',
    description: 'Get detailed information about an image',
    category: 'images',
    riskLevel: 'safe',
    requiresApproval: false,
    parameters: [
      { name: 'imageId', type: 'string', description: 'Image ID or name:tag', required: true },
    ],
    execute: inspectImage,
  },
  {
    name: 'delete_image',
    description: 'Delete a container image',
    category: 'images',
    riskLevel: 'high',
    requiresApproval: true,
    parameters: [
      { name: 'imageId', type: 'string', description: 'Image ID to delete', required: true },
    ],
    execute: deleteImage,
  },
  {
    name: 'create_container',
    description: 'Create a new container from an image',
    category: 'containers',
    riskLevel: 'high',
    requiresApproval: true,
    parameters: [
      { name: 'image', type: 'string', description: 'Image to use', required: true },
      { name: 'name', type: 'string', description: 'Container name', required: false },
      { name: 'ports', type: 'array', description: 'Port mappings', required: false },
    ],
    execute: createContainer,
  },
  {
    name: 'start_container',
    description: 'Start a stopped container',
    category: 'containers',
    riskLevel: 'medium',
    requiresApproval: true,
    parameters: [
      { name: 'containerId', type: 'string', description: 'Container ID', required: true },
    ],
    execute: startContainer,
  },
  {
    name: 'stop_container',
    description: 'Stop a running container',
    category: 'containers',
    riskLevel: 'medium',
    requiresApproval: true,
    parameters: [
      { name: 'containerId', type: 'string', description: 'Container ID', required: true },
    ],
    execute: stopContainer,
  },
  {
    name: 'exec_container',
    description: 'Execute a command inside a container',
    category: 'containers',
    riskLevel: 'critical',
    requiresApproval: true,
    parameters: [
      { name: 'containerId', type: 'string', description: 'Container ID', required: true },
      { name: 'command', type: 'string', description: 'Command to execute', required: true },
    ],
    execute: execContainer,
  },
  {
    name: 'list_networks',
    description: 'List virtual networks',
    category: 'network',
    riskLevel: 'safe',
    requiresApproval: false,
    parameters: [],
    execute: listNetworks,
  },
  {
    name: 'navigate',
    description: 'Navigate to a different view in the UI',
    category: 'ui',
    riskLevel: 'safe',
    requiresApproval: false,
    parameters: [
      { name: 'view', type: 'string', description: 'View to navigate to', required: true, enum: ['dashboard', 'ide', 'vm', 'network'] },
    ],
    execute: navigate,
  },
  {
    name: 'show_notification',
    description: 'Show a notification to the user',
    category: 'ui',
    riskLevel: 'safe',
    requiresApproval: false,
    parameters: [
      { name: 'message', type: 'string', description: 'Notification message', required: true },
      { name: 'type', type: 'string', description: 'Notification type', required: false, enum: ['info', 'success', 'warning', 'error'] },
    ],
    execute: showNotification,
  },
];

// Build the map from definitions
export const agentTools = new Map<string, ToolDefinition>(
  toolDefinitions.map(tool => [tool.name, tool])
);

// ============ Tool Executor ============

export class ToolExecutor {
  private invocations = new Map<string, ToolInvocation>();

  async invoke(
    toolName: string, 
    params: Record<string, unknown>, 
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = agentTools.get(toolName);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    const invocationId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    
    const invocation: ToolInvocation = {
      id: invocationId,
      toolName,
      params,
      context,
      status: 'pending',
      startTime: Date.now(),
    };

    this.invocations.set(invocationId, invocation);

    // Check if approval required
    if (tool.requiresApproval && !context.approvalToken) {
      const approvalRequest: ApprovalRequest = {
        id: `apr-${Date.now()}`,
        toolName,
        params,
        riskLevel: tool.riskLevel,
        reason: `Tool "${toolName}" requires approval (${tool.riskLevel} risk)`,
        timestamp: Date.now(),
        expiresAt: Date.now() + 300000, // 5 minutes
        context,
      };

      invocation.status = 'pending';
      invocation.approvalRequest = approvalRequest;
      dataStore.pendingApprovals.set(approvalRequest.id, approvalRequest);

      return {
        success: false,
        requiresApproval: true,
        approvalRequest,
      };
    }

    // Execute the tool
    try {
      invocation.status = 'executing';
      const result = await tool.execute(params, context);
      
      invocation.status = result.success ? 'completed' : 'failed';
      invocation.result = result;
      invocation.endTime = Date.now();

      // Track event
      const tracker = await getEventTracker();
      tracker.trackToolInvocation({
        toolName,
        input: params,
        output: result.data,
        error: result.error,
        duration: invocation.endTime - invocation.startTime,
      });

      return result;
    } catch (error) {
      invocation.status = 'failed';
      invocation.result = { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
      invocation.endTime = Date.now();

      return invocation.result;
    }
  }

  async approveRequest(approvalId: string): Promise<ToolResult> {
    const request = dataStore.pendingApprovals.get(approvalId);
    if (!request) {
      return { success: false, error: 'Approval request not found or expired' };
    }

    if (Date.now() > request.expiresAt) {
      dataStore.pendingApprovals.delete(approvalId);
      return { success: false, error: 'Approval request expired' };
    }

    dataStore.pendingApprovals.delete(approvalId);

    // Execute with approval token
    return this.invoke(request.toolName, request.params, {
      ...request.context,
      approvalToken: approvalId,
    });
  }

  async rejectRequest(approvalId: string, _reason?: string): Promise<void> {
    dataStore.pendingApprovals.delete(approvalId);
  }

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(dataStore.pendingApprovals.values())
      .filter(r => Date.now() < r.expiresAt);
  }

  getInvocation(id: string): ToolInvocation | undefined {
    return this.invocations.get(id);
  }

  getRecentInvocations(limit = 50): ToolInvocation[] {
    return Array.from(this.invocations.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }
}

// ============ Singleton ============

let executorInstance: ToolExecutor | null = null;

export function getToolExecutor(): ToolExecutor {
  if (!executorInstance) {
    executorInstance = new ToolExecutor();
  }
  return executorInstance;
}

// ============ Tool Helpers ============

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return toolDefinitions.filter(t => t.category === category);
}

export function getToolsByRiskLevel(riskLevel: ToolRiskLevel): ToolDefinition[] {
  return toolDefinitions.filter(t => t.riskLevel === riskLevel);
}

export function getAllTools(): ToolDefinition[] {
  return [...toolDefinitions];
}

export function formatToolForLLM(tool: ToolDefinition): string {
  const params = tool.parameters.map(p => 
    `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
  ).join('\n');
  
  return `${tool.name}: ${tool.description}
Category: ${tool.category} | Risk: ${tool.riskLevel}
Parameters:
${params || '  (none)'}`;
}

export function formatAllToolsForLLM(): string {
  return toolDefinitions.map(formatToolForLLM).join('\n\n');
}
