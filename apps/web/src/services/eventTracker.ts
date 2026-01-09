/**
 * Event Tracker
 * 
 * Captures all user interactions, DOM events, system events, and agent actions.
 * Stores everything in the vector memory for semantic search and agent context.
 */

import { 
  getMemoryStore, 
  VectorMemoryStore 
} from './vectorMemory';

// ============ Types ============

export interface TrackedClick {
  target: string;
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  path: string[];
  position: { x: number; y: number };
  [key: string]: unknown;
}

export interface TrackedNavigation {
  from: string;
  to: string;
  method: 'click' | 'programmatic' | 'popstate';
  [key: string]: unknown;
}

export interface TrackedService {
  serviceId: string;
  serviceName: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  ports?: number[];
  capabilities?: string[];
  [key: string]: unknown;
}

export interface TrackedContainer {
  containerId: string;
  imageName: string;
  status: string;
  resources?: {
    cpu?: number;
    memory?: number;
  };
  tools?: string[];
  mcpServers?: string[];
  [key: string]: unknown;
}

export interface TrackedMCPConnection {
  serverId: string;
  serverName: string;
  transport: 'stdio' | 'sse' | 'websocket';
  tools: string[];
  prompts?: string[];
  resources?: string[];
  [key: string]: unknown;
}

export interface TrackedToolInvocation {
  toolName: string;
  serverId?: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface TrackedModelSwitch {
  from?: string;
  to: string;
  provider: 'remote' | 'local' | 'in-architecture';
  endpoint?: string;
  [key: string]: unknown;
}

export interface TrackedDOMMutation {
  type: 'childList' | 'attributes' | 'characterData';
  target: string;
  addedNodes?: string[];
  removedNodes?: string[];
  attributeName?: string;
  oldValue?: string;
  newValue?: string;
  [key: string]: unknown;
}

export interface TrackedAgentAction {
  agentId: string;
  action: string;
  target?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  reasoning?: string;
  [key: string]: unknown;
}

export interface TrackedCapability {
  entityId: string;
  entityType: 'container' | 'service' | 'agent';
  capabilities: string[];
  connections: string[];
  [key: string]: unknown;
}

// ============ Event Tracker Class ============

export class EventTracker {
  private memoryStore: VectorMemoryStore | null = null;
  private clickObserver: ((e: MouseEvent) => void) | null = null;
  private mutationObserver: MutationObserver | null = null;
  private isTracking = false;
  private componentStack: string[] = [];
  private throttleMap: Map<string, number> = new Map();
  private throttleMs = 100; // Minimum ms between same event types

  async initialize(): Promise<void> {
    this.memoryStore = await getMemoryStore();
    this.startTracking();
  }

  private shouldThrottle(key: string): boolean {
    const now = Date.now();
    const last = this.throttleMap.get(key);
    if (last && now - last < this.throttleMs) {
      return true;
    }
    this.throttleMap.set(key, now);
    return false;
  }

  // ============ DOM Tracking ============

  startTracking(): void {
    if (this.isTracking) return;
    this.isTracking = true;

    // Track clicks
    this.clickObserver = (e: MouseEvent) => {
      if (this.shouldThrottle('click')) return;
      
      const target = e.target as HTMLElement;
      if (!target) return;

      const path = this.getElementPath(target);
      const tracked: TrackedClick = {
        target: this.getElementSelector(target),
        tagName: target.tagName,
        id: target.id || undefined,
        className: target.className || undefined,
        text: target.textContent?.slice(0, 100) || undefined,
        path,
        position: { x: e.clientX, y: e.clientY },
      };

      this.trackClick(tracked);
    };
    document.addEventListener('click', this.clickObserver, true);

    // Track DOM mutations
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (this.shouldThrottle(`mutation-${mutation.type}`)) continue;
        
        const tracked: TrackedDOMMutation = {
          type: mutation.type as TrackedDOMMutation['type'],
          target: this.getElementSelector(mutation.target as HTMLElement),
        };

        if (mutation.type === 'childList') {
          tracked.addedNodes = Array.from(mutation.addedNodes)
            .filter(n => n.nodeType === Node.ELEMENT_NODE)
            .slice(0, 5)
            .map(n => this.getElementSelector(n as HTMLElement));
          tracked.removedNodes = Array.from(mutation.removedNodes)
            .filter(n => n.nodeType === Node.ELEMENT_NODE)
            .slice(0, 5)
            .map(n => this.getElementSelector(n as HTMLElement));
        } else if (mutation.type === 'attributes') {
          tracked.attributeName = mutation.attributeName || undefined;
          tracked.oldValue = mutation.oldValue || undefined;
        }

        // Only track significant mutations
        if (tracked.addedNodes?.length || tracked.removedNodes?.length || tracked.attributeName) {
          this.trackDOMMutation(tracked);
        }
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
    });

    // Track navigation
    window.addEventListener('popstate', () => {
      this.trackNavigation({
        from: document.referrer,
        to: window.location.href,
        method: 'popstate',
      });
    });
  }

  stopTracking(): void {
    if (!this.isTracking) return;
    this.isTracking = false;

    if (this.clickObserver) {
      document.removeEventListener('click', this.clickObserver, true);
      this.clickObserver = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  private getElementPath(element: HTMLElement): string[] {
    const path: string[] = [];
    let current: HTMLElement | null = element;
    
    while (current && current !== document.body) {
      path.unshift(this.getElementSelector(current));
      current = current.parentElement;
    }
    
    return path.slice(-5); // Keep last 5 elements
  }

  private getElementSelector(element: HTMLElement): string {
    if (!element || !element.tagName) return 'unknown';
    
    let selector = element.tagName.toLowerCase();
    
    if (element.id) {
      selector += `#${element.id}`;
    } else if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(Boolean).slice(0, 3);
      if (classes.length) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    // Add data-testid if present
    const testId = element.getAttribute('data-testid');
    if (testId) {
      selector += `[data-testid="${testId}"]`;
    }
    
    return selector;
  }

  // ============ Track Methods ============

  async trackClick(click: TrackedClick): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('click', 'interaction', click, {
      source: 'user',
      componentPath: this.componentStack.join(' > '),
      importance: 0.3,
      embedText: `clicked ${click.tagName} ${click.text || click.id || click.className || ''}`,
    });
  }

  async trackNavigation(nav: TrackedNavigation): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('navigation', 'navigation', nav, {
      source: 'user',
      importance: 0.6,
      embedText: `navigated from ${nav.from} to ${nav.to}`,
    });
  }

  async trackViewChange(view: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('view_change', 'navigation', {
      view,
      params,
      timestamp: Date.now(),
    }, {
      source: 'user',
      importance: 0.5,
      embedText: `switched to view ${view}`,
    });
  }

  async trackContainerStart(container: TrackedContainer): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('container_start', 'container', container, {
      source: 'system',
      importance: 0.8,
      embedText: `started container ${container.imageName} with tools ${container.tools?.join(', ') || 'none'}`,
    });
  }

  async trackContainerStop(containerId: string, reason?: string): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('container_stop', 'container', {
      containerId,
      reason,
    }, {
      source: 'system',
      importance: 0.7,
      embedText: `stopped container ${containerId} reason: ${reason || 'user requested'}`,
    });
  }

  async trackServiceConnect(service: TrackedService): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('service_connect', 'service', service, {
      source: 'system',
      importance: 0.8,
      embedText: `connected to service ${service.serviceName} with capabilities ${service.capabilities?.join(', ') || 'none'}`,
    });
  }

  async trackServiceDisconnect(serviceId: string, reason?: string): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('service_disconnect', 'service', {
      serviceId,
      reason,
    }, {
      source: 'system',
      importance: 0.6,
      embedText: `disconnected from service ${serviceId}`,
    });
  }

  async trackMCPConnect(connection: TrackedMCPConnection): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('mcp_connect', 'agent', connection, {
      source: 'system',
      importance: 0.9,
      embedText: `connected to MCP server ${connection.serverName} with tools ${connection.tools.join(', ')}`,
    });
  }

  async trackMCPDisconnect(serverId: string): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('mcp_disconnect', 'agent', { serverId }, {
      source: 'system',
      importance: 0.7,
      embedText: `disconnected from MCP server ${serverId}`,
    });
  }

  async trackToolInvocation(invocation: TrackedToolInvocation): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('tool_invoke', 'agent', invocation, {
      source: 'agent',
      importance: 0.8,
      embedText: `invoked tool ${invocation.toolName} with input ${JSON.stringify(invocation.input).slice(0, 200)}`,
    });
  }

  async trackModelSwitch(modelSwitch: TrackedModelSwitch): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('model_switch', 'model', modelSwitch, {
      source: 'user',
      importance: 0.9,
      embedText: `switched model from ${modelSwitch.from || 'none'} to ${modelSwitch.to} (${modelSwitch.provider})`,
    });
  }

  async trackDOMMutation(mutation: TrackedDOMMutation): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('dom_mutation', 'interaction', mutation, {
      source: 'system',
      importance: 0.2,
      embedText: `DOM ${mutation.type} on ${mutation.target}`,
    });
  }

  async trackUserInput(input: { field: string; value: string; type: string }): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('user_input', 'interaction', input, {
      source: 'user',
      importance: 0.4,
      embedText: `user input in ${input.field}: ${input.value.slice(0, 100)}`,
    });
  }

  async trackAgentAction(action: TrackedAgentAction): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('agent_action', 'agent', action, {
      source: 'agent',
      importance: 0.9,
      embedText: `agent ${action.agentId} performed ${action.action} on ${action.target || 'system'}: ${action.reasoning || ''}`,
    });
  }

  async trackAgentRequest(request: string, context: Record<string, unknown>): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('agent_request', 'agent', { request, context }, {
      source: 'user',
      importance: 0.8,
      embedText: `user request to agent: ${request.slice(0, 200)}`,
    });
  }

  async trackError(error: { message: string; stack?: string; context?: Record<string, unknown> }): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('error', 'system', error, {
      source: 'system',
      importance: 1.0,
      embedText: `error: ${error.message}`,
    });
  }

  async trackCapabilityChange(capability: TrackedCapability): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('capability_change', 'service', capability, {
      source: 'system',
      importance: 0.7,
      embedText: `${capability.entityType} ${capability.entityId} capabilities: ${capability.capabilities.join(', ')}`,
    });
  }

  async trackImagePull(image: { name: string; tag: string; size?: number; digest?: string }): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('image_pull', 'container', image, {
      source: 'system',
      importance: 0.7,
      embedText: `pulled image ${image.name}:${image.tag}`,
    });
  }

  async trackImageBuild(image: { name: string; dockerfile?: string; context?: string }): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('image_build', 'container', image, {
      source: 'system',
      importance: 0.8,
      embedText: `built image ${image.name}`,
    });
  }

  async trackNetworkEvent(event: { type: string; source: string; destination: string; data?: unknown }): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('network_event', 'network', event, {
      source: 'system',
      importance: 0.5,
      embedText: `network ${event.type} from ${event.source} to ${event.destination}`,
    });
  }

  async trackFileChange(file: { path: string; action: 'create' | 'modify' | 'delete'; content?: string }): Promise<void> {
    if (!this.memoryStore) return;
    
    await this.memoryStore.append('file_change', 'file', file, {
      source: 'system',
      importance: 0.6,
      embedText: `file ${file.action}: ${file.path}`,
    });
  }

  // ============ Component Context ============

  pushComponent(name: string): void {
    this.componentStack.push(name);
  }

  popComponent(): void {
    this.componentStack.pop();
  }

  getCurrentComponentPath(): string {
    return this.componentStack.join(' > ');
  }
}

// ============ Singleton Instance ============

let trackerInstance: EventTracker | null = null;

export async function getEventTracker(): Promise<EventTracker> {
  if (!trackerInstance) {
    trackerInstance = new EventTracker();
    await trackerInstance.initialize();
  }
  return trackerInstance;
}

export function getEventTrackerSync(): EventTracker | null {
  return trackerInstance;
}
