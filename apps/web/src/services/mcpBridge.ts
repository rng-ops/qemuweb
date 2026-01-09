/**
 * MCP Bridge Service
 * 
 * Exposes MCP servers to external agents including:
 * - Ollama running on the host machine
 * - Remote AI agents on the network
 * - Other browser instances
 * 
 * Supports:
 * - WebSocket transport for real-time communication
 * - HTTP transport for request/response
 * - Discovery via mDNS-like announcement
 * - Authentication and access control
 */

import { MCPServerConfig } from '@qemuweb/vm-config';

// MCP Protocol Types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// Bridge Types
export interface MCPBridgeConfig {
  // WebSocket server config
  wsPort?: number;
  wsHost?: string;
  
  // HTTP server config
  httpPort?: number;
  httpHost?: string;
  
  // Authentication
  authMode: 'none' | 'token' | 'mtls';
  authToken?: string;
  
  // Access control
  allowedOrigins?: string[];
  allowedIPs?: string[];
  
  // Rate limiting
  rateLimit?: {
    requestsPerMinute: number;
    burstSize: number;
  };
  
  // Ollama integration
  ollamaEnabled: boolean;
  ollamaHost?: string;
  ollamaPort?: number;
}

export interface ConnectedAgent {
  id: string;
  type: 'browser' | 'ollama' | 'remote' | 'local';
  name: string;
  ip: string;
  connectedAt: number;
  lastActivity: number;
  requestCount: number;
  
  // Capabilities
  capabilities: string[];
  
  // Connection info
  transport: 'websocket' | 'http';
  connectionId: string;
  
  // Authentication
  authenticated: boolean;
  permissions: string[];
}

export interface BridgedServer {
  id: string;
  name: string;
  config: MCPServerConfig;
  status: 'online' | 'offline' | 'error';
  
  // Exposure settings
  exposed: boolean;
  allowedAgents: string[]; // 'all' or specific agent IDs
  
  // Statistics
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
}

export interface MCPDiscoveryAnnouncement {
  type: 'mcp-server';
  name: string;
  host: string;
  port: number;
  transport: 'websocket' | 'http';
  capabilities: string[];
  version: string;
  authRequired: boolean;
}

// Event types
type BridgeEventType = 
  | 'agent-connected'
  | 'agent-disconnected'
  | 'request'
  | 'response'
  | 'error'
  | 'server-registered'
  | 'server-unregistered';

interface BridgeEvent {
  type: BridgeEventType;
  timestamp: number;
  data: unknown;
}

type BridgeEventCallback = (event: BridgeEvent) => void;

/**
 * MCP Bridge Service
 * Creates a bridge between local MCP servers and external agents
 */
class MCPBridgeService {
  private config: MCPBridgeConfig | null = null;
  private servers: Map<string, BridgedServer> = new Map();
  private agents: Map<string, ConnectedAgent> = new Map();
  private eventCallbacks: Set<BridgeEventCallback> = new Set();
  
  // WebSocket connections (in browser, we simulate this with BroadcastChannel)
  private broadcastChannel: BroadcastChannel | null = null;
  
  // Ollama client
  private ollamaClient: OllamaClient | null = null;
  
  private isRunning = false;

  /**
   * Initialize the bridge with configuration
   */
  async init(config: MCPBridgeConfig): Promise<void> {
    this.config = config;
    
    // Set up BroadcastChannel for cross-tab communication
    this.broadcastChannel = new BroadcastChannel('mcp-bridge');
    this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
    
    // Initialize Ollama client if enabled
    if (config.ollamaEnabled) {
      this.ollamaClient = new OllamaClient(
        config.ollamaHost || 'localhost',
        config.ollamaPort || 11434
      );
      await this.ollamaClient.checkConnection();
    }
    
    console.log('[MCPBridge] Initialized');
  }

  /**
   * Start the bridge server
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    // Announce presence
    this.announcePresence();
    
    // Register as a local agent for Ollama
    if (this.ollamaClient?.isConnected) {
      this.registerAgent({
        id: 'ollama-local',
        type: 'ollama',
        name: 'Ollama (Local)',
        ip: this.config?.ollamaHost || 'localhost',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        requestCount: 0,
        capabilities: ['chat', 'completion', 'embedding'],
        transport: 'http',
        connectionId: 'ollama-local',
        authenticated: true,
        permissions: ['read', 'execute'],
      });
    }
    
    this.isRunning = true;
    console.log('[MCPBridge] Started');
  }

  /**
   * Stop the bridge server
   */
  async stop(): Promise<void> {
    this.broadcastChannel?.close();
    this.agents.clear();
    this.isRunning = false;
    console.log('[MCPBridge] Stopped');
  }

  /**
   * Register an MCP server to be exposed
   */
  registerServer(config: MCPServerConfig): BridgedServer {
    const server: BridgedServer = {
      id: `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: config.name,
      config,
      status: 'online',
      exposed: true,
      allowedAgents: ['all'],
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
    };
    
    this.servers.set(server.id, server);
    this.emit({ type: 'server-registered', timestamp: Date.now(), data: server });
    
    return server;
  }

  /**
   * Unregister an MCP server
   */
  unregisterServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;
    
    this.servers.delete(serverId);
    this.emit({ type: 'server-unregistered', timestamp: Date.now(), data: server });
    
    return true;
  }

  /**
   * Get all registered servers
   */
  getServers(): BridgedServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get all connected agents
   */
  getAgents(): ConnectedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Handle incoming MCP request from an agent
   */
  async handleRequest(
    agentId: string,
    serverId: string,
    request: MCPRequest
  ): Promise<MCPResponse> {
    const agent = this.agents.get(agentId);
    const server = this.servers.get(serverId);
    
    if (!agent) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32000, message: 'Agent not found' },
      };
    }
    
    if (!server) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32001, message: 'Server not found' },
      };
    }
    
    // Check permissions
    if (!server.allowedAgents.includes('all') && !server.allowedAgents.includes(agentId)) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32002, message: 'Access denied' },
      };
    }
    
    // Check rate limiting
    if (!this.checkRateLimit(agentId)) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32003, message: 'Rate limit exceeded' },
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Route request to the appropriate handler
      const result = await this.routeRequest(server, request);
      
      // Update statistics
      const responseTime = Date.now() - startTime;
      server.requestCount++;
      server.avgResponseTime = (server.avgResponseTime * (server.requestCount - 1) + responseTime) / server.requestCount;
      agent.requestCount++;
      agent.lastActivity = Date.now();
      
      this.emit({
        type: 'request',
        timestamp: Date.now(),
        data: { agentId, serverId, method: request.method, responseTime },
      });
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      server.errorCount++;
      
      this.emit({
        type: 'error',
        timestamp: Date.now(),
        data: { agentId, serverId, error: String(error) },
      });
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
    }
  }

  /**
   * Send a request to Ollama
   */
  async sendToOllama(request: OllamaRequest): Promise<OllamaResponse> {
    if (!this.ollamaClient?.isConnected) {
      throw new Error('Ollama is not connected');
    }
    
    return this.ollamaClient.send(request);
  }

  /**
   * Subscribe to bridge events
   */
  onEvent(callback: BridgeEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Expose servers for external access
   */
  async exposeToNetwork(serverIds: string[]): Promise<string[]> {
    // Generate access URLs
    const urls: string[] = [];
    
    for (const serverId of serverIds) {
      const server = this.servers.get(serverId);
      if (server) {
        server.exposed = true;
        // In a real implementation, this would expose via actual network
        const url = `ws://localhost:${this.config?.wsPort || 8765}/mcp/${serverId}`;
        urls.push(url);
      }
    }
    
    return urls;
  }

  /**
   * Create access token for an agent
   */
  createAccessToken(agentName: string, permissions: string[]): string {
    const payload = {
      agent: agentName,
      permissions,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      iat: Date.now(),
    };
    
    // Simple base64 encoding (in production, use JWT)
    return btoa(JSON.stringify(payload));
  }

  /**
   * Validate access token
   */
  validateToken(token: string): { valid: boolean; agentName?: string; permissions?: string[] } {
    try {
      const payload = JSON.parse(atob(token));
      
      if (payload.exp < Date.now()) {
        return { valid: false };
      }
      
      return {
        valid: true,
        agentName: payload.agent,
        permissions: payload.permissions,
      };
    } catch {
      return { valid: false };
    }
  }

  // Private methods
  
  private registerAgent(agent: ConnectedAgent): void {
    this.agents.set(agent.id, agent);
    this.emit({ type: 'agent-connected', timestamp: Date.now(), data: agent });
  }

  private unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      this.emit({ type: 'agent-disconnected', timestamp: Date.now(), data: agent });
    }
  }

  private async routeRequest(server: BridgedServer, request: MCPRequest): Promise<unknown> {
    // Route based on server type - transport can be a string or an object
    const transport = server.config.transport;
    const transportType = typeof transport === 'string' ? transport : (transport as Record<string, unknown>)?.type as string;
    
    switch (transportType) {
      case 'stdio':
        // Route to local process
        return this.handleStdioRequest(server, request);
      
      case 'http':
        // Route to HTTP endpoint
        return this.handleHttpRequest(server, request);
      
      case 'websocket':
        // Route to WebSocket connection
        return this.handleWebSocketRequest(server, request);
      
      default:
        // Mock response for development
        return this.handleMockRequest(server, request);
    }
  }

  private async handleStdioRequest(server: BridgedServer, request: MCPRequest): Promise<unknown> {
    // In browser, we can't do stdio directly - would need a sidecar
    console.log('[MCPBridge] Stdio request:', request.method);
    
    return {
      message: `Stdio request to ${server.name}: ${request.method}`,
      params: request.params,
    };
  }

  private async handleHttpRequest(server: BridgedServer, request: MCPRequest): Promise<unknown> {
    const transport = server.config.transport;
    const endpoint = typeof transport === 'object' ? (transport as Record<string, unknown>).endpoint as string : undefined;
    if (!endpoint) throw new Error('No HTTP endpoint configured');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const json = await response.json();
    return json.result;
  }

  private async handleWebSocketRequest(server: BridgedServer, request: MCPRequest): Promise<unknown> {
    // Would maintain persistent WS connections
    console.log('[MCPBridge] WebSocket request:', request.method);
    
    return {
      message: `WebSocket request to ${server.name}: ${request.method}`,
      params: request.params,
    };
  }

  private async handleMockRequest(server: BridgedServer, request: MCPRequest): Promise<unknown> {
    // Mock responses for development
    switch (request.method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          serverInfo: { name: server.name, version: '1.0.0' },
          capabilities: {
            tools: {},
            prompts: {},
            resources: {},
          },
        };
      
      case 'tools/list':
        return {
          tools: [
            {
              name: 'echo',
              description: 'Echo back the input',
              inputSchema: {
                type: 'object',
                properties: { message: { type: 'string' } },
              },
            },
          ],
        };
      
      case 'tools/call':
        return {
          content: [
            {
              type: 'text',
              text: `Mock response from ${server.name}`,
            },
          ],
        };
      
      default:
        return { success: true };
    }
  }

  private checkRateLimit(agentId: string): boolean {
    if (!this.config?.rateLimit) return true;
    
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    // Simple rate limiting (in production, use proper sliding window)
    // Note: windowStart would be used for per-minute tracking
    const recentRequests = agent.requestCount; // Would need per-minute tracking
    
    return recentRequests < this.config.rateLimit.requestsPerMinute;
  }

  private announcePresence(): void {
    const announcement: MCPDiscoveryAnnouncement = {
      type: 'mcp-server',
      name: 'QemuWeb MCP Bridge',
      host: this.config?.wsHost || 'localhost',
      port: this.config?.wsPort || 8765,
      transport: 'websocket',
      capabilities: ['tools', 'prompts', 'resources'],
      version: '1.0.0',
      authRequired: this.config?.authMode !== 'none',
    };
    
    // Announce via BroadcastChannel
    this.broadcastChannel?.postMessage({
      type: 'announce',
      data: announcement,
    });
  }

  private handleBroadcastMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'announce':
        // Another tab/window announced a server
        console.log('[MCPBridge] Received announcement:', data);
        break;
      
      case 'request':
        // Handle cross-tab request
        this.handleRequest(data.agentId, data.serverId, data.request)
          .then((response) => {
            this.broadcastChannel?.postMessage({
              type: 'response',
              requestId: data.requestId,
              data: response,
            });
          });
        break;
      
      case 'agent-connect':
        // Agent connecting from another tab
        this.registerAgent(data);
        break;
      
      case 'agent-disconnect':
        // Agent disconnecting
        this.unregisterAgent(data.id);
        break;
    }
  }

  private emit(event: BridgeEvent): void {
    this.eventCallbacks.forEach((cb) => cb(event));
  }
}

// Ollama Types
export interface OllamaRequest {
  model: string;
  prompt?: string;
  messages?: OllamaMessage[];
  stream?: boolean;
  options?: OllamaOptions;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
}

export interface OllamaResponse {
  model: string;
  response?: string;
  message?: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama Client
 * Communicates with Ollama running on the host machine
 */
class OllamaClient {
  private host: string;
  private port: number;
  private _isConnected = false;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.host}:${this.port}/api/tags`, {
        method: 'GET',
      });
      
      this._isConnected = response.ok;
      console.log(`[Ollama] Connection check: ${this._isConnected ? 'OK' : 'Failed'}`);
      return this._isConnected;
    } catch (error) {
      console.log('[Ollama] Connection failed:', error);
      this._isConnected = false;
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    if (!this._isConnected) return [];
    
    try {
      const response = await fetch(`http://${this.host}:${this.port}/api/tags`);
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  async send(request: OllamaRequest): Promise<OllamaResponse> {
    const endpoint = request.messages 
      ? `http://${this.host}:${this.port}/api/chat`
      : `http://${this.host}:${this.port}/api/generate`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    return response.json();
  }

  async chat(
    model: string,
    messages: OllamaMessage[],
    options?: OllamaOptions
  ): Promise<OllamaResponse> {
    return this.send({
      model,
      messages,
      stream: false,
      options,
    });
  }

  async generate(
    model: string,
    prompt: string,
    options?: OllamaOptions
  ): Promise<OllamaResponse> {
    return this.send({
      model,
      prompt,
      stream: false,
      options,
    });
  }
}

// Export singleton
export const mcpBridge = new MCPBridgeService();

export default mcpBridge;
