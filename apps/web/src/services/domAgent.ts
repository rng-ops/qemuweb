/**
 * DOM Agent
 * 
 * An agent that runs inside the architecture and can:
 * - Connect to MCP servers and perform actions
 * - Manipulate the UI based on user requests
 * - Hot-reload when its code changes
 * - Execute code transformations
 */

import { getMemoryStore, VectorMemoryStore } from './vectorMemory';
import { getEventTracker, EventTracker } from './eventTracker';

// ============ Types ============

export interface AgentConfig {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  mcpServers: MCPServerRef[];
  model: ModelConfig;
}

export type AgentCapability =
  | 'dom_manipulation'
  | 'code_generation'
  | 'code_execution'
  | 'file_operations'
  | 'network_operations'
  | 'container_management'
  | 'service_management'
  | 'memory_access'
  | 'view_creation'
  | 'report_generation';

export interface MCPServerRef {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'websocket';
  endpoint?: string;
  tools: string[];
}

export interface ModelConfig {
  provider: 'remote' | 'local' | 'in-architecture';
  modelId: string;
  endpoint?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentAction {
  id: string;
  type: AgentActionType;
  target?: string;
  params: Record<string, unknown>;
  reasoning?: string;
}

export type AgentActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'drag'
  | 'create_view'
  | 'modify_view'
  | 'remove_view'
  | 'execute_code'
  | 'call_tool'
  | 'start_service'
  | 'stop_service'
  | 'create_container'
  | 'destroy_container'
  | 'export_report'
  | 'arrange_layout';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCall?: {
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
  };
}

export interface HotReloadConfig {
  enabled: boolean;
  watchPatterns: string[];
  debounceMs: number;
}

export interface AgentState {
  isRunning: boolean;
  currentTask?: string;
  pendingActions: AgentAction[];
  history: AgentMessage[];
  lastError?: string;
  codeVersion: number;
}

// ============ DOM Operations ============

const domOps = {
  querySelector(selector: string): Element | null {
    return document.querySelector(selector);
  },

  querySelectorAll(selector: string): Element[] {
    return Array.from(document.querySelectorAll(selector));
  },

  click(selector: string): boolean {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      el.click();
      return true;
    }
    return false;
  },

  type(selector: string, text: string): boolean {
    const el = document.querySelector(selector);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  },

  scroll(selector: string, options: ScrollToOptions): boolean {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollTo(options);
      return true;
    }
    return false;
  },

  getAttribute(selector: string, attr: string): string | null {
    const el = document.querySelector(selector);
    return el?.getAttribute(attr) || null;
  },

  setAttribute(selector: string, attr: string, value: string): boolean {
    const el = document.querySelector(selector);
    if (el) {
      el.setAttribute(attr, value);
      return true;
    }
    return false;
  },

  getInnerText(selector: string): string | null {
    const el = document.querySelector(selector);
    return el instanceof HTMLElement ? el.innerText : null;
  },

  getComputedStyle(selector: string): CSSStyleDeclaration | null {
    const el = document.querySelector(selector);
    return el ? window.getComputedStyle(el) : null;
  },

  waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  },

  injectComponent(containerId: string, html: string): boolean {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = html;
      return true;
    }
    return false;
  },
};

// ============ Code Execution Sandbox ============

class CodeSandbox {
  private iframe: HTMLIFrameElement | null = null;

  initialize(): void {
    // Create sandboxed iframe for code execution
    this.iframe = document.createElement('iframe');
    this.iframe.sandbox.add('allow-scripts');
    this.iframe.style.display = 'none';
    document.body.appendChild(this.iframe);
  }

  async execute(code: string, context: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.iframe?.contentWindow) {
        reject(new Error('Sandbox not initialized'));
        return;
      }

      const messageHandler = (event: MessageEvent) => {
        if (event.source === this.iframe?.contentWindow) {
          window.removeEventListener('message', messageHandler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      window.addEventListener('message', messageHandler);

      const wrappedCode = `
        try {
          const context = ${JSON.stringify(context)};
          const result = (function() { ${code} })();
          parent.postMessage({ result }, '*');
        } catch (error) {
          parent.postMessage({ error: error.message }, '*');
        }
      `;

      this.iframe.contentWindow.postMessage({ type: 'execute', code: wrappedCode }, '*');
    });
  }

  destroy(): void {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }
}

// ============ DOM Agent Class ============

export class DOMAgent {
  private config: AgentConfig;
  private state: AgentState;
  private memoryStore: VectorMemoryStore | null = null;
  private eventTracker: EventTracker | null = null;
  private sandbox: CodeSandbox;
  private hotReloadConfig: HotReloadConfig;
  private codeWatcher: (() => void) | null = null;
  private subscribers: Set<(state: AgentState) => void> = new Set();

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      isRunning: false,
      pendingActions: [],
      history: [],
      codeVersion: 1,
    };
    this.sandbox = new CodeSandbox();
    this.hotReloadConfig = {
      enabled: true,
      watchPatterns: ['**/*.tsx', '**/*.ts'],
      debounceMs: 500,
    };
  }

  async initialize(): Promise<void> {
    this.memoryStore = await getMemoryStore();
    this.eventTracker = await getEventTracker();
    this.sandbox.initialize();
    
    if (this.hotReloadConfig.enabled) {
      this.setupHotReload();
    }

    // Record agent initialization
    await this.eventTracker.trackAgentAction({
      agentId: this.config.id,
      action: 'initialize',
      reasoning: 'Agent started and ready to accept commands',
    });
  }

  private setupHotReload(): void {
    // Listen for HMR updates from Vite
    if (import.meta.hot) {
      import.meta.hot.on('vite:beforeUpdate', () => {
        this.state.codeVersion++;
        this.notifySubscribers();
      });
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback({ ...this.state }));
  }

  subscribe(callback: (state: AgentState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // ============ Core Agent Methods ============

  async processUserRequest(request: string): Promise<string> {
    this.state.currentTask = request;
    this.state.isRunning = true;
    this.notifySubscribers();

    try {
      // Add user message to history
      this.state.history.push({ role: 'user', content: request });

      // Get relevant context from memory
      const context = await this.gatherContext(request);

      // Generate response based on model config
      const response = await this.generateResponse(request, context);

      // Parse and execute any actions
      const actions = this.parseActions(response);
      for (const action of actions) {
        await this.executeAction(action);
      }

      // Add assistant response to history
      this.state.history.push({ role: 'assistant', content: response });

      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.state.lastError = errorMsg;
      
      await this.eventTracker?.trackError({
        message: errorMsg,
        context: { request, agentId: this.config.id },
      });
      
      throw error;
    } finally {
      this.state.isRunning = false;
      this.state.currentTask = undefined;
      this.notifySubscribers();
    }
  }

  private async gatherContext(request: string): Promise<string> {
    if (!this.memoryStore) return '';

    // Semantic search for relevant memories
    const results = await this.memoryStore.semanticSearch(request, {
      limit: 20,
      minImportance: 0.3,
    });

    // Format context
    const contextParts = results.map(r => {
      const entry = r.entry;
      return `[${entry.type}] ${JSON.stringify(entry.data)}`;
    });

    return contextParts.join('\n');
  }

  private async generateResponse(request: string, context: string): Promise<string> {
    const { model } = this.config;

    // Build system prompt
    const systemPrompt = `You are a DOM agent capable of manipulating the UI and executing code.
Available capabilities: ${this.config.capabilities.join(', ')}
Available MCP servers: ${this.config.mcpServers.map(s => s.name).join(', ')}

Recent context:
${context}

Respond with actions in the format:
[ACTION:type:target:params]

Available action types: navigate, click, type, scroll, create_view, modify_view, execute_code, call_tool, start_service, stop_service, export_report, arrange_layout`;

    // Call model based on provider
    switch (model.provider) {
      case 'remote':
        return this.callRemoteModel(systemPrompt, request);
      case 'local':
        return this.callLocalModel(systemPrompt, request);
      case 'in-architecture':
        return this.callInArchitectureModel(systemPrompt, request);
      default:
        return `I understand you want to: ${request}. Please configure a model to enable full agent capabilities.`;
    }
  }

  private async callRemoteModel(system: string, user: string): Promise<string> {
    const { model } = this.config;
    
    if (!model.endpoint) {
      throw new Error('Remote model endpoint not configured');
    }

    const response = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(model.apiKey ? { 'Authorization': `Bearer ${model.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: model.temperature ?? 0.7,
        max_tokens: model.maxTokens ?? 2048,
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.content || '';
  }

  private async callLocalModel(system: string, user: string): Promise<string> {
    // Call local model (e.g., Ollama)
    const { model } = this.config;
    const endpoint = model.endpoint || 'http://localhost:11434/api/generate';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.modelId,
          prompt: `${system}\n\nUser: ${user}\n\nAssistant:`,
          stream: false,
        }),
      });

      const data = await response.json();
      return data.response || '';
    } catch {
      return `Local model not available. Request: ${user}`;
    }
  }

  private async callInArchitectureModel(_system: string, user: string): Promise<string> {
    // Call model running inside the VM/container architecture
    // This would communicate via the sidecar protocol
    return `In-architecture model processing: ${user}`;
  }

  private parseActions(response: string): AgentAction[] {
    const actions: AgentAction[] = [];
    const actionRegex = /\[ACTION:(\w+):([^:]*):([^\]]*)\]/g;
    let match;

    while ((match = actionRegex.exec(response)) !== null) {
      const [, type, target, paramsStr] = match;
      let params: Record<string, unknown> = {};
      
      try {
        params = JSON.parse(paramsStr || '{}');
      } catch {
        params = { raw: paramsStr };
      }

      actions.push({
        id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: type as AgentActionType,
        target: target || undefined,
        params,
      });
    }

    return actions;
  }

  // ============ Action Execution ============

  async executeAction(action: AgentAction): Promise<unknown> {
    await this.eventTracker?.trackAgentAction({
      agentId: this.config.id,
      action: action.type,
      target: action.target,
      input: action.params,
      reasoning: action.reasoning,
    });

    switch (action.type) {
      case 'click':
        return domOps.click(action.target || '');
      
      case 'type':
        return domOps.type(action.target || '', action.params.text as string);
      
      case 'scroll':
        return domOps.scroll(action.target || '', action.params as ScrollToOptions);
      
      case 'navigate':
        window.location.href = action.target || '/';
        return true;
      
      case 'execute_code':
        return this.sandbox.execute(action.params.code as string, action.params.context as Record<string, unknown>);
      
      case 'call_tool':
        return this.callMCPTool(action.params.server as string, action.params.tool as string, action.params.input as Record<string, unknown>);
      
      case 'create_view':
        return this.createView(action.params);
      
      case 'modify_view':
        return this.modifyView(action.target || '', action.params);
      
      case 'arrange_layout':
        return this.arrangeLayout(action.params);
      
      case 'export_report':
        return this.exportReport(action.params);
      
      default:
        console.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  }

  private async callMCPTool(serverId: string, toolName: string, input: Record<string, unknown>): Promise<unknown> {
    const server = this.config.mcpServers.find(s => s.id === serverId);
    if (!server) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    // Record tool invocation
    await this.eventTracker?.trackToolInvocation({
      toolName,
      serverId,
      input,
    });

    // TODO: Implement actual MCP tool calling
    return { success: true, tool: toolName, input };
  }

  private createView(params: Record<string, unknown>): boolean {
    // Dispatch custom event for view creation
    const event = new CustomEvent('agent:create-view', {
      detail: params,
      bubbles: true,
    });
    document.dispatchEvent(event);
    return true;
  }

  private modifyView(viewId: string, params: Record<string, unknown>): boolean {
    const event = new CustomEvent('agent:modify-view', {
      detail: { viewId, ...params },
      bubbles: true,
    });
    document.dispatchEvent(event);
    return true;
  }

  private arrangeLayout(params: Record<string, unknown>): boolean {
    const event = new CustomEvent('agent:arrange-layout', {
      detail: params,
      bubbles: true,
    });
    document.dispatchEvent(event);
    return true;
  }

  private async exportReport(params: Record<string, unknown>): Promise<Blob> {
    const reportType = params.type as string || 'json';
    const includeProvenance = params.includeProvenance !== false;

    // Gather data for report
    const memories = await this.memoryStore?.exportMemories();
    const stats = await this.memoryStore?.getStats();

    const report = {
      generatedAt: new Date().toISOString(),
      agentId: this.config.id,
      stats,
      memories: memories?.slice(-100), // Last 100 entries
      ...(includeProvenance ? {
        provenance: {
          sessionId: this.memoryStore?.getSessionId(),
          codeVersion: this.state.codeVersion,
          capabilities: this.config.capabilities,
        },
      } : {}),
    };

    const blob = new Blob(
      [reportType === 'json' ? JSON.stringify(report, null, 2) : this.formatReportAsText(report)],
      { type: reportType === 'json' ? 'application/json' : 'text/plain' }
    );

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${Date.now()}.${reportType}`;
    a.click();
    URL.revokeObjectURL(url);

    return blob;
  }

  private formatReportAsText(report: Record<string, unknown>): string {
    return `Agent Report
Generated: ${report.generatedAt}
Agent ID: ${report.agentId}

Statistics:
${JSON.stringify(report.stats, null, 2)}

Recent Activity:
${JSON.stringify(report.memories, null, 2)}
`;
  }

  // ============ Lifecycle ============

  getState(): AgentState {
    return { ...this.state };
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    Object.assign(this.config, updates);
    this.notifySubscribers();
  }

  async destroy(): Promise<void> {
    this.sandbox.destroy();
    if (this.codeWatcher) {
      this.codeWatcher();
    }
    this.subscribers.clear();
    
    await this.eventTracker?.trackAgentAction({
      agentId: this.config.id,
      action: 'destroy',
      reasoning: 'Agent shutting down',
    });
  }
}

// ============ Singleton Factory ============

const agentInstances = new Map<string, DOMAgent>();

export async function createAgent(config: AgentConfig): Promise<DOMAgent> {
  if (agentInstances.has(config.id)) {
    return agentInstances.get(config.id)!;
  }

  const agent = new DOMAgent(config);
  await agent.initialize();
  agentInstances.set(config.id, agent);
  return agent;
}

export function getAgent(id: string): DOMAgent | undefined {
  return agentInstances.get(id);
}

export async function destroyAgent(id: string): Promise<void> {
  const agent = agentInstances.get(id);
  if (agent) {
    await agent.destroy();
    agentInstances.delete(id);
  }
}

export function getAllAgents(): DOMAgent[] {
  return Array.from(agentInstances.values());
}
