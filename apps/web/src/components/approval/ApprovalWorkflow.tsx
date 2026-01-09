/**
 * Approval Workflow Components
 * 
 * Two modes:
 * 1. Inline approval - for low/medium risk actions, appears in chat flow
 * 2. Full-screen overlay - for high/critical risk actions, requires explicit confirmation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ApprovalRequest, ToolRiskLevel, getToolExecutor } from '../../services/agentTools';
import { getAuditLog } from '../../services/auditLog';

// ============ Inline Approval Component ============

interface InlineApprovalProps {
  request: ApprovalRequest;
  onApprove: () => void;
  onReject: (reason?: string) => void;
}

export const InlineApproval: React.FC<InlineApprovalProps> = ({
  request,
  onApprove,
  onReject,
}) => {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const riskColors: Record<ToolRiskLevel, string> = {
    safe: 'bg-green-500/10 border-green-500/30 text-green-400',
    low: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    high: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  const timeRemaining = Math.max(0, Math.floor((request.expiresAt - Date.now()) / 1000));

  const handleReject = () => {
    if (rejecting) {
      onReject(rejectReason || undefined);
    } else {
      setRejecting(true);
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${riskColors[request.riskLevel]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span className="font-medium">Approval Required</span>
        </div>
        <span className="text-xs opacity-70">
          Expires in {timeRemaining}s
        </span>
      </div>

      <div className="mb-3">
        <div className="text-sm font-mono mb-1">{request.toolName}</div>
        <div className="text-xs opacity-80">{request.reason}</div>
      </div>

      <details className="mb-3">
        <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
          View Parameters
        </summary>
        <pre className="mt-2 p-2 bg-black/30 rounded text-xs overflow-auto max-h-32">
          {JSON.stringify(request.params, null, 2)}
        </pre>
      </details>

      {rejecting && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full bg-black/30 border border-current/30 rounded px-2 py-1 text-sm"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
        >
          ✓ Approve
        </button>
        <button
          onClick={handleReject}
          className="flex-1 bg-red-600/50 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
        >
          ✕ {rejecting ? 'Confirm Reject' : 'Reject'}
        </button>
      </div>
    </div>
  );
};

// ============ Full-Screen Overlay Approval ============

interface OverlayApprovalProps {
  request: ApprovalRequest;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onCancel: () => void;
}

export const OverlayApproval: React.FC<OverlayApprovalProps> = ({
  request,
  onApprove,
  onReject,
  onCancel,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const expectedConfirmText = request.riskLevel === 'critical' 
    ? 'I UNDERSTAND THE RISKS'
    : 'CONFIRM';

  const canApprove = confirmText === expectedConfirmText;
  const timeRemaining = Math.max(0, Math.floor((request.expiresAt - Date.now()) / 1000));

  // Countdown timer
  const [countdown, setCountdown] = useState(timeRemaining);
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onCancel]);

  const riskInfo = {
    high: {
      icon: '⚠️',
      title: 'High Risk Action',
      description: 'This action may affect system stability or data integrity.',
      color: 'from-orange-900/90 to-orange-950/95',
      borderColor: 'border-orange-500',
    },
    critical: {
      icon: '🚨',
      title: 'Critical Risk Action',
      description: 'This action could cause irreversible changes or security implications.',
      color: 'from-red-900/90 to-red-950/95',
      borderColor: 'border-red-500',
    },
  };

  const info = riskInfo[request.riskLevel as 'high' | 'critical'] || riskInfo.high;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-xl mx-4 bg-gradient-to-b ${info.color} border-2 ${info.borderColor} rounded-xl shadow-2xl`}>
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{info.icon}</span>
              <div>
                <h2 className="text-xl font-bold text-white">{info.title}</h2>
                <p className="text-sm text-white/70">{info.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/50">Expires in</div>
              <div className={`text-2xl font-mono font-bold ${countdown < 30 ? 'text-red-400' : 'text-white'}`}>
                {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Tool info */}
          <div className="bg-black/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/50 text-sm">Tool</span>
              <span className="font-mono text-white">{request.toolName}</span>
            </div>
            <div className="text-white/70 text-sm">{request.reason}</div>
          </div>

          {/* Parameters */}
          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-white/50 text-sm mb-2">Parameters</div>
            <pre className="text-sm text-white/90 overflow-auto max-h-40">
              {JSON.stringify(request.params, null, 2)}
            </pre>
          </div>

          {/* Audit trail note */}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>🔐</span>
            <span>This action will be cryptographically signed and logged</span>
          </div>

          {/* Confirmation input */}
          {!showRejectForm ? (
            <div className="space-y-2">
              <label className="block text-sm text-white/70">
                Type <span className="font-mono bg-white/10 px-1 rounded">{expectedConfirmText}</span> to approve:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50"
                placeholder="Type confirmation text..."
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm text-white/70">
                Reason for rejection (optional):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50 h-24 resize-none"
                placeholder="Enter reason..."
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          {!showRejectForm ? (
            <>
              <button
                onClick={onApprove}
                disabled={!canApprove}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  canApprove 
                    ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                ✓ Approve Action
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="flex-1 py-3 rounded-lg font-medium bg-red-600/50 hover:bg-red-600 text-white transition-colors"
              >
                ✕ Reject
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onReject(rejectReason || undefined)}
                className="flex-1 py-3 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                ✕ Confirm Rejection
              </button>
              <button
                onClick={() => setShowRejectForm(false)}
                className="flex-1 py-3 rounded-lg font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                ← Back
              </button>
            </>
          )}
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ============ Approval Manager Hook ============

interface PendingApproval {
  request: ApprovalRequest;
  resolve: (approved: boolean) => void;
}

export function useApprovalWorkflow() {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [overlayApproval, setOverlayApproval] = useState<PendingApproval | null>(null);

  // Process approval requests from tool executor
  useEffect(() => {
    const executor = getToolExecutor();
    
    const checkPending = () => {
      const pending = executor.getPendingApprovals();
      // Update state if there are new pending requests
      setPendingApprovals(prev => {
        const existingIds = new Set(prev.map(p => p.request.id));
        const newRequests = pending.filter(r => !existingIds.has(r.id));
        
        if (newRequests.length === 0) return prev;
        
        return [
          ...prev,
          ...newRequests.map(request => ({
            request,
            resolve: () => {}, // Will be set properly when handled
          })),
        ];
      });
    };

    // Check initially and periodically
    checkPending();
    const interval = setInterval(checkPending, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Determine which approval to show as overlay
  useEffect(() => {
    if (overlayApproval) return; // Already showing overlay
    
    const highRiskApproval = pendingApprovals.find(
      p => p.request.riskLevel === 'high' || p.request.riskLevel === 'critical'
    );
    
    if (highRiskApproval) {
      setOverlayApproval(highRiskApproval);
    }
  }, [pendingApprovals, overlayApproval]);

  const handleApprove = useCallback(async (approvalId: string) => {
    const executor = getToolExecutor();
    const auditLog = await getAuditLog();
    
    await auditLog.logApprovalDecision(approvalId, true);
    await executor.approveRequest(approvalId);
    
    setPendingApprovals(prev => prev.filter(p => p.request.id !== approvalId));
    setOverlayApproval(prev => prev?.request.id === approvalId ? null : prev);
  }, []);

  const handleReject = useCallback(async (approvalId: string, reason?: string) => {
    const executor = getToolExecutor();
    const auditLog = await getAuditLog();
    
    await auditLog.logApprovalDecision(approvalId, false, reason);
    await executor.rejectRequest(approvalId, reason);
    
    setPendingApprovals(prev => prev.filter(p => p.request.id !== approvalId));
    setOverlayApproval(prev => prev?.request.id === approvalId ? null : prev);
  }, []);

  const handleCancel = useCallback((approvalId: string) => {
    setOverlayApproval(prev => prev?.request.id === approvalId ? null : prev);
  }, []);

  // Get inline approvals (low/medium risk)
  const inlineApprovals = pendingApprovals.filter(
    p => p.request.riskLevel !== 'high' && p.request.riskLevel !== 'critical'
  );

  return {
    inlineApprovals,
    overlayApproval,
    handleApprove,
    handleReject,
    handleCancel,
    hasPendingApprovals: pendingApprovals.length > 0,
  };
}

// ============ Approval Workflow Provider ============

interface ApprovalWorkflowContextValue {
  requestApproval: (request: ApprovalRequest) => Promise<boolean>;
  inlineApprovals: PendingApproval[];
  overlayApproval: PendingApproval | null;
  handleApprove: (id: string) => Promise<void>;
  handleReject: (id: string, reason?: string) => Promise<void>;
  handleCancel: (id: string) => void;
}

export const ApprovalWorkflowContext = React.createContext<ApprovalWorkflowContextValue | null>(null);

export const ApprovalWorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const workflow = useApprovalWorkflow();

  const requestApproval = useCallback(async (request: ApprovalRequest): Promise<boolean> => {
    // This would be called by the agent when it needs approval
    // For now, we just add it to pending and wait for user interaction
    return new Promise((resolve) => {
      // The actual approval is handled through the workflow
      const checkResult = setInterval(() => {
        const executor = getToolExecutor();
        const pending = executor.getPendingApprovals();
        if (!pending.find(p => p.id === request.id)) {
          clearInterval(checkResult);
          // Check if it was approved (tool was executed)
          resolve(true); // Simplified - in real impl would track actual result
        }
      }, 100);
    });
  }, []);

  const value: ApprovalWorkflowContextValue = {
    requestApproval,
    ...workflow,
  };

  return (
    <ApprovalWorkflowContext.Provider value={value}>
      {children}
      {/* Render overlay if needed */}
      {workflow.overlayApproval && (
        <OverlayApproval
          request={workflow.overlayApproval.request}
          onApprove={() => workflow.handleApprove(workflow.overlayApproval!.request.id)}
          onReject={(reason) => workflow.handleReject(workflow.overlayApproval!.request.id, reason)}
          onCancel={() => workflow.handleCancel(workflow.overlayApproval!.request.id)}
        />
      )}
    </ApprovalWorkflowContext.Provider>
  );
};

export function useApprovalContext() {
  const context = React.useContext(ApprovalWorkflowContext);
  if (!context) {
    throw new Error('useApprovalContext must be used within ApprovalWorkflowProvider');
  }
  return context;
}
