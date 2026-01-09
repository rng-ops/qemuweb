import { useState, useMemo } from 'react';
import type { VirtualNetwork, VirtualInterface, NetworkTopology as TopologyType } from '@qemuweb/vm-config';
import {
  generateNetworkId,
} from '@qemuweb/vm-config';

interface NetworkTopologyProps {
  topology: TopologyType;
  onTopologyChange: (topology: TopologyType) => void;
  vmInterfaces?: Map<string, VirtualInterface[]>;
}

interface NetworkNode {
  id: string;
  type: 'network' | 'vm' | 'router' | 'switch';
  label: string;
  x: number;
  y: number;
  color: string;
}

interface NetworkEdge {
  from: string;
  to: string;
  label?: string;
}

export function NetworkTopology({ topology, onTopologyChange, vmInterfaces }: NetworkTopologyProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [showAddNetwork, setShowAddNetwork] = useState(false);
  const [newNetworkConfig, setNewNetworkConfig] = useState({
    name: '',
    type: 'nat' as 'bridge' | 'nat' | 'isolated',
    cidr: '10.0.0.0/24',
    enableDhcp: true,
  });

  // Calculate network visualization nodes and edges
  const { nodes, edges } = useMemo(() => {
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];

    // Add network nodes
    topology.networks.forEach((network, index) => {
      const angle = (index / topology.networks.length) * 2 * Math.PI;
      const radius = 120;

      nodes.push({
        id: network.id,
        type: 'network',
        label: network.name,
        x: 200 + Math.cos(angle) * radius,
        y: 150 + Math.sin(angle) * radius,
        color: network.type === 'nat' ? '#6366f1' : network.type === 'bridge' ? '#22c55e' : '#f59e0b',
      });
    });

    // Add router nodes
    topology.routers.forEach((router) => {
      nodes.push({
        id: router.id,
        type: 'router',
        label: router.name,
        x: 200,
        y: 150,
        color: '#ec4899',
      });

      // Connect to networks
      router.interfaces.forEach((iface) => {
        edges.push({ from: router.id, to: iface.networkId });
      });
    });

    // Add VM nodes from interfaces
    if (vmInterfaces) {
      let vmIndex = 0;
      vmInterfaces.forEach((interfaces, vmId) => {
        const angle = ((vmIndex + 0.5) / vmInterfaces.size) * 2 * Math.PI;
        const radius = 200;

        nodes.push({
          id: vmId,
          type: 'vm',
          label: `VM ${vmIndex + 1}`,
          x: 200 + Math.cos(angle) * radius,
          y: 150 + Math.sin(angle) * radius,
          color: '#3b82f6',
        });

        // Connect VMs to first network if they have interfaces
        if (interfaces.length > 0 && topology.networks.length > 0) {
          edges.push({
            from: vmId,
            to: topology.networks[0].id,
            label: interfaces[0].mac.slice(-5),
          });
        }

        vmIndex++;
      });
    }

    return { nodes, edges };
  }, [topology, vmInterfaces]);

  const addNetwork = () => {
    const newNetwork: VirtualNetwork = {
      id: generateNetworkId(),
      name: newNetworkConfig.name || `Network ${topology.networks.length + 1}`,
      type: newNetworkConfig.type,
      cidr: newNetworkConfig.cidr,
      gateway: newNetworkConfig.cidr.replace(/\.\d+\/\d+$/, '.1'),
      dhcp: newNetworkConfig.enableDhcp
        ? {
            enabled: true,
            rangeStart: newNetworkConfig.cidr.replace(/\.\d+\/\d+$/, '.100'),
            rangeEnd: newNetworkConfig.cidr.replace(/\.\d+\/\d+$/, '.200'),
            leaseTime: 86400,
            reservations: [],
          }
        : undefined,
      interfaces: [],
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: [],
      },
    };

    onTopologyChange({
      ...topology,
      networks: [...topology.networks, newNetwork],
    });
    setShowAddNetwork(false);
    setNewNetworkConfig({
      name: '',
      type: 'nat',
      cidr: `10.${topology.networks.length}.0.0/24`,
      enableDhcp: true,
    });
  };

  const removeNetwork = (networkId: string) => {
    onTopologyChange({
      ...topology,
      networks: topology.networks.filter((n) => n.id !== networkId),
    });
    setSelectedNetwork(null);
  };

  const selectedNetworkData = selectedNetwork
    ? topology.networks.find((n) => n.id === selectedNetwork)
    : null;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          Network Topology
        </h2>
        <button
          onClick={() => setShowAddNetwork(true)}
          className="btn btn-sm btn-secondary"
        >
          + Add Network
        </button>
      </div>

      {/* Topology Visualization */}
      <div className="bg-gray-900 rounded-lg p-4 mb-4 min-h-[300px] relative">
        <svg width="100%" height="300" viewBox="0 0 400 300">
          {/* Draw edges first */}
          {edges.map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            return (
              <g key={i}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke="#4b5563"
                  strokeWidth={2}
                />
                {edge.label && (
                  <text
                    x={(fromNode.x + toNode.x) / 2}
                    y={(fromNode.y + toNode.y) / 2 - 5}
                    fill="#9ca3af"
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Draw nodes */}
          {nodes.map((node) => (
            <g
              key={node.id}
              onClick={() => node.type === 'network' && setSelectedNetwork(node.id)}
              style={{ cursor: node.type === 'network' ? 'pointer' : 'default' }}
            >
              {node.type === 'network' && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={30}
                  fill={node.color}
                  fillOpacity={0.2}
                  stroke={node.color}
                  strokeWidth={selectedNetwork === node.id ? 3 : 2}
                />
              )}
              {node.type === 'vm' && (
                <rect
                  x={node.x - 25}
                  y={node.y - 20}
                  width={50}
                  height={40}
                  rx={4}
                  fill={node.color}
                  fillOpacity={0.2}
                  stroke={node.color}
                  strokeWidth={2}
                />
              )}
              {node.type === 'router' && (
                <polygon
                  points={`${node.x},${node.y - 25} ${node.x + 25},${node.y + 15} ${node.x - 25},${node.y + 15}`}
                  fill={node.color}
                  fillOpacity={0.2}
                  stroke={node.color}
                  strokeWidth={2}
                />
              )}
              <text
                x={node.x}
                y={node.y + (node.type === 'router' ? 35 : node.type === 'vm' ? 35 : 45)}
                fill="#e5e7eb"
                fontSize={12}
                textAnchor="middle"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-indigo-500"></span> NAT
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> Bridge
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Isolated
          </div>
        </div>
      </div>

      {/* Network List */}
      <div className="space-y-2 mb-4">
        {topology.networks.map((network) => (
          <div
            key={network.id}
            onClick={() => setSelectedNetwork(network.id)}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedNetwork === network.id
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium text-white">{network.name}</span>
                <span className="text-xs text-gray-400 ml-2">{network.type}</span>
              </div>
              <span className="text-sm text-gray-400 font-mono">{network.cidr}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Network Details */}
      {selectedNetworkData && (
        <div className="border-t border-gray-700 pt-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-medium text-white">{selectedNetworkData.name}</h3>
            <button
              onClick={() => removeNetwork(selectedNetworkData.id)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Delete
            </button>
          </div>
          <div className="text-sm text-gray-400 space-y-1">
            <p><strong>Type:</strong> {selectedNetworkData.type}</p>
            <p><strong>CIDR:</strong> {selectedNetworkData.cidr}</p>
            <p><strong>Gateway:</strong> {selectedNetworkData.gateway}</p>
            {selectedNetworkData.dhcp?.enabled && (
              <p><strong>DHCP:</strong> {selectedNetworkData.dhcp.rangeStart} - {selectedNetworkData.dhcp.rangeEnd}</p>
            )}
          </div>
        </div>
      )}

      {/* Add Network Modal */}
      {showAddNetwork && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Add Network</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newNetworkConfig.name}
                  onChange={(e) => setNewNetworkConfig((c) => ({ ...c, name: e.target.value }))}
                  placeholder="my-network"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                <select
                  value={newNetworkConfig.type}
                  onChange={(e) => setNewNetworkConfig((c) => ({ ...c, type: e.target.value as typeof c.type }))}
                  className="input w-full"
                >
                  <option value="nat">NAT (Internet Access)</option>
                  <option value="bridge">Bridge (External)</option>
                  <option value="isolated">Isolated (Internal Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">CIDR</label>
                <input
                  type="text"
                  value={newNetworkConfig.cidr}
                  onChange={(e) => setNewNetworkConfig((c) => ({ ...c, cidr: e.target.value }))}
                  placeholder="10.0.0.0/24"
                  className="input w-full font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableDhcp"
                  checked={newNetworkConfig.enableDhcp}
                  onChange={(e) => setNewNetworkConfig((c) => ({ ...c, enableDhcp: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="enableDhcp" className="text-sm text-gray-300">Enable DHCP</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddNetwork(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={addNetwork}
                className="btn btn-primary"
              >
                Add Network
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
