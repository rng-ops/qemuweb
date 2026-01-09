/**
 * Atlas Agent Matrix
 * 
 * A multi-agent system where different specialized agents observe, analyze,
 * and communicate via a matrix-style messaging system. Each agent runs a
 * specific model with defined policies and can contribute thoughts to the
 * shared observation stream.
 * 
 * Architecture:
 * - AgentRegistry: Defines agent types, their models, and policies
 * - AgentMatrix: Inter-agent communication bus (pub/sub + direct messaging)
 * - AgentInstance: Running agent with inference capability
 * - MatrixRoom: Shared context space where agents collaborate
 */

import type { AtlasEvent } from './atlasOrchestrator';

// ============ Agent Definition Types ============

export type AgentRole = 
  | 'security'      // Evaluates security implications
  | 'performance'   // Monitors resource usage and efficiency
  | 'ux'            // Assesses user experience impact
  | 'compliance'    // Checks policy/regulatory compliance
  | 'architecture'  // Evaluates structural decisions
  | 'testing'       // Suggests testing strategies
  | 'documentation' // Tracks documentation needs
  | 'cost'          // Analyzes resource costs
  | 'orchestrator'  // Meta-agent that coordinates others
  | 'custom';       // User-defined agent

export type AgentPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export type AgentTrigger = 
  | 'always'              // Runs on every context update
  | 'on-file-change'      // When files are modified
  | 'on-command'          // When terminal commands run
  | 'on-navigation'       // When user navigates
  | 'on-user-action'      // On specific UI interactions
  | 'on-service-change'   // When services start/stop
  | 'on-error'            // When errors occur
  | 'on-request'          // Explicitly requested
  | 'periodic'            // On timer interval
  | 'on-agent-message';   // When another agent messages

export interface AgentPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  actions: PolicyAction[];
}

export interface PolicyRule {
  condition: string;           // Expression to evaluate
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

export interface PolicyAction {
  type: 'log' | 'notify' | 'block' | 'escalate' | 'prepare-resource';
  target?: string;             // Where to send/apply
  payload?: Record<string, unknown>;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  
  // Model configuration
  model: {
    type: 'ollama' | 'webllm' | 'onnx' | 'mock';
    name: string;                // Model identifier
    quantization?: string;       // e.g., 'q4_0', 'q8_0'
    contextWindow?: number;      // Max tokens
    temperature?: number;
    maxTokens?: number;
  };
  
  // Behavior configuration
  priority: AgentPriority;
  triggers: AgentTrigger[];
  policies: AgentPolicy[];
  
  // System prompt template
  systemPrompt: string;
  
  // Resource limits
  limits: {
    maxConcurrent: number;       // Max parallel evaluations
    cooldownMs: number;          // Min time between runs
    timeoutMs: number;           // Max execution time
    maxTokensPerRun: number;     // Token budget per run
  };
  
  // State
  enabled: boolean;
  attestation?: AgentAttestation;
}

export interface AgentAttestation {
  hash: string;                  // SHA256 of config
  signature?: string;            // Optional signature
  timestamp: number;
  version: string;
  issuer?: string;               // Who attested
}

// ============ Matrix Message Types ============

export type MatrixMessageType = 
  | 'thought'           // Agent sharing an observation
  | 'question'          // Agent asking for clarification
  | 'recommendation'    // Agent suggesting an action
  | 'concern'           // Agent raising a concern
  | 'approval-request'  // Agent requesting approval to proceed
  | 'approval-response' // Response to approval request
  | 'resource-ready'    // Notifying a resource is prepared
  | 'context-update'    // Sharing context with other agents
  | 'escalation'        // Escalating to higher priority
  | 'delegation'        // Delegating to another agent
  | 'ack'               // Acknowledgment
  | 'system';           // System-level message

export interface MatrixMessage {
  id: string;
  type: MatrixMessageType;
  fromAgent: string;            // Agent ID
  toAgent?: string;             // Target agent (undefined = broadcast)
  roomId: string;               // Matrix room context
  timestamp: number;
  
  content: {
    text: string;
    structured?: Record<string, unknown>;
    confidence?: number;         // 0-1 confidence in assessment
    severity?: PolicyRule['severity'];
    references?: string[];       // Related context IDs
  };
  
  metadata: {
    triggerEvent?: string;       // What triggered this
    processingTimeMs?: number;
    tokenCount?: number;
    modelUsed?: string;
  };
  
  // Approval tracking
  approval?: {
    required: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'timeout';
    approvedBy?: string;
    approvedAt?: number;
    reason?: string;
  };
}

export interface MatrixRoom {
  id: string;
  name: string;
  description: string;
  agents: string[];              // Agent IDs in room
  context: RoomContext;
  messages: MatrixMessage[];
  createdAt: number;
  expiresAt?: number;            // Auto-cleanup
}

export interface RoomContext {
  sessionId: string;
  userIntent?: string;           // What user is trying to do
  currentFile?: string;
  currentView?: string;
  recentEvents: AtlasEvent[];
  sharedData: Record<string, unknown>;
}

// ============ Agent Instance ============

export interface AgentInstance {
  config: AgentConfig;
  status: 'idle' | 'thinking' | 'blocked' | 'error' | 'disabled';
  lastRunAt?: number;
  lastError?: string;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  totalRuns: number;
  totalTokens: number;
  avgLatencyMs: number;
  concernsRaised: number;
  approvalsRequested: number;
  blocksTriggered: number;
}

// ============ Event Types for Matrix ============

export type MatrixEventType = 
  | 'agent:registered'
  | 'agent:started'
  | 'agent:stopped'
  | 'agent:thinking'
  | 'agent:thought'
  | 'agent:error'
  | 'room:created'
  | 'room:closed'
  | 'message:sent'
  | 'message:received'
  | 'approval:requested'
  | 'approval:resolved'
  | 'block:activated'
  | 'block:released';

export interface MatrixEvent {
  id: string;
  type: MatrixEventType;
  timestamp: number;
  agentId?: string;
  roomId?: string;
  data: Record<string, unknown>;
}

// ============ Agent Matrix Service ============

class AgentMatrixService {
  private agents = new Map<string, AgentInstance>();
  private rooms = new Map<string, MatrixRoom>();
  private messageQueue: MatrixMessage[] = [];
  private eventSubscribers = new Set<(event: MatrixEvent) => void>();
  private messageSubscribers = new Set<(message: MatrixMessage) => void>();
  
  // Active room for current session
  private activeRoomId: string | null = null;
  
  // ============ Agent Registry ============
  
  /**
   * Register a new agent configuration
   */
  registerAgent(config: AgentConfig): void {
    if (this.agents.has(config.id)) {
      console.warn(`[AgentMatrix] Agent ${config.id} already registered, updating config`);
    }
    
    const instance: AgentInstance = {
      config,
      status: config.enabled ? 'idle' : 'disabled',
      metrics: {
        totalRuns: 0,
        totalTokens: 0,
        avgLatencyMs: 0,
        concernsRaised: 0,
        approvalsRequested: 0,
        blocksTriggered: 0,
      },
    };
    
    this.agents.set(config.id, instance);
    this.emitEvent('agent:registered', { agentId: config.id, role: config.role });
    
    // Generate attestation if not present
    if (!config.attestation) {
      config.attestation = this.generateAttestation(config);
    }
    
    console.log(`[AgentMatrix] Registered agent: ${config.name} (${config.role})`);
  }
  
  /**
   * Get all registered agents
   */
  getAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get agent by ID
   */
  getAgent(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }
  
  /**
   * Enable/disable an agent
   */
  setAgentEnabled(id: string, enabled: boolean): void {
    const instance = this.agents.get(id);
    if (instance) {
      instance.config.enabled = enabled;
      instance.status = enabled ? 'idle' : 'disabled';
      this.emitEvent(enabled ? 'agent:started' : 'agent:stopped', { agentId: id });
    }
  }
  
  // ============ Room Management ============
  
  /**
   * Create a new matrix room for agent collaboration
   */
  createRoom(name: string, agentIds: string[], context?: Partial<RoomContext>): MatrixRoom {
    const room: MatrixRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: `Collaboration room: ${name}`,
      agents: agentIds.filter(id => this.agents.has(id)),
      context: {
        sessionId: `session-${Date.now()}`,
        recentEvents: [],
        sharedData: {},
        ...context,
      },
      messages: [],
      createdAt: Date.now(),
    };
    
    this.rooms.set(room.id, room);
    this.activeRoomId = room.id;
    this.emitEvent('room:created', { roomId: room.id, agents: room.agents });
    
    console.log(`[AgentMatrix] Created room: ${room.name} with ${room.agents.length} agents`);
    return room;
  }
  
  /**
   * Get or create the active room
   */
  getActiveRoom(): MatrixRoom {
    if (this.activeRoomId && this.rooms.has(this.activeRoomId)) {
      return this.rooms.get(this.activeRoomId)!;
    }
    
    // Create default room with all enabled agents
    const enabledAgents = Array.from(this.agents.values())
      .filter(a => a.config.enabled)
      .map(a => a.config.id);
    
    return this.createRoom('default', enabledAgents);
  }
  
  /**
   * Update room context
   */
  updateRoomContext(roomId: string, context: Partial<RoomContext>): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.context = { ...room.context, ...context };
      
      // Broadcast context update to agents
      this.broadcastMessage(roomId, {
        type: 'context-update',
        fromAgent: 'system',
        content: {
          text: 'Context updated',
          structured: context,
        },
      });
    }
  }
  
  // ============ Message Handling ============
  
  /**
   * Send a message in the matrix
   */
  sendMessage(message: Omit<MatrixMessage, 'id' | 'timestamp'>): MatrixMessage {
    const fullMessage: MatrixMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    
    // Add to room if specified
    const room = this.rooms.get(message.roomId);
    if (room) {
      room.messages.push(fullMessage);
      // Keep last 500 messages per room
      if (room.messages.length > 500) {
        room.messages = room.messages.slice(-500);
      }
    }
    
    // Add to queue for processing
    this.messageQueue.push(fullMessage);
    
    // Notify subscribers
    for (const subscriber of this.messageSubscribers) {
      try {
        subscriber(fullMessage);
      } catch (err) {
        console.error('[AgentMatrix] Message subscriber error:', err);
      }
    }
    
    this.emitEvent('message:sent', {
      messageId: fullMessage.id,
      type: fullMessage.type,
      from: fullMessage.fromAgent,
      to: fullMessage.toAgent,
    });
    
    return fullMessage;
  }
  
  /**
   * Broadcast a message to all agents in a room
   */
  broadcastMessage(
    roomId: string, 
    content: Omit<MatrixMessage, 'id' | 'timestamp' | 'roomId' | 'metadata'>
  ): MatrixMessage {
    return this.sendMessage({
      ...content,
      roomId,
      metadata: {},
    });
  }
  
  /**
   * Subscribe to all messages
   */
  onMessage(callback: (message: MatrixMessage) => void): () => void {
    this.messageSubscribers.add(callback);
    return () => this.messageSubscribers.delete(callback);
  }
  
  /**
   * Get messages for a room
   */
  getRoomMessages(roomId: string, limit = 100): MatrixMessage[] {
    const room = this.rooms.get(roomId);
    return room ? room.messages.slice(-limit) : [];
  }
  
  // ============ Agent Execution ============
  
  /**
   * Trigger agents based on an event
   */
  async triggerAgents(
    trigger: AgentTrigger, 
    context: Record<string, unknown>
  ): Promise<MatrixMessage[]> {
    const room = this.getActiveRoom();
    const results: MatrixMessage[] = [];
    
    // Update room context with trigger event
    room.context.sharedData = { ...room.context.sharedData, lastTrigger: { trigger, context } };
    
    // Find agents that should run for this trigger
    const eligibleAgents = Array.from(this.agents.values()).filter(agent => {
      if (!agent.config.enabled) return false;
      if (agent.status === 'thinking') return false;
      if (!agent.config.triggers.includes(trigger) && !agent.config.triggers.includes('always')) {
        return false;
      }
      
      // Check cooldown
      if (agent.lastRunAt) {
        const elapsed = Date.now() - agent.lastRunAt;
        if (elapsed < agent.config.limits.cooldownMs) {
          return false;
        }
      }
      
      return true;
    });
    
    // Sort by priority
    const priorityOrder: Record<AgentPriority, number> = {
      critical: 0, high: 1, normal: 2, low: 3, background: 4
    };
    eligibleAgents.sort((a, b) => 
      priorityOrder[a.config.priority] - priorityOrder[b.config.priority]
    );
    
    console.log(`[AgentMatrix] Triggering ${eligibleAgents.length} agents for ${trigger}`);
    
    // Run agents (parallel for background, sequential for critical)
    for (const agent of eligibleAgents) {
      try {
        const thought = await this.runAgent(agent, room, context);
        if (thought) {
          results.push(thought);
        }
      } catch (err) {
        console.error(`[AgentMatrix] Agent ${agent.config.id} error:`, err);
        agent.status = 'error';
        agent.lastError = err instanceof Error ? err.message : 'Unknown error';
      }
    }
    
    return results;
  }
  
  /**
   * Run a single agent and get its thought
   */
  private async runAgent(
    agent: AgentInstance,
    room: MatrixRoom,
    triggerContext: Record<string, unknown>
  ): Promise<MatrixMessage | null> {
    agent.status = 'thinking';
    agent.lastRunAt = Date.now();
    this.emitEvent('agent:thinking', { agentId: agent.config.id });
    
    const startTime = Date.now();
    
    try {
      // Build context for the agent
      const agentContext = this.buildAgentContext(agent, room, triggerContext);
      
      // Get inference from the agent's model
      const response = await this.runInference(agent.config, agentContext);
      
      const processingTime = Date.now() - startTime;
      
      // Parse structured response
      const parsed = this.parseAgentResponse(response, agent.config);
      
      // Create the thought message
      const thought = this.sendMessage({
        type: parsed.type || 'thought',
        fromAgent: agent.config.id,
        roomId: room.id,
        content: {
          text: parsed.text,
          structured: parsed.structured,
          confidence: parsed.confidence,
          severity: parsed.severity,
        },
        metadata: {
          triggerEvent: triggerContext.eventType as string,
          processingTimeMs: processingTime,
          tokenCount: response.length / 4, // Rough estimate
          modelUsed: agent.config.model.name,
        },
        approval: parsed.requiresApproval ? {
          required: true,
          status: 'pending',
        } : undefined,
      });
      
      // Update metrics
      agent.metrics.totalRuns++;
      agent.metrics.totalTokens += thought.metadata.tokenCount || 0;
      agent.metrics.avgLatencyMs = 
        (agent.metrics.avgLatencyMs * (agent.metrics.totalRuns - 1) + processingTime) / agent.metrics.totalRuns;
      
      if (parsed.type === 'concern') agent.metrics.concernsRaised++;
      if (parsed.requiresApproval) agent.metrics.approvalsRequested++;
      
      agent.status = 'idle';
      this.emitEvent('agent:thought', { 
        agentId: agent.config.id, 
        messageId: thought.id,
        type: thought.type,
      });
      
      return thought;
      
    } catch (err) {
      agent.status = 'error';
      agent.lastError = err instanceof Error ? err.message : 'Inference failed';
      throw err;
    }
  }
  
  /**
   * Build context string for agent inference
   */
  private buildAgentContext(
    agent: AgentInstance,
    room: MatrixRoom,
    triggerContext: Record<string, unknown>
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== Agent Context ===`);
    lines.push(`Agent: ${agent.config.name} (${agent.config.role})`);
    lines.push(`Trigger: ${JSON.stringify(triggerContext)}`);
    lines.push('');
    
    if (room.context.userIntent) {
      lines.push(`User Intent: ${room.context.userIntent}`);
    }
    if (room.context.currentFile) {
      lines.push(`Current File: ${room.context.currentFile}`);
    }
    if (room.context.currentView) {
      lines.push(`Current View: ${room.context.currentView}`);
    }
    
    // Recent events
    if (room.context.recentEvents.length > 0) {
      lines.push('');
      lines.push(`Recent Events (${room.context.recentEvents.length}):`);
      for (const event of room.context.recentEvents.slice(-5)) {
        lines.push(`  - [${event.type}] ${JSON.stringify(event.data).slice(0, 100)}`);
      }
    }
    
    // Recent agent messages
    const recentMessages = room.messages.slice(-10);
    if (recentMessages.length > 0) {
      lines.push('');
      lines.push('Recent Agent Discussion:');
      for (const msg of recentMessages) {
        const agentName = this.agents.get(msg.fromAgent)?.config.name || msg.fromAgent;
        lines.push(`  [${agentName}]: ${msg.content.text.slice(0, 150)}`);
      }
    }
    
    // Policies to enforce
    if (agent.config.policies.length > 0) {
      lines.push('');
      lines.push('Policies to Evaluate:');
      for (const policy of agent.config.policies) {
        lines.push(`  - ${policy.name}: ${policy.description}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Run inference using the agent's configured model
   */
  private async runInference(config: AgentConfig, context: string): Promise<string> {
    const fullPrompt = `${config.systemPrompt}\n\n${context}\n\nProvide your observation in JSON format with fields: type, text, confidence, severity, requiresApproval, structured`;
    
    switch (config.model.type) {
      case 'mock':
        // For testing - return mock response
        return JSON.stringify({
          type: 'thought',
          text: `[${config.name}] Observing context...`,
          confidence: 0.8,
          severity: 'info',
          requiresApproval: false,
        });
        
      case 'ollama':
        // Use Ollama API
        return await this.inferOllama(config.model.name, fullPrompt, config.model);
        
      case 'webllm':
        // Use WebLLM (browser-hosted)
        return await this.inferWebLLM(config.model.name, fullPrompt, config.model);
        
      case 'onnx':
        // Use ONNX runtime
        return await this.inferONNX(config.model.name, fullPrompt, config.model);
        
      default:
        throw new Error(`Unknown model type: ${config.model.type}`);
    }
  }
  
  private async inferOllama(
    model: string, 
    prompt: string, 
    options: AgentConfig['model']
  ): Promise<string> {
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.3,
            num_predict: options.maxTokens ?? 256,
          },
        }),
      });
      
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      const data = await response.json();
      return data.response;
    } catch (err) {
      console.error('[AgentMatrix] Ollama inference failed:', err);
      throw err;
    }
  }
  
  private async inferWebLLM(
    _model: string, 
    _prompt: string, 
    _options: AgentConfig['model']
  ): Promise<string> {
    // WebLLM integration will be implemented by BrowserInferenceService
    // For now, return placeholder
    console.warn('[AgentMatrix] WebLLM not yet implemented, using mock');
    return JSON.stringify({
      type: 'thought',
      text: 'WebLLM inference placeholder',
      confidence: 0.5,
    });
  }
  
  private async inferONNX(
    _model: string, 
    _prompt: string, 
    _options: AgentConfig['model']
  ): Promise<string> {
    // ONNX integration will be implemented by BrowserInferenceService
    console.warn('[AgentMatrix] ONNX not yet implemented, using mock');
    return JSON.stringify({
      type: 'thought', 
      text: 'ONNX inference placeholder',
      confidence: 0.5,
    });
  }
  
  /**
   * Parse agent response into structured format
   */
  private parseAgentResponse(
    response: string, 
    _config: AgentConfig
  ): {
    type?: MatrixMessageType;
    text: string;
    structured?: Record<string, unknown>;
    confidence?: number;
    severity?: PolicyRule['severity'];
    requiresApproval?: boolean;
  } {
    try {
      // Try to parse as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type as MatrixMessageType,
          text: parsed.text || response,
          structured: parsed.structured,
          confidence: parsed.confidence,
          severity: parsed.severity,
          requiresApproval: parsed.requiresApproval,
        };
      }
    } catch {
      // Not JSON, treat as plain text
    }
    
    return { text: response };
  }
  
  /**
   * Generate attestation for agent config
   */
  private generateAttestation(config: AgentConfig): AgentAttestation {
    // Simple hash for now - in production use Web Crypto
    const configStr = JSON.stringify({
      id: config.id,
      role: config.role,
      model: config.model,
      policies: config.policies,
      systemPrompt: config.systemPrompt,
    });
    
    let hash = 0;
    for (let i = 0; i < configStr.length; i++) {
      const char = configStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return {
      hash: Math.abs(hash).toString(16),
      timestamp: Date.now(),
      version: '1.0.0',
    };
  }
  
  // ============ Event Handling ============
  
  private emitEvent(type: MatrixEventType, data: Record<string, unknown>): void {
    const event: MatrixEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: Date.now(),
      data,
      ...('agentId' in data ? { agentId: data.agentId as string } : {}),
      ...('roomId' in data ? { roomId: data.roomId as string } : {}),
    };
    
    for (const subscriber of this.eventSubscribers) {
      try {
        subscriber(event);
      } catch (err) {
        console.error('[AgentMatrix] Event subscriber error:', err);
      }
    }
  }
  
  onEvent(callback: (event: MatrixEvent) => void): () => void {
    this.eventSubscribers.add(callback);
    return () => this.eventSubscribers.delete(callback);
  }
  
  // ============ Snapshot & Restore ============
  
  /**
   * Create a snapshot of current matrix state
   */
  createSnapshot(): MatrixSnapshot {
    return {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      agents: Array.from(this.agents.entries()).map(([id, instance]) => ({
        id,
        config: instance.config,
        metrics: instance.metrics,
      })),
      rooms: Array.from(this.rooms.values()).map(room => ({
        ...room,
        messages: room.messages.slice(-100), // Keep recent messages
      })),
    };
  }
  
  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshot: MatrixSnapshot): void {
    this.agents.clear();
    this.rooms.clear();
    
    for (const agentData of snapshot.agents) {
      this.registerAgent(agentData.config);
      const instance = this.agents.get(agentData.id);
      if (instance) {
        instance.metrics = agentData.metrics;
      }
    }
    
    for (const room of snapshot.rooms) {
      this.rooms.set(room.id, room);
    }
    
    console.log(`[AgentMatrix] Restored snapshot from ${new Date(snapshot.timestamp).toISOString()}`);
  }
}

export interface MatrixSnapshot {
  id: string;
  timestamp: number;
  agents: Array<{
    id: string;
    config: AgentConfig;
    metrics: AgentMetrics;
  }>;
  rooms: MatrixRoom[];
}

// ============ Default Agent Configurations ============

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'security-agent',
    name: 'Security Monitor',
    role: 'security',
    description: 'Monitors for security implications in user actions and code changes',
    model: {
      type: 'ollama',
      name: 'qwen2.5:0.5b',
      temperature: 0.2,
      maxTokens: 256,
    },
    priority: 'critical',
    triggers: ['on-file-change', 'on-command', 'on-service-change'],
    policies: [
      {
        id: 'no-secrets',
        name: 'Secret Detection',
        description: 'Detect potential secrets or credentials in code',
        rules: [
          { condition: 'contains(password|secret|api_key|token)', severity: 'critical', message: 'Potential secret detected' }
        ],
        actions: [
          { type: 'block', payload: { reason: 'Security review required' } }
        ],
      },
    ],
    systemPrompt: `You are a security-focused agent. Analyze the context for security concerns:
- Exposed credentials or secrets
- Insecure configurations
- Permission issues
- Network security concerns
Be concise and specific. If critical, set requiresApproval: true.`,
    limits: {
      maxConcurrent: 1,
      cooldownMs: 5000,
      timeoutMs: 10000,
      maxTokensPerRun: 256,
    },
    enabled: true,
  },
  {
    id: 'architecture-agent',
    name: 'Architecture Advisor',
    role: 'architecture',
    description: 'Provides insights on code structure and design patterns',
    model: {
      type: 'ollama',
      name: 'qwen2.5:0.5b',
      temperature: 0.4,
      maxTokens: 256,
    },
    priority: 'normal',
    triggers: ['on-file-change'],
    policies: [],
    systemPrompt: `You are an architecture advisor. Observe code changes and provide brief insights on:
- Code organization
- Design patterns
- Potential refactoring opportunities
Be constructive and concise.`,
    limits: {
      maxConcurrent: 1,
      cooldownMs: 10000,
      timeoutMs: 15000,
      maxTokensPerRun: 256,
    },
    enabled: true,
  },
  {
    id: 'ux-agent',
    name: 'UX Observer',
    role: 'ux',
    description: 'Observes user interactions and suggests UX improvements',
    model: {
      type: 'ollama',
      name: 'qwen2.5:0.5b',
      temperature: 0.5,
      maxTokens: 256,
    },
    priority: 'low',
    triggers: ['on-user-action', 'on-navigation'],
    policies: [],
    systemPrompt: `You are a UX observer. Watch user navigation and interactions to identify:
- Friction points
- Workflow inefficiencies
- Potential improvements
Keep observations brief and actionable.`,
    limits: {
      maxConcurrent: 1,
      cooldownMs: 15000,
      timeoutMs: 10000,
      maxTokensPerRun: 256,
    },
    enabled: true,
  },
  {
    id: 'resource-agent',
    name: 'Resource Preparer',
    role: 'performance',
    description: 'Anticipates resource needs and prepares them proactively',
    model: {
      type: 'ollama',
      name: 'qwen2.5:0.5b',
      temperature: 0.3,
      maxTokens: 256,
    },
    priority: 'background',
    triggers: ['on-navigation', 'on-file-change'],
    policies: [],
    systemPrompt: `You are a resource preparation agent. Anticipate what the user might need next:
- Files they might open
- Services they might need
- Data they might query
Suggest resources to preload or prepare.`,
    limits: {
      maxConcurrent: 2,
      cooldownMs: 20000,
      timeoutMs: 10000,
      maxTokensPerRun: 256,
    },
    enabled: true,
  },
];

// ============ Singleton ============

let matrixService: AgentMatrixService | null = null;

export function getAgentMatrix(): AgentMatrixService {
  if (!matrixService) {
    matrixService = new AgentMatrixService();
    
    // Register default agents
    for (const config of DEFAULT_AGENTS) {
      matrixService.registerAgent(config);
    }
  }
  return matrixService;
}

export function initAgentMatrix(): AgentMatrixService {
  return getAgentMatrix();
}
