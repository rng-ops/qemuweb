/**
 * Universe Service
 * 
 * Manages "universes" - isolated network environments that can be
 * connected via router images. Supports:
 * - Creating and managing network universes
 * - Configuring router images for inter-universe connectivity
 * - QoS policies and traffic shaping
 * - Connection to external MCP servers and Ollama
 */

import { openDB, IDBPDatabase } from 'idb';

// Universe Types
export interface Universe {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'connecting' | 'error';
  createdAt: number;
  updatedAt: number;
  
  // Network configuration
  network: UniverseNetwork;
  
  // Router configuration
  routers: RouterConfig[];
  
  // Connected peers (other universes)
  peers: UniversePeer[];
  
  // Services exposed from this universe
  services: ExposedService[];
  
  // QoS policies
  qosPolicies: QoSPolicy[];
  
  // Access control
  accessControl: AccessControlList;
  
  // Metrics
  metrics: UniverseMetrics;
}

export interface UniverseNetwork {
  cidr: string;
  gateway: string;
  dnsServers: string[];
  vlanId?: number;
  mtu: number;
  ipv6Enabled: boolean;
}

export interface RouterConfig {
  id: string;
  name: string;
  type: 'busybox' | 'alpine' | 'openwrt' | 'vyos' | 'custom';
  imageId: string;
  status: 'running' | 'stopped' | 'error';
  
  // Interfaces
  interfaces: RouterInterface[];
  
  // Routing tables
  routes: RouteEntry[];
  
  // Firewall rules
  firewallRules: FirewallRule[];
  
  // NAT configuration
  nat: NATConfig;
  
  // VPN configuration (for inter-universe)
  vpn?: VPNConfig;
  
  // BGP for dynamic routing
  bgp?: BGPConfig;
}

export interface RouterInterface {
  id: string;
  name: string;
  type: 'internal' | 'external' | 'peer';
  ip: string;
  netmask: string;
  mac: string;
  vlanId?: number;
  mtu: number;
  isUp: boolean;
  
  // Traffic stats
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface RouteEntry {
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  isStatic: boolean;
}

export interface FirewallRule {
  id: string;
  name: string;
  priority: number;
  action: 'allow' | 'deny' | 'drop' | 'reject';
  direction: 'inbound' | 'outbound' | 'forward';
  
  // Match criteria
  sourceIp?: string;
  destIp?: string;
  sourcePort?: string;
  destPort?: string;
  protocol?: 'tcp' | 'udp' | 'icmp' | 'any';
  
  // Logging
  log: boolean;
  
  // Stats
  matchCount: number;
  lastMatch?: number;
}

export interface NATConfig {
  enabled: boolean;
  masquerade: boolean;
  snat?: { source: string; translated: string }[];
  dnat?: { destination: string; translated: string; port?: number }[];
  portForwards: PortForward[];
}

export interface PortForward {
  externalPort: number;
  internalIp: string;
  internalPort: number;
  protocol: 'tcp' | 'udp';
  description: string;
}

export interface VPNConfig {
  type: 'wireguard' | 'ipsec' | 'openvpn' | 'gre';
  status: 'connected' | 'disconnected' | 'connecting';
  localEndpoint: string;
  remoteEndpoint: string;
  publicKey?: string;
  presharedKey?: string;
  allowedIPs: string[];
  keepalive?: number;
}

export interface BGPConfig {
  asn: number;
  routerId: string;
  neighbors: BGPNeighbor[];
  announcements: string[];
}

export interface BGPNeighbor {
  ip: string;
  asn: number;
  status: 'established' | 'idle' | 'active' | 'connect';
  prefixesReceived: number;
  prefixesSent: number;
}

export interface UniversePeer {
  id: string;
  universeId: string;
  universeName: string;
  status: 'connected' | 'disconnected' | 'pending';
  routerId: string;
  vpnType: 'wireguard' | 'ipsec' | 'direct';
  latencyMs?: number;
  bandwidthMbps?: number;
  connectedAt?: number;
}

export interface ExposedService {
  id: string;
  name: string;
  type: 'http' | 'https' | 'tcp' | 'udp' | 'grpc' | 'mcp';
  port: number;
  targetIp: string;
  targetPort: number;
  protocol: string;
  
  // For MCP services
  mcpConfig?: MCPExposedConfig;
  
  // Access control
  allowedPeers: string[]; // Universe IDs or 'all'
  
  // Health check
  healthCheck?: HealthCheck;
  status: 'healthy' | 'unhealthy' | 'unknown';
}

export interface MCPExposedConfig {
  serverName: string;
  capabilities: string[];
  authentication: 'none' | 'token' | 'mtls';
  token?: string;
  
  // Allow external agents
  allowOllama: boolean;
  allowRemoteAgents: boolean;
  agentWhitelist?: string[];
}

export interface HealthCheck {
  type: 'http' | 'tcp' | 'grpc';
  path?: string;
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface QoSPolicy {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  
  // Traffic matching
  match: QoSMatch;
  
  // Traffic shaping
  rateLimit?: number; // kbps
  burstSize?: number; // bytes
  latencyTarget?: number; // ms
  jitterTarget?: number; // ms
  
  // DSCP marking
  dscpMark?: number;
  
  // Queue management
  queueWeight?: number;
  dropProbability?: number;
}

export interface QoSMatch {
  sourceIp?: string;
  destIp?: string;
  protocol?: 'tcp' | 'udp' | 'icmp' | 'any';
  portRange?: { start: number; end: number };
  dscp?: number;
  serviceId?: string;
}

export interface AccessControlList {
  defaultAction: 'allow' | 'deny';
  rules: ACLRule[];
}

export interface ACLRule {
  id: string;
  type: 'user' | 'service' | 'universe' | 'agent';
  principalId: string;
  permissions: ('read' | 'write' | 'admin' | 'connect')[];
  resources: string[];
}

export interface UniverseMetrics {
  totalBandwidthIn: number;
  totalBandwidthOut: number;
  activeConnections: number;
  packetLoss: number;
  averageLatency: number;
  jitter: number;
  
  // Per-peer metrics
  peerMetrics: Map<string, PeerMetric>;
  
  // Historical data points (for graphing)
  history: MetricDataPoint[];
}

export interface PeerMetric {
  peerId: string;
  bandwidthIn: number;
  bandwidthOut: number;
  latency: number;
  packetLoss: number;
  lastUpdated: number;
}

export interface MetricDataPoint {
  timestamp: number;
  bandwidthIn: number;
  bandwidthOut: number;
  latency: number;
  connections: number;
}

// Traffic Analysis Types
export interface TrafficFlow {
  id: string;
  sourceIp: string;
  destIp: string;
  sourcePort: number;
  destPort: number;
  protocol: 'tcp' | 'udp' | 'icmp';
  bytes: number;
  packets: number;
  startTime: number;
  lastSeen: number;
  routerId: string;
  routerInterface: string;
}

export interface TrafficAnalysis {
  timestamp: number;
  universeId: string;
  
  // Flow statistics
  totalFlows: number;
  activeFlows: number;
  topTalkers: { ip: string; bytes: number }[];
  topProtocols: { protocol: string; bytes: number }[];
  topPorts: { port: number; bytes: number }[];
  
  // Probabilistic analysis
  anomalies: TrafficAnomaly[];
  predictions: TrafficPrediction[];
  
  // QoS compliance
  qosCompliance: QoSComplianceReport;
}

export interface TrafficAnomaly {
  id: string;
  type: 'spike' | 'drop' | 'pattern' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFlow?: string;
  detectedAt: number;
  probability: number; // Confidence score
  suggestedAction?: string;
}

export interface TrafficPrediction {
  id: string;
  type: 'bandwidth' | 'congestion' | 'failure';
  prediction: string;
  probability: number;
  timeframe: string;
  basedOn: string;
}

export interface QoSComplianceReport {
  overallScore: number;
  policiesEvaluated: number;
  policiesCompliant: number;
  violations: QoSViolation[];
}

export interface QoSViolation {
  policyId: string;
  policyName: string;
  violationType: 'rate' | 'latency' | 'jitter' | 'loss';
  currentValue: number;
  targetValue: number;
  duration: number;
}

// Database Schema
interface UniverseDBSchema {
  universes: { key: string; value: Universe };
  flows: { key: string; value: TrafficFlow };
  analyses: { key: string; value: TrafficAnalysis };
}

/**
 * Universe Store - IndexedDB-based storage for universes
 */
class UniverseStore {
  private db: IDBPDatabase<UniverseDBSchema> | null = null;
  private dbName = 'qemuweb-universes';
  private dbVersion = 1;

  async init(): Promise<void> {
    this.db = await openDB<UniverseDBSchema>(this.dbName, this.dbVersion, {
      upgrade(db: IDBPDatabase<UniverseDBSchema>) {
        // Universes store
        if (!db.objectStoreNames.contains('universes')) {
          db.createObjectStore('universes', { keyPath: 'id' });
        }
        
        // Traffic flows store
        if (!db.objectStoreNames.contains('flows')) {
          const flowStore = db.createObjectStore('flows', { keyPath: 'id' });
          flowStore.createIndex('routerId', 'routerId');
          flowStore.createIndex('lastSeen', 'lastSeen');
        }
        
        // Analysis store
        if (!db.objectStoreNames.contains('analyses')) {
          const analysisStore = db.createObjectStore('analyses', { keyPath: 'timestamp' });
          analysisStore.createIndex('universeId', 'universeId');
        }
      },
    });
  }

  private getDB(): IDBPDatabase<UniverseDBSchema> {
    if (!this.db) throw new Error('UniverseStore not initialized');
    return this.db;
  }

  // Universe CRUD
  async createUniverse(data: Omit<Universe, 'id' | 'createdAt' | 'updatedAt' | 'metrics'>): Promise<Universe> {
    const universe: Universe = {
      ...data,
      id: `universe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metrics: {
        totalBandwidthIn: 0,
        totalBandwidthOut: 0,
        activeConnections: 0,
        packetLoss: 0,
        averageLatency: 0,
        jitter: 0,
        peerMetrics: new Map(),
        history: [],
      },
    };
    
    await this.getDB().put('universes', universe);
    return universe;
  }

  async getUniverse(id: string): Promise<Universe | undefined> {
    return this.getDB().get('universes', id);
  }

  async getAllUniverses(): Promise<Universe[]> {
    return this.getDB().getAll('universes');
  }

  async updateUniverse(id: string, updates: Partial<Universe>): Promise<Universe | null> {
    const existing = await this.getUniverse(id);
    if (!existing) return null;
    
    const updated: Universe = {
      ...existing,
      ...updates,
      id,
      updatedAt: Date.now(),
    };
    
    await this.getDB().put('universes', updated);
    return updated;
  }

  async deleteUniverse(id: string): Promise<boolean> {
    await this.getDB().delete('universes', id);
    return true;
  }

  // Router operations
  async addRouter(universeId: string, router: Omit<RouterConfig, 'id'>): Promise<RouterConfig | null> {
    const universe = await this.getUniverse(universeId);
    if (!universe) return null;
    
    const newRouter: RouterConfig = {
      ...router,
      id: `router-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    
    universe.routers.push(newRouter);
    await this.updateUniverse(universeId, { routers: universe.routers });
    
    return newRouter;
  }

  async updateRouter(universeId: string, routerId: string, updates: Partial<RouterConfig>): Promise<RouterConfig | null> {
    const universe = await this.getUniverse(universeId);
    if (!universe) return null;
    
    const routerIndex = universe.routers.findIndex(r => r.id === routerId);
    if (routerIndex === -1) return null;
    
    universe.routers[routerIndex] = { ...universe.routers[routerIndex], ...updates };
    await this.updateUniverse(universeId, { routers: universe.routers });
    
    return universe.routers[routerIndex];
  }

  // Peer operations
  async connectPeer(universeId: string, peer: Omit<UniversePeer, 'id'>): Promise<UniversePeer | null> {
    const universe = await this.getUniverse(universeId);
    if (!universe) return null;
    
    const newPeer: UniversePeer = {
      ...peer,
      id: `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    
    universe.peers.push(newPeer);
    await this.updateUniverse(universeId, { peers: universe.peers });
    
    return newPeer;
  }

  // Service operations
  async exposeService(universeId: string, service: Omit<ExposedService, 'id' | 'status'>): Promise<ExposedService | null> {
    const universe = await this.getUniverse(universeId);
    if (!universe) return null;
    
    const newService: ExposedService = {
      ...service,
      id: `service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'unknown',
    };
    
    universe.services.push(newService);
    await this.updateUniverse(universeId, { services: universe.services });
    
    return newService;
  }

  // Traffic flow operations
  async recordFlow(flow: Omit<TrafficFlow, 'id'>): Promise<TrafficFlow> {
    const newFlow: TrafficFlow = {
      ...flow,
      id: `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    
    await this.getDB().put('flows', newFlow);
    return newFlow;
  }

  async getFlowsByRouter(routerId: string): Promise<TrafficFlow[]> {
    return this.getDB().getAllFromIndex('flows', 'routerId', routerId);
  }

  async cleanOldFlows(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const flows = await this.getDB().getAll('flows');
    let deleted = 0;
    
    for (const flow of flows) {
      if (flow.lastSeen < cutoff) {
        await this.getDB().delete('flows', flow.id);
        deleted++;
      }
    }
    
    return deleted;
  }

  // Analysis operations
  async saveAnalysis(analysis: TrafficAnalysis): Promise<void> {
    await this.getDB().put('analyses', analysis);
  }

  async getAnalyses(universeId: string, limit = 100): Promise<TrafficAnalysis[]> {
    const all = await this.getDB().getAllFromIndex('analyses', 'universeId', universeId);
    return all.slice(-limit);
  }
}

// Export singleton
export const universeStore = new UniverseStore();

/**
 * Traffic Analyzer - Probabilistic analysis of traffic flows
 */
export class TrafficAnalyzer {
  private universeId: string;
  private windowSize = 60000; // 1 minute window
  private samples: MetricDataPoint[] = [];

  constructor(universeId: string) {
    this.universeId = universeId;
  }

  /**
   * Analyze current traffic and detect anomalies
   */
  async analyze(flows: TrafficFlow[]): Promise<TrafficAnalysis> {
    const activeFlows = flows.filter(f => Date.now() - f.lastSeen < this.windowSize);
    
    // Calculate statistics
    const topTalkers = this.calculateTopTalkers(activeFlows);
    const topProtocols = this.calculateTopProtocols(activeFlows);
    const topPorts = this.calculateTopPorts(activeFlows);
    
    // Detect anomalies using statistical methods
    const anomalies = this.detectAnomalies(activeFlows);
    
    // Make predictions using simple stochastic modeling
    const predictions = this.makePredictions();
    
    // Evaluate QoS compliance
    const qosCompliance = await this.evaluateQoS();
    
    return {
      timestamp: Date.now(),
      universeId: this.universeId,
      totalFlows: flows.length,
      activeFlows: activeFlows.length,
      topTalkers,
      topProtocols,
      topPorts,
      anomalies,
      predictions,
      qosCompliance,
    };
  }

  private calculateTopTalkers(flows: TrafficFlow[]): { ip: string; bytes: number }[] {
    const byIp = new Map<string, number>();
    
    for (const flow of flows) {
      byIp.set(flow.sourceIp, (byIp.get(flow.sourceIp) || 0) + flow.bytes);
      byIp.set(flow.destIp, (byIp.get(flow.destIp) || 0) + flow.bytes);
    }
    
    return Array.from(byIp.entries())
      .map(([ip, bytes]) => ({ ip, bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);
  }

  private calculateTopProtocols(flows: TrafficFlow[]): { protocol: string; bytes: number }[] {
    const byProtocol = new Map<string, number>();
    
    for (const flow of flows) {
      byProtocol.set(flow.protocol, (byProtocol.get(flow.protocol) || 0) + flow.bytes);
    }
    
    return Array.from(byProtocol.entries())
      .map(([protocol, bytes]) => ({ protocol, bytes }))
      .sort((a, b) => b.bytes - a.bytes);
  }

  private calculateTopPorts(flows: TrafficFlow[]): { port: number; bytes: number }[] {
    const byPort = new Map<number, number>();
    
    for (const flow of flows) {
      byPort.set(flow.destPort, (byPort.get(flow.destPort) || 0) + flow.bytes);
    }
    
    return Array.from(byPort.entries())
      .map(([port, bytes]) => ({ port, bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);
  }

  /**
   * Detect traffic anomalies using statistical analysis
   */
  private detectAnomalies(flows: TrafficFlow[]): TrafficAnomaly[] {
    const anomalies: TrafficAnomaly[] = [];
    
    if (this.samples.length < 5) return anomalies;
    
    // Calculate mean and standard deviation of bandwidth
    const bandwidths = this.samples.map(s => s.bandwidthIn + s.bandwidthOut);
    const mean = bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length;
    const variance = bandwidths.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / bandwidths.length;
    const stdDev = Math.sqrt(variance);
    
    const currentBandwidth = flows.reduce((sum, f) => sum + f.bytes, 0);
    
    // Z-score for current bandwidth
    const zScore = (currentBandwidth - mean) / (stdDev || 1);
    
    // Detect spikes (> 2 standard deviations)
    if (zScore > 2) {
      anomalies.push({
        id: `anomaly-${Date.now()}`,
        type: 'spike',
        severity: zScore > 3 ? 'high' : 'medium',
        description: `Traffic spike detected: ${(zScore * 100).toFixed(1)}% above average`,
        detectedAt: Date.now(),
        probability: this.zScoreToProbability(zScore),
        suggestedAction: 'Consider rate limiting or investigating source',
      });
    }
    
    // Detect drops (< -2 standard deviations)
    if (zScore < -2) {
      anomalies.push({
        id: `anomaly-${Date.now()}`,
        type: 'drop',
        severity: zScore < -3 ? 'high' : 'medium',
        description: `Traffic drop detected: ${(Math.abs(zScore) * 100).toFixed(1)}% below average`,
        detectedAt: Date.now(),
        probability: this.zScoreToProbability(Math.abs(zScore)),
        suggestedAction: 'Check for connectivity issues or service health',
      });
    }
    
    // Detect unusual port patterns
    const unusualPorts = flows.filter(f => f.destPort > 10000 && f.bytes > mean * 0.1);
    if (unusualPorts.length > flows.length * 0.3) {
      anomalies.push({
        id: `anomaly-${Date.now()}-ports`,
        type: 'pattern',
        severity: 'low',
        description: 'High number of connections on ephemeral ports',
        detectedAt: Date.now(),
        probability: 0.7,
        suggestedAction: 'Review application behavior',
      });
    }
    
    return anomalies;
  }

  /**
   * Make traffic predictions using exponential smoothing
   */
  private makePredictions(): TrafficPrediction[] {
    const predictions: TrafficPrediction[] = [];
    
    if (this.samples.length < 10) return predictions;
    
    // Simple exponential smoothing for bandwidth prediction
    const alpha = 0.3;
    const bandwidths = this.samples.map(s => s.bandwidthIn + s.bandwidthOut);
    
    let smoothed = bandwidths[0];
    for (let i = 1; i < bandwidths.length; i++) {
      smoothed = alpha * bandwidths[i] + (1 - alpha) * smoothed;
    }
    
    const lastActual = bandwidths[bandwidths.length - 1];
    const trend = smoothed > lastActual ? 'increase' : 'decrease';
    const changePercent = Math.abs((smoothed - lastActual) / lastActual * 100);
    
    if (changePercent > 10) {
      predictions.push({
        id: `pred-${Date.now()}-bandwidth`,
        type: 'bandwidth',
        prediction: `Bandwidth expected to ${trend} by ${changePercent.toFixed(1)}%`,
        probability: 0.6 + (Math.min(changePercent, 50) / 100) * 0.3,
        timeframe: 'next 5 minutes',
        basedOn: 'Exponential smoothing of last 10 samples',
      });
    }
    
    // Predict potential congestion
    const recentConnections = this.samples.slice(-5).map(s => s.connections);
    const connectionGrowth = (recentConnections[recentConnections.length - 1] - recentConnections[0]) / recentConnections.length;
    
    if (connectionGrowth > 5) {
      predictions.push({
        id: `pred-${Date.now()}-congestion`,
        type: 'congestion',
        prediction: 'Potential congestion in the next 10 minutes',
        probability: Math.min(0.5 + connectionGrowth * 0.05, 0.9),
        timeframe: 'next 10 minutes',
        basedOn: 'Connection growth rate analysis',
      });
    }
    
    return predictions;
  }

  /**
   * Evaluate QoS policy compliance
   */
  private async evaluateQoS(): Promise<QoSComplianceReport> {
    const universe = await universeStore.getUniverse(this.universeId);
    if (!universe) {
      return {
        overallScore: 100,
        policiesEvaluated: 0,
        policiesCompliant: 0,
        violations: [],
      };
    }
    
    const violations: QoSViolation[] = [];
    const policies = universe.qosPolicies.filter(p => p.enabled);
    
    // Evaluate each policy (simplified - real implementation would measure actual traffic)
    for (const policy of policies) {
      // Simulate checking actual values against targets
      if (policy.rateLimit) {
        const actualRate = Math.random() * policy.rateLimit * 1.5; // Simulated
        if (actualRate > policy.rateLimit) {
          violations.push({
            policyId: policy.id,
            policyName: policy.name,
            violationType: 'rate',
            currentValue: actualRate,
            targetValue: policy.rateLimit,
            duration: Math.floor(Math.random() * 300),
          });
        }
      }
      
      if (policy.latencyTarget) {
        const actualLatency = universe.metrics.averageLatency;
        if (actualLatency > policy.latencyTarget) {
          violations.push({
            policyId: policy.id,
            policyName: policy.name,
            violationType: 'latency',
            currentValue: actualLatency,
            targetValue: policy.latencyTarget,
            duration: Math.floor(Math.random() * 300),
          });
        }
      }
    }
    
    const compliant = policies.length - violations.length;
    const score = policies.length > 0 ? (compliant / policies.length) * 100 : 100;
    
    return {
      overallScore: score,
      policiesEvaluated: policies.length,
      policiesCompliant: compliant,
      violations,
    };
  }

  /**
   * Convert z-score to probability (how unlikely the observation is)
   */
  private zScoreToProbability(z: number): number {
    // Approximate using sigmoid-like function
    return 1 - (1 / (1 + Math.exp(-Math.abs(z) + 2)));
  }

  /**
   * Add a sample for time-series analysis
   */
  addSample(sample: MetricDataPoint): void {
    this.samples.push(sample);
    if (this.samples.length > 100) {
      this.samples.shift();
    }
  }
}

export default universeStore;
