/**
 * Atlas Orchestrator
 * 
 * Manages the dual-model architecture:
 * - Chat Model: Responds in plain English only, no embedded thoughts
 * - Observer Model: Background reasoning that runs passively
 * - Agent Matrix: Multi-agent collaboration for specialized observations
 * 
 * Features:
 * - Separate rendering pipelines for chat and thoughts
 * - Context logging with visibility into what's passed to models
 * - Event emission for all model interactions
 * - Navigation and UI action awareness
 * - Multi-agent MoE (Mixture of Experts) observations
 * - Approval gates for blocking actions
 */

import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage, AIMessage, type BaseMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { getAtlasPersistence } from './atlasPersistence';
import { getDashboardContext } from './dashboardContext';
import { 
  getAgentMatrix, 
  type MatrixMessage, 
  type AgentInstance,
  type MatrixRoom,
} from './atlasAgentMatrix';
import { getPolicyEngine, type PolicyEvaluationResult } from './atlasPolicyEngine';
import { getApprovalGates, type ApprovalGate } from './atlasApprovalGates';

// ============ Event Types ============

export type AtlasEventType = 
  | 'context:passed'      // Context being sent to model
  | 'context:filtered'    // How context was filtered/summarized
  | 'thought:observation' // Background observation
  | 'thought:inference'   // Reasoning about user intent
  | 'thought:suggestion'  // Suggested action
  | 'thought:concern'     // Ethical or safety concern
  | 'thought:reflection'  // Meta-reflection on own reasoning
  | 'chat:start'          // Chat response starting
  | 'chat:chunk'          // Streaming chunk
  | 'chat:complete'       // Chat response complete
  | 'ui:action'           // User UI action
  | 'ui:navigation'       // Page/route navigation
  | 'ui:suggestion'       // Agent suggesting UI action
  | 'tool:invoke'         // Tool being called
  | 'tool:result'         // Tool result
  | 'model:switch'        // Model being switched
  // Matrix/Multi-agent events
  | 'matrix:message'      // Agent matrix message
  | 'matrix:thought'      // Agent thought from matrix
  | 'matrix:concern'      // Agent raised a concern
  | 'matrix:recommendation' // Agent recommendation
  | 'gate:pending'        // Approval gate waiting
  | 'gate:approved'       // Gate approved
  | 'gate:rejected'       // Gate rejected
  | 'gate:timeout'        // Gate timed out
  | 'policy:matched'      // Policy triggered
  | 'policy:action'       // Policy action executed
  | 'error';

export interface AtlasEvent {
  id: string;
  timestamp: number;
  type: AtlasEventType;
  source: 'chat-model' | 'observer-model' | 'ui' | 'system' | 'agent-matrix' | 'policy-engine' | 'approval-gate';
  agentId?: string;        // For matrix agent events
  agentName?: string;      // Human-readable agent name
  agentRole?: string;      // Agent's role (security, ux, etc.)
  data: Record<string, unknown>;
  metadata?: {
    modelName?: string;
    tokenCount?: number;
    latencyMs?: number;
    contextSize?: number;
    confidence?: number;
    severity?: string;
    requiresApproval?: boolean;
    gateId?: string;
  };
}

export interface AtlasThought {
  id: string;
  timestamp: number;
  type: 'observation' | 'inference' | 'suggestion' | 'concern' | 'reflection' | 'question';
  content: string;
  reasoning?: string;
  confidence: number;
  trigger?: 'dom-event' | 'navigation' | 'user-action' | 'timer' | 'chat';
  relatedActions: string[]; // Required for persistence compatibility
  relatedContext?: string[];
  metadata?: {
    domContext?: string;
    userAction?: string;
    triggeredBy?: 'dom' | 'user' | 'timer' | 'memory';
  };
}

export interface ContextSnapshot {
  id: string;
  timestamp: number;
  recentMessages: number;
  recentThoughts: number;
  domContext?: string;
  navigationPath?: string;
  activeServices?: string[];
  filteredReason?: string;
}

// ============ Configuration ============

export interface OrchestratorConfig {
  // Chat model (primary, English responses)
  chatModel: {
    name: string;
    baseUrl: string;
    temperature: number;
  };
  // Observer model (background thoughts)
  observerModel: {
    name: string;
    baseUrl: string;
    temperature: number;
    // Can be different/smaller model for speed
    enabled: boolean;
  };
  // Context settings
  maxContextMessages: number;
  maxContextThoughts: number;
  thoughtInterval: number; // ms between background thoughts
  enableDOMObservation: boolean;
  enableNavigationTracking: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  chatModel: {
    name: 'qwen2.5:3b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.7,
  },
  observerModel: {
    name: 'qwen2.5:0.5b', // Smaller model for fast background thoughts
    baseUrl: 'http://localhost:11434',
    temperature: 0.5,
    enabled: true,
  },
  maxContextMessages: 20,
  maxContextThoughts: 10,
  thoughtInterval: 10000, // 10 seconds
  enableDOMObservation: true,
  enableNavigationTracking: true,
};

// ============ System Prompts ============

const CHAT_SYSTEM_PROMPT = `You are Atlas, a helpful AI assistant for QemuWeb. 

IMPORTANT RULES:
1. Respond ONLY in plain English
2. Do NOT include your thought process in responses
3. Do NOT use prefixes like "OBSERVATION:", "INFERENCE:", etc.
4. Do NOT wrap responses in special formatting
5. Just have a natural conversation

You help users with:
- Understanding their application, services, and infrastructure
- Managing containers, images, and virtual machines
- DevOps tasks and configuration
- Scientific computing and analysis
- General questions and assistance

When answering questions about services or images:
- Check the dashboard context provided in the conversation
- Reference specific service names, capabilities, and status
- Provide actionable information based on what's actually running

Be concise, friendly, and helpful. If you need clarification, ask.`;

const OBSERVER_SYSTEM_PROMPT = `You are Atlas's background reasoning system. You observe and analyze without responding to the user directly.

Your job is to output structured observations about:
1. What the user might be trying to accomplish
2. What context is relevant to their current task
3. Any potential issues or concerns
4. Suggestions for helpful actions

Output ONLY in this JSON format:
{
  "type": "observation" | "inference" | "suggestion" | "concern" | "reflection",
  "content": "Brief observation text",
  "reasoning": "Why you think this",
  "confidence": 0.0 to 1.0,
  "relatedContext": ["relevant", "context", "items"]
}

Respond with a single JSON object. No other text.`;

// ============ Orchestrator Class ============

export class AtlasOrchestrator {
  private config: OrchestratorConfig;
  private chatModel: ChatOllama;
  private observerModel: ChatOllama | null = null;
  private messageHistory: BaseMessage[] = [];
  private thoughts: AtlasThought[] = [];
  private eventListeners: Map<string, Set<(event: AtlasEvent) => void>> = new Map();
  private thoughtInterval: ReturnType<typeof setInterval> | null = null;
  private currentContext: ContextSnapshot | null = null;
  private navigationHistory: string[] = [];
  private activeServices: Set<string> = new Set();
  private isInitialized = false;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize chat model
    this.chatModel = new ChatOllama({
      model: this.config.chatModel.name,
      baseUrl: this.config.chatModel.baseUrl,
      temperature: this.config.chatModel.temperature,
    });

    // Initialize observer model if enabled
    if (this.config.observerModel.enabled) {
      this.observerModel = new ChatOllama({
        model: this.config.observerModel.name,
        baseUrl: this.config.observerModel.baseUrl,
        temperature: this.config.observerModel.temperature,
      });
    }
  }

  // ============ Initialization ============

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Load persisted state
    try {
      const persistence = getAtlasPersistence();
      const state = await persistence.loadState();
      if (state) {
        // Rebuild message history
        for (const msg of state.messages.slice(-this.config.maxContextMessages)) {
          if (msg.role === 'user') {
            this.messageHistory.push(new HumanMessage(msg.content));
          } else {
            this.messageHistory.push(new AIMessage(msg.content));
          }
        }
        // Load thoughts
        this.thoughts = state.thoughts.slice(-this.config.maxContextThoughts) as AtlasThought[];
      }
    } catch (err) {
      this.emitEvent('error', 'system', { message: 'Failed to load persisted state', error: err });
    }

    // Start background thought generation if observer enabled
    if (this.config.observerModel.enabled) {
      this.startBackgroundObserver();
    }

    this.isInitialized = true;
    this.emitEvent('model:switch', 'system', { 
      chatModel: this.config.chatModel.name,
      observerModel: this.config.observerModel.name,
    });
  }

  // ============ Chat (English Only) ============

  async *chat(userMessage: string): AsyncGenerator<string> {
    // Emit context being passed
    const contextSnapshot = this.createContextSnapshot('chat');
    this.emitEvent('context:passed', 'chat-model', {
      snapshot: contextSnapshot,
      messageCount: this.messageHistory.length,
      thoughtCount: this.thoughts.length,
    });

    // Get dashboard context
    const dashboardCtx = getDashboardContext();
    const context = dashboardCtx.getContext();
    const dashboardInfo = context ? dashboardCtx.getContextString() : null;

    // Build messages with dashboard context
    const systemPrompt = dashboardInfo 
      ? `${CHAT_SYSTEM_PROMPT}\n\n=== CURRENT DASHBOARD STATE ===\n${dashboardInfo}`
      : CHAT_SYSTEM_PROMPT;

    // Log what context is being passed
    this.emitEvent('context:passed', 'chat-model', {
      hasDashboardContext: !!dashboardInfo,
      services: context?.services?.length ?? 0,
      images: context?.images?.length ?? 0,
    });

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...this.messageHistory.slice(-this.config.maxContextMessages),
      new HumanMessage(userMessage),
    ];

    // Log context filtering
    const filteredCount = Math.max(0, this.messageHistory.length - this.config.maxContextMessages);
    if (filteredCount > 0) {
      this.emitEvent('context:filtered', 'system', {
        originalCount: this.messageHistory.length,
        keptCount: this.config.maxContextMessages,
        filteredCount,
        reason: `Kept last ${this.config.maxContextMessages} messages for context window`,
      });
    }

    // Emit chat start
    this.emitEvent('chat:start', 'chat-model', { 
      userMessage,
      modelName: this.config.chatModel.name,
    });

    const startTime = Date.now();
    let fullResponse = '';

    try {
      // Stream response
      const stream = await this.chatModel.stream(messages);
      
      for await (const chunk of stream) {
        const content = typeof chunk.content === 'string' ? chunk.content : '';
        fullResponse += content;
        
        this.emitEvent('chat:chunk', 'chat-model', { chunk: content });
        yield content;
      }

      // Add to history
      this.messageHistory.push(new HumanMessage(userMessage));
      this.messageHistory.push(new AIMessage(fullResponse));

      // Emit completion
      this.emitEvent('chat:complete', 'chat-model', {
        response: fullResponse,
        latencyMs: Date.now() - startTime,
        tokenCount: fullResponse.split(/\s+/).length, // Rough estimate
      });

      // Trigger background observation about this exchange
      if (this.observerModel) {
        this.triggerObservation('chat', `User said: "${userMessage.slice(0, 100)}..."`);
      }

    } catch (err) {
      this.emitEvent('error', 'chat-model', { 
        message: 'Chat failed', 
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ============ Background Observer ============

  private startBackgroundObserver(): void {
    if (this.thoughtInterval) return;

    this.thoughtInterval = setInterval(() => {
      this.generateBackgroundThought();
    }, this.config.thoughtInterval);
  }

  private stopBackgroundObserver(): void {
    if (this.thoughtInterval) {
      clearInterval(this.thoughtInterval);
      this.thoughtInterval = null;
    }
  }

  async triggerObservation(trigger: AtlasThought['trigger'], context: string): Promise<void> {
    if (!this.observerModel) return;

    const contextSnapshot = this.createContextSnapshot('observation');
    this.emitEvent('context:passed', 'observer-model', {
      snapshot: contextSnapshot,
      trigger,
      context: context.slice(0, 200),
    });

    try {
      const observerPrompt = this.buildObserverPrompt(trigger, context);
      
      const messages: BaseMessage[] = [
        new SystemMessage(OBSERVER_SYSTEM_PROMPT),
        new HumanMessage(observerPrompt),
      ];

      const startTime = Date.now();
      const response = await this.observerModel.invoke(messages);
      const content = typeof response.content === 'string' ? response.content : '';

      // Parse the JSON response
      const thought = this.parseObserverResponse(content, trigger);
      if (thought) {
        this.thoughts.push(thought);
        this.emitEvent(`thought:${thought.type}` as AtlasEventType, 'observer-model', {
          thought,
          latencyMs: Date.now() - startTime,
        });
      }

    } catch (err) {
      // Observer failures are non-critical
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AtlasOrchestrator] Observer failed:', err);
      }
    }
  }

  private async generateBackgroundThought(): Promise<void> {
    // Only generate if there's recent activity
    const lastMessage = this.messageHistory[this.messageHistory.length - 1];
    if (!lastMessage) return;

    // Build context from recent activity
    const context = [
      `Recent messages: ${this.messageHistory.length}`,
      `Navigation: ${this.navigationHistory.slice(-3).join(' → ') || 'none'}`,
      `Active services: ${Array.from(this.activeServices).join(', ') || 'none'}`,
    ].join('\n');

    await this.triggerObservation('timer', context);
  }

  private buildObserverPrompt(trigger: AtlasThought['trigger'], context: string): string {
    const recentMessages = this.messageHistory.slice(-5).map(m => {
      const role = m._getType() === 'human' ? 'User' : 'Assistant';
      const content = typeof m.content === 'string' ? m.content.slice(0, 100) : '';
      return `${role}: ${content}`;
    }).join('\n');

    const recentThoughts = this.thoughts.slice(-3).map(t => 
      `[${t.type}] ${t.content.slice(0, 50)}`
    ).join('\n');

    return `Trigger: ${trigger}
Context: ${context}

Recent conversation:
${recentMessages || 'No messages yet'}

Recent thoughts:
${recentThoughts || 'No thoughts yet'}

Navigation path: ${this.navigationHistory.slice(-5).join(' → ') || 'Not tracked'}
Active services: ${Array.from(this.activeServices).join(', ') || 'None detected'}

What do you observe? Respond with a single JSON observation.`;
  }

  private parseObserverResponse(content: string, trigger: AtlasThought['trigger']): AtlasThought | null {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        id: uuidv4(),
        timestamp: Date.now(),
        type: parsed.type || 'observation',
        content: parsed.content || content,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence ?? 0.5,
        trigger,
        relatedActions: parsed.relatedActions || [],
        relatedContext: parsed.relatedContext,
      };
    } catch {
      // If JSON parsing fails, create a simple observation
      return {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'observation',
        content: content.slice(0, 200),
        confidence: 0.3,
        trigger,
        relatedActions: [],
      };
    }
  }

  // ============ Context Management ============

  private createContextSnapshot(_source: string): ContextSnapshot {
    this.currentContext = {
      id: uuidv4(),
      timestamp: Date.now(),
      recentMessages: Math.min(this.messageHistory.length, this.config.maxContextMessages),
      recentThoughts: Math.min(this.thoughts.length, this.config.maxContextThoughts),
      navigationPath: this.navigationHistory.slice(-5).join(' → '),
      activeServices: Array.from(this.activeServices),
    };
    return this.currentContext;
  }

  // ============ UI & Navigation Tracking ============

  trackNavigation(path: string): void {
    this.navigationHistory.push(path);
    // Keep last 20 navigations
    if (this.navigationHistory.length > 20) {
      this.navigationHistory.shift();
    }

    this.emitEvent('ui:navigation', 'ui', { 
      path,
      previousPath: this.navigationHistory[this.navigationHistory.length - 2],
    });

    // Trigger observation about navigation
    if (this.observerModel) {
      this.triggerObservation('navigation', `User navigated to: ${path}`);
    }
  }

  trackUIAction(action: string, element?: string, value?: unknown): void {
    this.emitEvent('ui:action', 'ui', { action, element, value });

    // Detect service interactions
    this.detectService(action, element);

    // Trigger observation for significant actions
    if (this.observerModel && this.isSignificantAction(action)) {
      this.triggerObservation('user-action', `User performed: ${action} on ${element || 'unknown'}`);
    }
  }

  private detectService(action: string, element?: string): void {
    // Detect which service the user might be interacting with
    const servicePatterns: Record<string, RegExp> = {
      'kubernetes': /k8s|kube|pod|deploy|service|ingress/i,
      'docker': /docker|container|image|volume/i,
      'terraform': /terraform|tf|provider|resource/i,
      'vm': /vm|virtual|qemu|machine/i,
      'network': /network|ip|dns|port|firewall/i,
      'storage': /storage|disk|volume|s3|bucket/i,
    };

    const context = `${action} ${element || ''}`;
    for (const [service, pattern] of Object.entries(servicePatterns)) {
      if (pattern.test(context)) {
        this.activeServices.add(service);
      }
    }
  }

  private isSignificantAction(action: string): boolean {
    const significant = ['click', 'submit', 'create', 'delete', 'deploy', 'start', 'stop'];
    return significant.some(s => action.toLowerCase().includes(s));
  }

  // ============ Event System ============

  private emitEvent(type: AtlasEventType, source: AtlasEvent['source'], data: Record<string, unknown>): void {
    const event: AtlasEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      type,
      source,
      data,
    };

    // Notify all listeners
    const listeners = this.eventListeners.get('*') || new Set();
    const typeListeners = this.eventListeners.get(type) || new Set();
    
    for (const listener of [...listeners, ...typeListeners]) {
      try {
        listener(event);
      } catch (err) {
        console.error('[AtlasOrchestrator] Event listener error:', err);
      }
    }
  }

  onEvent(handler: (event: AtlasEvent) => void): () => void {
    if (!this.eventListeners.has('*')) {
      this.eventListeners.set('*', new Set());
    }
    this.eventListeners.get('*')!.add(handler);
    
    return () => {
      this.eventListeners.get('*')?.delete(handler);
    };
  }

  onEventType(type: AtlasEventType, handler: (event: AtlasEvent) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(handler);
    
    return () => {
      this.eventListeners.get(type)?.delete(handler);
    };
  }

  // ============ State Access ============

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };

    // Reinitialize models if changed
    if (updates.chatModel) {
      this.chatModel = new ChatOllama({
        model: this.config.chatModel.name,
        baseUrl: this.config.chatModel.baseUrl,
        temperature: this.config.chatModel.temperature,
      });
    }

    if (updates.observerModel) {
      if (this.config.observerModel.enabled) {
        this.observerModel = new ChatOllama({
          model: this.config.observerModel.name,
          baseUrl: this.config.observerModel.baseUrl,
          temperature: this.config.observerModel.temperature,
        });
        this.startBackgroundObserver();
      } else {
        this.stopBackgroundObserver();
        this.observerModel = null;
      }
    }

    this.emitEvent('model:switch', 'system', {
      chatModel: this.config.chatModel.name,
      observerModel: this.config.observerModel.enabled ? this.config.observerModel.name : 'disabled',
    });
  }

  getThoughts(): AtlasThought[] {
    return [...this.thoughts];
  }

  getRecentThoughts(count = 20): AtlasThought[] {
    return this.thoughts.slice(-count);
  }

  getCurrentContext(): ContextSnapshot | null {
    return this.currentContext;
  }

  getNavigationHistory(): string[] {
    return [...this.navigationHistory];
  }

  getActiveServices(): string[] {
    return Array.from(this.activeServices);
  }

  // ============ Agent Matrix Integration ============

  /**
   * Initialize the agent matrix for multi-agent observations
   */
  initAgentMatrix(): void {
    const matrix = getAgentMatrix();
    const policyEngine = getPolicyEngine();
    const gates = getApprovalGates();
    
    // Subscribe to matrix messages and convert to events
    matrix.onMessage((message: MatrixMessage) => {
      this.handleMatrixMessage(message);
    });
    
    // Subscribe to matrix events
    matrix.onEvent((matrixEvent) => {
      if (matrixEvent.type === 'agent:thought') {
        const agent = matrix.getAgent(matrixEvent.agentId || '');
        this.emitEvent('matrix:thought', 'agent-matrix', {
          agentId: matrixEvent.agentId,
          agentName: agent?.config.name,
          agentRole: agent?.config.role,
          messageId: matrixEvent.data.messageId,
        });
      }
    });
    
    // Subscribe to policy engine events
    policyEngine.onEvent((policyEvent) => {
      if (policyEvent.type === 'policies:matched') {
        this.emitEvent('policy:matched', 'policy-engine', policyEvent.data);
      } else if (policyEvent.type === 'action:blocked') {
        this.emitEvent('gate:pending', 'policy-engine', policyEvent.data);
      }
    });
    
    // Subscribe to approval gate events
    gates.onEvent((gateEvent) => {
      const eventTypeMap: Record<string, AtlasEventType> = {
        'gate:approved': 'gate:approved',
        'gate:rejected': 'gate:rejected',
        'gate:timeout': 'gate:timeout',
        'gate:pending': 'gate:pending',
      };
      
      const atlasEventType = eventTypeMap[gateEvent.type];
      if (atlasEventType) {
        this.emitEvent(atlasEventType, 'approval-gate', {
          gateId: gateEvent.gateId,
          ...gateEvent.data,
        });
      }
    });
    
    console.log('[AtlasOrchestrator] Agent matrix integration initialized');
  }
  
  /**
   * Handle a message from the agent matrix
   */
  private handleMatrixMessage(message: MatrixMessage): void {
    const matrix = getAgentMatrix();
    const agent = matrix.getAgent(message.fromAgent);
    
    // Convert matrix message to Atlas event
    let eventType: AtlasEventType = 'matrix:message';
    switch (message.type) {
      case 'thought':
        eventType = 'matrix:thought';
        break;
      case 'concern':
        eventType = 'matrix:concern';
        break;
      case 'recommendation':
        eventType = 'matrix:recommendation';
        break;
      case 'approval-request':
        eventType = 'gate:pending';
        break;
    }
    
    // Emit as Atlas event
    this.emitEvent(eventType, 'agent-matrix', {
      messageId: message.id,
      messageType: message.type,
      text: message.content.text,
      structured: message.content.structured,
    });
    
    // Also create a thought if it's a thought-type message
    if (message.type === 'thought' || message.type === 'concern' || message.type === 'recommendation') {
      const thought: AtlasThought = {
        id: message.id,
        timestamp: message.timestamp,
        type: message.type === 'concern' ? 'concern' : 
              message.type === 'recommendation' ? 'suggestion' : 'observation',
        content: message.content.text,
        confidence: message.content.confidence || 0.5,
        trigger: 'timer',
        relatedActions: [],
        metadata: {
          triggeredBy: 'timer',
        },
      };
      
      this.thoughts.push(thought);
      
      // Keep thoughts limited
      if (this.thoughts.length > 100) {
        this.thoughts = this.thoughts.slice(-100);
      }
      
      // Emit thought event with agent info
      const event: AtlasEvent = {
        id: uuidv4(),
        timestamp: Date.now(),
        type: `thought:${thought.type}` as AtlasEventType,
        source: 'agent-matrix',
        agentId: message.fromAgent,
        agentName: agent?.config.name,
        agentRole: agent?.config.role,
        data: { thought },
        metadata: {
          confidence: message.content.confidence,
          severity: message.content.severity,
          requiresApproval: message.approval?.required,
          gateId: message.approval?.required ? message.id : undefined,
        },
      };
      
      // Notify listeners
      const listeners = this.eventListeners.get('*') || new Set();
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('[AtlasOrchestrator] Event listener error:', err);
        }
      }
    }
    
    // Handle approval requests
    if (message.approval?.required && message.approval.status === 'pending') {
      const gates = getApprovalGates();
      gates.createGateFromMessage(message);
    }
  }
  
  /**
   * Trigger matrix agents to evaluate current context
   */
  async triggerMatrixAgents(trigger: string, context?: Record<string, unknown>): Promise<MatrixMessage[]> {
    const matrix = getAgentMatrix();
    
    // Build context from current state
    const fullContext = {
      ...context,
      navigationPath: this.navigationHistory.slice(-5),
      activeServices: Array.from(this.activeServices),
      recentThoughtsCount: this.thoughts.length,
      currentContextId: this.currentContext?.id,
    };
    
    // Trigger agents and get their thoughts
    const messages = await matrix.triggerAgents(
      trigger as 'always' | 'on-file-change' | 'on-command' | 'on-navigation' | 'on-user-action' | 'on-service-change' | 'on-error' | 'on-request' | 'periodic' | 'on-agent-message',
      fullContext
    );
    
    return messages;
  }
  
  /**
   * Evaluate policies against an event
   */
  async evaluatePolicies(event: AtlasEvent): Promise<PolicyEvaluationResult> {
    const policyEngine = getPolicyEngine();
    return policyEngine.evaluate(event);
  }
  
  /**
   * Get all registered agents
   */
  getAgents(): AgentInstance[] {
    const matrix = getAgentMatrix();
    return matrix.getAgents();
  }
  
  /**
   * Get the active matrix room
   */
  getActiveRoom(): MatrixRoom {
    const matrix = getAgentMatrix();
    return matrix.getActiveRoom();
  }
  
  /**
   * Get pending approval gates
   */
  getPendingGates(): ApprovalGate[] {
    const gates = getApprovalGates();
    return gates.getPendingGates();
  }
  
  /**
   * Approve a gate
   */
  approveGate(gateId: string, approverId: string, reason?: string): boolean {
    const gates = getApprovalGates();
    return gates.approve(gateId, {
      approverType: 'human',
      approverId,
      approverName: approverId,
      reason,
    });
  }
  
  /**
   * Reject a gate
   */
  rejectGate(gateId: string, rejectorId: string, reason: string): boolean {
    const gates = getApprovalGates();
    return gates.reject(gateId, {
      rejectorType: 'human',
      rejectorId,
      rejectorName: rejectorId,
      reason,
    });
  }

  // ============ Cleanup ============

  destroy(): void {
    this.stopBackgroundObserver();
    this.eventListeners.clear();
  }
}

// ============ Singleton ============

let orchestratorInstance: AtlasOrchestrator | null = null;

export function getAtlasOrchestrator(): AtlasOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AtlasOrchestrator();
  }
  return orchestratorInstance;
}

export async function initAtlasOrchestrator(): Promise<AtlasOrchestrator> {
  const orchestrator = getAtlasOrchestrator();
  await orchestrator.init();
  return orchestrator;
}
