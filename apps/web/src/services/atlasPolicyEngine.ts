/**
 * Atlas Policy Engine
 * 
 * Evaluates policies against context and triggers appropriate agents.
 * Supports rule-based evaluation, pattern matching, and conditional logic.
 * 
 * Policies can:
 * - Trigger specific agents
 * - Create approval gates
 * - Block actions
 * - Prepare resources
 * - Emit notifications
 */

import { getAgentMatrix, type AgentTrigger } from './atlasAgentMatrix';
import { getApprovalGates, type GatePriority } from './atlasApprovalGates';
import type { AtlasEvent } from './atlasOrchestrator';

// ============ Policy Types ============

export type PolicyCategory = 
  | 'security'
  | 'compliance'
  | 'performance'
  | 'quality'
  | 'safeguarding'
  | 'resource'
  | 'workflow'
  | 'custom';

export type PolicyConditionType = 
  | 'contains'          // Text contains pattern
  | 'matches'           // Regex match
  | 'equals'            // Exact match
  | 'starts-with'       // Prefix match
  | 'ends-with'         // Suffix match
  | 'greater-than'      // Numeric comparison
  | 'less-than'
  | 'between'
  | 'in-list'           // Value in list
  | 'not-in-list'
  | 'exists'            // Field exists
  | 'not-exists'
  | 'custom';           // Custom function

export interface PolicyCondition {
  field: string;                    // Path to field (e.g., 'event.data.filename')
  type: PolicyConditionType;
  value: unknown;                   // Value(s) to compare
  caseSensitive?: boolean;
  negate?: boolean;                 // Invert the condition
}

export interface PolicyActionConfig {
  type: 'trigger-agent' | 'create-gate' | 'block' | 'notify' | 'prepare-resource' | 'log' | 'custom';
  
  // For trigger-agent
  agentId?: string;
  agentTrigger?: AgentTrigger;
  
  // For create-gate
  gateName?: string;
  gatePriority?: GatePriority;
  gateTimeout?: number;
  requireHuman?: boolean;
  
  // For block
  blockReason?: string;
  blockDuration?: number;
  
  // For notify
  notificationLevel?: 'info' | 'warning' | 'error' | 'critical';
  notificationMessage?: string;
  
  // For prepare-resource
  resourceType?: string;
  resourceId?: string;
  
  // For custom
  customHandler?: string;          // Handler name to call
  customPayload?: Record<string, unknown>;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  
  // Activation
  enabled: boolean;
  priority: number;                 // Lower = higher priority
  
  // Trigger conditions (when to evaluate)
  triggers: {
    eventTypes: string[];           // Atlas event types to watch
    schedule?: string;              // Cron-like schedule
    manual?: boolean;               // Can be triggered manually
  };
  
  // Evaluation conditions (when policy applies)
  conditions: {
    all?: PolicyCondition[];        // All must match (AND)
    any?: PolicyCondition[];        // Any must match (OR)
    none?: PolicyCondition[];       // None should match (NOT)
  };
  
  // Actions to take when policy matches
  actions: PolicyActionConfig[];
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  version: string;
  tags: string[];
}

export interface PolicyMatch {
  policyId: string;
  policyName: string;
  matchedConditions: string[];
  triggerEvent: AtlasEvent;
  timestamp: number;
}

export interface PolicyEvaluationResult {
  evaluated: number;
  matched: Policy[];
  actions: Array<{
    policy: Policy;
    action: PolicyActionConfig;
    result: 'executed' | 'failed' | 'blocked';
    error?: string;
  }>;
  duration: number;
}

// ============ Policy Engine Service ============

class PolicyEngineService {
  private policies = new Map<string, Policy>();
  private subscribers = new Set<(event: PolicyEvent) => void>();
  private customHandlers = new Map<string, (context: PolicyContext) => Promise<void>>();
  private evaluationHistory: PolicyMatch[] = [];
  
  // ============ Policy Management ============
  
  /**
   * Register a new policy
   */
  registerPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
    this.emitEvent('policy:registered', { policyId: policy.id, name: policy.name });
    console.log(`[PolicyEngine] Registered policy: ${policy.name}`);
  }
  
  /**
   * Update an existing policy
   */
  updatePolicy(id: string, updates: Partial<Policy>): boolean {
    const policy = this.policies.get(id);
    if (!policy) return false;
    
    const updated = { ...policy, ...updates, updatedAt: Date.now() };
    this.policies.set(id, updated);
    this.emitEvent('policy:updated', { policyId: id });
    return true;
  }
  
  /**
   * Enable/disable a policy
   */
  setEnabled(id: string, enabled: boolean): void {
    const policy = this.policies.get(id);
    if (policy) {
      policy.enabled = enabled;
      policy.updatedAt = Date.now();
      this.emitEvent(enabled ? 'policy:enabled' : 'policy:disabled', { policyId: id });
    }
  }
  
  /**
   * Remove a policy
   */
  removePolicy(id: string): boolean {
    const result = this.policies.delete(id);
    if (result) {
      this.emitEvent('policy:removed', { policyId: id });
    }
    return result;
  }
  
  /**
   * Get all policies
   */
  getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }
  
  /**
   * Get policies by category
   */
  getPoliciesByCategory(category: PolicyCategory): Policy[] {
    return Array.from(this.policies.values()).filter(p => p.category === category);
  }
  
  // ============ Custom Handlers ============
  
  /**
   * Register a custom action handler
   */
  registerHandler(name: string, handler: (context: PolicyContext) => Promise<void>): void {
    this.customHandlers.set(name, handler);
  }
  
  // ============ Policy Evaluation ============
  
  /**
   * Evaluate all policies against an event
   */
  async evaluate(event: AtlasEvent): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();
    const result: PolicyEvaluationResult = {
      evaluated: 0,
      matched: [],
      actions: [],
      duration: 0,
    };
    
    // Get applicable policies sorted by priority
    const applicablePolicies = Array.from(this.policies.values())
      .filter(p => p.enabled && this.policyMatchesTrigger(p, event))
      .sort((a, b) => a.priority - b.priority);
    
    result.evaluated = applicablePolicies.length;
    
    for (const policy of applicablePolicies) {
      // Evaluate conditions
      if (this.evaluateConditions(policy, event)) {
        result.matched.push(policy);
        
        // Record match
        this.recordMatch(policy, event);
        
        // Execute actions
        for (const action of policy.actions) {
          const actionResult = await this.executeAction(policy, action, event);
          result.actions.push({
            policy,
            action,
            ...actionResult,
          });
        }
      }
    }
    
    result.duration = Date.now() - startTime;
    
    if (result.matched.length > 0) {
      this.emitEvent('policies:matched', {
        count: result.matched.length,
        policies: result.matched.map(p => p.name),
        eventType: event.type,
      });
    }
    
    return result;
  }
  
  /**
   * Check if policy triggers match the event
   */
  private policyMatchesTrigger(policy: Policy, event: AtlasEvent): boolean {
    return policy.triggers.eventTypes.some(pattern => {
      if (pattern === '*') return true;
      if (pattern.endsWith('*')) {
        return event.type.startsWith(pattern.slice(0, -1));
      }
      return event.type === pattern;
    });
  }
  
  /**
   * Evaluate all conditions of a policy
   */
  private evaluateConditions(policy: Policy, event: AtlasEvent): boolean {
    const context = this.buildContext(event);
    
    // Check ALL conditions (AND)
    if (policy.conditions.all && policy.conditions.all.length > 0) {
      if (!policy.conditions.all.every(c => this.evaluateCondition(c, context))) {
        return false;
      }
    }
    
    // Check ANY conditions (OR)
    if (policy.conditions.any && policy.conditions.any.length > 0) {
      if (!policy.conditions.any.some(c => this.evaluateCondition(c, context))) {
        return false;
      }
    }
    
    // Check NONE conditions (NOT)
    if (policy.conditions.none && policy.conditions.none.length > 0) {
      if (policy.conditions.none.some(c => this.evaluateCondition(c, context))) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: Record<string, unknown>): boolean {
    const fieldValue = this.getFieldValue(context, condition.field);
    let result = false;
    
    switch (condition.type) {
      case 'contains':
        result = String(fieldValue).toLowerCase().includes(
          String(condition.value).toLowerCase()
        );
        break;
        
      case 'matches':
        try {
          const regex = new RegExp(String(condition.value), condition.caseSensitive ? '' : 'i');
          result = regex.test(String(fieldValue));
        } catch {
          result = false;
        }
        break;
        
      case 'equals':
        result = condition.caseSensitive 
          ? fieldValue === condition.value
          : String(fieldValue).toLowerCase() === String(condition.value).toLowerCase();
        break;
        
      case 'starts-with':
        result = String(fieldValue).toLowerCase().startsWith(
          String(condition.value).toLowerCase()
        );
        break;
        
      case 'ends-with':
        result = String(fieldValue).toLowerCase().endsWith(
          String(condition.value).toLowerCase()
        );
        break;
        
      case 'greater-than':
        result = Number(fieldValue) > Number(condition.value);
        break;
        
      case 'less-than':
        result = Number(fieldValue) < Number(condition.value);
        break;
        
      case 'between':
        const [min, max] = condition.value as [number, number];
        const num = Number(fieldValue);
        result = num >= min && num <= max;
        break;
        
      case 'in-list':
        result = (condition.value as unknown[]).includes(fieldValue);
        break;
        
      case 'not-in-list':
        result = !(condition.value as unknown[]).includes(fieldValue);
        break;
        
      case 'exists':
        result = fieldValue !== undefined && fieldValue !== null;
        break;
        
      case 'not-exists':
        result = fieldValue === undefined || fieldValue === null;
        break;
        
      case 'custom':
        // Custom conditions require a registered handler
        result = false;
        break;
    }
    
    return condition.negate ? !result : result;
  }
  
  /**
   * Get nested field value from context
   */
  private getFieldValue(context: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let value: unknown = context;
    
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    
    return value;
  }
  
  /**
   * Build evaluation context from event
   */
  private buildContext(event: AtlasEvent): Record<string, unknown> {
    return {
      event: {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        source: event.source,
        data: event.data,
      },
      time: {
        hour: new Date().getHours(),
        day: new Date().getDay(),
        timestamp: Date.now(),
      },
    };
  }
  
  // ============ Action Execution ============
  
  private async executeAction(
    policy: Policy, 
    action: PolicyActionConfig, 
    event: AtlasEvent
  ): Promise<{ result: 'executed' | 'failed' | 'blocked'; error?: string }> {
    try {
      switch (action.type) {
        case 'trigger-agent':
          if (action.agentId) {
            const matrix = getAgentMatrix();
            await matrix.triggerAgents(action.agentTrigger || 'on-request', {
              policyId: policy.id,
              eventType: event.type,
              eventData: event.data,
            });
          }
          break;
          
        case 'create-gate':
          const gates = getApprovalGates();
          gates.createGate({
            name: action.gateName || `Policy: ${policy.name}`,
            description: `Triggered by policy: ${policy.description}`,
            trigger: {
              source: 'policy',
              sourceId: policy.id,
              reason: policy.name,
              context: event.data as Record<string, unknown>,
            },
            config: {
              priority: action.gatePriority || 'normal',
              approverTypes: action.requireHuman ? ['human'] : ['human', 'agent'],
              timeoutMs: action.gateTimeout || 300000,
              fallbackBehavior: 'reject',
            },
          });
          break;
          
        case 'block':
          this.emitEvent('action:blocked', {
            policyId: policy.id,
            reason: action.blockReason,
            duration: action.blockDuration,
          });
          break;
          
        case 'notify':
          this.emitEvent('notification', {
            level: action.notificationLevel || 'info',
            message: action.notificationMessage || policy.name,
            policyId: policy.id,
          });
          break;
          
        case 'prepare-resource':
          this.emitEvent('resource:prepare', {
            type: action.resourceType,
            id: action.resourceId,
            policyId: policy.id,
          });
          break;
          
        case 'log':
          console.log(`[PolicyEngine] ${policy.name}: ${JSON.stringify(event.data)}`);
          break;
          
        case 'custom':
          if (action.customHandler) {
            const handler = this.customHandlers.get(action.customHandler);
            if (handler) {
              await handler({
                policy,
                event,
                action,
              });
            }
          }
          break;
      }
      
      return { result: 'executed' };
      
    } catch (err) {
      return { 
        result: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
  
  private recordMatch(policy: Policy, event: AtlasEvent): void {
    const match: PolicyMatch = {
      policyId: policy.id,
      policyName: policy.name,
      matchedConditions: [],
      triggerEvent: event,
      timestamp: Date.now(),
    };
    
    this.evaluationHistory.push(match);
    
    // Keep last 1000 matches
    if (this.evaluationHistory.length > 1000) {
      this.evaluationHistory = this.evaluationHistory.slice(-1000);
    }
  }
  
  // ============ History & Stats ============
  
  /**
   * Get recent policy matches
   */
  getRecentMatches(limit = 100): PolicyMatch[] {
    return this.evaluationHistory.slice(-limit);
  }
  
  /**
   * Get match statistics
   */
  getStats(): PolicyStats {
    const stats: PolicyStats = {
      totalPolicies: this.policies.size,
      enabledPolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
      totalEvaluations: this.evaluationHistory.length,
      matchesByPolicy: {},
      matchesByCategory: {},
    };
    
    for (const match of this.evaluationHistory) {
      stats.matchesByPolicy[match.policyId] = 
        (stats.matchesByPolicy[match.policyId] || 0) + 1;
      
      const policy = this.policies.get(match.policyId);
      if (policy) {
        stats.matchesByCategory[policy.category] = 
          (stats.matchesByCategory[policy.category] || 0) + 1;
      }
    }
    
    return stats;
  }
  
  // ============ Events ============
  
  private emitEvent(type: string, data: Record<string, unknown>): void {
    const event: PolicyEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: Date.now(),
      data,
    };
    
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (err) {
        console.error('[PolicyEngine] Event subscriber error:', err);
      }
    }
  }
  
  onEvent(callback: (event: PolicyEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

// ============ Event Types ============

export interface PolicyEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface PolicyContext {
  policy: Policy;
  event: AtlasEvent;
  action: PolicyActionConfig;
}

export interface PolicyStats {
  totalPolicies: number;
  enabledPolicies: number;
  totalEvaluations: number;
  matchesByPolicy: Record<string, number>;
  matchesByCategory: Record<string, number>;
}

// ============ Default Policies ============

export const DEFAULT_POLICIES: Policy[] = [
  {
    id: 'security-secrets',
    name: 'Secret Detection',
    description: 'Detect potential secrets or credentials in content',
    category: 'security',
    enabled: true,
    priority: 1,
    triggers: {
      eventTypes: ['context:passed', 'file:*'],
    },
    conditions: {
      any: [
        { field: 'event.data.content', type: 'matches', value: '(password|secret|api[_-]?key|token|credential)\\s*[:=]' },
        { field: 'event.data.content', type: 'matches', value: '(sk-|pk_|rk_)[a-zA-Z0-9]{20,}' },
        { field: 'event.data.content', type: 'matches', value: 'AKIA[0-9A-Z]{16}' },
      ],
    },
    actions: [
      { type: 'trigger-agent', agentId: 'security-agent', agentTrigger: 'on-request' },
      { type: 'create-gate', gateName: 'Secret Detected', gatePriority: 'critical', requireHuman: true },
      { type: 'notify', notificationLevel: 'critical', notificationMessage: 'Potential secret detected in content' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0',
    tags: ['security', 'secrets', 'built-in'],
  },
  {
    id: 'safeguarding-harmful',
    name: 'Harmful Content Detection',
    description: 'Detect potentially harmful or inappropriate content',
    category: 'safeguarding',
    enabled: true,
    priority: 1,
    triggers: {
      eventTypes: ['chat:*', 'context:passed'],
    },
    conditions: {
      any: [
        { field: 'event.data.content', type: 'matches', value: '\\b(harm|hurt|kill|attack)\\s+(self|myself|people|someone)\\b' },
      ],
    },
    actions: [
      { type: 'create-gate', gateName: 'Content Review', gatePriority: 'critical', requireHuman: true },
      { type: 'block', blockReason: 'Content flagged for review' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0',
    tags: ['safeguarding', 'content', 'built-in'],
  },
  {
    id: 'resource-large-file',
    name: 'Large File Warning',
    description: 'Warn when processing large files',
    category: 'resource',
    enabled: true,
    priority: 5,
    triggers: {
      eventTypes: ['file:*'],
    },
    conditions: {
      all: [
        { field: 'event.data.size', type: 'greater-than', value: 10485760 }, // 10MB
      ],
    },
    actions: [
      { type: 'trigger-agent', agentId: 'resource-agent', agentTrigger: 'on-request' },
      { type: 'notify', notificationLevel: 'warning', notificationMessage: 'Processing large file - may impact performance' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0',
    tags: ['resource', 'performance', 'built-in'],
  },
  {
    id: 'workflow-destructive',
    name: 'Destructive Operation Warning',
    description: 'Require confirmation for destructive operations',
    category: 'workflow',
    enabled: true,
    priority: 2,
    triggers: {
      eventTypes: ['command:*', 'action:*'],
    },
    conditions: {
      any: [
        { field: 'event.data.command', type: 'matches', value: '\\b(rm|delete|drop|truncate|destroy)\\b.*(-rf|-r|--force|--recursive)' },
        { field: 'event.data.action', type: 'in-list', value: ['delete-all', 'format', 'reset', 'wipe'] },
      ],
    },
    actions: [
      { type: 'create-gate', gateName: 'Destructive Operation', gatePriority: 'high', requireHuman: true, gateTimeout: 60000 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0',
    tags: ['workflow', 'safety', 'built-in'],
  },
];

// ============ Singleton ============

let policyEngine: PolicyEngineService | null = null;

export function getPolicyEngine(): PolicyEngineService {
  if (!policyEngine) {
    policyEngine = new PolicyEngineService();
    
    // Register default policies
    for (const policy of DEFAULT_POLICIES) {
      policyEngine.registerPolicy(policy);
    }
  }
  return policyEngine;
}

export function initPolicyEngine(): PolicyEngineService {
  return getPolicyEngine();
}
