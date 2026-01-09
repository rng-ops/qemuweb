/**
 * Dashboard Context Provider
 * 
 * Captures and forwards dashboard state (running services, images, etc.)
 * to Atlas for context awareness.
 */

import type { AtlasEvent } from './atlasOrchestrator';

export interface ServiceInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'starting';
  type: 'container' | 'mcp' | 'mcp-server' | 'agent' | 'vm';
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface ImageInfo {
  name: string;
  tag: string;
  size: string;
  arch?: string;
  verified?: boolean;
}

export interface DashboardContext {
  services: ServiceInfo[];
  images: ImageInfo[];
  currentView: 'dashboard' | 'ide' | 'vm' | 'network' | 'browser' | 'ollama';
  timestamp: number;
}

class DashboardContextProvider {
  private currentContext: DashboardContext | null = null;
  private subscribers = new Set<(context: DashboardContext) => void>();
  private updateTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Update the current dashboard context
   */
  updateContext(context: Partial<DashboardContext>): void {
    this.currentContext = {
      ...this.currentContext,
      ...context,
      timestamp: Date.now(),
    } as DashboardContext;

    // Debounce notifications
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    this.updateTimer = setTimeout(() => {
      this.notifySubscribers();
    }, 500);
  }

  /**
   * Set running services
   */
  setServices(services: ServiceInfo[]): void {
    this.updateContext({ services });
  }

  /**
   * Set available images
   */
  setImages(images: ImageInfo[]): void {
    this.updateContext({ images });
  }

  /**
   * Set current view
   */
  setCurrentView(view: DashboardContext['currentView']): void {
    this.updateContext({ currentView: view });
  }

  /**
   * Get current context
   */
  getContext(): DashboardContext | null {
    return this.currentContext;
  }

  /**
   * Get context as formatted string for chat
   */
  getContextString(): string {
    if (!this.currentContext) {
      return 'No dashboard context available.';
    }

    const lines: string[] = [];
    
    lines.push(`Current View: ${this.currentContext.currentView}`);
    
    if (this.currentContext.services && this.currentContext.services.length > 0) {
      lines.push(`\nRunning Services (${this.currentContext.services.length}):`);
      for (const service of this.currentContext.services) {
        lines.push(`  - ${service.name} (${service.type}) - ${service.status}`);
        if (service.capabilities && service.capabilities.length > 0) {
          lines.push(`    Capabilities: ${service.capabilities.join(', ')}`);
        }
      }
    }

    if (this.currentContext.images && this.currentContext.images.length > 0) {
      lines.push(`\nAvailable Images (${this.currentContext.images.length}):`);
      for (const image of this.currentContext.images) {
        const verified = image.verified ? ' ✓' : '';
        lines.push(`  - ${image.name}:${image.tag} (${image.size})${verified}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate an event from current context
   */
  createContextEvent(): AtlasEvent {
    return {
      id: `dashboard-context-${Date.now()}`,
      timestamp: Date.now(),
      type: 'context:passed' as const,
      source: 'system' as const,
      data: {
        context: 'dashboard-state',
        services: this.currentContext?.services || [],
        images: this.currentContext?.images || [],
        currentView: this.currentContext?.currentView || 'unknown',
      },
    };
  }

  /**
   * Subscribe to context changes
   */
  onContextChange(callback: (context: DashboardContext) => void): () => void {
    this.subscribers.add(callback);
    // Immediately notify with current context
    if (this.currentContext) {
      callback(this.currentContext);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    if (!this.currentContext) return;
    for (const subscriber of this.subscribers) {
      subscriber(this.currentContext);
    }
  }
}

// Singleton
let provider: DashboardContextProvider | null = null;

export function getDashboardContext(): DashboardContextProvider {
  if (!provider) {
    provider = new DashboardContextProvider();
  }
  return provider;
}
