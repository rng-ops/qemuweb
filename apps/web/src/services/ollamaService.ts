/**
 * Ollama Service
 * 
 * Comprehensive integration with local Ollama service:
 * - Model management (list, pull, delete, copy)
 * - Chat and completion with reasoning levels
 * - Embedding generation
 * - Connection management
 * - Model configuration
 */

import { getEventTracker } from './eventTracker';
import { getAuditLog } from './auditLog';

// ============ Types ============

export type ReasoningLevel = 'none' | 'low' | 'medium' | 'high' | 'max';

export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[] | null;
    parameterSize: string;
    quantizationLevel: string;
  };
}

export interface OllamaModelInfo {
  modelfile: string;
  parameters: string;
  template: string;
  details: OllamaModel['details'];
  modelInfo: Record<string, unknown>;
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  toolCalls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required?: string[];
    };
  };
}

export interface OllamaChatOptions {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  format?: 'json' | string;
  options?: OllamaGenerateOptions;
  tools?: OllamaTool[];
  keepAlive?: string;
  reasoningLevel?: ReasoningLevel;
}

export interface OllamaGenerateOptions {
  // Sampling options
  temperature?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  typical_p?: number;
  
  // Reasoning/thinking options (for compatible models)
  num_ctx?: number;
  num_predict?: number;
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  
  // Stop sequences
  stop?: string[];
  
  // Seed for reproducibility
  seed?: number;
  
  // Mirostat sampling
  mirostat?: 0 | 1 | 2;
  mirostat_eta?: number;
  mirostat_tau?: number;
  
  // Performance
  num_batch?: number;
  num_gpu?: number;
  main_gpu?: number;
  num_thread?: number;
  
  // Low VRAM mode
  low_vram?: boolean;
  
  // Vocab only (for embeddings)
  vocab_only?: boolean;
}

export interface OllamaChatResponse {
  model: string;
  createdAt: string;
  message: OllamaChatMessage;
  done: boolean;
  doneReason?: string;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  promptEvalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
}

export interface OllamaStreamChunk {
  model: string;
  createdAt: string;
  message: OllamaChatMessage;
  done: boolean;
}

export interface OllamaEmbeddingRequest {
  model: string;
  input: string | string[];
  truncate?: boolean;
  options?: OllamaGenerateOptions;
  keepAlive?: string;
}

export interface OllamaEmbeddingResponse {
  model: string;
  embeddings: number[][];
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: OllamaModel['details'];
  expiresAt: string;
  sizeVram: number;
}

export interface OllamaConnectionStatus {
  connected: boolean;
  host: string;
  port: number;
  version?: string;
  models: OllamaModel[];
  runningModels: OllamaRunningModel[];
  lastCheck: number;
  error?: string;
}

// Reasoning level configurations
const REASONING_CONFIGS: Record<ReasoningLevel, Partial<OllamaGenerateOptions>> = {
  none: {
    temperature: 0.7,
    num_predict: 2048,
  },
  low: {
    temperature: 0.5,
    num_predict: 4096,
    top_p: 0.9,
  },
  medium: {
    temperature: 0.3,
    num_predict: 8192,
    top_p: 0.85,
    repeat_penalty: 1.1,
  },
  high: {
    temperature: 0.2,
    num_predict: 16384,
    top_p: 0.8,
    repeat_penalty: 1.15,
    num_ctx: 32768,
  },
  max: {
    temperature: 0.1,
    num_predict: 32768,
    top_p: 0.75,
    repeat_penalty: 1.2,
    num_ctx: 65536,
  },
};

// ============ Ollama Service Class ============

class OllamaService {
  private host: string;
  private port: number;
  private status: OllamaConnectionStatus;
  private abortControllers: Map<string, AbortController> = new Map();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: Set<(status: OllamaConnectionStatus) => void> = new Set();

  constructor(host = 'localhost', port = 11434) {
    this.host = host;
    this.port = port;
    this.status = {
      connected: false,
      host,
      port,
      models: [],
      runningModels: [],
      lastCheck: 0,
    };
  }

  // ============ Connection Management ============

  get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  get isConnected(): boolean {
    return this.status.connected;
  }

  getStatus(): OllamaConnectionStatus {
    return { ...this.status };
  }

  onStatusChange(callback: (status: OllamaConnectionStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  private emitStatus(): void {
    this.statusCallbacks.forEach(cb => cb(this.getStatus()));
  }

  async configure(host: string, port: number): Promise<void> {
    this.host = host;
    this.port = port;
    this.status.host = host;
    this.status.port = port;
    await this.checkConnection();
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        this.status.connected = true;
        this.status.version = data.version;
        this.status.error = undefined;
        
        // Load models list
        await this.refreshModels();
        
        console.log(`[Ollama] Connected to ${this.baseUrl} (v${data.version})`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.status.connected = false;
      this.status.error = error instanceof Error ? error.message : 'Connection failed';
      console.warn(`[Ollama] Connection failed: ${this.status.error}`);
    }

    this.status.lastCheck = Date.now();
    this.emitStatus();
    return this.status.connected;
  }

  startAutoReconnect(intervalMs = 10000): void {
    this.stopAutoReconnect();
    this.reconnectInterval = setInterval(() => {
      if (!this.status.connected) {
        this.checkConnection();
      }
    }, intervalMs);
  }

  stopAutoReconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // ============ Model Management ============

  async refreshModels(): Promise<OllamaModel[]> {
    if (!this.status.connected) {
      return [];
    }

    try {
      const [modelsRes, psRes] = await Promise.all([
        fetch(`${this.baseUrl}/api/tags`),
        fetch(`${this.baseUrl}/api/ps`),
      ]);

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        this.status.models = data.models || [];
      }

      if (psRes.ok) {
        const data = await psRes.json();
        this.status.runningModels = data.models || [];
      }

      this.emitStatus();
      return this.status.models;
    } catch (error) {
      console.error('[Ollama] Failed to refresh models:', error);
      return [];
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    return this.refreshModels();
  }

  async showModel(name: string): Promise<OllamaModelInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        return response.json();
      }
      return null;
    } catch (error) {
      console.error('[Ollama] Failed to show model:', error);
      return null;
    }
  }

  async pullModel(
    name: string,
    onProgress?: (progress: OllamaPullProgress) => void
  ): Promise<boolean> {
    const auditLog = await getAuditLog();
    await auditLog.log('tool_invocation', {
      action: 'ollama.pull',
      model: name,
      actor: 'user',
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const result = await reader.read();
        streamDone = result.done;
        if (streamDone) break;
        const value = result.value;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const progress = JSON.parse(line) as OllamaPullProgress;
              onProgress?.(progress);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      await this.refreshModels();
      return true;
    } catch (error) {
      console.error('[Ollama] Failed to pull model:', error);
      return false;
    }
  }

  async deleteModel(name: string): Promise<boolean> {
    const auditLog = await getAuditLog();
    await auditLog.log('tool_invocation', {
      action: 'ollama.delete',
      model: name,
      actor: 'user',
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        await this.refreshModels();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Ollama] Failed to delete model:', error);
      return false;
    }
  }

  async copyModel(source: string, destination: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, destination }),
      });

      if (response.ok) {
        await this.refreshModels();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Ollama] Failed to copy model:', error);
      return false;
    }
  }

  // ============ Chat & Completion ============

  async chat(options: OllamaChatOptions): Promise<OllamaChatResponse> {
    if (!this.status.connected) {
      throw new Error('Ollama is not connected');
    }

    // Apply reasoning level config
    const reasoningConfig = options.reasoningLevel 
      ? REASONING_CONFIGS[options.reasoningLevel]
      : {};

    const mergedOptions: OllamaGenerateOptions = {
      ...reasoningConfig,
      ...options.options,
    };

    const requestId = `chat-${Date.now()}`;
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    try {
      const tracker = await getEventTracker();
      const startTime = Date.now();

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          stream: false,
          format: options.format,
          options: mergedOptions,
          tools: options.tools,
          keep_alive: options.keepAlive,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json() as OllamaChatResponse;

      // Track the interaction
      tracker.trackAgentRequest(
        options.messages[options.messages.length - 1]?.content || '',
        {
          model: options.model,
          reasoningLevel: options.reasoningLevel,
          duration: Date.now() - startTime,
          tokens: result.evalCount,
        }
      );

      return result;
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  async *chatStream(options: OllamaChatOptions): AsyncGenerator<OllamaStreamChunk> {
    if (!this.status.connected) {
      throw new Error('Ollama is not connected');
    }

    const reasoningConfig = options.reasoningLevel 
      ? REASONING_CONFIGS[options.reasoningLevel]
      : {};

    const mergedOptions: OllamaGenerateOptions = {
      ...reasoningConfig,
      ...options.options,
    };

    const requestId = `stream-${Date.now()}`;
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          stream: true,
          format: options.format,
          options: mergedOptions,
          tools: options.tools,
          keep_alive: options.keepAlive,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let chatDone = false;

      while (!chatDone) {
        const result = await reader.read();
        chatDone = result.done;
        if (chatDone) break;
        const value = result.value;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line) as OllamaStreamChunk;
              yield chunk;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  abortRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  abortAllRequests(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  // ============ Embeddings ============

  async embed(request: OllamaEmbeddingRequest): Promise<OllamaEmbeddingResponse> {
    if (!this.status.connected) {
      throw new Error('Ollama is not connected');
    }

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        input: request.input,
        truncate: request.truncate,
        options: request.options,
        keep_alive: request.keepAlive,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============ Model Loading ============

  async loadModel(name: string): Promise<boolean> {
    try {
      // Send a minimal request to load the model into memory
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: name,
          messages: [],
          keep_alive: '10m',
        }),
      });

      if (response.ok) {
        await this.refreshModels();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Ollama] Failed to load model:', error);
      return false;
    }
  }

  async unloadModel(name: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: name,
          messages: [],
          keep_alive: '0',
        }),
      });

      if (response.ok) {
        await this.refreshModels();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Ollama] Failed to unload model:', error);
      return false;
    }
  }

  // ============ Blob Management ============

  async checkBlob(digest: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/blobs/${digest}`, {
        method: 'HEAD',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============ Helper Methods ============

  formatModelSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(1)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  getReasoningLevelDescription(level: ReasoningLevel): string {
    switch (level) {
      case 'none':
        return 'Quick responses, minimal reasoning';
      case 'low':
        return 'Basic reasoning, faster responses';
      case 'medium':
        return 'Balanced reasoning and speed';
      case 'high':
        return 'Deep reasoning, thorough analysis';
      case 'max':
        return 'Maximum reasoning, most thorough';
    }
  }
}

// ============ Singleton ============

let ollamaInstance: OllamaService | null = null;

export function getOllamaService(): OllamaService {
  if (!ollamaInstance) {
    ollamaInstance = new OllamaService();
    // Auto-connect on first use
    ollamaInstance.checkConnection();
    ollamaInstance.startAutoReconnect();
  }
  return ollamaInstance;
}

export async function initOllamaService(host?: string, port?: number): Promise<OllamaService> {
  const service = getOllamaService();
  if (host && port) {
    await service.configure(host, port);
  } else {
    await service.checkConnection();
  }
  return service;
}

export default OllamaService;
