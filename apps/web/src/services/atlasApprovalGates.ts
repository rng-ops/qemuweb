/**
 * Atlas Approval Gates System
 * 
 * Provides a blocking mechanism that can pause actions until:
 * - Human intervention (manual approval)
 * - External process resolution (automated approval)
 * - Timeout with fallback behavior
 * 
 * Used for:
 * - Security-sensitive operations
 * - Safeguarding concerns
 * - Resource-intensive actions
 * - Policy violations that need review
 */

import type { MatrixMessage } from './atlasAgentMatrix';

// ============ Types ============

export type GateStatus = 
  | 'open'       // No blocking, action can proceed
  | 'pending'    // Waiting for approval
  | 'approved'   // Approved, can proceed
  | 'rejected'   // Rejected, action blocked
  | 'timeout'    // Timed out, fallback behavior
  | 'escalated'; // Escalated to higher authority

export type GatePriority = 'critical' | 'high' | 'normal' | 'low';

export type ApproverType = 
  | 'human'           // Requires manual human approval
  | 'agent'           // Another agent can approve
  | 'external'        // External service/process
  | 'automated'       // Automated rules-based approval
  | 'any';            // Any approver type

export interface ApprovalGate {
  id: string;
  name: string;
  description: string;
  
  // What triggered this gate
  trigger: {
    source: 'agent' | 'policy' | 'system' | 'user';
    sourceId: string;
    reason: string;
    context: Record<string, unknown>;
  };
  
  // Gate configuration
  config: {
    priority: GatePriority;
    requiredApprovers: number;       // How many approvals needed
    approverTypes: ApproverType[];   // Who can approve
    allowedApprovers?: string[];     // Specific approver IDs
    timeoutMs: number;               // Auto-timeout duration
    fallbackBehavior: 'reject' | 'approve' | 'escalate';
    escalateTo?: string;             // Where to escalate
  };
  
  // Current state
  status: GateStatus;
  createdAt: number;
  expiresAt: number;
  
  // Approval tracking
  approvals: GateApproval[];
  rejections: GateRejection[];
  
  // Related data
  relatedMessages: string[];         // Matrix message IDs
  blockedActions: BlockedAction[];   // Actions waiting on this gate
}

export interface GateApproval {
  id: string;
  gateid: string;
  approverType: ApproverType;
  approverId: string;
  approverName: string;
  timestamp: number;
  reason?: string;
  conditions?: string[];             // Conditions attached to approval
}

export interface GateRejection {
  id: string;
  gateId: string;
  rejectorType: ApproverType;
  rejectorId: string;
  rejectorName: string;
  timestamp: number;
  reason: string;
  suggestedAction?: string;
}

export interface BlockedAction {
  id: string;
  type: string;                      // Action type
  description: string;
  payload: Record<string, unknown>;
  createdAt: number;
  
  // Callbacks
  onApproved?: () => Promise<void>;
  onRejected?: (reason: string) => Promise<void>;
  onTimeout?: () => Promise<void>;
}

// ============ Gate Events ============

export type GateEventType = 
  | 'gate:created'
  | 'gate:pending'
  | 'gate:approved'
  | 'gate:rejected'
  | 'gate:timeout'
  | 'gate:escalated'
  | 'gate:closed'
  | 'action:blocked'
  | 'action:released'
  | 'approval:received'
  | 'rejection:received';

export interface GateEvent {
  id: string;
  type: GateEventType;
  timestamp: number;
  gateId: string;
  data: Record<string, unknown>;
}

// ============ Approval Gates Service ============

class ApprovalGatesService {
  private gates = new Map<string, ApprovalGate>();
  private actionCallbacks = new Map<string, BlockedAction>();
  private subscribers = new Set<(event: GateEvent) => void>();
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();
  
  // ============ Gate Creation ============
  
  /**
   * Create a new approval gate
   */
  createGate(params: {
    name: string;
    description: string;
    trigger: ApprovalGate['trigger'];
    config: Partial<ApprovalGate['config']>;
  }): ApprovalGate {
    const id = `gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    
    const config: ApprovalGate['config'] = {
      priority: params.config.priority ?? 'normal',
      requiredApprovers: params.config.requiredApprovers ?? 1,
      approverTypes: params.config.approverTypes ?? ['human'],
      allowedApprovers: params.config.allowedApprovers,
      timeoutMs: params.config.timeoutMs ?? 300000, // 5 minutes default
      fallbackBehavior: params.config.fallbackBehavior ?? 'reject',
      escalateTo: params.config.escalateTo,
    };
    
    const gate: ApprovalGate = {
      id,
      name: params.name,
      description: params.description,
      trigger: params.trigger,
      config,
      status: 'pending',
      createdAt: now,
      expiresAt: now + config.timeoutMs,
      approvals: [],
      rejections: [],
      relatedMessages: [],
      blockedActions: [],
    };
    
    this.gates.set(id, gate);
    this.emitEvent('gate:created', gate.id, { name: gate.name, priority: config.priority });
    this.emitEvent('gate:pending', gate.id, { expiresAt: gate.expiresAt });
    
    // Set timeout
    this.scheduleTimeout(gate);
    
    console.log(`[ApprovalGates] Created gate: ${gate.name} (${gate.id})`);
    return gate;
  }
  
  /**
   * Create a gate from a matrix message with approval request
   */
  createGateFromMessage(message: MatrixMessage): ApprovalGate | null {
    if (!message.approval?.required) return null;
    
    return this.createGate({
      name: `Approval: ${message.type}`,
      description: message.content.text,
      trigger: {
        source: 'agent',
        sourceId: message.fromAgent,
        reason: message.content.text,
        context: message.content.structured || {},
      },
      config: {
        priority: message.content.severity === 'critical' ? 'critical' : 'normal',
        approverTypes: ['human', 'agent'],
        timeoutMs: 300000,
        fallbackBehavior: 'reject',
      },
    });
  }
  
  // ============ Gate Operations ============
  
  /**
   * Submit an approval for a gate
   */
  approve(gateId: string, approval: Omit<GateApproval, 'id' | 'gateid' | 'timestamp'>): boolean {
    const gate = this.gates.get(gateId);
    if (!gate || gate.status !== 'pending') {
      console.warn(`[ApprovalGates] Cannot approve gate ${gateId}: ${gate?.status || 'not found'}`);
      return false;
    }
    
    // Validate approver
    if (!this.isValidApprover(gate, approval.approverType, approval.approverId)) {
      console.warn(`[ApprovalGates] Invalid approver for gate ${gateId}`);
      return false;
    }
    
    const fullApproval: GateApproval = {
      ...approval,
      id: `appr-${Date.now()}`,
      gateid: gateId,
      timestamp: Date.now(),
    };
    
    gate.approvals.push(fullApproval);
    this.emitEvent('approval:received', gateId, { 
      approverId: approval.approverId,
      approverType: approval.approverType,
    });
    
    // Check if we have enough approvals
    if (gate.approvals.length >= gate.config.requiredApprovers) {
      this.resolveGate(gate, 'approved');
    }
    
    return true;
  }
  
  /**
   * Submit a rejection for a gate
   */
  reject(gateId: string, rejection: Omit<GateRejection, 'id' | 'gateId' | 'timestamp'>): boolean {
    const gate = this.gates.get(gateId);
    if (!gate || gate.status !== 'pending') {
      return false;
    }
    
    const fullRejection: GateRejection = {
      ...rejection,
      id: `rej-${Date.now()}`,
      gateId,
      timestamp: Date.now(),
    };
    
    gate.rejections.push(fullRejection);
    this.emitEvent('rejection:received', gateId, { 
      rejectorId: rejection.rejectorId,
      reason: rejection.reason,
    });
    
    // Any rejection immediately rejects the gate
    this.resolveGate(gate, 'rejected');
    
    return true;
  }
  
  /**
   * Escalate a gate to higher authority
   */
  escalate(gateId: string, reason: string): boolean {
    const gate = this.gates.get(gateId);
    if (!gate || gate.status !== 'pending') {
      return false;
    }
    
    gate.status = 'escalated';
    this.clearTimeout(gateId);
    this.emitEvent('gate:escalated', gateId, { 
      reason,
      escalateTo: gate.config.escalateTo,
    });
    
    return true;
  }
  
  // ============ Blocking Actions ============
  
  /**
   * Block an action pending gate approval
   */
  blockAction(gateId: string, action: Omit<BlockedAction, 'id' | 'createdAt'>): string {
    const gate = this.gates.get(gateId);
    if (!gate) {
      throw new Error(`Gate ${gateId} not found`);
    }
    
    const blockedAction: BlockedAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    
    gate.blockedActions.push(blockedAction);
    this.actionCallbacks.set(blockedAction.id, blockedAction);
    
    this.emitEvent('action:blocked', gateId, {
      actionId: blockedAction.id,
      actionType: action.type,
    });
    
    console.log(`[ApprovalGates] Blocked action: ${action.type} on gate ${gateId}`);
    return blockedAction.id;
  }
  
  /**
   * Wait for a gate to be resolved
   */
  async waitForGate(gateId: string): Promise<GateStatus> {
    const gate = this.gates.get(gateId);
    if (!gate) {
      throw new Error(`Gate ${gateId} not found`);
    }
    
    if (gate.status !== 'pending') {
      return gate.status;
    }
    
    return new Promise((resolve) => {
      const unsubscribe = this.onEvent((event) => {
        if (event.gateId === gateId && 
            (event.type === 'gate:approved' || 
             event.type === 'gate:rejected' || 
             event.type === 'gate:timeout' ||
             event.type === 'gate:escalated')) {
          unsubscribe();
          resolve(gate.status);
        }
      });
    });
  }
  
  // ============ Gate Resolution ============
  
  private resolveGate(gate: ApprovalGate, status: 'approved' | 'rejected' | 'timeout'): void {
    gate.status = status;
    this.clearTimeout(gate.id);
    
    this.emitEvent(`gate:${status}` as GateEventType, gate.id, {
      approvals: gate.approvals.length,
      rejections: gate.rejections.length,
    });
    
    // Execute blocked action callbacks
    for (const action of gate.blockedActions) {
      this.emitEvent('action:released', gate.id, { actionId: action.id });
      
      try {
        switch (status) {
          case 'approved':
            action.onApproved?.();
            break;
          case 'rejected': {
            const reason = gate.rejections[0]?.reason || 'Rejected';
            action.onRejected?.(reason);
            break;
          }
          case 'timeout':
            action.onTimeout?.();
            break;
        }
      } catch (err) {
        console.error(`[ApprovalGates] Action callback error:`, err);
      }
      
      this.actionCallbacks.delete(action.id);
    }
    
    console.log(`[ApprovalGates] Gate ${gate.id} resolved: ${status}`);
  }
  
  private scheduleTimeout(gate: ApprovalGate): void {
    const timeout = setTimeout(() => {
      if (gate.status === 'pending') {
        switch (gate.config.fallbackBehavior) {
          case 'approve':
            this.resolveGate(gate, 'approved');
            break;
          case 'escalate':
            this.escalate(gate.id, 'Timeout - auto-escalated');
            break;
          case 'reject':
          default:
            this.resolveGate(gate, 'timeout');
            break;
        }
      }
    }, gate.config.timeoutMs);
    
    this.timeouts.set(gate.id, timeout);
  }
  
  private clearTimeout(gateId: string): void {
    const timeout = this.timeouts.get(gateId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(gateId);
    }
  }
  
  private isValidApprover(gate: ApprovalGate, type: ApproverType, id: string): boolean {
    // Check approver type is allowed
    if (!gate.config.approverTypes.includes(type) && !gate.config.approverTypes.includes('any')) {
      return false;
    }
    
    // Check specific approver list if configured
    if (gate.config.allowedApprovers && !gate.config.allowedApprovers.includes(id)) {
      return false;
    }
    
    // Check not already approved/rejected by this approver
    if (gate.approvals.some(a => a.approverId === id)) {
      return false;
    }
    if (gate.rejections.some(r => r.rejectorId === id)) {
      return false;
    }
    
    return true;
  }
  
  // ============ Gate Queries ============
  
  /**
   * Get all gates
   */
  getGates(): ApprovalGate[] {
    return Array.from(this.gates.values());
  }
  
  /**
   * Get pending gates
   */
  getPendingGates(): ApprovalGate[] {
    return Array.from(this.gates.values()).filter(g => g.status === 'pending');
  }
  
  /**
   * Get gate by ID
   */
  getGate(gateId: string): ApprovalGate | undefined {
    return this.gates.get(gateId);
  }
  
  /**
   * Get gates by priority
   */
  getGatesByPriority(priority: GatePriority): ApprovalGate[] {
    return Array.from(this.gates.values()).filter(g => g.config.priority === priority);
  }
  
  /**
   * Check if any critical gates are pending
   */
  hasCriticalPendingGates(): boolean {
    return Array.from(this.gates.values()).some(
      g => g.status === 'pending' && g.config.priority === 'critical'
    );
  }
  
  /**
   * Clean up old resolved gates
   */
  cleanup(olderThanMs = 3600000): number {
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;
    
    for (const [id, gate] of this.gates) {
      if (gate.status !== 'pending' && gate.createdAt < cutoff) {
        this.gates.delete(id);
        removed++;
      }
    }
    
    return removed;
  }
  
  // ============ Events ============
  
  private emitEvent(type: GateEventType, gateId: string, data: Record<string, unknown>): void {
    const event: GateEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: Date.now(),
      gateId,
      data,
    };
    
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (err) {
        console.error('[ApprovalGates] Event subscriber error:', err);
      }
    }
  }
  
  onEvent(callback: (event: GateEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

// ============ Singleton ============

let gatesService: ApprovalGatesService | null = null;

export function getApprovalGates(): ApprovalGatesService {
  if (!gatesService) {
    gatesService = new ApprovalGatesService();
  }
  return gatesService;
}

export function initApprovalGates(): ApprovalGatesService {
  return getApprovalGates();
}

// ============ Utility Functions ============

/**
 * Create a simple confirmation gate
 */
export function createConfirmationGate(
  action: string,
  reason: string,
  onApproved: () => Promise<void>,
  onRejected?: (reason: string) => Promise<void>
): ApprovalGate {
  const gates = getApprovalGates();
  
  const gate = gates.createGate({
    name: `Confirm: ${action}`,
    description: reason,
    trigger: {
      source: 'system',
      sourceId: 'confirmation',
      reason,
      context: { action },
    },
    config: {
      priority: 'normal',
      approverTypes: ['human'],
      timeoutMs: 60000, // 1 minute
      fallbackBehavior: 'reject',
    },
  });
  
  gates.blockAction(gate.id, {
    type: 'confirmation',
    description: action,
    payload: {},
    onApproved,
    onRejected,
  });
  
  return gate;
}

/**
 * Create a security review gate
 */
export function createSecurityGate(
  concern: string,
  severity: 'high' | 'critical',
  context: Record<string, unknown>,
  onApproved: () => Promise<void>,
  onRejected?: (reason: string) => Promise<void>
): ApprovalGate {
  const gates = getApprovalGates();
  
  const gate = gates.createGate({
    name: `Security Review Required`,
    description: concern,
    trigger: {
      source: 'agent',
      sourceId: 'security-agent',
      reason: concern,
      context,
    },
    config: {
      priority: severity,
      requiredApprovers: severity === 'critical' ? 2 : 1,
      approverTypes: ['human'],
      timeoutMs: severity === 'critical' ? 600000 : 300000, // 10 or 5 minutes
      fallbackBehavior: 'reject',
    },
  });
  
  gates.blockAction(gate.id, {
    type: 'security-review',
    description: concern,
    payload: context,
    onApproved,
    onRejected,
  });
  
  return gate;
}
