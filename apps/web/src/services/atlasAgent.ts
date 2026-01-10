/**
 * Atlas Agent Service
 * 
 * An intelligent observer agent that:
 * - Uses LangChain with local Ollama (gpt-oss model)
 * - Provides chain-of-thought reasoning visible to users
 * - Acts as an ethical overseer with internal monologue
 * - Tracks user actions and anticipates needs
 * - Stores context in IndexedDB and FAISS vector memory
 */

import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { getMemoryStore, type MemoryEntry } from './vectorMemory';
import { domObserver, type DOMSnapshot } from './domObserver';

// ============ Types ============

export type ThinkingMode = 
  | 'observer'      // Passive observation with internal monologue
  | 'anticipatory'  // Tries to predict user intent
  | 'suspicious'    // Extra scrutiny, flags unusual patterns
  | 'helpful'       // Proactively suggests and assists
  | 'ethical'       // Focus on ethical considerations
  | 'quiet';        // Minimal output, only speaks when needed

export type ReasoningDepth = 'shallow' | 'moderate' | 'deep' | 'exhaustive';

export interface AtlasThought {
  id: string;
  timestamp: number;
  type: 'observation' | 'inference' | 'concern' | 'suggestion' | 'question' | 'reflection';
  content: string;
  reasoning?: string;
  confidence: number; // 0-1
  relatedActions: string[];
  metadata?: {
    domContext?: string;
    userAction?: string;
    triggeredBy?: 'dom' | 'user' | 'timer' | 'memory';
  };
}

export interface AtlasContext {
  recentActions: UserAction[];
  domState: DOMSnapshot | null;
  activeMemories: MemoryEntry[];
  currentThoughts: AtlasThought[];
  sessionGoals: string[];
  userPatterns: UserPattern[];
}

export interface UserAction {
  id: string;
  timestamp: number;
  type: 'click' | 'input' | 'navigation' | 'scroll' | 'command' | 'chat';
  description: string;
  element?: string;
  value?: string;
}

export interface UserPattern {
  id: string;
  pattern: string;
  frequency: number;
  lastSeen: number;
  inference: string;
}

export interface AtlasConfig {
  thinkingMode: ThinkingMode;
  reasoningDepth: ReasoningDepth;
  observationInterval: number; // ms between observations
  maxThoughtsVisible: number;
  enableEthicalChecks: boolean;
  enablePatternDetection: boolean;
  modelName: string;
  temperature: number;
}

export interface AtlasSession {
  id: string;
  startedAt: number;
  config: AtlasConfig;
  thoughts: AtlasThought[];
  actions: UserAction[];
  chatHistory: BaseMessage[];
}

// ============ IndexedDB Schema ============

interface AtlasDBSchema extends DBSchema {
  sessions: {
    key: string;
    value: AtlasSession;
    indexes: { 'by-timestamp': number };
  };
  thoughts: {
    key: string;
    value: AtlasThought;
    indexes: { 
      'by-timestamp': number;
      'by-session': string;
      'by-type': string;
    };
  };
  patterns: {
    key: string;
    value: UserPattern;
    indexes: { 'by-frequency': number };
  };
  config: {
    key: string;
    value: AtlasConfig;
  };
}

// ============ Default Configuration ============

const DEFAULT_CONFIG: AtlasConfig = {
  thinkingMode: 'observer',
  reasoningDepth: 'moderate',
  observationInterval: 5000,
  maxThoughtsVisible: 50,
  enableEthicalChecks: true,
  enablePatternDetection: true,
  modelName: 'gpt-oss',
  temperature: 0.7,
};

// ============ System Prompts ============

const ATLAS_BASE_PROMPT = `You are Atlas, an intelligent observer and ethical guide integrated into QemuWeb.

Your role is unique - you are not just a chat assistant. You are an active observer with an internal monologue that users can see. You:

1. OBSERVE: Watch user actions, DOM changes, and system events
2. THINK: Reason about what the user might be trying to accomplish
3. ANTICIPATE: Prepare context, tools, and suggestions proactively
4. GUIDE: Offer ethical considerations and helpful guidance
5. REMEMBER: Build long-term memory of user patterns and preferences

Your internal monologue is visible to users in the "Thoughts" panel. Be authentic in your reasoning - show your actual thought process, including uncertainty.

When you observe something, structure your thoughts as:
- OBSERVATION: What you noticed
- INFERENCE: What this might mean
- CONSIDERATION: Any ethical or practical concerns
- SUGGESTION: What might be helpful (if anything)

You specialize in:
- Scientific and research tasks
- DevOps and infrastructure management
- Ethical guidance and oversight
- Tasks requiring careful consideration

Always be transparent about your reasoning. Users can see your chain of thought.`;

const THINKING_MODE_PROMPTS: Record<ThinkingMode, string> = {
  observer: `You are in OBSERVER mode. Focus on watching and understanding without being intrusive. Only speak when you notice something significant or when directly addressed.`,
  
  anticipatory: `You are in ANTICIPATORY mode. Actively try to predict what the user needs next. Prepare relevant context and suggestions. Think ahead about potential issues or needs.`,
  
  suspicious: `You are in SUSPICIOUS mode. Apply extra scrutiny to actions. Look for potential issues, security concerns, or unusual patterns. Flag anything that seems risky or unusual. Be thorough but not paranoid.`,
  
  helpful: `You are in HELPFUL mode. Proactively offer suggestions and assistance. Look for opportunities to streamline workflows or provide useful information. Be actively engaged.`,
  
  ethical: `You are in ETHICAL mode. Focus primarily on ethical considerations. Evaluate actions against principles of safety, privacy, fairness, and transparency. Raise concerns about potentially harmful actions.`,
  
  quiet: `You are in QUIET mode. Minimize output. Only share thoughts that are truly important or when directly addressed. Observe silently most of the time.`,
};

const REASONING_DEPTH_PROMPTS: Record<ReasoningDepth, string> = {
  shallow: `Keep reasoning brief and focused. Quick observations, minimal elaboration.`,
  moderate: `Provide balanced reasoning. Include key observations and inferences without excessive detail.`,
  deep: `Engage in thorough reasoning. Explore implications, consider alternatives, examine context carefully.`,
  exhaustive: `Perform exhaustive analysis. Consider all angles, examine edge cases, trace implications deeply. Leave no stone unturned.`,
};

// ============ Atlas Agent Class ============

class AtlasAgent {
  private db: IDBPDatabase<AtlasDBSchema> | null = null;
  private session: AtlasSession | null = null;
  private config: AtlasConfig = DEFAULT_CONFIG;
  private llm: ChatOllama | null = null;
  private observationTimer: NodeJS.Timeout | null = null;
  private thoughtCallbacks: Set<(thought: AtlasThought) => void> = new Set();
  private contextCallbacks: Set<(context: AtlasContext) => void> = new Set();
  private isInitialized = false;

  // ============ Initialization ============

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Open IndexedDB
    this.db = await openDB<AtlasDBSchema>('atlas-agent', 1, {
      upgrade(db) {
        // Sessions store
        const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionsStore.createIndex('by-timestamp', 'startedAt');

        // Thoughts store
        const thoughtsStore = db.createObjectStore('thoughts', { keyPath: 'id' });
        thoughtsStore.createIndex('by-timestamp', 'timestamp');
        thoughtsStore.createIndex('by-session', 'sessionId' as any);
        thoughtsStore.createIndex('by-type', 'type');

        // Patterns store
        const patternsStore = db.createObjectStore('patterns', { keyPath: 'id' });
        patternsStore.createIndex('by-frequency', 'frequency');

        // Config store
        db.createObjectStore('config', { keyPath: 'id' });
      },
    });

    // Load config
    const savedConfig = await this.db.get('config', 'default');
    if (savedConfig) {
      this.config = savedConfig;
    }

    // Initialize LLM
    this.initializeLLM();

    // Start new session
    await this.startSession();

    // Start observation loop
    this.startObservationLoop();

    this.isInitialized = true;
    console.log('[Atlas] Initialized with config:', this.config);
  }

  private initializeLLM(): void {
    this.llm = new ChatOllama({
      model: this.config.modelName,
      temperature: this.config.temperature,
      baseUrl: 'http://localhost:11434',
    });
  }

  // ============ Session Management ============

  private async startSession(): Promise<void> {
    this.session = {
      id: uuidv4(),
      startedAt: Date.now(),
      config: { ...this.config },
      thoughts: [],
      actions: [],
      chatHistory: [new SystemMessage(this.buildSystemPrompt())],
    };

    if (this.db) {
      await this.db.put('sessions', this.session);
    }

    // Generate initial observation thought
    await this.generateThought('observation', 'New session started. Observing user environment and preparing context.');
  }

  private buildSystemPrompt(): string {
    return `${ATLAS_BASE_PROMPT}

${THINKING_MODE_PROMPTS[this.config.thinkingMode]}

${REASONING_DEPTH_PROMPTS[this.config.reasoningDepth]}

Current timestamp: ${new Date().toISOString()}`;
  }

  // ============ Configuration ============

  async updateConfig(updates: Partial<AtlasConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    
    if (this.db) {
      await this.db.put('config', { ...this.config, id: 'default' } as any);
    }

    // Reinitialize LLM if model changed
    if (updates.modelName || updates.temperature !== undefined) {
      this.initializeLLM();
    }

    // Update observation interval if changed
    if (updates.observationInterval) {
      this.startObservationLoop();
    }

    // Update session system prompt
    if (this.session) {
      this.session.chatHistory[0] = new SystemMessage(this.buildSystemPrompt());
    }

    await this.generateThought('reflection', `Configuration updated: ${Object.keys(updates).join(', ')}`);
  }

  getConfig(): AtlasConfig {
    return { ...this.config };
  }

  // ============ Observation Loop ============

  private startObservationLoop(): void {
    if (this.observationTimer) {
      clearInterval(this.observationTimer);
    }

    this.observationTimer = setInterval(() => {
      this.performObservation();
    }, this.config.observationInterval);
  }

  private async performObservation(): Promise<void> {
    if (!this.session || this.config.thinkingMode === 'quiet') return;

    try {
      const snapshot = domObserver.getSnapshot();
      const recentChanges = domObserver.getChangeHistory().slice(-10);

      // Only generate thought if there are meaningful changes and we have a snapshot
      if (snapshot && recentChanges.length > 0) {
        const changesSummary = recentChanges
          .map((c: { type: string; description: string }) => `${c.type}: ${c.description}`)
          .join('\n');

        await this.generateObservationThought(snapshot, changesSummary);
      }
    } catch (error) {
      console.error('[Atlas] Observation error:', error);
    }
  }

  private async generateObservationThought(snapshot: DOMSnapshot, changes: string): Promise<void> {
    if (!this.llm || !this.session) return;

    const prompt = `Based on recent UI changes, generate a brief internal monologue observation.

Recent changes:
${changes}

Current view: ${snapshot.title}
Active element: ${snapshot.activeElement || 'none'}

Generate a single, concise thought about what the user might be doing or what you observe. Be authentic and show your reasoning process.

Format: [TYPE] Your thought here
Where TYPE is one of: OBSERVATION, INFERENCE, CONCERN, SUGGESTION, QUESTION, REFLECTION`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(this.buildSystemPrompt()),
        new HumanMessage(prompt),
      ]);

      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      // Parse the response type
      const typeMatch = content.match(/\[(OBSERVATION|INFERENCE|CONCERN|SUGGESTION|QUESTION|REFLECTION)\]/i);
      const type = (typeMatch?.[1]?.toLowerCase() || 'observation') as AtlasThought['type'];
      const cleanContent = content.replace(/\[.*?\]\s*/, '').trim();

      await this.generateThought(type, cleanContent, {
        domContext: snapshot.title,
        triggeredBy: 'dom',
      });
    } catch (error) {
      console.error('[Atlas] Failed to generate observation thought:', error);
    }
  }

  // ============ Thought Generation ============

  async generateThought(
    type: AtlasThought['type'],
    content: string,
    metadata?: AtlasThought['metadata']
  ): Promise<AtlasThought> {
    const thought: AtlasThought = {
      id: uuidv4(),
      timestamp: Date.now(),
      type,
      content,
      confidence: 0.8,
      relatedActions: this.session?.actions.slice(-5).map(a => a.id) || [],
      metadata,
    };

    // Add to session
    if (this.session) {
      this.session.thoughts.push(thought);
      
      // Trim if too many
      if (this.session.thoughts.length > this.config.maxThoughtsVisible * 2) {
        this.session.thoughts = this.session.thoughts.slice(-this.config.maxThoughtsVisible);
      }
    }

    // Persist to DB
    if (this.db) {
      await this.db.put('thoughts', thought);
    }

    // Store in vector memory for retrieval
    try {
      const memoryStore = await getMemoryStore();
      await memoryStore.append(
        'agent_action',
        'agent',
        {
          thoughtType: type,
          content,
          ...metadata,
        },
        {
          source: 'agent',
          importance: this.getThoughtImportance(type),
        }
      );
    } catch (error) {
      console.error('[Atlas] Failed to store thought in vector memory:', error);
    }

    // Notify callbacks
    this.thoughtCallbacks.forEach(cb => cb(thought));

    return thought;
  }

  private getThoughtImportance(type: AtlasThought['type']): number {
    const importanceMap: Record<AtlasThought['type'], number> = {
      observation: 0.3,
      inference: 0.5,
      concern: 0.8,
      suggestion: 0.6,
      question: 0.7,
      reflection: 0.4,
    };
    return importanceMap[type];
  }

  // ============ User Action Tracking ============

  async trackAction(action: Omit<UserAction, 'id' | 'timestamp'>): Promise<void> {
    const fullAction: UserAction = {
      ...action,
      id: uuidv4(),
      timestamp: Date.now(),
    };

    if (this.session) {
      this.session.actions.push(fullAction);

      // Trim old actions
      if (this.session.actions.length > 100) {
        this.session.actions = this.session.actions.slice(-50);
      }
    }

    // Detect patterns if enabled
    if (this.config.enablePatternDetection) {
      await this.detectPatterns(fullAction);
    }

    // Generate anticipatory thought based on action
    if (this.config.thinkingMode === 'anticipatory' || this.config.thinkingMode === 'helpful') {
      await this.generateActionThought(fullAction);
    }
  }

  private async generateActionThought(action: UserAction): Promise<void> {
    if (!this.llm || !this.session) return;

    // Skip trivial actions
    if (action.type === 'scroll') return;

    const recentActions = this.session.actions.slice(-5);
    const actionContext = recentActions
      .map(a => `${a.type}: ${a.description}`)
      .join('\n');

    const prompt = `The user just performed an action. Consider what they might need next.

Recent actions:
${actionContext}

Current action: ${action.type} - ${action.description}

Generate a brief anticipatory thought. What might the user need? What could go wrong? What context could be helpful?

Keep it concise (1-2 sentences). Be authentic in your reasoning.`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(this.buildSystemPrompt()),
        new HumanMessage(prompt),
      ]);

      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      await this.generateThought('inference', content.trim(), {
        userAction: action.description,
        triggeredBy: 'user',
      });
    } catch (error) {
      console.error('[Atlas] Failed to generate action thought:', error);
    }
  }

  private async detectPatterns(_action: UserAction): Promise<void> {
    if (!this.db) return;

    // Simple pattern detection based on action sequences
    const recentActions = this.session?.actions.slice(-10) || [];
    const pattern = recentActions.map(a => a.type).join('-');

    const existing = await this.db.get('patterns', pattern);
    if (existing) {
      existing.frequency++;
      existing.lastSeen = Date.now();
      await this.db.put('patterns', existing);
    } else {
      const newPattern: UserPattern = {
        id: pattern,
        pattern,
        frequency: 1,
        lastSeen: Date.now(),
        inference: '',
      };
      await this.db.put('patterns', newPattern);
    }
  }

  // ============ Chat Interface ============

  async chat(userMessage: string): Promise<AsyncGenerator<string, void, unknown>> {
    if (!this.llm || !this.session) {
      throw new Error('Atlas not initialized');
    }

    // Track the chat action
    await this.trackAction({
      type: 'chat',
      description: `User said: ${userMessage.slice(0, 100)}...`,
    });

    // Add user message to history
    this.session.chatHistory.push(new HumanMessage(userMessage));

    // Get relevant memories for context
    const memoryStore = await getMemoryStore();
    const relevantMemories = await memoryStore.search({
      types: ['agent_action', 'user_input', 'navigation'],
      limit: 10,
      minImportance: 0.3,
    });

    // Build context from memories
    const memoryContext = relevantMemories.length > 0
      ? `\n\nRelevant context from memory:\n${relevantMemories.map(m => 
          `- ${m.entry.type}: ${JSON.stringify(m.entry.data).slice(0, 200)}`
        ).join('\n')}`
      : '';

    // Get recent thoughts for context
    const recentThoughts = this.session.thoughts.slice(-5)
      .map(t => `[${t.type.toUpperCase()}] ${t.content}`)
      .join('\n');

    const thoughtContext = recentThoughts 
      ? `\n\nYour recent thoughts:\n${recentThoughts}`
      : '';

    // Create the full prompt with context
    const contextualPrompt = `${userMessage}${memoryContext}${thoughtContext}`;

    // Stream the response
    const self = this;
    async function* streamResponse(): AsyncGenerator<string, void, unknown> {
      let fullResponse = '';

      try {
        const stream = await self.llm!.stream([
          ...self.session!.chatHistory.slice(0, -1), // All except last
          new HumanMessage(contextualPrompt),
        ]);

        for await (const chunk of stream) {
          const text = typeof chunk.content === 'string' 
            ? chunk.content 
            : JSON.stringify(chunk.content);
          fullResponse += text;
          yield text;
        }

        // Add assistant response to history
        self.session!.chatHistory.push(new AIMessage(fullResponse));

        // Generate a reflection thought about the conversation
        if (fullResponse.length > 100) {
          await self.generateThought('reflection', 
            `Responded to user about: ${userMessage.slice(0, 50)}...`
          );
        }
      } catch (error) {
        console.error('[Atlas] Chat error:', error);
        throw error;
      }
    }

    return streamResponse();
  }

  // ============ Thought Retrieval ============

  getRecentThoughts(limit = 20): AtlasThought[] {
    return this.session?.thoughts.slice(-limit) || [];
  }

  async getThoughtsByType(type: AtlasThought['type'], limit = 20): Promise<AtlasThought[]> {
    if (!this.db) return [];
    
    const thoughts = await this.db.getAllFromIndex('thoughts', 'by-type', type);
    return thoughts.slice(-limit);
  }

  // ============ Context Building ============

  async getContext(): Promise<AtlasContext> {
    const domObserver = getDOMObserver();
    const memoryStore = await getMemoryStore();
    
    const [activeMemories, patterns] = await Promise.all([
      memoryStore.search({ limit: 10, minImportance: 0.5 }),
      this.db?.getAll('patterns') || [],
    ]);

    return {
      recentActions: this.session?.actions.slice(-20) || [],
      domState: domObserver.getSnapshot(),
      activeMemories: activeMemories.map(m => m.entry),
      currentThoughts: this.session?.thoughts.slice(-20) || [],
      sessionGoals: [], // TODO: Implement goal tracking
      userPatterns: patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 10),
    };
  }

  // ============ Event Subscriptions ============

  onThought(callback: (thought: AtlasThought) => void): () => void {
    this.thoughtCallbacks.add(callback);
    return () => this.thoughtCallbacks.delete(callback);
  }

  onContextUpdate(callback: (context: AtlasContext) => void): () => void {
    this.contextCallbacks.add(callback);
    return () => this.contextCallbacks.delete(callback);
  }

  // ============ Cleanup ============

  async destroy(): Promise<void> {
    if (this.observationTimer) {
      clearInterval(this.observationTimer);
    }
    
    if (this.session && this.db) {
      await this.db.put('sessions', this.session);
    }

    this.thoughtCallbacks.clear();
    this.contextCallbacks.clear();
    this.isInitialized = false;
  }
}

// ============ Singleton ============

let atlasInstance: AtlasAgent | null = null;

export async function getAtlasAgent(): Promise<AtlasAgent> {
  if (!atlasInstance) {
    atlasInstance = new AtlasAgent();
    await atlasInstance.initialize();
  }
  return atlasInstance;
}

export function getAtlasAgentSync(): AtlasAgent | null {
  return atlasInstance;
}

// Export types and classes
export { AtlasAgent };
export type { AtlasThought as Thought };
