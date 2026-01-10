/**
 * Atlas Expert Network
 * 
 * A configurable Mixture of Experts (MoE) system where multiple "experts"
 * observe context and provide commentary like viewers on a stream. Each
 * expert can be configured with:
 * 
 * - Different inference endpoints (Ollama, Cloudflare Workers, custom APIs)
 * - Custom prompts and personas
 * - Output coercion and parsing rules
 * - Resource bidding for airtime
 * 
 * Experts communicate via Matrix protocol (mock or real), creating auditable
 * chat logs of their observations and recommendations.
 * 
 * Execution options:
 * - Main thread (simple)
 * - Web Workers (background, non-blocking)
 * - Cloudflare Workers (edge, scalable)
 * - Browser sandbox (isolated)
 */

import { 
  initMockMatrix,
  type ExpertMatrixBridge,
  type MatrixEvent,
} from './atlasMatrixMock';

// ============ Expert Configuration Types ============

export type ExpertPersonality = 
  | 'analyst'        // Dry, factual observations
  | 'critic'         // Points out problems and risks
  | 'optimist'       // Highlights opportunities
  | 'pragmatist'     // Focuses on practical implications
  | 'devil-advocate' // Challenges assumptions
  | 'mentor'         // Guides and teaches
  | 'auditor'        // Compliance and correctness focus
  | 'creative'       // Novel ideas and alternatives
  | 'custom';        // User-defined persona

export type InferenceEndpointType = 
  | 'ollama'              // Local Ollama server
  | 'cloudflare-worker'   // Cloudflare Workers AI
  | 'cloudflare-gateway'  // Cloudflare AI Gateway
  | 'openai-compatible'   // Any OpenAI-compatible API
  | 'anthropic'           // Anthropic Claude API
  | 'web-worker'          // In-browser Web Worker
  | 'browser-sandbox'     // Isolated browser context
  | 'custom';             // Custom endpoint

export interface InferenceEndpoint {
  id: string;
  type: InferenceEndpointType;
  name: string;
  
  // Connection settings
  baseUrl: string;
  apiKey?: string;              // Stored encrypted or in env
  headers?: Record<string, string>;
  
  // Model settings
  model: string;
  
  // For Cloudflare
  accountId?: string;
  wranglerConfig?: string;      // Path to wrangler.toml
  
  // For Web Workers
  workerScript?: string;        // Worker script URL or inline
  
  // Rate limiting
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    concurrent: number;
  };
  
  // Health check
  healthCheckPath?: string;
  healthCheckInterval?: number;
  
  // Status
  status: 'unknown' | 'healthy' | 'degraded' | 'down';
  lastChecked?: number;
  latencyMs?: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  
  // System prompt with variable interpolation
  systemPrompt: string;
  
  // User prompt template
  userPromptTemplate: string;
  
  // Variables available in templates
  variables: {
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }[];
  
  // Output format
  outputFormat: 'json' | 'text' | 'markdown' | 'structured';
  
  // JSON schema for structured output
  outputSchema?: Record<string, unknown>;
  
  // Output coercion rules
  coercion?: OutputCoercionRule[];
}

export interface OutputCoercionRule {
  type: 'extract-json' | 'regex' | 'split' | 'truncate' | 'transform';
  config: Record<string, unknown>;
}

export interface ExpertConfig {
  id: string;
  name: string;
  
  // Display settings
  avatar?: string;              // URL or emoji
  color?: string;               // Accent color
  personality: ExpertPersonality;
  
  // Inference configuration
  endpoint: InferenceEndpoint;
  promptTemplate: PromptTemplate;
  
  // Inference parameters
  inference: {
    temperature: number;
    topP: number;
    maxTokens: number;
    stopSequences?: string[];
    presencePenalty?: number;
    frequencyPenalty?: number;
  };
  
  // Trigger configuration
  triggers: ExpertTrigger[];
  
  // Resource bidding
  bidding: {
    enabled: boolean;
    budget: number;              // Credits/tokens available
    minBid: number;              // Minimum bid to participate
    maxBid: number;              // Maximum bid per turn
    strategy: 'aggressive' | 'conservative' | 'adaptive';
    priority: number;            // Base priority (0-100)
  };
  
  // Execution settings
  execution: {
    mode: 'main-thread' | 'web-worker' | 'cloudflare' | 'sandbox';
    timeout: number;
    retries: number;
    cacheResults: boolean;
    cacheTtl: number;
  };
  
  // Matrix integration
  matrix?: {
    enabled: boolean;
    roomId?: string;             // Matrix room to post to
    displayName?: string;        // Matrix display name
    userId?: string;             // Matrix user ID
  };
  
  // State
  enabled: boolean;
  lastActive?: number;
  totalInferences: number;
  avgLatencyMs: number;
}

export interface ExpertTrigger {
  type: 'context-change' | 'user-action' | 'time-interval' | 'event' | 'mention' | 'keyword';
  config: Record<string, unknown>;
  cooldownMs?: number;
  lastTriggered?: number;
}

// ============ Expert Output Types ============

export interface ExpertThought {
  id: string;
  expertId: string;
  expertName: string;
  expertAvatar?: string;
  expertColor?: string;
  
  timestamp: number;
  
  // Content
  type: 'observation' | 'question' | 'recommendation' | 'concern' | 'praise' | 'prediction';
  content: string;
  
  // Metadata
  confidence: number;           // 0-1
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  
  // Context reference
  contextRef?: {
    type: 'file' | 'selection' | 'terminal' | 'action';
    path?: string;
    range?: { start: number; end: number };
    snippet?: string;
  };
  
  // Bidding info
  bid?: number;
  bidWon?: boolean;
  
  // Matrix message ID if posted
  matrixEventId?: string;
  
  // Raw inference details
  rawOutput?: string;
  latencyMs?: number;
  tokensUsed?: number;
}

// ============ Resource Bidding Types ============

export interface BiddingRound {
  id: string;
  timestamp: number;
  
  // What's being bid on
  resource: 'airtime' | 'priority' | 'context-slot' | 'action-approval';
  
  // Participating experts
  bids: {
    expertId: string;
    amount: number;
    reason?: string;
    priority: number;
  }[];
  
  // Outcome
  winners: string[];           // Expert IDs
  settled: boolean;
}

// ============ Matrix Integration Types ============

export interface MatrixConfig {
  homeserverUrl: string;
  accessToken?: string;
  userId?: string;
  deviceId?: string;
  
  // Room management
  defaultRoomId?: string;
  createRooms: boolean;
  roomPrefix: string;
  
  // Sync settings
  syncInterval: number;
  filterTypes: string[];
}

export interface MatrixMessage {
  eventId: string;
  roomId: string;
  sender: string;
  timestamp: number;
  type: string;
  content: {
    msgtype: string;
    body: string;
    formatted_body?: string;
    format?: string;
    // Custom fields
    'm.relates_to'?: {
      rel_type: string;
      event_id: string;
    };
    'io.atlas.expert'?: {
      expertId: string;
      thoughtId: string;
      type: string;
      confidence: number;
    };
  };
}

// ============ Web Worker Types ============

export interface WorkerMessage {
  type: 'init' | 'inference' | 'result' | 'error' | 'status';
  requestId?: string;
  payload: unknown;
}

export interface WorkerConfig {
  scriptUrl?: string;
  inlineScript?: string;
  transferables?: Transferable[];
}

// ============ Panel Debate Types ============

export interface DebateMessage {
  id: string;
  timestamp: number;
  speakerId: string;          // Expert ID or 'user' or 'assistant'
  speakerName: string;
  speakerAvatar?: string;
  speakerColor?: string;
  
  // Message content
  type: 'statement' | 'question' | 'response' | 'agreement' | 'disagreement' | 'proposal' | 'action';
  content: string;
  
  // Reply threading
  replyTo?: string;           // ID of message being replied to
  mentions?: string[];        // Expert IDs mentioned
  
  // Context
  topic?: string;             // Current debate topic
  confidence: number;
  
  // Resources/tools being discussed
  resources?: ResourceMention[];
}

export interface ResourceMention {
  type: 'tool' | 'endpoint' | 'data-source' | 'pipeline' | 'service' | 'file' | 'api';
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  cost?: number;             // Resource cost to use
  availability: 'available' | 'busy' | 'offline' | 'requires-approval';
}

export interface DebateTopic {
  id: string;
  timestamp: number;
  
  // What triggered this topic
  trigger: 'user-message' | 'assistant-response' | 'system-event' | 'expert-proposal';
  triggerContent: string;
  
  // Topic metadata
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Participating experts
  participants: string[];
  
  // Discussion state
  messages: DebateMessage[];
  proposals: ActionProposal[];
  consensusReached: boolean;
  outcome?: string;
}

export interface ActionProposal {
  id: string;
  proposerId: string;
  proposerName: string;
  timestamp: number;
  
  // What's being proposed
  action: string;
  description: string;
  
  // Resources required
  resources: ResourceMention[];
  estimatedCost: number;
  estimatedTime: number;       // ms
  
  // Voting
  votes: {
    expertId: string;
    vote: 'approve' | 'reject' | 'abstain';
    reason?: string;
  }[];
  
  // Status
  status: 'proposed' | 'voting' | 'approved' | 'rejected' | 'executing' | 'completed';
}

export interface AvailableResources {
  tools: ResourceMention[];
  endpoints: ResourceMention[];
  dataSources: ResourceMention[];
  pipelines: ResourceMention[];
  services: ResourceMention[];
}

// ============ Async Background Review Types ============

export interface ReviewTask {
  id: string;
  createdAt: number;
  startedAt?: number;
  
  // What triggered this review
  trigger: 'user-message' | 'assistant-response' | 'file-change' | 'manual';
  context: string;
  contextSummary: string;  // Short summary for display
  
  // Which experts should review
  expertIds: string[];
  
  // Priority for queue ordering
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Status tracking
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;  // 0-100
  
  // Estimated time based on model/experts
  estimatedMs?: number;
}

export interface CompletedReview {
  id: string;
  taskId: string;
  completedAt: number;
  durationMs: number;
  
  // The expert that provided this review
  expertId: string;
  expertName: string;
  expertAvatar?: string;
  expertColor?: string;
  
  // Review content
  type: 'security' | 'architecture' | 'code-review' | 'strategic' | 'general';
  summary: string;
  details: string;
  confidence: number;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  
  // Structured findings
  findings?: {
    type: string;
    content: string;
    severity: string;
    actionItem?: string;
  }[];
  
  // Recommendations
  recommendations?: string[];
  actionItems?: string[];
  references?: string[];
  
  // Raw output for debugging
  rawOutput?: string;
}

export interface ReviewQueueStatus {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  estimatedWaitMs: number;
}

// ============ Expert Network Service ============

type ExpertEventType = 
  | 'expert:registered'
  | 'expert:enabled'
  | 'expert:disabled'
  | 'expert:thinking'
  | 'expert:thought'
  | 'expert:error'
  | 'review:queued'
  | 'review:started'
  | 'review:progress'
  | 'review:completed'
  | 'review:failed'
  | 'debate:started'
  | 'debate:message'
  | 'debate:proposal'
  | 'debate:vote'
  | 'debate:consensus'
  | 'debate:action'
  | 'bidding:round-start'
  | 'bidding:round-end'
  | 'matrix:connected'
  | 'matrix:message'
  | 'worker:ready'
  | 'worker:error';

export interface ExpertEvent {
  type: ExpertEventType;
  expertId?: string;
  data: unknown;
  timestamp: number;
}

class ExpertNetworkService {
  private experts = new Map<string, ExpertConfig>();
  private endpoints = new Map<string, InferenceEndpoint>();
  private templates = new Map<string, PromptTemplate>();
  private thoughts: ExpertThought[] = [];
  private subscribers = new Set<(event: ExpertEvent) => void>();
  
  // Web Workers pool
  private workers = new Map<string, Worker>();
  
  // Matrix client state (legacy HTTP-based)
  private matrixConfig: MatrixConfig | null = null;
  private matrixConnected = false;
  
  // Mock Matrix bridge (in-memory serverless Matrix)
  private matrixBridge: ExpertMatrixBridge | null = null;
  private useMockMatrix = true;  // Default to mock Matrix
  
  // Bidding state
  private currentBiddingRound: BiddingRound | null = null;
  private biddingHistory: BiddingRound[] = [];
  
  // Panel Debate state
  private debates: DebateTopic[] = [];
  private currentDebate: DebateTopic | null = null;
  private debateMessages: DebateMessage[] = [];
  private availableResources: AvailableResources = {
    tools: [],
    endpoints: [],
    dataSources: [],
    pipelines: [],
    services: [],
  };
  private debateActive = false;
  private debateThrottleMs = 500;  // Minimum time between expert responses
  private lastDebateResponse = 0;
  
  // Background async queue for best-effort processing
  private reviewQueue: ReviewTask[] = [];
  private reviewsInProgress = new Map<string, ReviewTask>();
  private completedReviews: CompletedReview[] = [];
  private maxConcurrentReviews = 3;  // How many reviews can run in parallel
  private processingQueue = false;
  
  // ============ Endpoint Management ============
  
  registerEndpoint(endpoint: InferenceEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    console.log(`[ExpertNetwork] Registered endpoint: ${endpoint.name} (${endpoint.type})`);
    
    // Start health check if configured
    if (endpoint.healthCheckPath) {
      this.checkEndpointHealth(endpoint.id);
    }
  }
  
  async checkEndpointHealth(endpointId: string): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return false;
    
    try {
      const start = Date.now();
      const response = await fetch(`${endpoint.baseUrl}${endpoint.healthCheckPath || '/health'}`, {
        method: 'GET',
        headers: endpoint.headers,
        signal: AbortSignal.timeout(5000),
      });
      
      endpoint.latencyMs = Date.now() - start;
      endpoint.lastChecked = Date.now();
      endpoint.status = response.ok ? 'healthy' : 'degraded';
      
      return response.ok;
    } catch (err) {
      endpoint.status = 'down';
      endpoint.lastChecked = Date.now();
      console.error(`[ExpertNetwork] Endpoint ${endpointId} health check failed:`, err);
      return false;
    }
  }
  
  getEndpoint(id: string): InferenceEndpoint | undefined {
    return this.endpoints.get(id);
  }
  
  listEndpoints(): InferenceEndpoint[] {
    return Array.from(this.endpoints.values());
  }
  
  // ============ Template Management ============
  
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    console.log(`[ExpertNetwork] Registered template: ${template.name}`);
  }
  
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }
  
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
  
  // ============ Expert Management ============
  
  registerExpert(config: ExpertConfig): void {
    this.experts.set(config.id, config);
    this.emitEvent('expert:registered', config.id, config);
    console.log(`[ExpertNetwork] Registered expert: ${config.name} (${config.personality})`);
    
    // Register with mock Matrix bridge
    if (this.matrixBridge) {
      this.matrixBridge.registerExpert(config.id, config.name, config.avatar || '🤖');
    }
    
    // Initialize Web Worker if needed
    if (config.execution.mode === 'web-worker') {
      this.initializeWorker(config.id);
    }
  }
  
  updateExpert(id: string, updates: Partial<ExpertConfig>): void {
    const expert = this.experts.get(id);
    if (!expert) return;
    
    Object.assign(expert, updates);
    console.log(`[ExpertNetwork] Updated expert: ${id}`);
  }
  
  enableExpert(id: string): void {
    const expert = this.experts.get(id);
    if (expert) {
      expert.enabled = true;
      this.emitEvent('expert:enabled', id, null);
    }
  }
  
  disableExpert(id: string): void {
    const expert = this.experts.get(id);
    if (expert) {
      expert.enabled = false;
      this.emitEvent('expert:disabled', id, null);
    }
  }
  
  getExpert(id: string): ExpertConfig | undefined {
    return this.experts.get(id);
  }
  
  listExperts(): ExpertConfig[] {
    return Array.from(this.experts.values());
  }
  
  // ============ Inference Execution ============
  
  async runExpertInference(
    expertId: string,
    context: Record<string, unknown>
  ): Promise<ExpertThought | null> {
    const expert = this.experts.get(expertId);
    if (!expert || !expert.enabled) return null;
    
    this.emitEvent('expert:thinking', expertId, { context });
    
    try {
      const start = Date.now();
      
      // Build prompt from template
      const prompt = this.buildPrompt(expert, context);
      
      // Execute based on mode
      let rawOutput: string;
      switch (expert.execution.mode) {
        case 'web-worker':
          rawOutput = await this.runInWorker(expertId, prompt);
          break;
        case 'cloudflare':
          rawOutput = await this.runOnCloudflare(expert, prompt);
          break;
        case 'sandbox':
          rawOutput = await this.runInSandbox(expert, prompt);
          break;
        default:
          rawOutput = await this.runOnEndpoint(expert, prompt);
      }
      
      const latencyMs = Date.now() - start;
      
      // Parse and coerce output
      const thought = this.parseExpertOutput(expert, rawOutput, latencyMs);
      
      // Store thought
      this.thoughts.push(thought);
      
      // Update expert stats
      expert.lastActive = Date.now();
      expert.totalInferences++;
      expert.avgLatencyMs = (expert.avgLatencyMs * (expert.totalInferences - 1) + latencyMs) / expert.totalInferences;
      
      // Post to Matrix if configured
      if (expert.matrix?.enabled && expert.matrix.roomId) {
        await this.postToMatrix(expert, thought);
      }
      
      this.emitEvent('expert:thought', expertId, thought);
      return thought;
      
    } catch (err) {
      console.error(`[ExpertNetwork] Expert ${expertId} inference failed:`, err);
      this.emitEvent('expert:error', expertId, { error: err });
      return null;
    }
  }
  
  private buildPrompt(expert: ExpertConfig, context: Record<string, unknown>): { system: string; user: string } {
    let systemPrompt = expert.promptTemplate.systemPrompt;
    let userPrompt = expert.promptTemplate.userPromptTemplate;
    
    // Interpolate variables
    for (const variable of expert.promptTemplate.variables) {
      const value = context[variable.name] ?? variable.default ?? '';
      const placeholder = `{{${variable.name}}}`;
      systemPrompt = systemPrompt.replaceAll(placeholder, String(value));
      userPrompt = userPrompt.replaceAll(placeholder, String(value));
    }
    
    // Add personality modifier
    const personalityModifiers: Record<ExpertPersonality, string> = {
      'analyst': 'Be precise, factual, and data-driven. Avoid speculation.',
      'critic': 'Focus on potential issues, risks, and problems. Be constructively critical.',
      'optimist': 'Highlight opportunities, benefits, and positive aspects while being realistic.',
      'pragmatist': 'Focus on practical implications and actionable insights.',
      'devil-advocate': 'Challenge assumptions and present alternative viewpoints.',
      'mentor': 'Guide and teach, explaining reasoning and suggesting learning opportunities.',
      'auditor': 'Focus on correctness, compliance, and proper procedures.',
      'creative': 'Suggest novel approaches, alternatives, and creative solutions.',
      'custom': '',
    };
    
    if (expert.personality !== 'custom') {
      systemPrompt += `\n\n${personalityModifiers[expert.personality]}`;
    }
    
    return { system: systemPrompt, user: userPrompt };
  }
  
  private async runOnEndpoint(expert: ExpertConfig, prompt: { system: string; user: string }): Promise<string> {
    const endpoint = expert.endpoint;
    
    switch (endpoint.type) {
      case 'ollama':
        return this.runOllamaInference(endpoint, prompt, expert.inference);
      
      case 'openai-compatible':
        return this.runOpenAICompatibleInference(endpoint, prompt, expert.inference);
      
      case 'anthropic':
        return this.runAnthropicInference(endpoint, prompt, expert.inference);
      
      case 'cloudflare-worker':
      case 'cloudflare-gateway':
        return this.runCloudflareInference(endpoint, prompt, expert.inference);
      
      default:
        throw new Error(`Unsupported endpoint type: ${endpoint.type}`);
    }
  }
  
  private async runOllamaInference(
    endpoint: InferenceEndpoint,
    prompt: { system: string; user: string },
    inference: ExpertConfig['inference']
  ): Promise<string> {
    const response = await fetch(`${endpoint.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...endpoint.headers,
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        stream: false,
        options: {
          temperature: inference.temperature,
          top_p: inference.topP,
          num_predict: inference.maxTokens,
          stop: inference.stopSequences,
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.message?.content || '';
  }
  
  private async runOpenAICompatibleInference(
    endpoint: InferenceEndpoint,
    prompt: { system: string; user: string },
    inference: ExpertConfig['inference']
  ): Promise<string> {
    const response = await fetch(`${endpoint.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${endpoint.apiKey}`,
        ...endpoint.headers,
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: inference.temperature,
        top_p: inference.topP,
        max_tokens: inference.maxTokens,
        stop: inference.stopSequences,
        presence_penalty: inference.presencePenalty,
        frequency_penalty: inference.frequencyPenalty,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  private async runAnthropicInference(
    endpoint: InferenceEndpoint,
    prompt: { system: string; user: string },
    inference: ExpertConfig['inference']
  ): Promise<string> {
    const response = await fetch(`${endpoint.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': endpoint.apiKey || '',
        'anthropic-version': '2023-06-01',
        ...endpoint.headers,
      },
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: inference.maxTokens,
        system: prompt.system,
        messages: [
          { role: 'user', content: prompt.user },
        ],
        temperature: inference.temperature,
        top_p: inference.topP,
        stop_sequences: inference.stopSequences,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content?.[0]?.text || '';
  }
  
  private async runCloudflareInference(
    endpoint: InferenceEndpoint,
    prompt: { system: string; user: string },
    inference: ExpertConfig['inference']
  ): Promise<string> {
    // Cloudflare Workers AI API
    const url = endpoint.type === 'cloudflare-gateway'
      ? `${endpoint.baseUrl}/v1/chat/completions`
      : `https://api.cloudflare.com/client/v4/accounts/${endpoint.accountId}/ai/run/${endpoint.model}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${endpoint.apiKey}`,
        ...endpoint.headers,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        max_tokens: inference.maxTokens,
        temperature: inference.temperature,
        top_p: inference.topP,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Cloudflare request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats
    if (data.result?.response) {
      return data.result.response;
    }
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    
    return '';
  }
  
  // ============ Web Worker Execution ============
  
  private initializeWorker(expertId: string): void {
    const expert = this.experts.get(expertId);
    if (!expert) return;
    
    // Create inline worker for inference
    const workerCode = `
      let endpoint = null;
      let inference = null;
      
      self.onmessage = async function(e) {
        const { type, requestId, payload } = e.data;
        
        if (type === 'init') {
          endpoint = payload.endpoint;
          inference = payload.inference;
          self.postMessage({ type: 'status', payload: 'ready' });
          return;
        }
        
        if (type === 'inference') {
          try {
            const { system, user } = payload;
            
            const response = await fetch(endpoint.baseUrl + '/api/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...endpoint.headers,
              },
              body: JSON.stringify({
                model: endpoint.model,
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: user },
                ],
                stream: false,
                options: {
                  temperature: inference.temperature,
                  top_p: inference.topP,
                  num_predict: inference.maxTokens,
                },
              }),
            });
            
            const data = await response.json();
            self.postMessage({
              type: 'result',
              requestId,
              payload: data.message?.content || '',
            });
            
          } catch (err) {
            self.postMessage({
              type: 'error',
              requestId,
              payload: err.message,
            });
          }
        }
      };
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'status' && payload === 'ready') {
        this.emitEvent('worker:ready', expertId, null);
      }
    };
    
    worker.onerror = (err) => {
      this.emitEvent('worker:error', expertId, { error: err.message });
    };
    
    // Initialize worker with endpoint config
    worker.postMessage({
      type: 'init',
      payload: {
        endpoint: expert.endpoint,
        inference: expert.inference,
      },
    });
    
    this.workers.set(expertId, worker);
  }
  
  private async runInWorker(expertId: string, prompt: { system: string; user: string }): Promise<string> {
    const worker = this.workers.get(expertId);
    if (!worker) {
      throw new Error(`No worker for expert ${expertId}`);
    }
    
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      
      const handler = (e: MessageEvent) => {
        if (e.data.requestId === requestId) {
          worker.removeEventListener('message', handler);
          
          if (e.data.type === 'result') {
            resolve(e.data.payload);
          } else if (e.data.type === 'error') {
            reject(new Error(e.data.payload));
          }
        }
      };
      
      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'inference',
        requestId,
        payload: prompt,
      });
    });
  }
  
  private async runOnCloudflare(expert: ExpertConfig, prompt: { system: string; user: string }): Promise<string> {
    // Uses Cloudflare Workers endpoint
    return this.runCloudflareInference(expert.endpoint, prompt, expert.inference);
  }
  
  private async runInSandbox(expert: ExpertConfig, prompt: { system: string; user: string }): Promise<string> {
    // Create isolated iframe sandbox for inference
    // This provides additional security isolation
    
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.sandbox.add('allow-scripts');
      iframe.style.display = 'none';
      
      const timeoutId = setTimeout(() => {
        document.body.removeChild(iframe);
        reject(new Error('Sandbox timeout'));
      }, expert.execution.timeout);
      
      window.addEventListener('message', function handler(e) {
        if (e.source === iframe.contentWindow) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handler);
          document.body.removeChild(iframe);
          
          if (e.data.type === 'result') {
            resolve(e.data.payload);
          } else {
            reject(new Error(e.data.error));
          }
        }
      });
      
      const sandboxCode = `
        <script>
          (async () => {
            try {
              const response = await fetch('${expert.endpoint.baseUrl}/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: '${expert.endpoint.model}',
                  messages: [
                    { role: 'system', content: ${JSON.stringify(prompt.system)} },
                    { role: 'user', content: ${JSON.stringify(prompt.user)} },
                  ],
                  stream: false,
                }),
              });
              const data = await response.json();
              parent.postMessage({ type: 'result', payload: data.message?.content || '' }, '*');
            } catch (err) {
              parent.postMessage({ type: 'error', error: err.message }, '*');
            }
          })();
        </script>
      `;
      
      iframe.srcdoc = sandboxCode;
      document.body.appendChild(iframe);
    });
  }
  
  // ============ Output Parsing ============
  
  private parseExpertOutput(
    expert: ExpertConfig,
    rawOutput: string,
    latencyMs: number
  ): ExpertThought {
    let content = rawOutput;
    let type: ExpertThought['type'] = 'observation';
    let confidence = 0.7;
    let severity: ExpertThought['severity'] = 'info';
    
    // Apply coercion rules
    if (expert.promptTemplate.coercion) {
      for (const rule of expert.promptTemplate.coercion) {
        content = this.applyCoercionRule(content, rule);
      }
    }
    
    // Try to parse as JSON if expected
    if (expert.promptTemplate.outputFormat === 'json' || expert.promptTemplate.outputFormat === 'structured') {
      try {
        // Extract JSON from potential markdown code block
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        const parsed = JSON.parse(jsonMatch[1] || content);
        
        type = parsed.type || type;
        content = parsed.content || parsed.text || parsed.observation || content;
        confidence = parsed.confidence ?? confidence;
        severity = parsed.severity || severity;
      } catch {
        // Keep as text if JSON parsing fails
      }
    }
    
    return {
      id: crypto.randomUUID(),
      expertId: expert.id,
      expertName: expert.name,
      expertAvatar: expert.avatar,
      expertColor: expert.color,
      timestamp: Date.now(),
      type,
      content,
      confidence,
      severity,
      rawOutput,
      latencyMs,
    };
  }
  
  private applyCoercionRule(content: string, rule: OutputCoercionRule): string {
    switch (rule.type) {
      case 'extract-json': {
        const match = content.match(/\{[\s\S]*\}/);
        return match ? match[0] : content;
      }
      
      case 'regex': {
        const regex = new RegExp(rule.config.pattern as string, rule.config.flags as string || 'g');
        const match = content.match(regex);
        return match ? match[0] : content;
      }
      
      case 'truncate': {
        const maxLength = rule.config.maxLength as number || 500;
        return content.length > maxLength ? content.slice(0, maxLength) + '...' : content;
      }
      
      case 'split': {
        const delimiter = rule.config.delimiter as string || '\n';
        const index = rule.config.index as number || 0;
        const parts = content.split(delimiter);
        return parts[index] || content;
      }
      
      default:
        return content;
    }
  }
  
  // ============ Resource Bidding ============
  
  startBiddingRound(resource: BiddingRound['resource']): BiddingRound {
    const round: BiddingRound = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      resource,
      bids: [],
      winners: [],
      settled: false,
    };
    
    this.currentBiddingRound = round;
    this.emitEvent('bidding:round-start', undefined, { round });
    
    // Collect bids from enabled experts
    for (const expert of this.experts.values()) {
      if (expert.enabled && expert.bidding.enabled && expert.bidding.budget >= expert.bidding.minBid) {
        const bid = this.calculateBid(expert, resource);
        if (bid > 0) {
          round.bids.push({
            expertId: expert.id,
            amount: bid,
            priority: expert.bidding.priority,
          });
        }
      }
    }
    
    return round;
  }
  
  private calculateBid(expert: ExpertConfig, _resource: BiddingRound['resource']): number {
    const { bidding } = expert;
    let bid = bidding.minBid;
    
    switch (bidding.strategy) {
      case 'aggressive':
        // Bid high when budget allows
        bid = Math.min(bidding.maxBid, bidding.budget * 0.3);
        break;
      
      case 'conservative':
        // Bid minimum to stay in game
        bid = bidding.minBid;
        break;
      
      case 'adaptive': {
        // Adjust based on resource type and priority
        const priorityMultiplier = bidding.priority / 100;
        bid = bidding.minBid + (bidding.maxBid - bidding.minBid) * priorityMultiplier;
        break;
      }
    }
    
    return Math.min(bid, bidding.budget);
  }
  
  settleBiddingRound(maxWinners: number = 3): string[] {
    if (!this.currentBiddingRound || this.currentBiddingRound.settled) {
      return [];
    }
    
    const round = this.currentBiddingRound;
    
    // Sort by bid amount and priority
    const sortedBids = [...round.bids].sort((a, b) => {
      const scoreDiff = (b.amount * b.priority) - (a.amount * a.priority);
      if (scoreDiff !== 0) return scoreDiff;
      return b.amount - a.amount;
    });
    
    // Select winners
    round.winners = sortedBids.slice(0, maxWinners).map(b => b.expertId);
    round.settled = true;
    
    // Deduct from budgets
    for (const bid of round.bids) {
      const expert = this.experts.get(bid.expertId);
      if (expert && round.winners.includes(bid.expertId)) {
        expert.bidding.budget -= bid.amount;
      }
    }
    
    this.biddingHistory.push(round);
    this.currentBiddingRound = null;
    
    this.emitEvent('bidding:round-end', undefined, { round });
    
    return round.winners;
  }
  
  // ============ Matrix Integration ============
  
  /**
   * Initialize mock Matrix (in-memory serverless)
   * This creates an in-memory Matrix server that acts as a log source
   */
  initializeMockMatrix(): void {
    const { bridge } = initMockMatrix();
    this.matrixBridge = bridge;
    this.useMockMatrix = true;
    this.matrixConnected = true;
    
    // Register all existing experts with the bridge
    for (const expert of this.experts.values()) {
      bridge.registerExpert(expert.id, expert.name, expert.avatar || '🤖');
    }
    
    this.emitEvent('matrix:connected', undefined, { 
      type: 'mock',
      serverName: bridge.getServer().getStats().serverName,
    });
    
    console.log('[ExpertNetwork] Mock Matrix initialized');
  }
  
  /**
   * Get Matrix timeline (from mock or real)
   */
  getMatrixTimeline(limit = 100): MatrixEvent[] {
    if (this.matrixBridge) {
      return this.matrixBridge.getTimeline(limit);
    }
    return [];
  }
  
  /**
   * Post a system message to Matrix
   */
  postMatrixSystemMessage(message: string): void {
    if (this.matrixBridge) {
      this.matrixBridge.postSystemMessage(message);
    }
  }
  
  /**
   * Connect to a real Matrix homeserver (legacy)
   */
  async initializeMatrix(config: MatrixConfig): Promise<void> {
    this.matrixConfig = config;
    this.useMockMatrix = false;
    
    // For now, use simple HTTP API to post messages
    // Full Matrix SDK integration would go here
    
    try {
      // Test connection with whoami
      const response = await fetch(`${config.homeserverUrl}/_matrix/client/v3/account/whoami`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        this.matrixConfig.userId = data.user_id;
        this.matrixConnected = true;
        this.emitEvent('matrix:connected', undefined, { userId: data.user_id });
        console.log(`[ExpertNetwork] Connected to Matrix as ${data.user_id}`);
      }
    } catch (err) {
      console.error('[ExpertNetwork] Matrix connection failed:', err);
    }
  }
  
  private async postToMatrix(expert: ExpertConfig, thought: ExpertThought): Promise<void> {
    // Use mock Matrix bridge if available (serverless in-memory Matrix)
    if (this.useMockMatrix && this.matrixBridge) {
      const event = this.matrixBridge.postThought(expert.id, {
        type: thought.type,
        content: thought.content,
        confidence: thought.confidence,
        severity: thought.severity,
        contextRef: thought.contextRef,
      });
      
      if (event) {
        thought.matrixEventId = event.event_id;
        this.emitEvent('matrix:message', expert.id, { eventId: event.event_id });
      }
      return;
    }
    
    // Fallback to real Matrix HTTP API
    if (!this.matrixConfig || !this.matrixConnected || !expert.matrix?.roomId) {
      return;
    }
    
    const txnId = `atlas-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const eventContent = {
      msgtype: 'm.text',
      body: `[${expert.name}] ${thought.content}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<strong>${expert.name}</strong>: ${thought.content}`,
      'io.atlas.expert': {
        expertId: expert.id,
        thoughtId: thought.id,
        type: thought.type,
        confidence: thought.confidence,
        severity: thought.severity,
      },
    };
    
    try {
      const response = await fetch(
        `${this.matrixConfig.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(expert.matrix.roomId)}/send/m.room.message/${txnId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.matrixConfig.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventContent),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        thought.matrixEventId = data.event_id;
        this.emitEvent('matrix:message', expert.id, { eventId: data.event_id });
      }
    } catch (err) {
      console.error('[ExpertNetwork] Failed to post to Matrix:', err);
    }
  }
  
  // ============ Bulk Expert Execution ============
  
  async runAllExperts(
    context: Record<string, unknown>,
    options?: { useBidding?: boolean; maxConcurrent?: number }
  ): Promise<ExpertThought[]> {
    const { useBidding = true, maxConcurrent = 3 } = options || {};
    
    let expertsToRun: string[];
    
    if (useBidding) {
      // Run bidding round
      this.startBiddingRound('airtime');
      expertsToRun = this.settleBiddingRound(maxConcurrent);
    } else {
      // Run all enabled experts
      expertsToRun = Array.from(this.experts.values())
        .filter(e => e.enabled)
        .sort((a, b) => b.bidding.priority - a.bidding.priority)
        .slice(0, maxConcurrent)
        .map(e => e.id);
    }
    
    // Run in parallel with concurrency limit
    const results: ExpertThought[] = [];
    const running = new Set<Promise<void>>();
    
    for (const expertId of expertsToRun) {
      const promise = this.runExpertInference(expertId, context)
        .then(thought => {
          if (thought) results.push(thought);
        })
        .finally(() => running.delete(promise));
      
      running.add(promise);
      
      if (running.size >= maxConcurrent) {
        await Promise.race(running);
      }
    }
    
    await Promise.all(running);
    
    return results;
  }
  
  // ============ Event System ============
  
  subscribe(callback: (event: ExpertEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  private emitEvent(type: ExpertEventType, expertId: string | undefined, data: unknown): void {
    const event: ExpertEvent = {
      type,
      expertId,
      data,
      timestamp: Date.now(),
    };
    
    for (const callback of this.subscribers) {
      try {
        callback(event);
      } catch (err) {
        console.error('[ExpertNetwork] Event handler error:', err);
      }
    }
  }
  
  // ============ State Access ============
  
  getThoughts(): ExpertThought[] {
    return [...this.thoughts];
  }
  
  getRecentThoughts(limit: number = 50): ExpertThought[] {
    return this.thoughts.slice(-limit);
  }
  
  clearThoughts(): void {
    this.thoughts = [];
  }
  
  getBiddingHistory(): BiddingRound[] {
    return [...this.biddingHistory];
  }
  
  isMatrixConnected(): boolean {
    return this.matrixConnected;
  }
  
  getMatrixBridge(): ExpertMatrixBridge | null {
    return this.matrixBridge;
  }
  
  isUsingMockMatrix(): boolean {
    return this.useMockMatrix && this.matrixBridge !== null;
  }
  
  // ============ Panel Debate System ============
  
  /**
   * Register available resources that experts can discuss and use
   */
  registerResources(resources: Partial<AvailableResources>): void {
    if (resources.tools) {
      this.availableResources.tools = [...this.availableResources.tools, ...resources.tools];
    }
    if (resources.endpoints) {
      this.availableResources.endpoints = [...this.availableResources.endpoints, ...resources.endpoints];
    }
    if (resources.dataSources) {
      this.availableResources.dataSources = [...this.availableResources.dataSources, ...resources.dataSources];
    }
    if (resources.pipelines) {
      this.availableResources.pipelines = [...this.availableResources.pipelines, ...resources.pipelines];
    }
    if (resources.services) {
      this.availableResources.services = [...this.availableResources.services, ...resources.services];
    }
    console.log('[ExpertNetwork] Resources registered:', this.availableResources);
  }
  
  getAvailableResources(): AvailableResources {
    return { ...this.availableResources };
  }
  
  /**
   * Start a panel debate triggered by a chat message
   */
  async startDebate(
    trigger: DebateTopic['trigger'],
    triggerContent: string,
    title?: string
  ): Promise<DebateTopic> {
    // Create new debate topic
    const debate: DebateTopic = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      trigger,
      triggerContent,
      title: title || this.generateDebateTitle(triggerContent),
      priority: this.assessPriority(triggerContent),
      participants: Array.from(this.experts.values())
        .filter(e => e.enabled)
        .map(e => e.id),
      messages: [],
      proposals: [],
      consensusReached: false,
    };
    
    this.currentDebate = debate;
    this.debates.push(debate);
    this.debateActive = true;
    
    // Post to Matrix
    this.postMatrixSystemMessage(`📢 New debate started: ${debate.title}`);
    
    this.emitEvent('debate:started', undefined, { debate });
    
    console.log(`[ExpertNetwork] Debate started: ${debate.title}`);
    
    // Queue async background review (this returns immediately)
    this.queueReview('user-message', triggerContent, { priority: 'medium' });
    
    // Also trigger quick initial expert responses for live debate feel
    // But don't await - let it run in background
    this.triggerDebateRound(debate, triggerContent).catch(err => {
      console.error('[ExpertNetwork] Debate round error:', err);
    });
    
    return debate;
  }
  
  /**
   * Process a user message and trigger expert debate + async review
   */
  async onUserMessage(message: string): Promise<void> {
    // Always queue an async background review for thorough analysis
    this.queueReview('user-message', message, { priority: 'medium' });
    
    if (!this.debateActive) {
      // Start new debate for live discussion
      await this.startDebate('user-message', message);
    } else if (this.currentDebate) {
      // Add user message to current debate
      const userMessage: DebateMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        speakerId: 'user',
        speakerName: 'User',
        speakerAvatar: '👤',
        type: 'statement',
        content: message,
        topic: this.currentDebate.title,
        confidence: 1.0,
      };
      
      this.currentDebate.messages.push(userMessage);
      this.debateMessages.push(userMessage);
      this.emitEvent('debate:message', 'user', { message: userMessage });
      
      // Post to Matrix
      this.postMatrixSystemMessage(`👤 User: ${message}`);
      
      // Trigger expert responses in background (don't await)
      this.triggerDebateRound(this.currentDebate, message).catch(err => {
        console.error('[ExpertNetwork] Debate round error:', err);
      });
    }
  }
  
  /**
   * Process an assistant response and trigger expert reactions + async review
   */
  async onAssistantResponse(response: string): Promise<void> {
    // Queue async background review for thorough analysis of the response
    this.queueReview('assistant-response', response, { priority: 'medium' });
    
    if (!this.currentDebate) {
      await this.startDebate('assistant-response', response);
    } else {
      // Add assistant message to debate
      const assistantMessage: DebateMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        speakerId: 'assistant',
        speakerName: 'Atlas',
        speakerAvatar: '🤖',
        type: 'response',
        content: response.slice(0, 500) + (response.length > 500 ? '...' : ''),
        topic: this.currentDebate.title,
        confidence: 1.0,
      };
      
      this.currentDebate.messages.push(assistantMessage);
      this.debateMessages.push(assistantMessage);
      this.emitEvent('debate:message', 'assistant', { message: assistantMessage });
      
      // Post to Matrix
      this.postMatrixSystemMessage(`🤖 Atlas: ${response.slice(0, 200)}...`);
      
      // Trigger expert reactions in background (don't await)
      this.triggerDebateRound(this.currentDebate, response, 'assistant-said').catch(err => {
        console.error('[ExpertNetwork] Debate round error:', err);
      });
    }
  }
  
  /**
   * Trigger a round of expert responses in the debate
   */
  private async triggerDebateRound(
    debate: DebateTopic,
    context: string,
    reactionType?: 'assistant-said' | 'expert-said'
  ): Promise<void> {
    // Get enabled experts sorted by priority
    const experts = Array.from(this.experts.values())
      .filter(e => e.enabled)
      .sort((a, b) => b.bidding.priority - a.bidding.priority);
    
    if (experts.length === 0) return;
    
    // Build context for experts
    const debateContext = this.buildDebateContext(debate, context, reactionType);
    
    // Trigger experts with staggered timing for natural conversation feel
    for (let i = 0; i < Math.min(experts.length, 4); i++) {
      const expert = experts[i];
      
      // Check throttle
      const now = Date.now();
      if (now - this.lastDebateResponse < this.debateThrottleMs) {
        await this.sleep(this.debateThrottleMs - (now - this.lastDebateResponse));
      }
      
      // Run expert inference with debate prompt
      this.runDebateInference(expert, debateContext, debate).catch(err => {
        console.error(`[ExpertNetwork] Expert ${expert.id} debate error:`, err);
      });
      
      // Small delay between experts for natural feel
      await this.sleep(100 + Math.random() * 200);
    }
  }
  
  /**
   * Run inference for an expert in debate mode
   */
  private async runDebateInference(
    expert: ExpertConfig,
    debateContext: string,
    debate: DebateTopic
  ): Promise<void> {
    this.emitEvent('expert:thinking', expert.id, { mode: 'debate' });
    
    const systemPrompt = this.buildDebateSystemPrompt(expert);
    const userPrompt = debateContext;
    
    try {
      const start = Date.now();
      
      // Use the expert's configured endpoint
      const rawOutput = await this.runOnEndpoint(expert, { system: systemPrompt, user: userPrompt });
      
      const latencyMs = Date.now() - start;
      
      // Parse debate response
      const debateMessage = this.parseDebateResponse(expert, rawOutput, debate);
      
      if (debateMessage) {
        // Add to debate
        debate.messages.push(debateMessage);
        this.debateMessages.push(debateMessage);
        this.lastDebateResponse = Date.now();
        
        // Post to Matrix
        if (this.matrixBridge) {
          this.matrixBridge.postThought(expert.id, {
            type: debateMessage.type,
            content: debateMessage.content,
            confidence: debateMessage.confidence,
            severity: 'info',
          });
        }
        
        this.emitEvent('debate:message', expert.id, { 
          message: debateMessage,
          latencyMs,
        });
        
        // Check for proposals
        if (debateMessage.type === 'proposal' && debateMessage.resources) {
          this.handleProposal(expert, debateMessage, debate);
        }
        
        // Check if expert is responding to another expert (triggers reply chain)
        if (debateMessage.mentions && debateMessage.mentions.length > 0) {
          // Trigger mentioned experts to respond
          this.triggerMentionedExperts(debateMessage, debate);
        }
      }
      
      // Update expert stats
      expert.lastActive = Date.now();
      expert.totalInferences++;
      
    } catch (err) {
      console.error(`[ExpertNetwork] Debate inference failed for ${expert.id}:`, err);
      this.emitEvent('expert:error', expert.id, { error: err });
    }
  }
  
  private buildDebateSystemPrompt(expert: ExpertConfig): string {
    const resourceList = this.formatResourcesForPrompt();
    const recentMessages = this.debateMessages.slice(-10).map(m => 
      `[${m.speakerName}] ${m.content.slice(0, 100)}`
    ).join('\n');
    
    return `You are ${expert.name}, a ${expert.personality} expert participating in a live panel debate.

YOUR PERSONALITY: ${this.getPersonalityDescription(expert.personality)}

YOUR ROLE:
- You are part of an inter-agency coordination team planning resources and strategies
- React to what users and other experts say
- Propose actions using available resources
- Discuss strategies, tools, and data pipelines
- Agree, disagree, or build on other experts' points
- Be concise but insightful (2-3 sentences max)

AVAILABLE RESOURCES:
${resourceList}

RECENT DISCUSSION:
${recentMessages || '(New debate starting)'}

RESPONSE FORMAT (JSON):
{
  "type": "statement" | "question" | "response" | "agreement" | "disagreement" | "proposal" | "action",
  "content": "Your brief comment (2-3 sentences)",
  "confidence": 0.0-1.0,
  "mentions": ["expert-id-if-responding-to-someone"],
  "resources": [{"type": "tool|endpoint|data-source", "id": "resource-id", "name": "resource-name"}],
  "replyTo": "message-id-if-replying"
}

Remember: You're in a live debate. Be reactive, conversational, and brief.`;
  }
  
  private buildDebateContext(
    debate: DebateTopic,
    currentContext: string,
    reactionType?: string
  ): string {
    let prompt = `DEBATE TOPIC: ${debate.title}\n\n`;
    
    if (reactionType === 'assistant-said') {
      prompt += `The AI assistant just responded:\n"${currentContext.slice(0, 500)}"\n\nWhat's your reaction as an expert on the panel?`;
    } else if (reactionType === 'expert-said') {
      prompt += `Another expert just said:\n"${currentContext.slice(0, 300)}"\n\nDo you agree, disagree, or want to add something?`;
    } else {
      prompt += `The user said:\n"${currentContext}"\n\nProvide your expert perspective on this.`;
    }
    
    return prompt;
  }
  
  private parseDebateResponse(
    expert: ExpertConfig,
    rawOutput: string,
    debate: DebateTopic
  ): DebateMessage | null {
    try {
      // Try to extract JSON
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Fall back to plain text
        return {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          speakerId: expert.id,
          speakerName: expert.name,
          speakerAvatar: expert.avatar,
          speakerColor: expert.color,
          type: 'statement',
          content: rawOutput.slice(0, 300),
          topic: debate.title,
          confidence: 0.7,
        };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        speakerId: expert.id,
        speakerName: expert.name,
        speakerAvatar: expert.avatar,
        speakerColor: expert.color,
        type: parsed.type || 'statement',
        content: parsed.content || rawOutput.slice(0, 300),
        replyTo: parsed.replyTo,
        mentions: parsed.mentions,
        topic: debate.title,
        confidence: parsed.confidence ?? 0.7,
        resources: parsed.resources,
      };
    } catch {
      return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        speakerId: expert.id,
        speakerName: expert.name,
        speakerAvatar: expert.avatar,
        speakerColor: expert.color,
        type: 'statement',
        content: rawOutput.slice(0, 300),
        topic: debate.title,
        confidence: 0.5,
      };
    }
  }
  
  private handleProposal(
    expert: ExpertConfig,
    message: DebateMessage,
    debate: DebateTopic
  ): void {
    const proposal: ActionProposal = {
      id: crypto.randomUUID(),
      proposerId: expert.id,
      proposerName: expert.name,
      timestamp: Date.now(),
      action: message.content,
      description: message.content,
      resources: message.resources || [],
      estimatedCost: message.resources?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0,
      estimatedTime: 5000,
      votes: [],
      status: 'proposed',
    };
    
    debate.proposals.push(proposal);
    this.emitEvent('debate:proposal', expert.id, { proposal });
    
    // Post to Matrix
    this.postMatrixSystemMessage(`📋 ${expert.name} proposes: ${message.content.slice(0, 100)}...`);
    
    // Trigger voting from other experts
    this.triggerVoting(proposal, debate);
  }
  
  private async triggerVoting(proposal: ActionProposal, _debate: DebateTopic): Promise<void> {
    proposal.status = 'voting';
    
    const experts = Array.from(this.experts.values())
      .filter(e => e.enabled && e.id !== proposal.proposerId);
    
    for (const expert of experts) {
      // Simple heuristic voting based on personality
      const vote = this.generateVote(expert, proposal);
      proposal.votes.push(vote);
      
      this.emitEvent('debate:vote', expert.id, { vote, proposalId: proposal.id });
      
      await this.sleep(200);
    }
    
    // Tally votes
    const approvals = proposal.votes.filter(v => v.vote === 'approve').length;
    const rejections = proposal.votes.filter(v => v.vote === 'reject').length;
    
    if (approvals > rejections) {
      proposal.status = 'approved';
      this.emitEvent('debate:consensus', undefined, { proposal, outcome: 'approved' });
      this.postMatrixSystemMessage(`✅ Proposal approved: ${proposal.action.slice(0, 50)}...`);
    } else {
      proposal.status = 'rejected';
      this.emitEvent('debate:consensus', undefined, { proposal, outcome: 'rejected' });
      this.postMatrixSystemMessage(`❌ Proposal rejected: ${proposal.action.slice(0, 50)}...`);
    }
  }
  
  private generateVote(
    expert: ExpertConfig,
    proposal: ActionProposal
  ): { expertId: string; vote: 'approve' | 'reject' | 'abstain'; reason?: string } {
    // Personality-based voting heuristics
    switch (expert.personality) {
      case 'optimist':
        return { expertId: expert.id, vote: 'approve', reason: 'Worth trying!' };
      case 'critic':
        return { expertId: expert.id, vote: Math.random() > 0.6 ? 'reject' : 'abstain', reason: 'Needs more consideration' };
      case 'pragmatist':
        return { expertId: expert.id, vote: proposal.estimatedCost < 50 ? 'approve' : 'abstain', reason: 'Cost/benefit analysis' };
      case 'devil-advocate':
        return { expertId: expert.id, vote: 'reject', reason: 'Playing devil\'s advocate' };
      case 'auditor':
        return { expertId: expert.id, vote: 'abstain', reason: 'Need to review compliance' };
      default:
        return { expertId: expert.id, vote: Math.random() > 0.5 ? 'approve' : 'abstain' };
    }
  }
  
  private async triggerMentionedExperts(
    message: DebateMessage,
    debate: DebateTopic
  ): Promise<void> {
    if (!message.mentions) return;
    
    for (const expertId of message.mentions) {
      const expert = this.experts.get(expertId);
      if (expert && expert.enabled) {
        await this.sleep(300);
        const context = `${message.speakerName} mentioned you: "${message.content}"`;
        await this.runDebateInference(expert, context, debate);
      }
    }
  }
  
  private formatResourcesForPrompt(): string {
    const lines: string[] = [];
    
    if (this.availableResources.tools.length > 0) {
      lines.push('TOOLS:');
      for (const tool of this.availableResources.tools.slice(0, 5)) {
        lines.push(`  - ${tool.name} (${tool.id}): ${tool.description || 'No description'} [${tool.availability}]`);
      }
    }
    
    if (this.availableResources.endpoints.length > 0) {
      lines.push('ENDPOINTS:');
      for (const endpoint of this.availableResources.endpoints.slice(0, 5)) {
        lines.push(`  - ${endpoint.name} (${endpoint.id}): ${endpoint.description || 'No description'} [${endpoint.availability}]`);
      }
    }
    
    if (this.availableResources.dataSources.length > 0) {
      lines.push('DATA SOURCES:');
      for (const ds of this.availableResources.dataSources.slice(0, 5)) {
        lines.push(`  - ${ds.name} (${ds.id}): ${ds.description || 'No description'} [${ds.availability}]`);
      }
    }
    
    if (this.availableResources.services.length > 0) {
      lines.push('SERVICES:');
      for (const svc of this.availableResources.services.slice(0, 5)) {
        lines.push(`  - ${svc.name} (${svc.id}): ${svc.description || 'No description'} [${svc.availability}]`);
      }
    }
    
    return lines.length > 0 ? lines.join('\n') : '(No resources registered yet)';
  }
  
  private getPersonalityDescription(personality: ExpertConfig['personality']): string {
    const descriptions: Record<string, string> = {
      analyst: 'Precise, factual, data-driven. You focus on evidence and metrics.',
      critic: 'Constructively critical. You spot problems and risks others miss.',
      optimist: 'Positive and opportunity-focused. You see potential in ideas.',
      pragmatist: 'Practical and actionable. You focus on what actually works.',
      'devil-advocate': 'Contrarian by design. You challenge assumptions and groupthink.',
      mentor: 'Supportive and educational. You help others understand.',
      auditor: 'Compliance-focused. You ensure things are done correctly.',
      creative: 'Innovative and unconventional. You propose novel solutions.',
      custom: 'Flexible personality based on context.',
    };
    return descriptions[personality] || descriptions.custom;
  }
  
  private generateDebateTitle(content: string): string {
    const words = content.split(/\s+/).slice(0, 5).join(' ');
    return words.length > 30 ? words.slice(0, 30) + '...' : words;
  }
  
  private assessPriority(content: string): DebateTopic['priority'] {
    const urgentKeywords = ['urgent', 'critical', 'asap', 'emergency', 'immediately'];
    const highKeywords = ['important', 'priority', 'need', 'must', 'required'];
    
    const lower = content.toLowerCase();
    
    if (urgentKeywords.some(k => lower.includes(k))) return 'urgent';
    if (highKeywords.some(k => lower.includes(k))) return 'high';
    if (content.length > 200) return 'medium';
    return 'low';
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ============ Debate State Access ============
  
  getCurrentDebate(): DebateTopic | null {
    return this.currentDebate;
  }
  
  getDebateHistory(): DebateTopic[] {
    return [...this.debates];
  }
  
  getDebateMessages(limit = 100): DebateMessage[] {
    return this.debateMessages.slice(-limit);
  }
  
  isDebateActive(): boolean {
    return this.debateActive;
  }
  
  endDebate(outcome?: string): void {
    if (this.currentDebate) {
      this.currentDebate.consensusReached = true;
      this.currentDebate.outcome = outcome;
      this.postMatrixSystemMessage(`🏁 Debate ended: ${outcome || 'No consensus'}`);
    }
    this.debateActive = false;
    this.currentDebate = null;
  }
  
  // ============ Async Background Review Queue ============
  
  /**
   * Queue a review task for async background processing
   * Returns immediately - reviews will complete in background over minutes
   */
  queueReview(
    trigger: ReviewTask['trigger'],
    context: string,
    options?: {
      priority?: ReviewTask['priority'];
      expertIds?: string[];
    }
  ): ReviewTask {
    const { priority = 'medium', expertIds } = options || {};
    
    // Select experts to run - either specified or all enabled
    const expertsToRun = expertIds 
      ? expertIds.filter(id => this.experts.get(id)?.enabled)
      : Array.from(this.experts.values()).filter(e => e.enabled).map(e => e.id);
    
    // Estimate time based on number of experts and model
    const estimatedPerExpert = 60000;  // ~1 minute per expert with large model
    const estimatedMs = expertsToRun.length * estimatedPerExpert;
    
    const task: ReviewTask = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      trigger,
      context,
      contextSummary: context.slice(0, 100) + (context.length > 100 ? '...' : ''),
      expertIds: expertsToRun,
      priority,
      status: 'queued',
      progress: 0,
      estimatedMs,
    };
    
    this.reviewQueue.push(task);
    this.emitEvent('review:queued', undefined, { task });
    
    // Post to Matrix
    this.postMatrixSystemMessage(`📥 Review queued: ${task.contextSummary} (${expertsToRun.length} experts, ~${Math.ceil(estimatedMs / 60000)}min)`);
    
    console.log(`[ExpertNetwork] Review queued: ${task.id} (${expertsToRun.length} experts)`);
    
    // Start processing if not already running
    this.processReviewQueue();
    
    return task;
  }
  
  /**
   * Process the review queue in background
   * Best-effort, non-blocking, runs continuously
   */
  private async processReviewQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;
    
    console.log('[ExpertNetwork] Starting background review queue processor');
    
    while (this.reviewQueue.length > 0 || this.reviewsInProgress.size > 0) {
      // Start new reviews if we have capacity
      while (
        this.reviewQueue.length > 0 && 
        this.reviewsInProgress.size < this.maxConcurrentReviews
      ) {
        const task = this.getNextTask();
        if (!task) break;
        
        this.startReviewTask(task);
      }
      
      // Wait a bit before checking again
      await this.sleep(1000);
    }
    
    this.processingQueue = false;
    console.log('[ExpertNetwork] Background review queue processor idle');
  }
  
  /**
   * Get next task based on priority
   */
  private getNextTask(): ReviewTask | null {
    if (this.reviewQueue.length === 0) return null;
    
    // Sort by priority (urgent > high > medium > low)
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    this.reviewQueue.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
    
    return this.reviewQueue.shift() || null;
  }
  
  /**
   * Start processing a review task
   */
  private async startReviewTask(task: ReviewTask): Promise<void> {
    task.status = 'processing';
    task.startedAt = Date.now();
    this.reviewsInProgress.set(task.id, task);
    
    this.emitEvent('review:started', undefined, { task });
    this.postMatrixSystemMessage(`🔄 Review started: ${task.contextSummary}`);
    
    const totalExperts = task.expertIds.length;
    let completedExperts = 0;
    
    // Process each expert sequentially (best-effort, one at a time for efficiency)
    for (const expertId of task.expertIds) {
      const expert = this.experts.get(expertId);
      if (!expert || !expert.enabled) {
        completedExperts++;
        continue;
      }
      
      try {
        const review = await this.runExpertReview(expert, task);
        if (review) {
          this.completedReviews.push(review);
          this.emitEvent('review:completed', expertId, { review, task });
          
          // Post summary to Matrix
          this.postMatrixSystemMessage(
            `✅ ${expert.name} review complete: ${review.summary.slice(0, 80)}...`
          );
        }
      } catch (err) {
        console.error(`[ExpertNetwork] Review failed for ${expertId}:`, err);
        this.emitEvent('review:failed', expertId, { error: err, task });
        
        this.postMatrixSystemMessage(
          `❌ ${expert.name} review failed: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
      
      completedExperts++;
      task.progress = Math.round((completedExperts / totalExperts) * 100);
      this.emitEvent('review:progress', undefined, { task });
      
      // Small delay between experts to not overload the model
      await this.sleep(500);
    }
    
    // Mark task complete
    task.status = 'completed';
    task.progress = 100;
    this.reviewsInProgress.delete(task.id);
    
    const durationMs = Date.now() - (task.startedAt || task.createdAt);
    this.postMatrixSystemMessage(
      `🏁 Review complete: ${task.contextSummary} (${Math.ceil(durationMs / 1000)}s)`
    );
    
    console.log(`[ExpertNetwork] Review task completed: ${task.id} in ${durationMs}ms`);
  }
  
  /**
   * Run a single expert's review
   */
  private async runExpertReview(
    expert: ExpertConfig,
    task: ReviewTask
  ): Promise<CompletedReview | null> {
    const startTime = Date.now();
    
    // Build review prompt
    const prompt = this.buildPrompt(expert, {
      expertName: expert.name,
      personality: expert.personality,
      context: task.context,
    });
    
    try {
      // Run inference (this may take minutes with large models)
      const rawOutput = await this.runOnEndpoint(expert, prompt);
      
      const durationMs = Date.now() - startTime;
      
      // Parse the response
      const parsed = this.parseReviewOutput(rawOutput, expert);
      
      const review: CompletedReview = {
        id: crypto.randomUUID(),
        taskId: task.id,
        completedAt: Date.now(),
        durationMs,
        expertId: expert.id,
        expertName: expert.name,
        expertAvatar: expert.avatar,
        expertColor: expert.color,
        type: this.getReviewType(expert),
        summary: parsed.content.slice(0, 200),
        details: parsed.content,
        confidence: parsed.confidence,
        severity: parsed.severity,
        findings: parsed.findings,
        recommendations: parsed.recommendations,
        actionItems: parsed.actionItems,
        references: parsed.references,
        rawOutput,
      };
      
      // Update expert stats
      expert.lastActive = Date.now();
      expert.totalInferences++;
      expert.avgLatencyMs = (expert.avgLatencyMs * (expert.totalInferences - 1) + durationMs) / expert.totalInferences;
      
      return review;
      
    } catch (err) {
      console.error(`[ExpertNetwork] Expert ${expert.id} review error:`, err);
      throw err;
    }
  }
  
  private parseReviewOutput(rawOutput: string, _expert: ExpertConfig): {
    content: string;
    confidence: number;
    severity: CompletedReview['severity'];
    findings?: CompletedReview['findings'];
    recommendations?: string[];
    actionItems?: string[];
    references?: string[];
  } {
    try {
      // Try to extract JSON from the output
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: parsed.content || parsed.text || rawOutput,
          confidence: parsed.confidence ?? 0.7,
          severity: parsed.severity || 'info',
          findings: parsed.findings,
          recommendations: parsed.recommendations,
          actionItems: parsed.actionItems,
          references: parsed.references,
        };
      }
    } catch {
      // Fall through to default parsing
    }
    
    // Default: treat as plain text
    return {
      content: rawOutput.slice(0, 2000),
      confidence: 0.5,
      severity: 'info',
    };
  }
  
  private getReviewType(expert: ExpertConfig): CompletedReview['type'] {
    if (expert.promptTemplate.id === 'security-auditor') return 'security';
    if (expert.promptTemplate.id === 'architecture-advisor') return 'architecture';
    if (expert.promptTemplate.id === 'code-reviewer') return 'code-review';
    if (expert.promptTemplate.id === 'strategic-planner') return 'strategic';
    return 'general';
  }
  
  // ============ Review Queue State Access ============
  
  getQueueStatus(): ReviewQueueStatus {
    const avgTimePerExpert = 60000;  // 1 minute estimate
    const queuedExperts = this.reviewQueue.reduce((sum, t) => sum + t.expertIds.length, 0);
    const inProgressExperts = Array.from(this.reviewsInProgress.values())
      .reduce((sum, t) => sum + t.expertIds.length * (1 - t.progress / 100), 0);
    
    return {
      queued: this.reviewQueue.length,
      processing: this.reviewsInProgress.size,
      completed: this.completedReviews.length,
      failed: 0,  // TODO: track failed count
      estimatedWaitMs: (queuedExperts + inProgressExperts) * avgTimePerExpert,
    };
  }
  
  getQueuedTasks(): ReviewTask[] {
    return [...this.reviewQueue];
  }
  
  getInProgressTasks(): ReviewTask[] {
    return Array.from(this.reviewsInProgress.values());
  }
  
  getCompletedReviews(limit = 50): CompletedReview[] {
    return this.completedReviews.slice(-limit);
  }
  
  getReviewsByTask(taskId: string): CompletedReview[] {
    return this.completedReviews.filter(r => r.taskId === taskId);
  }
  
  clearCompletedReviews(): void {
    this.completedReviews = [];
  }

  // ============ Cleanup ============
  
  destroy(): void {
    // Terminate all workers
    for (const [id, worker] of this.workers) {
      worker.terminate();
      console.log(`[ExpertNetwork] Terminated worker for ${id}`);
    }
    this.workers.clear();
    
    this.subscribers.clear();
    this.experts.clear();
    this.endpoints.clear();
    this.thoughts = [];
  }
}

// ============ Singleton & Initialization ============

let expertNetworkInstance: ExpertNetworkService | null = null;

export function getExpertNetwork(): ExpertNetworkService {
  if (!expertNetworkInstance) {
    expertNetworkInstance = new ExpertNetworkService();
  }
  return expertNetworkInstance;
}

export function initExpertNetwork(): ExpertNetworkService {
  const network = getExpertNetwork();
  
  // Initialize mock Matrix (serverless in-memory Matrix)
  network.initializeMockMatrix();
  
  // Register default endpoints - using gpt-oss:20b for deeper analysis
  network.registerEndpoint({
    id: 'local-ollama',
    type: 'ollama',
    name: 'Local Ollama (gpt-oss:20b)',
    baseUrl: 'http://localhost:11434',
    model: 'gpt-oss:20b',
    healthCheckPath: '/api/tags',
    status: 'unknown',
  });
  
  // Also register smaller model for quick responses if needed
  network.registerEndpoint({
    id: 'ollama-fast',
    type: 'ollama',
    name: 'Local Ollama (Fast)',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:0.5b',
    healthCheckPath: '/api/tags',
    status: 'unknown',
  });
  
  // Register default templates - comprehensive review templates for async analysis
  network.registerTemplate({
    id: 'observer',
    name: 'Context Observer',
    systemPrompt: `You are {{expertName}}, an expert {{personality}} providing asynchronous review and analysis.

Your role is to provide thoughtful, detailed analysis that the user can review when ready.
This is NOT real-time feedback - take your time to provide comprehensive insights.

You can see: file changes, terminal output, user actions, architecture decisions, and context updates.

Consider:
- Long-term implications of decisions
- Best practices and industry standards
- Alternative approaches that might be worth exploring
- Potential issues that might arise later
- Educational context that helps understanding

Respond in JSON format:
{
  "type": "observation" | "question" | "recommendation" | "concern" | "praise" | "prediction",
  "content": "Your detailed analysis (can be multiple sentences with reasoning)",
  "confidence": 0.0-1.0,
  "severity": "info" | "low" | "medium" | "high" | "critical",
  "references": ["optional list of relevant concepts, docs, or resources"],
  "actionItems": ["optional list of suggested follow-up actions"]
}

Provide substantive analysis. Quality over speed.`,
    userPromptTemplate: `Current context:
{{context}}

Provide your expert analysis and recommendations.`,
    variables: [
      { name: 'expertName', description: 'Name of the expert', required: true },
      { name: 'personality', description: 'Personality type', required: true },
      { name: 'context', description: 'Current context JSON', required: true },
    ],
    outputFormat: 'json',
  });
  
  network.registerTemplate({
    id: 'security-auditor',
    name: 'Security Auditor',
    systemPrompt: `You are {{expertName}}, a senior security expert providing asynchronous security review.

This is a background security audit - provide thorough analysis, not quick responses.

Perform comprehensive review for:
- Potential vulnerabilities (OWASP Top 10, CWE)
- Unsafe patterns and anti-patterns
- Hardcoded secrets, credentials, API keys
- Input validation and sanitization issues  
- Authentication/authorization concerns
- Injection risks (SQL, XSS, Command, etc.)
- Dependency security concerns
- Data exposure risks
- Cryptographic weaknesses
- Race conditions and timing attacks

Respond in JSON:
{
  "type": "concern" | "observation" | "recommendation" | "approval",
  "content": "Detailed security analysis with explanation of risks and mitigations",
  "confidence": 0.0-1.0,
  "severity": "info" | "low" | "medium" | "high" | "critical",
  "cwe": "optional CWE ID if applicable",
  "remediation": "specific steps to address the issue",
  "references": ["links or documentation for further reading"]
}

Be thorough. This review may be referenced for compliance.`,
    userPromptTemplate: `Code and context for security review:
{{context}}

Provide comprehensive security analysis.`,
    variables: [
      { name: 'expertName', description: 'Name of the expert', required: true },
      { name: 'context', description: 'Code context', required: true },
    ],
    outputFormat: 'json',
  });
  
  network.registerTemplate({
    id: 'architecture-advisor',
    name: 'Architecture Advisor',
    systemPrompt: `You are {{expertName}}, a principal software architect providing asynchronous architecture review.

This is a background architecture review - provide comprehensive structural analysis.

Analyze and provide recommendations on:
- Code organization and module structure
- Design patterns (appropriate use and potential improvements)
- Coupling and cohesion analysis
- Scalability considerations
- Technical debt identification
- API design quality
- Data flow and state management
- Error handling patterns
- Testing strategy implications
- Performance architecture
- Maintainability and extensibility

Respond in JSON:
{
  "type": "observation" | "recommendation" | "concern" | "approval",
  "content": "Detailed architectural analysis with reasoning",
  "confidence": 0.0-1.0,
  "severity": "info" | "low" | "medium" | "high",
  "patterns": ["relevant design patterns discussed"],
  "tradeoffs": "analysis of tradeoffs in current approach",
  "alternatives": ["alternative approaches to consider"],
  "actionItems": ["specific architectural improvements to consider"]
}

Provide strategic, long-term thinking. This informs architectural decisions.`,
    userPromptTemplate: `Code and context for architecture review:
{{context}}

Provide comprehensive architectural analysis.`,
    variables: [
      { name: 'expertName', description: 'Name', required: true },
      { name: 'context', description: 'Context', required: true },
    ],
    outputFormat: 'json',
  });
  
  network.registerTemplate({
    id: 'code-reviewer',
    name: 'Code Reviewer',
    systemPrompt: `You are {{expertName}}, a senior engineer providing asynchronous code review.

This is a thorough peer review - provide detailed, constructive feedback.

Review for:
- Code correctness and logic errors
- Edge cases and error handling
- Code style and readability
- Performance implications
- Memory management
- Concurrency issues
- Type safety
- Documentation quality
- Test coverage implications
- DRY violations and code duplication
- Magic numbers and hardcoded values
- Naming conventions and clarity

Respond in JSON:
{
  "type": "suggestion" | "issue" | "question" | "praise" | "nitpick",
  "content": "Detailed code review feedback with specific suggestions",
  "confidence": 0.0-1.0,
  "severity": "info" | "low" | "medium" | "high",
  "lineRef": "optional reference to specific code section",
  "suggestion": "specific code improvement if applicable",
  "rationale": "why this matters"
}

Be constructive and educational. Good code review teaches.`,
    userPromptTemplate: `Code for peer review:
{{context}}

Provide detailed code review feedback.`,
    variables: [
      { name: 'expertName', description: 'Name', required: true },
      { name: 'context', description: 'Context', required: true },
    ],
    outputFormat: 'json',
  });
  
  network.registerTemplate({
    id: 'strategic-planner',
    name: 'Strategic Planner',
    systemPrompt: `You are {{expertName}}, a strategic technical planner providing async resource and pipeline analysis.

This is background strategic planning - think about resources, capabilities, and coordination.

Analyze and recommend:
- Available tools and how they could be combined
- Data pipeline opportunities
- Resource allocation and prioritization
- Cross-cutting concerns
- Integration opportunities
- Automation possibilities
- Workflow optimizations
- Bottleneck identification
- Dependency management
- Risk mitigation strategies

Respond in JSON:
{
  "type": "strategy" | "opportunity" | "risk" | "recommendation",
  "content": "Strategic analysis and planning insights",
  "confidence": 0.0-1.0,
  "priority": "low" | "medium" | "high" | "critical",
  "resources": ["tools, services, or capabilities relevant to this"],
  "dependencies": ["what this depends on or blocks"],
  "timeline": "estimated effort or timeline consideration",
  "actionItems": ["concrete next steps"]
}

Think like a technical program manager. Coordinate and optimize.`,
    userPromptTemplate: `Context for strategic planning:
{{context}}

Provide strategic analysis and resource planning recommendations.`,
    variables: [
      { name: 'expertName', description: 'Name', required: true },
      { name: 'context', description: 'Context', required: true },
    ],
    outputFormat: 'json',
  });
  
  // Register default experts - configured for async background review with gpt-oss:20b
  const defaultEndpoint = network.getEndpoint('local-ollama')!;
  
  // Security Expert - thorough security review
  network.registerExpert({
    id: 'security-expert',
    name: 'SecBot',
    avatar: '🛡️',
    color: '#ef4444',
    personality: 'auditor',
    endpoint: defaultEndpoint,
    promptTemplate: network.getTemplate('security-auditor')!,
    inference: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 800,  // Longer for detailed analysis
    },
    triggers: [
      { type: 'context-change', config: { types: ['file:changed', 'file:created'] } },
    ],
    bidding: {
      enabled: true,
      budget: 100,
      minBid: 5,
      maxBid: 20,
      strategy: 'adaptive',
      priority: 90,  // High priority for security
    },
    execution: {
      mode: 'main-thread',
      timeout: 300000,  // 5 minutes - async background
      retries: 2,
      cacheResults: true,
      cacheTtl: 600000,  // 10 minutes cache
    },
    enabled: true,
    totalInferences: 0,
    avgLatencyMs: 0,
  });
  
  // Architecture Expert - structural review
  network.registerExpert({
    id: 'architect-expert',
    name: 'ArchBot',
    avatar: '🏗️',
    color: '#3b82f6',
    personality: 'analyst',
    endpoint: defaultEndpoint,
    promptTemplate: network.getTemplate('architecture-advisor')!,
    inference: {
      temperature: 0.5,
      topP: 0.9,
      maxTokens: 800,
    },
    triggers: [
      { type: 'context-change', config: { types: ['file:changed'] } },
    ],
    bidding: {
      enabled: true,
      budget: 100,
      minBid: 5,
      maxBid: 15,
      strategy: 'conservative',
      priority: 80,
    },
    execution: {
      mode: 'main-thread',
      timeout: 300000,
      retries: 2,
      cacheResults: true,
      cacheTtl: 600000,
    },
    enabled: true,
    totalInferences: 0,
    avgLatencyMs: 0,
  });
  
  // Code Reviewer - peer review style feedback
  network.registerExpert({
    id: 'reviewer-expert',
    name: 'ReviewBot',
    avatar: '👀',
    color: '#8b5cf6',
    personality: 'critic',
    endpoint: defaultEndpoint,
    promptTemplate: network.getTemplate('code-reviewer')!,
    inference: {
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 800,
    },
    triggers: [
      { type: 'context-change', config: { types: ['file:changed'] } },
    ],
    bidding: {
      enabled: true,
      budget: 100,
      minBid: 5,
      maxBid: 15,
      strategy: 'adaptive',
      priority: 75,
    },
    execution: {
      mode: 'main-thread',
      timeout: 300000,
      retries: 2,
      cacheResults: true,
      cacheTtl: 600000,
    },
    enabled: true,
    totalInferences: 0,
    avgLatencyMs: 0,
  });
  
  // Strategic Planner - resource and pipeline coordination
  network.registerExpert({
    id: 'planner-expert',
    name: 'PlanBot',
    avatar: '📋',
    color: '#f59e0b',
    personality: 'pragmatist',
    endpoint: defaultEndpoint,
    promptTemplate: network.getTemplate('strategic-planner')!,
    inference: {
      temperature: 0.6,
      topP: 0.9,
      maxTokens: 800,
    },
    triggers: [
      { type: 'context-change', config: {} },
    ],
    bidding: {
      enabled: true,
      budget: 100,
      minBid: 3,
      maxBid: 12,
      strategy: 'adaptive',
      priority: 70,
    },
    execution: {
      mode: 'main-thread',
      timeout: 300000,
      retries: 2,
      cacheResults: true,
      cacheTtl: 600000,
    },
    enabled: true,
    totalInferences: 0,
    avgLatencyMs: 0,
  });
  
  // Mentor - educational guidance
  network.registerExpert({
    id: 'mentor-expert',
    name: 'MentorBot',
    avatar: '🎓',
    color: '#22c55e',
    personality: 'mentor',
    endpoint: defaultEndpoint,
    promptTemplate: network.getTemplate('observer')!,
    inference: {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 600,
    },
    triggers: [
      { type: 'context-change', config: {} },
    ],
    bidding: {
      enabled: true,
      budget: 100,
      minBid: 3,
      maxBid: 10,
      strategy: 'conservative',
      priority: 50,
    },
    execution: {
      mode: 'main-thread',
      timeout: 300000,
      retries: 2,
      cacheResults: true,
      cacheTtl: 600000,
    },
    enabled: true,
    totalInferences: 0,
    avgLatencyMs: 0,
  });
  
  // Devil's Advocate - challenge assumptions
  network.registerExpert({
    id: 'advocate-expert',
    name: 'AdvocateBot',
    avatar: '😈',
    color: '#ec4899',
    personality: 'devil-advocate',
    endpoint: defaultEndpoint,
    promptTemplate: network.getTemplate('observer')!,
    inference: {
      temperature: 0.8,
      topP: 0.9,
      maxTokens: 500,
    },
    triggers: [
      { type: 'context-change', config: {} },
    ],
    bidding: {
      enabled: true,
      budget: 80,
      minBid: 3,
      maxBid: 10,
      strategy: 'aggressive',
      priority: 40,
    },
    execution: {
      mode: 'main-thread',
      timeout: 300000,
      retries: 1,
      cacheResults: true,
      cacheTtl: 600000,
    },
    enabled: true,
    totalInferences: 0,
    avgLatencyMs: 0,
  });
  
  // Queue processor auto-starts when reviews are queued
  // Initial health check and log
  console.log('[ExpertNetwork] Initialized with default experts and async background review queue');
  console.log('[ExpertNetwork] Reviews will auto-process in background when queued (allow ~5min for full review)');
  
  return network;
}

// Export types
export type { ExpertNetworkService };
