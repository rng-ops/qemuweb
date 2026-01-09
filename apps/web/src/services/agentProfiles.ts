/**
 * Agent Profiles System
 * 
 * Configurable agent profiles with:
 * - Model selection (Ollama models, remote APIs)
 * - Reasoning level configuration
 * - MCP server targets (local QEMU, remote peers)
 * - Tool permissions
 * - Context/prompt templates
 */

import type { ReasoningLevel } from './ollamaService';

// ============ Types ============

export type AgentProviderType = 'ollama' | 'openai' | 'anthropic' | 'openrouter' | 'custom';

export interface AgentModelConfig {
  provider: AgentProviderType;
  modelId: string;
  endpoint?: string;
  apiKey?: string;
  defaultReasoningLevel: ReasoningLevel;
  maxTokens?: number;
  temperature?: number;
}

export interface MCPServerTarget {
  id: string;
  name: string;
  type: 'local' | 'qemu' | 'remote';
  endpoint: string;
  transport: 'stdio' | 'http' | 'websocket';
  
  // For QEMU instances
  vmId?: string;
  containerId?: string;
  
  // For remote peers (via busybox router)
  peerAddress?: string;
  peerPort?: number;
  routerViaIp?: string;
  
  // Capabilities
  capabilities: string[];
  
  // Auth
  authRequired: boolean;
  authToken?: string;
}

export interface ToolPermission {
  toolName: string;
  allowed: boolean;
  requiresApproval: boolean;
  maxCallsPerSession?: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  
  // Model configuration
  model: AgentModelConfig;
  
  // MCP server targets
  mcpServers: MCPServerTarget[];
  
  // Tool permissions
  toolPermissions: ToolPermission[];
  defaultToolApproval: boolean;
  
  // System prompt
  systemPrompt: string;
  
  // Behavior settings
  settings: {
    maxContextTokens: number;
    includeAuditLog: boolean;
    includeRecentEvents: boolean;
    streamResponses: boolean;
    autoExecuteTools: boolean;
    planningMode: 'none' | 'simple' | 'detailed';
  };
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  isBuiltIn: boolean;
}

export interface AgentSession {
  id: string;
  profileId: string;
  startedAt: number;
  lastActivity: number;
  messageCount: number;
  toolCallCount: number;
  status: 'active' | 'paused' | 'ended';
  
  // Current state
  currentPlan?: AgentPlan;
  pendingToolCalls: string[];
}

export interface AgentPlan {
  id: string;
  goal: string;
  steps: AgentPlanStep[];
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export interface AgentPlanStep {
  id: string;
  description: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

// ============ Default Profiles ============

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant integrated with QemuWeb. You can:
- Manage container images (list, pull, inspect, delete)
- Control containers (create, start, stop, execute commands)
- Navigate the application interface
- Access MCP servers for extended capabilities

Always explain what you're doing and ask for confirmation before executing potentially destructive actions.
When planning complex tasks, break them down into clear steps and show your reasoning.`;

const CODE_ASSISTANT_PROMPT = `You are a code-focused AI assistant within the QemuWeb environment.

Your capabilities:
- Analyze and explain code
- Help debug issues in containers
- Execute shell commands in running containers
- Access file systems through MCP servers
- Generate and review code

Best practices:
- Always show code snippets with proper syntax highlighting
- Explain your reasoning step by step
- When executing commands, show what will run and wait for approval
- Keep track of the current working directory and environment`;

const INFRASTRUCTURE_AGENT_PROMPT = `You are an infrastructure management agent for QemuWeb.

Your role:
- Manage virtual machines and containers
- Configure networking between instances
- Monitor system resources and performance
- Deploy and configure services
- Interact with Terraform for infrastructure as code

Guidelines:
- Always verify current state before making changes
- Use planning mode for multi-step operations
- Log all infrastructure changes to the audit trail
- Consider dependencies between services`;

const RESEARCH_AGENT_PROMPT = `You are a research and information gathering agent.

Your capabilities:
- Search and summarize information
- Analyze data from various sources
- Generate reports and documentation
- Cross-reference information from multiple MCP servers

Guidelines:
- Cite your sources when providing information
- Be thorough but concise in summaries
- Highlight key findings and insights
- Flag any uncertainties or conflicting information`;

export const DEFAULT_PROFILES: AgentProfile[] = [
  {
    id: 'default',
    name: 'General Assistant',
    description: 'A general-purpose assistant for common tasks',
    icon: '🤖',
    model: {
      provider: 'ollama',
      modelId: 'qwen2.5:3b',
      defaultReasoningLevel: 'medium',
    },
    mcpServers: [],
    toolPermissions: [],
    defaultToolApproval: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    settings: {
      maxContextTokens: 32768,
      includeAuditLog: true,
      includeRecentEvents: true,
      streamResponses: true,
      autoExecuteTools: false,
      planningMode: 'simple',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    isBuiltIn: true,
  },
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Specialized for coding and development tasks',
    icon: '👨‍💻',
    model: {
      provider: 'ollama',
      modelId: 'llama3-groq-tool-use:latest',
      defaultReasoningLevel: 'high',
    },
    mcpServers: [],
    toolPermissions: [
      { toolName: 'exec_container', allowed: true, requiresApproval: true },
      { toolName: 'create_container', allowed: true, requiresApproval: true },
    ],
    defaultToolApproval: true,
    systemPrompt: CODE_ASSISTANT_PROMPT,
    settings: {
      maxContextTokens: 65536,
      includeAuditLog: false,
      includeRecentEvents: true,
      streamResponses: true,
      autoExecuteTools: false,
      planningMode: 'detailed',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: false,
    isBuiltIn: true,
  },
  {
    id: 'infrastructure-agent',
    name: 'Infrastructure Agent',
    description: 'For managing VMs, containers, and networking',
    icon: '🏗️',
    model: {
      provider: 'ollama',
      modelId: 'deepseek-r1:14b',
      defaultReasoningLevel: 'high',
    },
    mcpServers: [],
    toolPermissions: [
      { toolName: 'create_container', allowed: true, requiresApproval: true },
      { toolName: 'start_container', allowed: true, requiresApproval: false },
      { toolName: 'stop_container', allowed: true, requiresApproval: false },
      { toolName: 'delete_image', allowed: true, requiresApproval: true },
    ],
    defaultToolApproval: true,
    systemPrompt: INFRASTRUCTURE_AGENT_PROMPT,
    settings: {
      maxContextTokens: 32768,
      includeAuditLog: true,
      includeRecentEvents: true,
      streamResponses: true,
      autoExecuteTools: false,
      planningMode: 'detailed',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: false,
    isBuiltIn: true,
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'For information gathering and analysis',
    icon: '🔍',
    model: {
      provider: 'ollama',
      modelId: 'llama3.2:3b',
      defaultReasoningLevel: 'medium',
    },
    mcpServers: [],
    toolPermissions: [],
    defaultToolApproval: false,
    systemPrompt: RESEARCH_AGENT_PROMPT,
    settings: {
      maxContextTokens: 16384,
      includeAuditLog: false,
      includeRecentEvents: false,
      streamResponses: true,
      autoExecuteTools: true,
      planningMode: 'none',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: false,
    isBuiltIn: true,
  },
];

// ============ Agent Profile Manager ============

class AgentProfileManager {
  private profiles: Map<string, AgentProfile> = new Map();
  private sessions: Map<string, AgentSession> = new Map();
  private activeSessionId: string | null = null;
  private storageKey = 'qemuweb-agent-profiles';
  private callbacks: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  // ============ Profile Management ============

  getProfiles(): AgentProfile[] {
    return Array.from(this.profiles.values());
  }

  getProfile(id: string): AgentProfile | undefined {
    return this.profiles.get(id);
  }

  getDefaultProfile(): AgentProfile {
    const defaultProfile = Array.from(this.profiles.values()).find(p => p.isDefault);
    return defaultProfile || DEFAULT_PROFILES[0];
  }

  createProfile(profile: Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>): AgentProfile {
    const newProfile: AgentProfile = {
      ...profile,
      id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltIn: false,
    };

    this.profiles.set(newProfile.id, newProfile);
    this.saveToStorage();
    this.notify();

    return newProfile;
  }

  updateProfile(id: string, updates: Partial<AgentProfile>): AgentProfile | null {
    const existing = this.profiles.get(id);
    if (!existing) return null;

    const updated: AgentProfile = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      updatedAt: Date.now(),
      isBuiltIn: existing.isBuiltIn, // Prevent changing built-in status
    };

    this.profiles.set(id, updated);
    this.saveToStorage();
    this.notify();

    return updated;
  }

  deleteProfile(id: string): boolean {
    const profile = this.profiles.get(id);
    if (!profile || profile.isBuiltIn) return false;

    this.profiles.delete(id);
    this.saveToStorage();
    this.notify();

    return true;
  }

  setDefaultProfile(id: string): boolean {
    const profile = this.profiles.get(id);
    if (!profile) return false;

    // Unset current default
    for (const p of this.profiles.values()) {
      if (p.isDefault) {
        p.isDefault = false;
      }
    }

    profile.isDefault = true;
    this.saveToStorage();
    this.notify();

    return true;
  }

  duplicateProfile(id: string, newName: string): AgentProfile | null {
    const source = this.profiles.get(id);
    if (!source) return null;

    return this.createProfile({
      ...source,
      name: newName,
      isDefault: false,
    });
  }

  // ============ MCP Server Management ============

  addMCPServerToProfile(profileId: string, server: MCPServerTarget): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    profile.mcpServers = [...profile.mcpServers, server];
    profile.updatedAt = Date.now();
    this.saveToStorage();
    this.notify();

    return true;
  }

  removeMCPServerFromProfile(profileId: string, serverId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    profile.mcpServers = profile.mcpServers.filter(s => s.id !== serverId);
    profile.updatedAt = Date.now();
    this.saveToStorage();
    this.notify();

    return true;
  }

  // ============ Session Management ============

  createSession(profileId: string): AgentSession {
    const session: AgentSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      profileId,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      toolCallCount: 0,
      status: 'active',
      pendingToolCalls: [],
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;
    this.notify();

    return session;
  }

  getSession(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  getActiveSession(): AgentSession | undefined {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
  }

  setActiveSession(id: string): void {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      this.notify();
    }
  }

  updateSession(id: string, updates: Partial<AgentSession>): AgentSession | null {
    const session = this.sessions.get(id);
    if (!session) return null;

    const updated = { ...session, ...updates, lastActivity: Date.now() };
    this.sessions.set(id, updated);
    this.notify();

    return updated;
  }

  endSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.status = 'ended';
      if (this.activeSessionId === id) {
        this.activeSessionId = null;
      }
      this.notify();
    }
  }

  // ============ Planning ============

  createPlan(sessionId: string, goal: string, steps: Omit<AgentPlanStep, 'id' | 'status'>[]): AgentPlan | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const plan: AgentPlan = {
      id: `plan-${Date.now()}`,
      goal,
      steps: steps.map((step, index) => ({
        ...step,
        id: `step-${index}`,
        status: 'pending',
      })),
      currentStepIndex: 0,
      status: 'planning',
      createdAt: Date.now(),
    };

    session.currentPlan = plan;
    this.notify();

    return plan;
  }

  updatePlanStep(sessionId: string, stepId: string, updates: Partial<AgentPlanStep>): void {
    const session = this.sessions.get(sessionId);
    if (!session?.currentPlan) return;

    const step = session.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      Object.assign(step, updates);
      this.notify();
    }
  }

  advancePlan(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.currentPlan) return false;

    const plan = session.currentPlan;
    if (plan.currentStepIndex < plan.steps.length - 1) {
      plan.currentStepIndex++;
      this.notify();
      return true;
    }

    plan.status = 'completed';
    plan.completedAt = Date.now();
    this.notify();
    return false;
  }

  // ============ Persistence ============

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as AgentProfile[];
        for (const profile of parsed) {
          this.profiles.set(profile.id, profile);
        }
      }
    } catch (error) {
      console.error('[AgentProfiles] Failed to load from storage:', error);
    }

    // Ensure default profiles exist
    for (const defaultProfile of DEFAULT_PROFILES) {
      if (!this.profiles.has(defaultProfile.id)) {
        this.profiles.set(defaultProfile.id, defaultProfile);
      }
    }
  }

  private saveToStorage(): void {
    try {
      const profiles = Array.from(this.profiles.values());
      localStorage.setItem(this.storageKey, JSON.stringify(profiles));
    } catch (error) {
      console.error('[AgentProfiles] Failed to save to storage:', error);
    }
  }

  // ============ Subscriptions ============

  subscribe(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notify(): void {
    this.callbacks.forEach(cb => cb());
  }
}

// ============ Singleton ============

let profileManagerInstance: AgentProfileManager | null = null;

export function getAgentProfileManager(): AgentProfileManager {
  if (!profileManagerInstance) {
    profileManagerInstance = new AgentProfileManager();
  }
  return profileManagerInstance;
}

// ============ Helper Hooks ============

export function formatReasoningLevel(level: ReasoningLevel): string {
  switch (level) {
    case 'none': return 'None';
    case 'low': return 'Low';
    case 'medium': return 'Medium';
    case 'high': return 'High';
    case 'max': return 'Maximum';
  }
}

export function getReasoningLevelColor(level: ReasoningLevel): string {
  switch (level) {
    case 'none': return 'text-gray-400';
    case 'low': return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-orange-400';
    case 'max': return 'text-red-400';
  }
}

export default AgentProfileManager;
