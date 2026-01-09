/**
 * Atlas Context Logger
 * 
 * Provides visibility into:
 * - What context is being passed to models
 * - How events are filtered
 * - Model invocation details
 * - Performance metrics
 * 
 * All logs are emitted as events that appear in the Events panel
 */

import { v4 as uuidv4 } from 'uuid';

// ============ Log Types ============

export type ContextLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ContextLogCategory = 
  | 'context'     // What context is being passed
  | 'filter'      // How data is being filtered
  | 'model'       // Model invocation details
  | 'thought'     // Thought generation
  | 'ui'          // UI interactions
  | 'navigation'  // Route changes
  | 'performance' // Timing metrics
  | 'system';     // System events

export interface ContextLogEntry {
  id: string;
  timestamp: number;
  level: ContextLogLevel;
  category: ContextLogCategory;
  message: string;
  data?: Record<string, unknown>;
  source?: string;
  duration?: number;
}

export interface ContextStats {
  totalLogs: number;
  byLevel: Record<ContextLogLevel, number>;
  byCategory: Record<ContextLogCategory, number>;
  avgLatency: number;
  peakLatency: number;
}

// ============ Logger Configuration ============

export interface ContextLoggerConfig {
  maxLogs: number;
  enableConsole: boolean;
  enabledLevels: Set<ContextLogLevel>;
  enabledCategories: Set<ContextLogCategory>;
  persistLogs: boolean;
}

const DEFAULT_CONFIG: ContextLoggerConfig = {
  maxLogs: 500,
  enableConsole: false,
  enabledLevels: new Set(['debug', 'info', 'warn', 'error']),
  enabledCategories: new Set(['context', 'filter', 'model', 'thought', 'ui', 'navigation', 'performance', 'system']),
  persistLogs: true,
};

// ============ Context Logger Class ============

export class AtlasContextLogger {
  private logs: ContextLogEntry[] = [];
  private config: ContextLoggerConfig;
  private listeners: Set<(log: ContextLogEntry) => void> = new Set();
  private latencies: number[] = [];
  private stats: ContextStats = {
    totalLogs: 0,
    byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
    byCategory: { context: 0, filter: 0, model: 0, thought: 0, ui: 0, navigation: 0, performance: 0, system: 0 },
    avgLatency: 0,
    peakLatency: 0,
  };

  constructor(config: Partial<ContextLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ Logging Methods ============

  debug(category: ContextLogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('debug', category, message, data);
  }

  info(category: ContextLogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('info', category, message, data);
  }

  warn(category: ContextLogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('warn', category, message, data);
  }

  error(category: ContextLogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('error', category, message, data);
  }

  private log(level: ContextLogLevel, category: ContextLogCategory, message: string, data?: Record<string, unknown>): void {
    // Check if this level/category is enabled
    if (!this.config.enabledLevels.has(level)) return;
    if (!this.config.enabledCategories.has(category)) return;

    const entry: ContextLogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    // Add to log buffer
    this.logs.push(entry);
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }

    // Update stats
    this.stats.totalLogs++;
    this.stats.byLevel[level]++;
    this.stats.byCategory[category]++;

    // Console output if enabled
    if (this.config.enableConsole) {
      const prefix = `[Atlas:${category}]`;
      switch (level) {
        case 'debug':
          // eslint-disable-next-line no-console
          console.debug(prefix, message, data);
          break;
        case 'info':
          // eslint-disable-next-line no-console
          console.info(prefix, message, data);
          break;
        case 'warn':
          // eslint-disable-next-line no-console
          console.warn(prefix, message, data);
          break;
        case 'error':
          // eslint-disable-next-line no-console
          console.error(prefix, message, data);
          break;
      }
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (err) {
        console.error('[ContextLogger] Listener error:', err);
      }
    }
  }

  // ============ Specialized Logging ============

  /**
   * Log context being passed to a model
   */
  logContext(
    model: string,
    messageCount: number,
    thoughtCount: number,
    contextSize: number,
    details?: Record<string, unknown>
  ): void {
    this.info('context', `Context passed to ${model}`, {
      model,
      messageCount,
      thoughtCount,
      contextSize,
      ...details,
    });
  }

  /**
   * Log how context was filtered
   */
  logFilter(
    original: number,
    kept: number,
    reason: string
  ): void {
    this.debug('filter', `Filtered ${original - kept} items: ${reason}`, {
      originalCount: original,
      keptCount: kept,
      filteredCount: original - kept,
      reason,
    });
  }

  /**
   * Log model invocation with timing
   */
  logModelCall(
    model: string,
    action: 'start' | 'complete' | 'error',
    details?: Record<string, unknown>
  ): void {
    const level = action === 'error' ? 'error' : 'info';
    this.log(level, 'model', `Model ${action}: ${model}`, {
      model,
      action,
      ...details,
    });
  }

  /**
   * Log thought generation
   */
  logThought(
    type: string,
    trigger: string,
    content: string,
    confidence: number
  ): void {
    this.info('thought', `Generated ${type} thought (${(confidence * 100).toFixed(0)}% confidence)`, {
      type,
      trigger,
      content: content.slice(0, 100),
      confidence,
    });
  }

  /**
   * Log UI action
   */
  logUIAction(
    action: string,
    element?: string,
    value?: unknown
  ): void {
    this.debug('ui', `UI Action: ${action}`, {
      action,
      element,
      value,
    });
  }

  /**
   * Log navigation
   */
  logNavigation(
    from: string | undefined,
    to: string
  ): void {
    this.info('navigation', `Navigated: ${from || 'start'} → ${to}`, {
      from,
      to,
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(
    operation: string,
    durationMs: number,
    details?: Record<string, unknown>
  ): void {
    // Track latencies
    this.latencies.push(durationMs);
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }

    // Update stats
    this.stats.avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    this.stats.peakLatency = Math.max(this.stats.peakLatency, durationMs);

    const level = durationMs > 5000 ? 'warn' : 'debug';
    this.log(level, 'performance', `${operation}: ${durationMs}ms`, {
      operation,
      durationMs,
      avgLatency: this.stats.avgLatency.toFixed(0),
      ...details,
    });
  }

  // ============ Timer Utility ============

  startTimer(operation: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.logPerformance(operation, duration);
    };
  }

  // ============ Query & Subscribe ============

  getLogs(options?: {
    level?: ContextLogLevel;
    category?: ContextLogCategory;
    limit?: number;
    since?: number;
  }): ContextLogEntry[] {
    let result = [...this.logs];

    if (options?.level) {
      result = result.filter(l => l.level === options.level);
    }
    if (options?.category) {
      result = result.filter(l => l.category === options.category);
    }
    if (options?.since) {
      const since = options.since;
      result = result.filter(l => l.timestamp >= since);
    }
    if (options?.limit) {
      result = result.slice(-options.limit);
    }

    return result;
  }

  getStats(): ContextStats {
    return { ...this.stats };
  }

  onLog(handler: (log: ContextLogEntry) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  // ============ Configuration ============

  updateConfig(updates: Partial<ContextLoggerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): ContextLoggerConfig {
    return { ...this.config };
  }

  enableConsole(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }

  enableCategory(category: ContextLogCategory, enabled: boolean): void {
    if (enabled) {
      this.config.enabledCategories.add(category);
    } else {
      this.config.enabledCategories.delete(category);
    }
  }

  // ============ Export & Clear ============

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clear(): void {
    this.logs = [];
    this.latencies = [];
    this.stats = {
      totalLogs: 0,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
      byCategory: { context: 0, filter: 0, model: 0, thought: 0, ui: 0, navigation: 0, performance: 0, system: 0 },
      avgLatency: 0,
      peakLatency: 0,
    };
  }
}

// ============ Singleton ============

let loggerInstance: AtlasContextLogger | null = null;

export function getContextLogger(): AtlasContextLogger {
  if (!loggerInstance) {
    loggerInstance = new AtlasContextLogger();
  }
  return loggerInstance;
}
