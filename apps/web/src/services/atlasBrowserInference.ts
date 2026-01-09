/**
 * Atlas Browser Inference Service
 * 
 * Manages in-browser model hosting using WebLLM, ONNX Runtime, and other
 * browser-native inference engines. Provides a unified interface for running
 * small models entirely in the browser without external API calls.
 * 
 * Features:
 * - WebLLM integration for transformer models
 * - ONNX Runtime Web for optimized models
 * - Model caching and preloading
 * - Resource management and memory limits
 * - Attestation and configuration snapshots
 */

// ============ Types ============

export type InferenceBackend = 'webllm' | 'onnx' | 'transformers-js' | 'wasm';

export type ModelStatus = 
  | 'not-loaded'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unloading';

export interface InferenceModelConfig {
  id: string;
  name: string;
  backend: InferenceBackend;
  
  // Model source
  source: {
    type: 'huggingface' | 'url' | 'local' | 'bundled';
    path: string;                  // HF repo or URL
    revision?: string;             // Git revision/tag
  };
  
  // Model parameters
  params: {
    contextWindow: number;
    quantization?: string;         // e.g., 'q4f16_1', 'q4_0'
    dtype?: string;                // e.g., 'float16', 'int8'
  };
  
  // Inference settings
  inference: {
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
    stopTokens?: string[];
  };
  
  // Resource limits
  limits: {
    maxMemoryMB: number;           // Max memory usage
    maxConcurrent: number;         // Max parallel requests
    timeoutMs: number;             // Max inference time
  };
  
  // Preloading
  preload: boolean;                // Load on service init
  priority: number;                // Loading priority (lower = first)
}

export interface LoadedModel {
  config: InferenceModelConfig;
  status: ModelStatus;
  backend: InferenceBackendInstance;
  loadedAt?: number;
  lastUsedAt?: number;
  memoryUsageMB?: number;
  error?: string;
  
  // Performance metrics
  metrics: {
    totalInferences: number;
    totalTokensGenerated: number;
    avgLatencyMs: number;
    avgTokensPerSecond: number;
  };
}

export interface InferenceRequest {
  id: string;
  modelId: string;
  prompt: string;
  options?: Partial<InferenceModelConfig['inference']>;
  priority?: 'high' | 'normal' | 'low';
  timeout?: number;
}

export interface InferenceResult {
  requestId: string;
  modelId: string;
  output: string;
  tokensGenerated: number;
  latencyMs: number;
  tokensPerSecond: number;
  finishReason: 'stop' | 'length' | 'timeout' | 'error';
  error?: string;
}

export interface InferenceBackendInstance {
  type: InferenceBackend;
  initialize(config: InferenceModelConfig): Promise<void>;
  generate(prompt: string, options: InferenceModelConfig['inference']): Promise<string>;
  getMemoryUsage(): number;
  unload(): Promise<void>;
}

// ============ WebLLM Backend ============

class WebLLMBackend implements InferenceBackendInstance {
  type: InferenceBackend = 'webllm';
  private engine: unknown = null;
  private modelId: string;
  private webllmModule: unknown = null;
  
  constructor(modelId: string) {
    this.modelId = modelId;
  }
  
  async initialize(config: InferenceModelConfig): Promise<void> {
    console.log(`[WebLLM] Initializing model: ${config.source.path}`);
    
    // Dynamic import to avoid bundling issues - uses optional dependency
    try {
      // Try to load WebLLM dynamically - it may not be installed
      // Use string variable to prevent TypeScript from trying to resolve
      const webllmPackage = '@mlc-ai/web-llm';
      this.webllmModule = await import(/* @vite-ignore */ webllmPackage).catch(() => null);
      
      if (!this.webllmModule) {
        console.warn('[WebLLM] @mlc-ai/web-llm not installed, using mock backend');
        throw new Error('WebLLM not available - please install @mlc-ai/web-llm');
      }
      
      // @ts-expect-error - WebLLM is loaded dynamically
      this.engine = await this.webllmModule.CreateMLCEngine(config.source.path, {
        initProgressCallback: (progress: { text: string; progress: number }) => {
          console.log(`[WebLLM] Loading ${this.modelId}: ${progress.text} (${Math.round(progress.progress * 100)}%)`);
        },
      });
      
      console.log(`[WebLLM] Model ${this.modelId} ready`);
    } catch (err) {
      console.error(`[WebLLM] Failed to load model:`, err);
      throw err;
    }
  }
  
  async generate(prompt: string, options: InferenceModelConfig['inference']): Promise<string> {
    if (!this.engine) {
      throw new Error('WebLLM engine not initialized');
    }
    
    try {
      // @ts-expect-error - Using dynamic WebLLM API
      const response = await this.engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxTokens,
        stop: options.stopTokens,
      });
      
      return response.choices[0]?.message?.content || '';
    } catch (err) {
      console.error(`[WebLLM] Generation error:`, err);
      throw err;
    }
  }
  
  getMemoryUsage(): number {
    // WebLLM doesn't expose memory usage directly
    // Estimate based on model size
    return 500; // MB estimate
  }
  
  async unload(): Promise<void> {
    if (this.engine) {
      // @ts-expect-error - Using dynamic WebLLM API
      await this.engine.unload?.();
      this.engine = null;
    }
  }
}

// ============ ONNX Backend ============

class ONNXBackend implements InferenceBackendInstance {
  type: InferenceBackend = 'onnx';
  private session: unknown = null;
  private modelId: string;
  private ortModule: unknown = null;
  
  constructor(modelId: string) {
    this.modelId = modelId;
  }
  
  async initialize(config: InferenceModelConfig): Promise<void> {
    console.log(`[ONNX] Initializing model: ${config.source.path}`);
    
    try {
      // Dynamic import ONNX Runtime Web - uses optional dependency
      // Use string variable to prevent TypeScript from trying to resolve
      const onnxPackage = 'onnxruntime-web';
      this.ortModule = await import(/* @vite-ignore */ onnxPackage).catch(() => null);
      
      if (!this.ortModule) {
        console.warn('[ONNX] onnxruntime-web not installed, using mock backend');
        throw new Error('ONNX not available - please install onnxruntime-web');
      }
      
      // Load model from URL or path
      const modelUrl = config.source.type === 'url' 
        ? config.source.path 
        : `https://huggingface.co/${config.source.path}/resolve/main/model.onnx`;
      
      // @ts-expect-error - ONNX Runtime is loaded dynamically
      this.session = await this.ortModule.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      console.log(`[ONNX] Model ${this.modelId} ready`);
    } catch (err) {
      console.error(`[ONNX] Failed to load model:`, err);
      throw err;
    }
  }
  
  async generate(prompt: string, options: InferenceModelConfig['inference']): Promise<string> {
    if (!this.session) {
      throw new Error('ONNX session not initialized');
    }
    
    // ONNX text generation is more complex - needs tokenization
    // This is a simplified placeholder
    console.log(`[ONNX] Generating with prompt length: ${prompt.length}, max tokens: ${options.maxTokens}`);
    
    // For now, return a placeholder - full implementation would need tokenizer
    return `[ONNX model output placeholder for: ${prompt.slice(0, 50)}...]`;
  }
  
  getMemoryUsage(): number {
    return 200; // MB estimate for small ONNX models
  }
  
  async unload(): Promise<void> {
    if (this.session) {
      // @ts-expect-error - Using dynamic ONNX API
      await this.session.release?.();
      this.session = null;
    }
  }
}

// ============ Mock Backend for Testing ============

class MockBackend implements InferenceBackendInstance {
  type: InferenceBackend = 'wasm';
  private modelId: string;
  private loadDelay: number;
  
  constructor(modelId: string, loadDelay = 100) {
    this.modelId = modelId;
    this.loadDelay = loadDelay;
  }
  
  async initialize(_config: InferenceModelConfig): Promise<void> {
    console.log(`[Mock] Initializing model: ${this.modelId}`);
    await new Promise(resolve => setTimeout(resolve, this.loadDelay));
    console.log(`[Mock] Model ${this.modelId} ready`);
  }
  
  async generate(prompt: string, options: InferenceModelConfig['inference']): Promise<string> {
    // Simulate some latency
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    // Generate mock response based on prompt content
    const responses: Record<string, string> = {
      security: JSON.stringify({
        type: 'thought',
        text: 'Security check: No obvious vulnerabilities detected in current context.',
        confidence: 0.85,
        severity: 'info',
      }),
      architecture: JSON.stringify({
        type: 'thought',
        text: 'Architecture observation: Consider extracting this logic into a separate service.',
        confidence: 0.7,
        severity: 'info',
      }),
      ux: JSON.stringify({
        type: 'thought',
        text: 'UX note: This workflow has 3 steps, consider combining for efficiency.',
        confidence: 0.6,
        severity: 'info',
      }),
      performance: JSON.stringify({
        type: 'recommendation',
        text: 'Resource hint: User likely to need file X next, consider preloading.',
        confidence: 0.65,
        severity: 'info',
      }),
    };
    
    // Find matching response type from prompt
    const promptLower = prompt.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (promptLower.includes(key)) {
        return response;
      }
    }
    
    // Default response
    return JSON.stringify({
      type: 'thought',
      text: `[${this.modelId}] Observation: Context processed, no significant findings.`,
      confidence: 0.5 + Math.random() * 0.3,
      severity: 'info',
      maxTokens: options.maxTokens,
    });
  }
  
  getMemoryUsage(): number {
    return 10; // Mock uses minimal memory
  }
  
  async unload(): Promise<void> {
    console.log(`[Mock] Unloading model: ${this.modelId}`);
  }
}

// ============ Browser Inference Service ============

// Queued request with resolver for concurrent limiting
interface QueuedRequest extends InferenceRequest {
  resolve: (result: InferenceResult) => void;
}

export class BrowserInferenceService {
  private models = new Map<string, LoadedModel>();
  private requestQueue: QueuedRequest[] = [];
  private processing = new Set<string>();
  private subscribers = new Set<(event: InferenceEvent) => void>();
  
  // Memory management
  private maxTotalMemoryMB = 2048;  // 2GB default limit
  private currentMemoryMB = 0;
  
  // ============ Model Management ============
  
  /**
   * Register a model configuration
   */
  registerModel(config: InferenceModelConfig): void {
    if (this.models.has(config.id)) {
      console.warn(`[BrowserInference] Model ${config.id} already registered`);
      return;
    }
    
    const model: LoadedModel = {
      config,
      status: 'not-loaded',
      backend: null!,
      metrics: {
        totalInferences: 0,
        totalTokensGenerated: 0,
        avgLatencyMs: 0,
        avgTokensPerSecond: 0,
      },
    };
    
    this.models.set(config.id, model);
    this.emitEvent('model:registered', { modelId: config.id });
    
    // Auto-preload if configured
    if (config.preload) {
      this.loadModel(config.id).catch(err => {
        console.error(`[BrowserInference] Failed to preload ${config.id}:`, err);
      });
    }
  }
  
  /**
   * Load a model into memory
   */
  async loadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not registered`);
    }
    
    if (model.status === 'ready' || model.status === 'loading') {
      return;
    }
    
    model.status = 'loading';
    this.emitEvent('model:loading', { modelId });
    
    try {
      // Check memory limits
      const requiredMemory = model.config.limits.maxMemoryMB;
      if (this.currentMemoryMB + requiredMemory > this.maxTotalMemoryMB) {
        // Try to free memory by unloading least-used models
        await this.freeMemory(requiredMemory);
      }
      
      // Create backend based on type
      const backend = await this.createBackend(model.config);
      await backend.initialize(model.config);
      
      model.backend = backend;
      model.status = 'ready';
      model.loadedAt = Date.now();
      model.memoryUsageMB = backend.getMemoryUsage();
      this.currentMemoryMB += model.memoryUsageMB;
      
      this.emitEvent('model:ready', { modelId, memoryMB: model.memoryUsageMB });
      console.log(`[BrowserInference] Model ${modelId} loaded (${model.memoryUsageMB}MB)`);
      
    } catch (err) {
      model.status = 'error';
      model.error = err instanceof Error ? err.message : 'Load failed';
      this.emitEvent('model:error', { modelId, error: model.error });
      throw err;
    }
  }
  
  /**
   * Unload a model from memory
   */
  async unloadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model || model.status !== 'ready') {
      return;
    }
    
    model.status = 'unloading';
    this.emitEvent('model:unloading', { modelId });
    
    try {
      await model.backend.unload();
      this.currentMemoryMB -= model.memoryUsageMB || 0;
      model.status = 'not-loaded';
      model.memoryUsageMB = 0;
      
      this.emitEvent('model:unloaded', { modelId });
    } catch (err) {
      model.status = 'error';
      model.error = err instanceof Error ? err.message : 'Unload failed';
    }
  }
  
  /**
   * Free memory by unloading least-recently-used models
   */
  private async freeMemory(requiredMB: number): Promise<void> {
    const loadedModels = Array.from(this.models.values())
      .filter(m => m.status === 'ready')
      .sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));
    
    let freedMB = 0;
    for (const model of loadedModels) {
      if (this.currentMemoryMB - freedMB + requiredMB <= this.maxTotalMemoryMB) {
        break;
      }
      
      await this.unloadModel(model.config.id);
      freedMB += model.memoryUsageMB || 0;
    }
  }
  
  /**
   * Create appropriate backend for model config
   */
  private async createBackend(config: InferenceModelConfig): Promise<InferenceBackendInstance> {
    switch (config.backend) {
      case 'webllm':
        return new WebLLMBackend(config.id);
      case 'onnx':
        return new ONNXBackend(config.id);
      case 'wasm':
      default:
        // Use mock for now, or WASM-based backend
        return new MockBackend(config.id);
    }
  }
  
  // ============ Inference ============
  
  /**
   * Run inference with a model
   */
  async infer(request: InferenceRequest): Promise<InferenceResult> {
    const model = this.models.get(request.modelId);
    if (!model) {
      return {
        requestId: request.id,
        modelId: request.modelId,
        output: '',
        tokensGenerated: 0,
        latencyMs: 0,
        tokensPerSecond: 0,
        finishReason: 'error',
        error: `Model ${request.modelId} not registered`,
      };
    }
    
    // Ensure model is loaded
    if (model.status !== 'ready') {
      try {
        await this.loadModel(request.modelId);
      } catch (err) {
        return {
          requestId: request.id,
          modelId: request.modelId,
          output: '',
          tokensGenerated: 0,
          latencyMs: 0,
          tokensPerSecond: 0,
          finishReason: 'error',
          error: `Failed to load model: ${err}`,
        };
      }
    }
    
    // Check concurrent limit
    const activeRequests = Array.from(this.processing).filter(id => id.startsWith(request.modelId)).length;
    if (activeRequests >= model.config.limits.maxConcurrent) {
      // Queue the request
      return new Promise<InferenceResult>((resolve) => {
        this.requestQueue.push({ ...request, resolve });
        this.emitEvent('inference:queued', { requestId: request.id, queuePosition: this.requestQueue.length });
      });
    }
    
    return this.executeInference(model, request);
  }
  
  private async executeInference(model: LoadedModel, request: InferenceRequest): Promise<InferenceResult> {
    const startTime = Date.now();
    this.processing.add(`${request.modelId}:${request.id}`);
    this.emitEvent('inference:started', { requestId: request.id, modelId: request.modelId });
    
    try {
      // Merge options with defaults
      const options: InferenceModelConfig['inference'] = {
        ...model.config.inference,
        ...request.options,
      };
      
      // Run with timeout
      const timeout = request.timeout || model.config.limits.timeoutMs;
      const output = await Promise.race([
        model.backend.generate(request.prompt, options),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Inference timeout')), timeout)
        ),
      ]);
      
      const latencyMs = Date.now() - startTime;
      const tokensGenerated = Math.ceil(output.length / 4); // Rough estimate
      const tokensPerSecond = (tokensGenerated / latencyMs) * 1000;
      
      // Update metrics
      model.lastUsedAt = Date.now();
      model.metrics.totalInferences++;
      model.metrics.totalTokensGenerated += tokensGenerated;
      model.metrics.avgLatencyMs = 
        (model.metrics.avgLatencyMs * (model.metrics.totalInferences - 1) + latencyMs) / model.metrics.totalInferences;
      model.metrics.avgTokensPerSecond = 
        (model.metrics.avgTokensPerSecond * (model.metrics.totalInferences - 1) + tokensPerSecond) / model.metrics.totalInferences;
      
      const result: InferenceResult = {
        requestId: request.id,
        modelId: request.modelId,
        output,
        tokensGenerated,
        latencyMs,
        tokensPerSecond,
        finishReason: 'stop',
      };
      
      this.emitEvent('inference:completed', { 
        requestId: request.id, 
        latencyMs, 
        tokensGenerated,
      });
      
      return result;
      
    } catch (err) {
      const result: InferenceResult = {
        requestId: request.id,
        modelId: request.modelId,
        output: '',
        tokensGenerated: 0,
        latencyMs: Date.now() - startTime,
        tokensPerSecond: 0,
        finishReason: err instanceof Error && err.message.includes('timeout') ? 'timeout' : 'error',
        error: err instanceof Error ? err.message : 'Inference failed',
      };
      
      this.emitEvent('inference:error', { requestId: request.id, error: result.error });
      return result;
      
    } finally {
      this.processing.delete(`${request.modelId}:${request.id}`);
      this.processQueue();
    }
  }
  
  private processQueue(): void {
    if (this.requestQueue.length === 0) return;
    
    // Find a request that can be processed
    for (let i = 0; i < this.requestQueue.length; i++) {
      const request = this.requestQueue[i];
      const model = this.models.get(request.modelId);
      if (!model) continue;
      
      const activeRequests = Array.from(this.processing).filter(id => id.startsWith(request.modelId)).length;
      if (activeRequests < model.config.limits.maxConcurrent) {
        this.requestQueue.splice(i, 1);
        this.executeInference(model, request);
        return;
      }
    }
  }
  
  // ============ Status & Metrics ============
  
  /**
   * Get all registered models with their status
   */
  getModels(): LoadedModel[] {
    return Array.from(this.models.values());
  }
  
  /**
   * Get a specific model
   */
  getModel(modelId: string): LoadedModel | undefined {
    return this.models.get(modelId);
  }
  
  /**
   * Get total memory usage
   */
  getMemoryUsage(): { used: number; max: number; percentage: number } {
    return {
      used: this.currentMemoryMB,
      max: this.maxTotalMemoryMB,
      percentage: (this.currentMemoryMB / this.maxTotalMemoryMB) * 100,
    };
  }
  
  /**
   * Set maximum memory limit
   */
  setMaxMemory(maxMB: number): void {
    this.maxTotalMemoryMB = maxMB;
    
    // If over limit, free memory
    if (this.currentMemoryMB > maxMB) {
      this.freeMemory(0).catch(console.error);
    }
  }
  
  // ============ Attestation ============
  
  /**
   * Create attestation for current service state
   */
  createAttestation(): ServiceAttestation {
    const models = Array.from(this.models.values()).map(m => ({
      id: m.config.id,
      name: m.config.name,
      backend: m.config.backend,
      source: m.config.source,
      status: m.status,
    }));
    
    const configHash = this.hashConfig(models);
    
    return {
      id: `attest-${Date.now()}`,
      timestamp: Date.now(),
      version: '1.0.0',
      configHash,
      models,
      memoryConfig: {
        maxMB: this.maxTotalMemoryMB,
        usedMB: this.currentMemoryMB,
      },
    };
  }
  
  private hashConfig(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  
  // ============ Events ============
  
  private emitEvent(type: string, data: Record<string, unknown>): void {
    const event: InferenceEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: Date.now(),
      data,
    };
    
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (err) {
        console.error('[BrowserInference] Event subscriber error:', err);
      }
    }
  }
  
  onEvent(callback: (event: InferenceEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

// ============ Event Types ============

export interface InferenceEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface ServiceAttestation {
  id: string;
  timestamp: number;
  version: string;
  configHash: string;
  models: Array<{
    id: string;
    name: string;
    backend: InferenceBackend;
    source: InferenceModelConfig['source'];
    status: ModelStatus;
  }>;
  memoryConfig: {
    maxMB: number;
    usedMB: number;
  };
}

// ============ Default Model Configs ============

export const DEFAULT_BROWSER_MODELS: InferenceModelConfig[] = [
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini',
    backend: 'webllm',
    source: {
      type: 'huggingface',
      path: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
    },
    params: {
      contextWindow: 4096,
      quantization: 'q4f16_1',
    },
    inference: {
      temperature: 0.3,
      topP: 0.9,
      topK: 40,
      maxTokens: 256,
    },
    limits: {
      maxMemoryMB: 800,
      maxConcurrent: 1,
      timeoutMs: 30000,
    },
    preload: false,
    priority: 1,
  },
  {
    id: 'smollm-135m',
    name: 'SmolLM 135M',
    backend: 'webllm',
    source: {
      type: 'huggingface',
      path: 'SmolLM-135M-Instruct-q4f16_1-MLC',
    },
    params: {
      contextWindow: 2048,
      quantization: 'q4f16_1',
    },
    inference: {
      temperature: 0.4,
      topP: 0.9,
      topK: 40,
      maxTokens: 128,
    },
    limits: {
      maxMemoryMB: 150,
      maxConcurrent: 2,
      timeoutMs: 10000,
    },
    preload: false,
    priority: 2,
  },
  {
    id: 'mock-agent',
    name: 'Mock Agent Model',
    backend: 'wasm',
    source: {
      type: 'bundled',
      path: 'mock',
    },
    params: {
      contextWindow: 2048,
    },
    inference: {
      temperature: 0.5,
      topP: 0.9,
      topK: 40,
      maxTokens: 256,
    },
    limits: {
      maxMemoryMB: 10,
      maxConcurrent: 10,
      timeoutMs: 5000,
    },
    preload: true,
    priority: 0,
  },
];

// ============ Singleton ============

let inferenceService: BrowserInferenceService | null = null;

export function getBrowserInference(): BrowserInferenceService {
  if (!inferenceService) {
    inferenceService = new BrowserInferenceService();
    
    // Register default models
    for (const config of DEFAULT_BROWSER_MODELS) {
      inferenceService.registerModel(config);
    }
  }
  return inferenceService;
}

export function initBrowserInference(): BrowserInferenceService {
  return getBrowserInference();
}
