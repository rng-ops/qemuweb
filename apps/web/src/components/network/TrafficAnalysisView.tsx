/**
 * Traffic Analysis View Component
 * 
 * QoS and traffic flow analysis with probabilistic modeling:
 * - Real-time traffic flow visualization
 * - Anomaly detection with confidence scores
 * - Traffic predictions using stochastic models
 * - QoS policy compliance monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  TrafficAnalysis,
  TrafficAnomaly,
  TrafficPrediction,
  QoSComplianceReport,
  QoSPolicy,
  Universe,
} from '../../services/universeStore';
import { universeStore, TrafficAnalyzer } from '../../services/universeStore';

interface TrafficAnalysisViewProps {
  universeId?: string;
  onPolicyCreate?: (policy: Partial<QoSPolicy>) => void;
  onAnomalyAction?: (anomaly: TrafficAnomaly, action: string) => void;
}

export const TrafficAnalysisView: React.FC<TrafficAnalysisViewProps> = ({
  universeId,
  onPolicyCreate,
  onAnomalyAction,
}) => {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [selectedUniverse, setSelectedUniverse] = useState<Universe | null>(null);
  const [analysis, setAnalysis] = useState<TrafficAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Load universes
  useEffect(() => {
    const loadUniverses = async () => {
      await universeStore.init();
      const allUniverses = await universeStore.getAllUniverses();
      setUniverses(allUniverses);
      
      if (universeId) {
        const universe = allUniverses.find(u => u.id === universeId);
        setSelectedUniverse(universe || null);
      } else if (allUniverses.length > 0) {
        setSelectedUniverse(allUniverses[0]);
      }
      
      setLoading(false);
    };
    
    loadUniverses();
  }, [universeId]);

  // Run analysis
  const runAnalysis = useCallback(async () => {
    if (!selectedUniverse) return;
    
    const analyzer = new TrafficAnalyzer(selectedUniverse.id);
    const flows = await universeStore.getFlowsByRouter(
      selectedUniverse.routers[0]?.id || ''
    );
    
    // Add sample data for demo
    analyzer.addSample({
      timestamp: Date.now(),
      bandwidthIn: Math.random() * 1000000,
      bandwidthOut: Math.random() * 800000,
      latency: 10 + Math.random() * 50,
      connections: Math.floor(Math.random() * 100),
    });
    
    const result = await analyzer.analyze(flows);
    setAnalysis(result);
    
    // Save analysis
    await universeStore.saveAnalysis(result);
  }, [selectedUniverse]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !selectedUniverse) return;
    
    const interval = setInterval(runAnalysis, refreshInterval);
    runAnalysis(); // Initial run
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, selectedUniverse, runAnalysis]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
          <span className="text-sm text-gray-400">Loading traffic analysis...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <TrafficIcon className="w-5 h-5 text-cyan-400" />
            Traffic Analysis
          </h2>
          
          {/* Universe Selector */}
          <select
            value={selectedUniverse?.id || ''}
            onChange={(e) => {
              const u = universes.find(u => u.id === e.target.value);
              setSelectedUniverse(u || null);
            }}
            className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm"
          >
            {universes.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
            {universes.length === 0 && (
              <option value="">No universes</option>
            )}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            Auto-refresh
          </label>
          
          {/* Refresh interval */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
            className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm disabled:opacity-50"
          >
            <option value={1000}>1s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>
          
          {/* Manual refresh */}
          <button
            onClick={runAnalysis}
            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {analysis ? (
          <div className="grid grid-cols-3 gap-4">
            {/* Left Column - Stats & Flows */}
            <div className="space-y-4">
              {/* Flow Stats */}
              <StatsCard analysis={analysis} />
              
              {/* Top Talkers */}
              <TopTalkersCard
                talkers={analysis.topTalkers}
                protocols={analysis.topProtocols}
                ports={analysis.topPorts}
              />
            </div>

            {/* Center Column - QoS & Compliance */}
            <div className="space-y-4">
              {/* QoS Compliance */}
              <QoSComplianceCard
                compliance={analysis.qosCompliance}
                onPolicyCreate={onPolicyCreate}
              />
              
              {/* Active Policies */}
              {selectedUniverse && (
                <PoliciesCard
                  policies={selectedUniverse.qosPolicies}
                  violations={analysis.qosCompliance.violations}
                />
              )}
            </div>

            {/* Right Column - Anomalies & Predictions */}
            <div className="space-y-4">
              {/* Anomalies */}
              <AnomaliesCard
                anomalies={analysis.anomalies}
                onAction={onAnomalyAction}
              />
              
              {/* Predictions */}
              <PredictionsCard predictions={analysis.predictions} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {selectedUniverse 
              ? 'Waiting for traffic data...'
              : 'Select a universe to analyze'}
          </div>
        )}
      </div>
    </div>
  );
};

// Stats Card
const StatsCard: React.FC<{ analysis: TrafficAnalysis }> = ({ analysis }) => (
  <div className="bg-gray-800 rounded-lg p-4">
    <h3 className="text-sm font-medium text-gray-400 mb-3">Flow Statistics</h3>
    <div className="grid grid-cols-2 gap-3">
      <StatItem
        label="Total Flows"
        value={analysis.totalFlows}
        icon={<FlowIcon className="w-4 h-4 text-blue-400" />}
      />
      <StatItem
        label="Active Flows"
        value={analysis.activeFlows}
        icon={<ActiveIcon className="w-4 h-4 text-green-400" />}
      />
      <StatItem
        label="Anomalies"
        value={analysis.anomalies.length}
        icon={<WarningIcon className="w-4 h-4 text-yellow-400" />}
        alert={analysis.anomalies.length > 0}
      />
      <StatItem
        label="Predictions"
        value={analysis.predictions.length}
        icon={<PredictIcon className="w-4 h-4 text-purple-400" />}
      />
    </div>
  </div>
);

const StatItem: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  alert?: boolean;
}> = ({ label, value, icon, alert }) => (
  <div className={`flex items-center gap-2 p-2 rounded ${alert ? 'bg-yellow-900/20' : 'bg-gray-700/50'}`}>
    {icon}
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-medium ${alert ? 'text-yellow-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  </div>
);

// Top Talkers Card
const TopTalkersCard: React.FC<{
  talkers: { ip: string; bytes: number }[];
  protocols: { protocol: string; bytes: number }[];
  ports: { port: number; bytes: number }[];
}> = ({ talkers, protocols, ports }) => {
  const [tab, setTab] = useState<'talkers' | 'protocols' | 'ports'>('talkers');

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {['talkers', 'protocols', 'ports'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={`px-2 py-1 text-xs rounded ${
              tab === t ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="space-y-2">
        {tab === 'talkers' && talkers.slice(0, 5).map((t, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-300 font-mono">{t.ip}</span>
            <span className="text-gray-400">{formatBytes(t.bytes)}</span>
          </div>
        ))}
        {tab === 'protocols' && protocols.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-300 uppercase">{p.protocol}</span>
            <span className="text-gray-400">{formatBytes(p.bytes)}</span>
          </div>
        ))}
        {tab === 'ports' && ports.slice(0, 5).map((p, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Port {p.port}</span>
            <span className="text-gray-400">{formatBytes(p.bytes)}</span>
          </div>
        ))}
        {(tab === 'talkers' && talkers.length === 0) ||
         (tab === 'protocols' && protocols.length === 0) ||
         (tab === 'ports' && ports.length === 0) ? (
          <div className="text-xs text-gray-500 text-center py-4">No data</div>
        ) : null}
      </div>
    </div>
  );
};

// QoS Compliance Card
const QoSComplianceCard: React.FC<{
  compliance: QoSComplianceReport;
  onPolicyCreate?: (policy: Partial<QoSPolicy>) => void;
}> = ({ compliance, onPolicyCreate }) => {
  const scoreColor = compliance.overallScore >= 90 ? 'text-green-400' :
    compliance.overallScore >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">QoS Compliance</h3>
        {onPolicyCreate && (
          <button
            onClick={() => onPolicyCreate({})}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            + Add Policy
          </button>
        )}
      </div>
      
      {/* Score Circle */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#374151"
              strokeWidth="8"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke={compliance.overallScore >= 90 ? '#10B981' :
                compliance.overallScore >= 70 ? '#F59E0B' : '#EF4444'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${compliance.overallScore * 2.83} 283`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>
              {Math.round(compliance.overallScore)}%
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between text-sm text-gray-400">
        <span>{compliance.policiesCompliant}/{compliance.policiesEvaluated} policies OK</span>
        <span className="text-red-400">{compliance.violations.length} violations</span>
      </div>
      
      {/* Violations */}
      {compliance.violations.length > 0 && (
        <div className="mt-3 space-y-2">
          {compliance.violations.slice(0, 3).map((v, i) => (
            <div key={i} className="p-2 bg-red-900/20 rounded text-xs">
              <div className="flex items-center justify-between">
                <span className="text-red-300">{v.policyName}</span>
                <span className="text-red-400">{v.violationType}</span>
              </div>
              <div className="text-gray-400 mt-1">
                {v.currentValue.toFixed(1)} / {v.targetValue} target
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Policies Card
const PoliciesCard: React.FC<{
  policies: QoSPolicy[];
  violations: QoSComplianceReport['violations'];
}> = ({ policies, violations }) => (
  <div className="bg-gray-800 rounded-lg p-4">
    <h3 className="text-sm font-medium text-gray-400 mb-3">Active Policies</h3>
    <div className="space-y-2">
      {policies.filter(p => p.enabled).map((policy) => {
        const hasViolation = violations.some(v => v.policyId === policy.id);
        return (
          <div
            key={policy.id}
            className={`p-2 rounded ${hasViolation ? 'bg-red-900/20' : 'bg-gray-700/50'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200">{policy.name}</span>
              {hasViolation ? (
                <span className="text-xs text-red-400">Violated</span>
              ) : (
                <span className="text-xs text-green-400">OK</span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {policy.rateLimit && `Rate: ${policy.rateLimit} kbps`}
              {policy.latencyTarget && ` | Latency: ${policy.latencyTarget}ms`}
            </div>
          </div>
        );
      })}
      {policies.filter(p => p.enabled).length === 0 && (
        <div className="text-xs text-gray-500 text-center py-4">No active policies</div>
      )}
    </div>
  </div>
);

// Anomalies Card
const AnomaliesCard: React.FC<{
  anomalies: TrafficAnomaly[];
  onAction?: (anomaly: TrafficAnomaly, action: string) => void;
}> = ({ anomalies, onAction }) => {
  const severityColors = {
    low: 'border-blue-500 bg-blue-900/20',
    medium: 'border-yellow-500 bg-yellow-900/20',
    high: 'border-orange-500 bg-orange-900/20',
    critical: 'border-red-500 bg-red-900/20',
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <WarningIcon className="w-4 h-4 text-yellow-400" />
        Anomaly Detection
      </h3>
      <div className="space-y-2">
        {anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className={`p-2 rounded border-l-4 ${severityColors[anomaly.severity]}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-200 capitalize">
                {anomaly.type}
              </span>
              <span className="text-xs text-gray-400">
                {(anomaly.probability * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="text-xs text-gray-300">{anomaly.description}</p>
            {anomaly.suggestedAction && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">{anomaly.suggestedAction}</span>
                {onAction && (
                  <button
                    onClick={() => onAction(anomaly, 'apply')}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Apply
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {anomalies.length === 0 && (
          <div className="text-xs text-green-400 text-center py-4 flex items-center justify-center gap-2">
            <CheckIcon className="w-4 h-4" />
            No anomalies detected
          </div>
        )}
      </div>
    </div>
  );
};

// Predictions Card
const PredictionsCard: React.FC<{ predictions: TrafficPrediction[] }> = ({ predictions }) => (
  <div className="bg-gray-800 rounded-lg p-4">
    <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
      <PredictIcon className="w-4 h-4 text-purple-400" />
      Traffic Predictions
    </h3>
    <div className="space-y-2">
      {predictions.map((pred) => (
        <div
          key={pred.id}
          className="p-2 bg-purple-900/20 rounded border-l-4 border-purple-500"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-200 capitalize">
              {pred.type}
            </span>
            <span className="text-xs text-purple-400">
              {(pred.probability * 100).toFixed(0)}% likely
            </span>
          </div>
          <p className="text-xs text-gray-300">{pred.prediction}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
            <span>{pred.timeframe}</span>
            <span>Based on: {pred.basedOn}</span>
          </div>
        </div>
      ))}
      {predictions.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-4">
          Collecting data for predictions...
        </div>
      )}
    </div>
  </div>
);

// Icons
const TrafficIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const FlowIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const ActiveIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const PredictIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export default TrafficAnalysisView;
