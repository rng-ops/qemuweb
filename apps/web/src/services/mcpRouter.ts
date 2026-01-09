/**
 * MCP Server Router
 * 
 * Routes MCP requests to servers running on:
 * - Local QEMU instances
 * - Remote peers via busybox router
 * - Container instances
 */

import type { MCPServerTarget } from './agentProfiles';
import { getAuditLog } from './auditLog';

// ============ Types ============

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
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface RouterConfig {
  busyboxRouterIp: string;
  busyboxRouterPort: number;
  dhcpEnabled: boolean;
  natEnabled: boolean;
  subnet: string;
  gateway: string;
}

export interface PeerConnection {
  id: string;
  name: string;
  address: string;
  port: number;
  status: 'connected' | 'disconnected' | 'connecting';
  lastSeen: number;
  mcpServers: MCPServerTarget[];
}

export interface NetworkRoute {
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
}

export interface DHCPLease {
  mac: string;
  ip: string;
  hostname?: string;
  expiresAt: number;
}

// ============ MCP Router Class ============

class MCPServerRouter {
  private targets: Map<string, MCPServerTarget> = new Map();
  private peers: Map<string, PeerConnection> = new Map();
  private routes: NetworkRoute[] = [];
  private dhcpLeases: DHCPLease[] = [];
  private routerConfig: RouterConfig;
  private wsConnections: Map<string, WebSocket> = new Map();
  private pendingRequests: Map<string, { resolve: (value: MCPResponse) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = new Map();

  constructor() {
    this.routerConfig = {
      busyboxRouterIp: '10.0.0.1',
      busyboxRouterPort: 8765,
      dhcpEnabled: true,
      natEnabled: true,
      subnet: '10.0.0.0/24',
      gateway: '10.0.0.1',
    };

    // Default routes
    this.routes = [
      { destination: '0.0.0.0/0', gateway: '10.0.0.1', interface: 'eth0', metric: 100 },
      { destination: '10.0.0.0/24', gateway: '0.0.0.0', interface: 'eth0', metric: 0 },
    ];
  }

  // ============ Configuration ============

  configureRouter(config: Partial<RouterConfig>): void {
    this.routerConfig = { ...this.routerConfig, ...config };
  }

  getRouterConfig(): RouterConfig {
    return { ...this.routerConfig };
  }

  // ============ Target Management ============

  registerTarget(target: MCPServerTarget): void {
    this.targets.set(target.id, target);
    console.log(`[MCPRouter] Registered target: ${target.name} (${target.type})`);
  }

  unregisterTarget(targetId: string): void {
    const target = this.targets.get(targetId);
    if (target) {
      this.closeConnection(targetId);
      this.targets.delete(targetId);
      console.log(`[MCPRouter] Unregistered target: ${target.name}`);
    }
  }

  getTargets(): MCPServerTarget[] {
    return Array.from(this.targets.values());
  }

  getTarget(id: string): MCPServerTarget | undefined {
    return this.targets.get(id);
  }

  // ============ Peer Management ============

  async connectPeer(peer: Omit<PeerConnection, 'id' | 'status' | 'lastSeen'>): Promise<PeerConnection> {
    const connection: PeerConnection = {
      ...peer,
      id: `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'connecting',
      lastSeen: Date.now(),
    };

    this.peers.set(connection.id, connection);

    try {
      // Attempt to connect via busybox router
      const routedAddress = await this.routeToAddress(peer.address, peer.port);
      
      // Test connection
      const testResponse = await fetch(`http://${routedAddress}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (testResponse.ok) {
        connection.status = 'connected';
        
        // Discover MCP servers on peer
        const servers = await this.discoverPeerServers(connection);
        connection.mcpServers = servers;
      } else {
        connection.status = 'disconnected';
      }
    } catch (error) {
      console.error(`[MCPRouter] Failed to connect to peer: ${error}`);
      connection.status = 'disconnected';
    }

    return connection;
  }

  disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = 'disconnected';
      // Unregister all MCP servers from this peer
      for (const server of peer.mcpServers) {
        this.unregisterTarget(server.id);
      }
    }
  }

  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  private async discoverPeerServers(peer: PeerConnection): Promise<MCPServerTarget[]> {
    // Would query the peer for available MCP servers
    // For now, return mock data
    return [
      {
        id: `${peer.id}-mcp-1`,
        name: `${peer.name} MCP Server`,
        type: 'remote',
        endpoint: `http://${peer.address}:${peer.port}/mcp`,
        transport: 'http',
        peerAddress: peer.address,
        peerPort: peer.port,
        routerViaIp: this.routerConfig.busyboxRouterIp,
        capabilities: ['tools', 'prompts'],
        authRequired: false,
      },
    ];
  }

  // ============ Routing ============

  private async routeToAddress(address: string, port: number): Promise<string> {
    // Check if address needs to be routed through busybox router
    const isInSubnet = this.isAddressInSubnet(address, this.routerConfig.subnet);
    
    if (isInSubnet) {
      // Direct route within subnet
      return `${address}:${port}`;
    }

    // Route through NAT
    if (this.routerConfig.natEnabled) {
      // In a real implementation, this would set up port forwarding
      return `${this.routerConfig.busyboxRouterIp}:${port}`;
    }

    return `${address}:${port}`;
  }

  private isAddressInSubnet(address: string, subnet: string): boolean {
    // Simple check - would need proper CIDR matching in production
    const [subnetBase] = subnet.split('/');
    const subnetPrefix = subnetBase.split('.').slice(0, 3).join('.');
    const addressPrefix = address.split('.').slice(0, 3).join('.');
    return subnetPrefix === addressPrefix;
  }

  addRoute(route: NetworkRoute): void {
    this.routes.push(route);
    this.routes.sort((a, b) => a.metric - b.metric);
  }

  removeRoute(destination: string): void {
    this.routes = this.routes.filter(r => r.destination !== destination);
  }

  getRoutes(): NetworkRoute[] {
    return [...this.routes];
  }

  // ============ DHCP ============

  requestLease(mac: string, hostname?: string): DHCPLease | null {
    if (!this.routerConfig.dhcpEnabled) return null;

    // Check for existing lease
    const existing = this.dhcpLeases.find(l => l.mac === mac);
    if (existing && existing.expiresAt > Date.now()) {
      return existing;
    }

    // Allocate new IP
    const usedIps = new Set(this.dhcpLeases.map(l => l.ip));
    const [subnetBase] = this.routerConfig.subnet.split('/');
    const baseOctets = subnetBase.split('.').slice(0, 3);
    
    let newIp: string | null = null;
    for (let i = 10; i < 254; i++) {
      const candidate = `${baseOctets.join('.')}.${i}`;
      if (!usedIps.has(candidate)) {
        newIp = candidate;
        break;
      }
    }

    if (!newIp) return null;

    const lease: DHCPLease = {
      mac,
      ip: newIp,
      hostname,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    this.dhcpLeases.push(lease);
    return lease;
  }

  releaseLease(mac: string): void {
    this.dhcpLeases = this.dhcpLeases.filter(l => l.mac !== mac);
  }

  getLeases(): DHCPLease[] {
    // Clean expired leases
    this.dhcpLeases = this.dhcpLeases.filter(l => l.expiresAt > Date.now());
    return [...this.dhcpLeases];
  }

  // ============ MCP Request Routing ============

  async sendRequest(targetId: string, request: MCPRequest): Promise<MCPResponse> {
    const target = this.targets.get(targetId);
    if (!target) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32001, message: 'Target not found' },
      };
    }

    const auditLog = await getAuditLog();
    await auditLog.log('tool_invocation', {
      action: 'mcp_request',
      target: targetId,
      method: request.method,
      actor: 'system',
    });

    try {
      switch (target.transport) {
        case 'http':
          return await this.sendHttpRequest(target, request);
        case 'websocket':
          return await this.sendWebSocketRequest(target, request);
        case 'stdio':
          return await this.sendStdioRequest(target, request);
        default:
          throw new Error(`Unsupported transport: ${target.transport}`);
      }
    } catch (error) {
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

  private async sendHttpRequest(target: MCPServerTarget, request: MCPRequest): Promise<MCPResponse> {
    const endpoint = target.routerViaIp
      ? `http://${target.routerViaIp}:${this.routerConfig.busyboxRouterPort}/proxy/${target.peerAddress}:${target.peerPort}/mcp`
      : target.endpoint;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (target.authRequired && target.authToken) {
      headers['Authorization'] = `Bearer ${target.authToken}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private async sendWebSocketRequest(target: MCPServerTarget, request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      let ws = this.wsConnections.get(target.id);

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const endpoint = target.routerViaIp
          ? `ws://${target.routerViaIp}:${this.routerConfig.busyboxRouterPort}/proxy/${target.peerAddress}:${target.peerPort}/mcp`
          : target.endpoint.replace('http', 'ws');

        ws = new WebSocket(endpoint);
        
        ws.onopen = () => {
          ws!.send(JSON.stringify(request));
        };

        ws.onerror = (error) => {
          reject(new Error(`WebSocket error: ${error}`));
        };

        this.wsConnections.set(target.id, ws);
      } else {
        ws.send(JSON.stringify(request));
      }

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(String(request.id), { resolve, reject, timeout });

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data) as MCPResponse;
          const pending = this.pendingRequests.get(String(response.id));
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(String(response.id));
            pending.resolve(response);
          }
        } catch (error) {
          console.error('[MCPRouter] Failed to parse WebSocket message:', error);
        }
      };
    });
  }

  private async sendStdioRequest(target: MCPServerTarget, request: MCPRequest): Promise<MCPResponse> {
    // For QEMU instances with stdio transport, we need to communicate via the VM
    // This would use the QEMU client to send commands to the VM's stdio
    console.log(`[MCPRouter] Stdio request to ${target.name}:`, request.method);
    
    // Mock response for development
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        message: `Stdio request to ${target.name}: ${request.method}`,
        params: request.params,
      },
    };
  }

  private closeConnection(targetId: string): void {
    const ws = this.wsConnections.get(targetId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(targetId);
    }
  }

  // ============ Cleanup ============

  destroy(): void {
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    this.wsConnections.clear();
    this.pendingRequests.clear();
    this.targets.clear();
    this.peers.clear();
  }
}

// ============ Singleton ============

let routerInstance: MCPServerRouter | null = null;

export function getMCPRouter(): MCPServerRouter {
  if (!routerInstance) {
    routerInstance = new MCPServerRouter();
  }
  return routerInstance;
}

export default MCPServerRouter;
