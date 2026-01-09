/**
 * Agent Profile Card Component
 * 
 * Displays agent identity with:
 * - Personality profile
 * - Strengths and weaknesses
 * - Skills and certifications
 * - Network identity
 * - Benchmark attestations
 */

import React, { useState, useEffect } from 'react';
import {
  getAgentIdentityManager,
  type AgentIdentity,
  type AgentPersonality,
  type AgentStrength,
  type AgentWeakness,
  type AgentSkill,
  type AgentCertification,
  DEFAULT_PERSONALITIES,
} from '../../services/agentIdentity';
import {
  getPeerNetworkManager,
  type PeerNode,
  type InferenceEndpoint,
  type BenchmarkAttestation,
} from '../../services/peerNetwork';

// ============ Types ============

interface AgentProfileCardProps {
  agentId?: string;
  onSwitchProfile?: (profileId: string) => void;
  onClose?: () => void;
  className?: string;
}

// ============ Sub-Components ============

const PersonalitySection: React.FC<{ personality: AgentPersonality }> = ({ personality }) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
          {personality.avatar || personality.name.charAt(0)}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{personality.name}</h3>
          <p className="text-sm text-zinc-400">{personality.description}</p>
        </div>
      </div>
      
      {/* Personality Traits */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-zinc-300">Personality Traits</h4>
        {personality.traits.map((trait, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">{trait.trait.split('↔')[0].trim()}</span>
              <span className="text-zinc-500">{trait.trait.split('↔')[1]?.trim()}</span>
            </div>
            <div className="relative h-2 bg-zinc-700 rounded-full">
              <div 
                className="absolute top-0 h-2 w-2 rounded-full bg-indigo-500 transform -translate-x-1/2"
                style={{ left: `${(trait.value + 1) * 50}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 text-center">{trait.description}</p>
          </div>
        ))}
      </div>
      
      {/* Communication Style */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-zinc-800 rounded">
          <span className="text-zinc-500">Formality:</span>
          <span className="ml-2 text-zinc-300 capitalize">{personality.communication.formality}</span>
        </div>
        <div className="p-2 bg-zinc-800 rounded">
          <span className="text-zinc-500">Verbosity:</span>
          <span className="ml-2 text-zinc-300 capitalize">{personality.communication.verbosity}</span>
        </div>
        <div className="p-2 bg-zinc-800 rounded">
          <span className="text-zinc-500">Tone:</span>
          <span className="ml-2 text-zinc-300 capitalize">{personality.communication.tone}</span>
        </div>
        <div className="p-2 bg-zinc-800 rounded">
          <span className="text-zinc-500">Style:</span>
          <span className="ml-2 text-zinc-300 capitalize">{personality.communication.responseStyle}</span>
        </div>
      </div>
    </div>
  );
};

const StrengthsSection: React.FC<{ strengths: AgentStrength[] }> = ({ strengths }) => {
  const proficiencyColors: Record<string, string> = {
    'novice': 'bg-gray-500',
    'competent': 'bg-blue-500',
    'proficient': 'bg-green-500',
    'expert': 'bg-purple-500',
    'master': 'bg-yellow-500',
  };
  
  const proficiencyWidth: Record<string, string> = {
    'novice': 'w-1/5',
    'competent': 'w-2/5',
    'proficient': 'w-3/5',
    'expert': 'w-4/5',
    'master': 'w-full',
  };
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-green-400 flex items-center gap-2">
        <span>💪</span> Strengths
      </h4>
      {strengths.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No verified strengths yet</p>
      ) : (
        <div className="space-y-2">
          {strengths.map((strength, i) => (
            <div key={i} className="p-2 bg-zinc-800/50 rounded">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-zinc-300">{strength.domain}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${proficiencyColors[strength.proficiency]} text-white`}>
                  {strength.proficiency}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className={`h-full ${proficiencyColors[strength.proficiency]} ${proficiencyWidth[strength.proficiency]}`} />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{strength.description}</p>
              {strength.benchmarkScores && strength.benchmarkScores.length > 0 && (
                <div className="mt-2 text-xs text-zinc-500">
                  <span>Verified by: </span>
                  {strength.benchmarkScores.map(b => b.benchmarkName).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WeaknessesSection: React.FC<{ weaknesses: AgentWeakness[] }> = ({ weaknesses }) => {
  const severityColors: Record<string, string> = {
    'minor': 'text-yellow-400',
    'moderate': 'text-orange-400',
    'significant': 'text-red-400',
  };
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-yellow-400 flex items-center gap-2">
        <span>⚠️</span> Known Limitations
      </h4>
      {weaknesses.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No documented limitations</p>
      ) : (
        <div className="space-y-2">
          {weaknesses.map((weakness, i) => (
            <div key={i} className="p-2 bg-zinc-800/50 rounded border-l-2 border-yellow-500/50">
              <div className="flex justify-between items-start">
                <span className="text-sm text-zinc-300">{weakness.domain}</span>
                <span className={`text-xs ${severityColors[weakness.severity]}`}>
                  {weakness.severity}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">{weakness.description}</p>
              {weakness.mitigations && weakness.mitigations.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-zinc-500">Mitigations: </span>
                  <span className="text-xs text-zinc-400">{weakness.mitigations.join(', ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SkillsSection: React.FC<{ skills: AgentSkill[] }> = ({ skills }) => {
  const categoryIcons: Record<string, string> = {
    'coding': '💻',
    'reasoning': '🧠',
    'analysis': '📊',
    'communication': '💬',
    'domain_knowledge': '📚',
    'tool_use': '🔧',
    'planning': '📋',
    'creativity': '🎨',
  };
  
  const groupedSkills = skills.reduce<Record<string, AgentSkill[]>>((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {});
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2">
        <span>🎯</span> Skills
      </h4>
      {Object.keys(groupedSkills).length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No skills documented</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedSkills).map(([category, categorySkills]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <span>{categoryIcons[category] || '•'}</span>
                <span className="text-xs text-zinc-400 capitalize">{category.replace('_', ' ')}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {categorySkills.map((skill) => (
                  <div 
                    key={skill.id}
                    className="flex items-center gap-2 p-1.5 bg-zinc-800/50 rounded text-xs"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-300">{skill.name}</span>
                        {skill.verified && <span className="text-green-400">✓</span>}
                      </div>
                      <div className="h-1 bg-zinc-700 rounded-full mt-1">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${skill.level}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-zinc-500">{skill.level}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CertificationsSection: React.FC<{ certifications: AgentCertification[] }> = ({ certifications }) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-purple-400 flex items-center gap-2">
        <span>🏆</span> Certifications & Attestations
      </h4>
      {certifications.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No certifications yet</p>
      ) : (
        <div className="space-y-2">
          {certifications.map((cert) => (
            <div 
              key={cert.id}
              className="p-2 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded border border-purple-500/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="text-sm font-medium text-purple-300">{cert.name}</h5>
                  <p className="text-xs text-zinc-500">Issued by: {cert.issuer}</p>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(cert.issuedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {cert.capabilities.map((cap, i) => (
                  <span 
                    key={i}
                    className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded"
                  >
                    {cap}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-xs text-zinc-500 font-mono truncate">
                Proof: {cert.proof.hash.slice(0, 20)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const NetworkIdentitySection: React.FC<{ 
  identity: AgentIdentity;
  peerNode?: PeerNode;
}> = ({ identity, peerNode }) => {
  const [showFullAddress, setShowFullAddress] = useState(false);
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
        <span>🌐</span> Network Identity
      </h4>
      
      {/* Derived Address */}
      <div className="p-2 bg-zinc-800/50 rounded font-mono">
        <div className="text-xs text-zinc-500 mb-1">Derived Address</div>
        <div 
          className="text-sm text-cyan-400 cursor-pointer hover:text-cyan-300"
          onClick={() => setShowFullAddress(!showFullAddress)}
        >
          {showFullAddress 
            ? identity.crypto.derivedAddress 
            : `${identity.crypto.derivedAddress.slice(0, 16)}...`
          }
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          Epoch: {identity.crypto.rotationEpoch} | Version: {identity.crypto.addressVersion}
        </div>
      </div>
      
      {/* Peer Status */}
      {peerNode && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-zinc-800/50 rounded">
            <span className="text-zinc-500">Status:</span>
            <span className={`ml-2 ${
              peerNode.status === 'online' ? 'text-green-400' :
              peerNode.status === 'degraded' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {peerNode.status}
            </span>
          </div>
          <div className="p-2 bg-zinc-800/50 rounded">
            <span className="text-zinc-500">Reputation:</span>
            <span className="ml-2 text-zinc-300">{peerNode.reputation}/100</span>
          </div>
          <div className="p-2 bg-zinc-800/50 rounded">
            <span className="text-zinc-500">Endpoints:</span>
            <span className="ml-2 text-zinc-300">{peerNode.endpoints.length}</span>
          </div>
          <div className="p-2 bg-zinc-800/50 rounded">
            <span className="text-zinc-500">Latency:</span>
            <span className="ml-2 text-zinc-300">{peerNode.latency ? `${peerNode.latency}ms` : 'N/A'}</span>
          </div>
        </div>
      )}
      
      {/* Inference Endpoints */}
      {peerNode && peerNode.inferenceEndpoints.length > 0 && (
        <div>
          <div className="text-xs text-zinc-500 mb-2">Inference Endpoints</div>
          <div className="space-y-1">
            {peerNode.inferenceEndpoints.map((endpoint: InferenceEndpoint) => (
              <div 
                key={endpoint.endpointId}
                className="flex items-center justify-between p-1.5 bg-zinc-800/50 rounded text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${endpoint.verified ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-zinc-300">{endpoint.modelId}</span>
                  <span className="text-zinc-500">({endpoint.protocol})</span>
                </div>
                <span className="text-zinc-500">{endpoint.avgLatency}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Benchmark Attestations */}
      {peerNode && peerNode.benchmarkAttestations.length > 0 && (
        <div>
          <div className="text-xs text-zinc-500 mb-2">Benchmark Attestations</div>
          <div className="space-y-1">
            {peerNode.benchmarkAttestations.map((attestation: BenchmarkAttestation, i: number) => (
              <div 
                key={i}
                className="flex items-center justify-between p-1.5 bg-zinc-800/50 rounded text-xs"
              >
                <span className="text-zinc-300">{attestation.benchmarkName}</span>
                <span className={`${attestation.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {Math.round((attestation.score / attestation.maxScore) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Main Component ============

export const AgentProfileCard: React.FC<AgentProfileCardProps> = ({
  agentId,
  onSwitchProfile,
  onClose,
  className = '',
}) => {
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [peerNode, setPeerNode] = useState<PeerNode | null>(null);
  const [activeTab, setActiveTab] = useState<'personality' | 'capabilities' | 'network'>('personality');
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  
  useEffect(() => {
    const loadIdentity = async () => {
      const manager = getAgentIdentityManager();
      const peerManager = getPeerNetworkManager();
      
      // Get or create identity
      let id = identity;
      if (agentId) {
        id = manager.getIdentity(agentId) || null;
      }
      
      if (!id) {
        // Create default identity
        id = await manager.createIdentity(DEFAULT_PERSONALITIES.general);
        
        // Add some default skills
        manager.addSkill(id.id, {
          name: 'Python',
          category: 'coding',
          level: 85,
          verified: true,
          lastAssessed: Date.now(),
        });
        manager.addSkill(id.id, {
          name: 'TypeScript',
          category: 'coding',
          level: 80,
          verified: true,
          lastAssessed: Date.now(),
        });
        manager.addSkill(id.id, {
          name: 'Problem Solving',
          category: 'reasoning',
          level: 75,
          verified: false,
          lastAssessed: Date.now(),
        });
        
        // Add example weakness
        manager.addWeakness(id.id, {
          domain: 'Real-time Data',
          severity: 'moderate',
          description: 'Knowledge cutoff limits access to current information',
          mitigations: ['Web search tools', 'User-provided context'],
        });
        
        // Initialize peer node
        await peerManager.initializeLocalNode(id);
      }
      
      setIdentity(id);
      
      // Get peer node if available
      const topology = peerManager.getTopology();
      if (topology) {
        setPeerNode(topology.localNode);
      }
      
      // Get available profiles
      setAvailableProfiles(Object.keys(DEFAULT_PERSONALITIES));
    };
    
    loadIdentity();
  }, [agentId]);
  
  const handleSwitchProfile = async (profileKey: string) => {
    const personality = DEFAULT_PERSONALITIES[profileKey];
    if (!personality) return;
    
    const manager = getAgentIdentityManager();
    const newIdentity = await manager.createIdentity(personality);
    setIdentity(newIdentity);
    
    onSwitchProfile?.(newIdentity.id);
  };
  
  if (!identity) {
    return (
      <div className={`p-6 bg-zinc-900 rounded-lg ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-16 w-16 bg-zinc-700 rounded-full" />
          <div className="h-4 bg-zinc-700 rounded w-3/4" />
          <div className="h-4 bg-zinc-700 rounded w-1/2" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col h-full bg-zinc-900 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700">
        <h2 className="text-lg font-semibold text-white">Agent Profile</h2>
        <div className="flex items-center gap-2">
          {/* Profile Switcher */}
          <select
            value={Object.entries(DEFAULT_PERSONALITIES).find(
              ([_, p]) => p.name === identity.personality.name
            )?.[0] || 'general'}
            onChange={(e) => handleSwitchProfile(e.target.value)}
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300"
          >
            {availableProfiles.map(key => (
              <option key={key} value={key}>
                {DEFAULT_PERSONALITIES[key].name}
              </option>
            ))}
          </select>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-700 rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        <button
          onClick={() => setActiveTab('personality')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'personality'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Personality
        </button>
        <button
          onClick={() => setActiveTab('capabilities')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'capabilities'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Capabilities
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'network'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Network
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'personality' && (
          <PersonalitySection personality={identity.personality} />
        )}
        
        {activeTab === 'capabilities' && (
          <div className="space-y-6">
            <StrengthsSection strengths={identity.strengths} />
            <WeaknessesSection weaknesses={identity.weaknesses} />
            <SkillsSection skills={identity.skills} />
            <CertificationsSection certifications={identity.certifications} />
          </div>
        )}
        
        {activeTab === 'network' && (
          <NetworkIdentitySection 
            identity={identity} 
            peerNode={peerNode || undefined}
          />
        )}
      </div>
      
      {/* Footer - Reputation */}
      <div className="p-4 border-t border-zinc-700 bg-zinc-800/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Reputation Score</span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-green-500"
                style={{ width: `${identity.reputation.overall}%` }}
              />
            </div>
            <span className="text-white font-medium">{identity.reputation.overall}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-zinc-500">
          <div>Reliability: {identity.reputation.reliability}</div>
          <div>Accuracy: {identity.reputation.accuracy}</div>
          <div>Attestations: {identity.reputation.attestations}</div>
        </div>
      </div>
    </div>
  );
};

export default AgentProfileCard;
