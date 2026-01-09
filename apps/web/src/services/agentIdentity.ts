/**
 * Agent Identity System
 * 
 * Cryptographic identity for agents with:
 * - Derived addressing (similar to onion/hidden services)
 * - Benchmark attestations as capability proofs
 * - Rotatable keys with deterministic derivation
 * - Network peering identity
 */

import { getAuditLog } from './auditLog';

// ============ Types ============

export interface AgentPersonality {
  name: string;
  avatar?: string;
  description: string;
  traits: PersonalityTrait[];
  communication: CommunicationStyle;
}

export interface PersonalityTrait {
  trait: string;
  value: number; // -1.0 to 1.0 spectrum
  description: string;
}

export interface CommunicationStyle {
  formality: 'casual' | 'neutral' | 'formal' | 'technical';
  verbosity: 'concise' | 'balanced' | 'detailed' | 'comprehensive';
  tone: 'friendly' | 'professional' | 'analytical' | 'supportive';
  responseStyle: 'direct' | 'explanatory' | 'socratic' | 'collaborative';
}

export interface AgentStrength {
  domain: string;
  proficiency: 'novice' | 'competent' | 'proficient' | 'expert' | 'master';
  description: string;
  benchmarkScores?: BenchmarkScore[];
}

export interface AgentWeakness {
  domain: string;
  severity: 'minor' | 'moderate' | 'significant';
  description: string;
  mitigations?: string[];
}

export interface AgentSkill {
  id: string;
  name: string;
  category: SkillCategory;
  level: number; // 0-100
  verified: boolean;
  verificationProof?: string; // Cryptographic proof
  lastAssessed?: number;
}

export type SkillCategory = 
  | 'coding'
  | 'reasoning'
  | 'analysis'
  | 'communication'
  | 'domain_knowledge'
  | 'tool_use'
  | 'planning'
  | 'creativity';

export interface AgentCertification {
  id: string;
  name: string;
  issuer: string;
  issuedAt: number;
  expiresAt?: number;
  proof: CertificationProof;
  capabilities: string[];
}

export interface CertificationProof {
  type: 'benchmark' | 'attestation' | 'peer_review';
  hash: string;
  signature: string;
  metadata: Record<string, unknown>;
}

export interface BenchmarkScore {
  benchmarkId: string;
  benchmarkName: string;
  score: number;
  maxScore: number;
  percentile?: number;
  timestamp: number;
  proof: string;
}

export interface AgentCapabilitySet {
  mcpServers: MCPServerCapability[];
  tools: ToolCapability[];
  models: ModelCapability[];
  resources: ResourceCapability[];
}

export interface MCPServerCapability {
  serverId: string;
  serverName: string;
  endpoint: string;
  capabilities: string[];
  verified: boolean;
  latency?: number;
}

export interface ToolCapability {
  toolId: string;
  toolName: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  permissions: string[];
}

export interface ModelCapability {
  modelId: string;
  modelName: string;
  provider: string;
  contextWindow: number;
  capabilities: ('chat' | 'completion' | 'embedding' | 'vision' | 'code')[];
}

export interface ResourceCapability {
  resourceType: 'cpu' | 'memory' | 'gpu' | 'storage' | 'network';
  available: number;
  unit: string;
}

// ============ Cryptographic Identity ============

export interface AgentCryptoIdentity {
  // Primary identity
  publicKey: string;
  keyAlgorithm: 'Ed25519' | 'ECDSA-P256';
  
  // Derived address (like onion address)
  derivedAddress: string;
  addressVersion: number;
  
  // Key rotation
  rotationEpoch: number;
  previousAddresses: string[];
  
  // Network identity
  peerIdentity: PeerIdentity;
}

export interface PeerIdentity {
  peerId: string;
  networkId: string;
  consulServiceId?: string;
  wireguardPublicKey?: string;
  endpoints: PeerEndpoint[];
}

export interface PeerEndpoint {
  protocol: 'wireguard' | 'https' | 'wss' | 'quic';
  address: string;
  port: number;
  priority: number;
  splitTunnel?: SplitTunnelConfig;
}

export interface SplitTunnelConfig {
  provider: string;
  tunnelId: string;
  allowedIPs: string[];
  persistentKeepalive?: number;
}

// ============ Full Agent Identity ============

export interface AgentIdentity {
  id: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  
  // Identity components
  personality: AgentPersonality;
  crypto: AgentCryptoIdentity;
  
  // Capabilities
  strengths: AgentStrength[];
  weaknesses: AgentWeakness[];
  skills: AgentSkill[];
  certifications: AgentCertification[];
  capabilities: AgentCapabilitySet;
  
  // Network state
  online: boolean;
  lastSeen?: number;
  reputation: ReputationScore;
}

export interface ReputationScore {
  overall: number; // 0-100
  reliability: number;
  accuracy: number;
  responsiveness: number;
  attestations: number;
}

// ============ Crypto Utilities ============

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
}

async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function signData(privateKey: CryptoKey, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    dataBuffer
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

/**
 * Derive a deterministic address from public key and epoch
 * Similar to onion address derivation but with rotation support
 */
async function deriveAddress(publicKey: string, epoch: number, version: number): Promise<string> {
  const input = `${publicKey}:${epoch}:${version}`;
  const hash = await hashData(input);
  
  // Take first 16 bytes and encode as base32 (like onion addresses)
  const bytes = Uint8Array.from(atob(hash), c => c.charCodeAt(0)).slice(0, 16);
  const base32Chars = 'abcdefghijklmnopqrstuvwxyz234567';
  let address = '';
  
  for (let i = 0; i < bytes.length; i += 5) {
    const chunk = bytes.slice(i, i + 5);
    // Simple base32 encoding
    for (let j = 0; j < chunk.length; j++) {
      address += base32Chars[chunk[j] % 32];
    }
  }
  
  return `${address}.agent.local`;
}

/**
 * Generate proof of benchmark completion
 */
async function generateBenchmarkProof(
  privateKey: CryptoKey,
  benchmarkId: string,
  score: number,
  timestamp: number
): Promise<string> {
  const data = JSON.stringify({ benchmarkId, score, timestamp });
  return signData(privateKey, data);
}

// ============ Agent Identity Manager ============

export class AgentIdentityManager {
  private identities = new Map<string, AgentIdentity>();
  private keyPairs = new Map<string, CryptoKeyPair>();
  private currentEpoch: number;
  
  constructor() {
    this.currentEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)); // Weekly epochs
  }
  
  /**
   * Create a new agent identity
   */
  async createIdentity(
    personality: AgentPersonality,
    initialCapabilities?: Partial<AgentCapabilitySet>
  ): Promise<AgentIdentity> {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    const derivedAddress = await deriveAddress(publicKey, this.currentEpoch, 1);
    
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const identity: AgentIdentity = {
      id,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      
      personality,
      
      crypto: {
        publicKey,
        keyAlgorithm: 'ECDSA-P256',
        derivedAddress,
        addressVersion: 1,
        rotationEpoch: this.currentEpoch,
        previousAddresses: [],
        peerIdentity: {
          peerId: id,
          networkId: 'qemuweb-agents',
          endpoints: [],
        },
      },
      
      strengths: [],
      weaknesses: [],
      skills: [],
      certifications: [],
      
      capabilities: {
        mcpServers: initialCapabilities?.mcpServers || [],
        tools: initialCapabilities?.tools || [],
        models: initialCapabilities?.models || [],
        resources: initialCapabilities?.resources || [],
      },
      
      online: true,
      reputation: {
        overall: 50, // Start neutral
        reliability: 50,
        accuracy: 50,
        responsiveness: 50,
        attestations: 0,
      },
    };
    
    this.identities.set(id, identity);
    this.keyPairs.set(id, keyPair);
    
    // Log creation
    const auditLog = await getAuditLog();
    await auditLog.log('system_event', {
      event: 'agent_identity_created',
      agentId: id,
      derivedAddress,
    });
    
    return identity;
  }
  
  /**
   * Rotate keys for an identity (new epoch)
   */
  async rotateKeys(agentId: string): Promise<AgentCryptoIdentity> {
    const identity = this.identities.get(agentId);
    const oldKeyPair = this.keyPairs.get(agentId);
    
    if (!identity || !oldKeyPair) {
      throw new Error(`Identity not found: ${agentId}`);
    }
    
    // Generate new key pair
    const newKeyPair = await generateKeyPair();
    const newPublicKey = await exportPublicKey(newKeyPair.publicKey);
    
    // Increment epoch
    const newEpoch = this.currentEpoch + 1;
    const newAddress = await deriveAddress(newPublicKey, newEpoch, identity.crypto.addressVersion + 1);
    
    // Update identity
    identity.crypto.previousAddresses.push(identity.crypto.derivedAddress);
    identity.crypto.publicKey = newPublicKey;
    identity.crypto.derivedAddress = newAddress;
    identity.crypto.rotationEpoch = newEpoch;
    identity.crypto.addressVersion++;
    identity.updatedAt = Date.now();
    
    this.keyPairs.set(agentId, newKeyPair);
    
    return identity.crypto;
  }
  
  /**
   * Add a benchmark score and generate proof
   */
  async addBenchmarkScore(
    agentId: string,
    benchmarkId: string,
    benchmarkName: string,
    score: number,
    maxScore: number
  ): Promise<BenchmarkScore> {
    const identity = this.identities.get(agentId);
    const keyPair = this.keyPairs.get(agentId);
    
    if (!identity || !keyPair) {
      throw new Error(`Identity not found: ${agentId}`);
    }
    
    const timestamp = Date.now();
    const proof = await generateBenchmarkProof(
      keyPair.privateKey,
      benchmarkId,
      score,
      timestamp
    );
    
    const benchmarkScore: BenchmarkScore = {
      benchmarkId,
      benchmarkName,
      score,
      maxScore,
      timestamp,
      proof,
    };
    
    // Find or create strength for this domain
    const domain = this.getBenchmarkDomain(benchmarkId);
    let strength = identity.strengths.find(s => s.domain === domain);
    
    if (!strength) {
      strength = {
        domain,
        proficiency: 'novice',
        description: `Evaluated through ${benchmarkName}`,
        benchmarkScores: [],
      };
      identity.strengths.push(strength);
    }
    
    strength.benchmarkScores = strength.benchmarkScores || [];
    strength.benchmarkScores.push(benchmarkScore);
    
    // Update proficiency based on score
    const percentage = score / maxScore;
    if (percentage >= 0.95) strength.proficiency = 'master';
    else if (percentage >= 0.85) strength.proficiency = 'expert';
    else if (percentage >= 0.70) strength.proficiency = 'proficient';
    else if (percentage >= 0.50) strength.proficiency = 'competent';
    else strength.proficiency = 'novice';
    
    identity.updatedAt = Date.now();
    
    return benchmarkScore;
  }
  
  /**
   * Add a certification with proof
   */
  async addCertification(
    agentId: string,
    name: string,
    issuer: string,
    capabilities: string[],
    proofMetadata: Record<string, unknown>
  ): Promise<AgentCertification> {
    const identity = this.identities.get(agentId);
    const keyPair = this.keyPairs.get(agentId);
    
    if (!identity || !keyPair) {
      throw new Error(`Identity not found: ${agentId}`);
    }
    
    const timestamp = Date.now();
    const certData = JSON.stringify({ name, issuer, capabilities, timestamp, ...proofMetadata });
    const hash = await hashData(certData);
    const signature = await signData(keyPair.privateKey, certData);
    
    const certification: AgentCertification = {
      id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      issuer,
      issuedAt: timestamp,
      capabilities,
      proof: {
        type: 'attestation',
        hash,
        signature,
        metadata: proofMetadata,
      },
    };
    
    identity.certifications.push(certification);
    identity.reputation.attestations++;
    identity.updatedAt = Date.now();
    
    return certification;
  }
  
  /**
   * Add a skill with optional verification
   */
  addSkill(
    agentId: string,
    skill: Omit<AgentSkill, 'id'>
  ): AgentSkill {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Identity not found: ${agentId}`);
    }
    
    const fullSkill: AgentSkill = {
      ...skill,
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    
    identity.skills.push(fullSkill);
    identity.updatedAt = Date.now();
    
    return fullSkill;
  }
  
  /**
   * Add a weakness
   */
  addWeakness(agentId: string, weakness: AgentWeakness): void {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Identity not found: ${agentId}`);
    }
    
    identity.weaknesses.push(weakness);
    identity.updatedAt = Date.now();
  }
  
  /**
   * Get identity by ID
   */
  getIdentity(agentId: string): AgentIdentity | undefined {
    return this.identities.get(agentId);
  }
  
  /**
   * Get identity by derived address
   */
  getIdentityByAddress(address: string): AgentIdentity | undefined {
    for (const identity of this.identities.values()) {
      if (identity.crypto.derivedAddress === address) {
        return identity;
      }
      if (identity.crypto.previousAddresses.includes(address)) {
        return identity;
      }
    }
    return undefined;
  }
  
  /**
   * Get all identities
   */
  getAllIdentities(): AgentIdentity[] {
    return Array.from(this.identities.values());
  }
  
  /**
   * Generate identity card for display
   */
  generateIdentityCard(agentId: string): AgentIdentityCard | undefined {
    const identity = this.identities.get(agentId);
    if (!identity) return undefined;
    
    return {
      id: identity.id,
      name: identity.personality.name,
      avatar: identity.personality.avatar,
      description: identity.personality.description,
      address: identity.crypto.derivedAddress,
      
      topStrengths: identity.strengths
        .sort((a, b) => this.proficiencyToNumber(b.proficiency) - this.proficiencyToNumber(a.proficiency))
        .slice(0, 3)
        .map(s => ({ domain: s.domain, proficiency: s.proficiency })),
      
      topSkills: identity.skills
        .filter(s => s.verified)
        .sort((a, b) => b.level - a.level)
        .slice(0, 5)
        .map(s => ({ name: s.name, level: s.level })),
      
      certificationCount: identity.certifications.length,
      reputation: identity.reputation.overall,
      online: identity.online,
    };
  }
  
  private proficiencyToNumber(p: string): number {
    const map: Record<string, number> = {
      'novice': 1, 'competent': 2, 'proficient': 3, 'expert': 4, 'master': 5
    };
    return map[p] || 0;
  }
  
  private getBenchmarkDomain(benchmarkId: string): string {
    // Map benchmark IDs to domains
    if (benchmarkId.includes('code') || benchmarkId.includes('humaneval')) return 'Coding';
    if (benchmarkId.includes('math') || benchmarkId.includes('gsm')) return 'Mathematics';
    if (benchmarkId.includes('reason') || benchmarkId.includes('arc')) return 'Reasoning';
    if (benchmarkId.includes('mmlu')) return 'General Knowledge';
    return 'General';
  }
}

// ============ Identity Card for Display ============

export interface AgentIdentityCard {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  address: string;
  topStrengths: { domain: string; proficiency: string }[];
  topSkills: { name: string; level: number }[];
  certificationCount: number;
  reputation: number;
  online: boolean;
}

// ============ Default Personalities ============

export const DEFAULT_PERSONALITIES: Record<string, AgentPersonality> = {
  general: {
    name: 'Atlas',
    description: 'A well-rounded assistant capable of handling diverse tasks with balanced expertise.',
    traits: [
      { trait: 'Analytical ↔ Intuitive', value: 0, description: 'Balanced approach' },
      { trait: 'Cautious ↔ Bold', value: 0.2, description: 'Slightly cautious' },
      { trait: 'Concise ↔ Detailed', value: 0.3, description: 'Tends toward detail' },
    ],
    communication: {
      formality: 'neutral',
      verbosity: 'balanced',
      tone: 'professional',
      responseStyle: 'explanatory',
    },
  },
  
  coder: {
    name: 'Forge',
    description: 'A specialized coding assistant with deep expertise in software development.',
    traits: [
      { trait: 'Analytical ↔ Intuitive', value: -0.7, description: 'Highly analytical' },
      { trait: 'Cautious ↔ Bold', value: -0.3, description: 'Careful and precise' },
      { trait: 'Concise ↔ Detailed', value: -0.2, description: 'Code-focused brevity' },
    ],
    communication: {
      formality: 'technical',
      verbosity: 'concise',
      tone: 'analytical',
      responseStyle: 'direct',
    },
  },
  
  infrastructure: {
    name: 'Nexus',
    description: 'An infrastructure specialist focused on DevOps, cloud, and system administration.',
    traits: [
      { trait: 'Analytical ↔ Intuitive', value: -0.5, description: 'Systematic thinker' },
      { trait: 'Cautious ↔ Bold', value: -0.6, description: 'Very cautious with systems' },
      { trait: 'Concise ↔ Detailed', value: 0.5, description: 'Thorough documentation' },
    ],
    communication: {
      formality: 'technical',
      verbosity: 'detailed',
      tone: 'professional',
      responseStyle: 'explanatory',
    },
  },
  
  researcher: {
    name: 'Sage',
    description: 'A research-oriented assistant skilled at deep analysis and knowledge synthesis.',
    traits: [
      { trait: 'Analytical ↔ Intuitive', value: -0.4, description: 'Research-oriented' },
      { trait: 'Cautious ↔ Bold', value: -0.2, description: 'Evidence-based' },
      { trait: 'Concise ↔ Detailed', value: 0.7, description: 'Comprehensive analysis' },
    ],
    communication: {
      formality: 'formal',
      verbosity: 'comprehensive',
      tone: 'analytical',
      responseStyle: 'socratic',
    },
  },
};

// ============ Singleton ============

let identityManagerInstance: AgentIdentityManager | null = null;

export function getAgentIdentityManager(): AgentIdentityManager {
  if (!identityManagerInstance) {
    identityManagerInstance = new AgentIdentityManager();
  }
  return identityManagerInstance;
}
