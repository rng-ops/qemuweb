/**
 * Network Topology Diagram Component
 *
 * Interactive visualization of the SDN topology with:
 * - Draggable nodes (VMs, routers, switches)
 * - Selectable nodes and links
 * - Terraform configuration view
 * - Policy suggestions panel
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { SDNNode, SDNLink, SecurityPolicy, SerializedSDNState } from '../../hooks/useSDN';

interface NetworkDiagramProps {
  state: SerializedSDNState;
  onNodeSelect: (nodeId: string | null) => void;
  onLinkSelect: (linkId: string | null) => void;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onAddNode: () => void;
  onAddLink: (sourceId: string, targetId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onRemoveLink: (linkId: string) => void;
  terraformConfig: string | null;
  policySuggestions: SecurityPolicy[];
  onApplyPolicy: (policyId: string) => void;
}

export const NetworkDiagram: React.FC<NetworkDiagramProps> = ({
  state,
  onNodeSelect,
  onLinkSelect,
  onNodeMove,
  onAddNode,
  onAddLink,
  onRemoveNode,
  onRemoveLink,
  terraformConfig,
  policySuggestions,
  onApplyPolicy,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linkMode, setLinkMode] = useState<{ sourceId: string; tempTarget: { x: number; y: number } } | null>(null);
  const [showTerraform, setShowTerraform] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan] = useState({ x: 0, y: 0 });

  const selectedNode = useMemo(
    () => state.nodes.find((n) => n.id === state.selectedNodeId),
    [state.nodes, state.selectedNodeId]
  );

  const selectedLink = useMemo(
    () => state.links.find((l) => l.id === state.selectedLinkId),
    [state.links, state.selectedLinkId]
  );

  // Get node position
  const getNodePosition = useCallback(
    (nodeId: string) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      return node?.position || { x: 0, y: 0 };
    },
    [state.nodes]
  );

  // Handle mouse down on node
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();

      if (e.shiftKey && linkMode === null) {
        // Start link creation mode
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          setLinkMode({
            sourceId: nodeId,
            tempTarget: { x: node.position.x, y: node.position.y },
          });
        }
        return;
      }

      const node = state.nodes.find((n) => n.id === nodeId);
      if (node) {
        setDraggedNode(nodeId);
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          setDragOffset({
            x: (e.clientX - rect.left) / zoom - pan.x - node.position.x,
            y: (e.clientY - rect.top) / zoom - pan.y - node.position.y,
          });
        }
      }
      onNodeSelect(nodeId);
    },
    [state.nodes, linkMode, onNodeSelect, zoom, pan]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / zoom - pan.x;
      const y = (e.clientY - rect.top) / zoom - pan.y;

      if (draggedNode) {
        onNodeMove(draggedNode, {
          x: x - dragOffset.x,
          y: y - dragOffset.y,
        });
      }

      if (linkMode) {
        setLinkMode({
          ...linkMode,
          tempTarget: { x, y },
        });
      }
    },
    [draggedNode, dragOffset, linkMode, onNodeMove, zoom, pan]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (linkMode) {
        // Check if we dropped on a node
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left) / zoom - pan.x;
          const y = (e.clientY - rect.top) / zoom - pan.y;

          // Find node at position
          const targetNode = state.nodes.find((n) => {
            const dx = n.position.x - x;
            const dy = n.position.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 40 && n.id !== linkMode.sourceId;
          });

          if (targetNode) {
            onAddLink(linkMode.sourceId, targetNode.id);
          }
        }
        setLinkMode(null);
      }

      setDraggedNode(null);
    },
    [linkMode, state.nodes, onAddLink, zoom, pan]
  );

  // Handle click on link
  const handleLinkClick = useCallback(
    (e: React.MouseEvent, linkId: string) => {
      e.stopPropagation();
      onLinkSelect(linkId);
    },
    [onLinkSelect]
  );

  // Handle click on canvas background
  const handleBackgroundClick = useCallback(() => {
    onNodeSelect(null);
    onLinkSelect(null);
  }, [onNodeSelect, onLinkSelect]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedNodeId) {
          onRemoveNode(state.selectedNodeId);
        } else if (state.selectedLinkId) {
          onRemoveLink(state.selectedLinkId);
        }
      }
      if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z * 1.1, 3));
      }
      if (e.key === '-') {
        setZoom((z) => Math.max(z / 1.1, 0.3));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedNodeId, state.selectedLinkId, onRemoveNode, onRemoveLink]);

  return (
    <div className="flex h-full bg-gray-900">
      {/* Main Diagram Area */}
      <div className="flex-1 relative">
        {/* Toolbar */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
          <button
            onClick={onAddNode}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            Add Node
          </button>
          <button
            onClick={() => setShowTerraform(!showTerraform)}
            className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
              showTerraform
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <TerraformIcon className="w-4 h-4" />
            Terraform
          </button>
          <button
            onClick={() => setShowPolicies(!showPolicies)}
            className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
              showPolicies
                ? 'bg-amber-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <ShieldIcon className="w-4 h-4" />
            Policies
            {policySuggestions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-xs rounded-full">
                {policySuggestions.length}
              </span>
            )}
          </button>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-gray-800 rounded p-1">
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.2, 0.3))}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <MinusIcon className="w-4 h-4 text-gray-400" />
          </button>
          <span className="text-xs text-gray-400 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <PlusIcon className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleBackgroundClick}
        >
          <defs>
            {/* Arrow marker for links */}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>

            {/* Glow filter for selected elements */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Grid pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#374151"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          {/* Background grid */}
          <g transform={`translate(${pan.x * zoom}, ${pan.y * zoom}) scale(${zoom})`}>
            <rect width="2000" height="2000" x="-500" y="-500" fill="url(#grid)" />

            {/* Network zones */}
            {state.networks.map((network) => (
              <g key={network.id}>
                <rect
                  x={50}
                  y={50}
                  width={700}
                  height={500}
                  rx={10}
                  fill="#1e293b"
                  fillOpacity={0.5}
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="5,5"
                />
                <text x={60} y={75} className="text-xs fill-gray-500">
                  {network.name} ({network.cidr})
                </text>
              </g>
            ))}

            {/* Links */}
            {state.links.map((link) => {
              const sourcePos = getNodePosition(link.sourceNodeId);
              const targetPos = getNodePosition(link.targetNodeId);
              const isSelected = link.id === state.selectedLinkId;

              return (
                <g key={link.id}>
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isSelected ? '#8b5cf6' : link.status === 'up' ? '#10b981' : '#ef4444'}
                    strokeWidth={isSelected ? 3 : 2}
                    filter={isSelected ? 'url(#glow)' : undefined}
                    onClick={(e) => handleLinkClick(e, link.id)}
                    className="cursor-pointer hover:stroke-purple-400"
                  />
                  {/* Link stats */}
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 10}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                  >
                    {link.stats.latencyMs}ms
                  </text>
                </g>
              );
            })}

            {/* Temporary link while creating */}
            {linkMode && (
              <line
                x1={getNodePosition(linkMode.sourceId).x}
                y1={getNodePosition(linkMode.sourceId).y}
                x2={linkMode.tempTarget.x}
                y2={linkMode.tempTarget.y}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
            )}

            {/* Nodes */}
            {state.nodes.map((node) => {
              const isSelected = node.id === state.selectedNodeId;
              const nodeColor = getNodeColor(node.type, node.status);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.position.x}, ${node.position.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  className="cursor-move"
                >
                  {/* Node background */}
                  <circle
                    r={35}
                    fill={nodeColor.bg}
                    stroke={isSelected ? '#8b5cf6' : nodeColor.border}
                    strokeWidth={isSelected ? 3 : 2}
                    filter={isSelected ? 'url(#glow)' : undefined}
                  />

                  {/* Node icon */}
                  <g transform="translate(-12, -12)">
                    {node.type === 'router' && <RouterIcon />}
                    {node.type === 'vm' && <VMIcon />}
                    {node.type === 'switch' && <SwitchIcon />}
                    {node.type === 'external' && <CloudIcon />}
                  </g>

                  {/* Node label */}
                  <text
                    y={50}
                    textAnchor="middle"
                    className="text-xs font-medium fill-gray-300"
                  >
                    {node.name}
                  </text>

                  {/* Status indicator */}
                  <circle
                    cx={25}
                    cy={-25}
                    r={6}
                    fill={
                      node.status === 'online'
                        ? '#10b981'
                        : node.status === 'offline'
                        ? '#ef4444'
                        : '#f59e0b'
                    }
                    stroke="#1f2937"
                    strokeWidth={2}
                  />

                  {/* Interface indicators */}
                  {node.interfaces.slice(0, 4).map((iface, i) => {
                    const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
                    const x = Math.cos(angle) * 40;
                    const y = Math.sin(angle) * 40;

                    return (
                      <g key={iface.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r={5}
                          fill={iface.isUp ? '#22c55e' : '#71717a'}
                          stroke="#1f2937"
                          strokeWidth={1}
                        />
                        <title>
                          {iface.name}: {iface.ip || 'No IP'}
                        </title>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 right-2 bg-gray-800 rounded p-2 text-xs text-gray-400">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span>Online</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Starting</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span>Offline</span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700">
            <span className="text-gray-500">Shift+drag to create links</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Details/Terraform/Policies */}
      {(selectedNode || selectedLink || showTerraform || showPolicies) && (
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          {/* Selected Node Details */}
          {selectedNode && !showTerraform && !showPolicies && (
            <NodeDetails node={selectedNode} onRemove={() => onRemoveNode(selectedNode.id)} />
          )}

          {/* Selected Link Details */}
          {selectedLink && !selectedNode && !showTerraform && !showPolicies && (
            <LinkDetails link={selectedLink} onRemove={() => onRemoveLink(selectedLink.id)} />
          )}

          {/* Terraform View */}
          {showTerraform && (
            <div className="p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <TerraformIcon className="w-4 h-4 text-purple-400" />
                Terraform Configuration
              </h3>
              {terraformConfig ? (
                <pre className="text-xs bg-gray-900 p-3 rounded overflow-x-auto text-gray-300 font-mono">
                  {terraformConfig}
                </pre>
              ) : (
                <p className="text-gray-500 text-sm">Select a node to view its Terraform config</p>
              )}
            </div>
          )}

          {/* Policies View */}
          {showPolicies && (
            <div className="p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <ShieldIcon className="w-4 h-4 text-amber-400" />
                Security Policies
              </h3>

              {/* Active Policies */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Active Policies</h4>
                {state.policies.length > 0 ? (
                  <div className="space-y-2">
                    {state.policies.map((policy) => (
                      <div
                        key={policy.id}
                        className="bg-gray-900 rounded p-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{policy.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              policy.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {policy.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-gray-500 mt-1">{policy.description}</p>
                        <div className="mt-1 text-gray-600">
                          {policy.rules.length} rules • {policy.appliedTo.length} nodes
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No active policies</p>
                )}
              </div>

              {/* AI Suggestions */}
              {policySuggestions.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" />
                    AI Suggestions
                  </h4>
                  <div className="space-y-2">
                    {policySuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="bg-amber-900/20 border border-amber-700/50 rounded p-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-amber-300 font-medium">{suggestion.name}</span>
                          {suggestion.suggestion && (
                            <span className="text-xs text-gray-500">
                              {Math.round(suggestion.suggestion.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 mt-1">{suggestion.description}</p>
                        {suggestion.suggestion && (
                          <p className="text-amber-400/70 mt-1 text-xs italic">
                            {suggestion.suggestion.reason}
                          </p>
                        )}
                        <button
                          onClick={() => onApplyPolicy(suggestion.id)}
                          className="mt-2 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs"
                        >
                          Apply Policy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Node Details Panel
const NodeDetails: React.FC<{ node: SDNNode; onRemove: () => void }> = ({ node, onRemove }) => (
  <div className="p-4">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-white">{node.name}</h3>
      <button
        onClick={onRemove}
        className="p-1 hover:bg-red-900/50 rounded text-red-400"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>

    <div className="space-y-3 text-xs">
      <div>
        <span className="text-gray-500">Type:</span>
        <span className="ml-2 text-gray-300 capitalize">{node.type}</span>
      </div>
      <div>
        <span className="text-gray-500">Status:</span>
        <span
          className={`ml-2 ${
            node.status === 'online'
              ? 'text-green-400'
              : node.status === 'offline'
              ? 'text-red-400'
              : 'text-yellow-400'
          }`}
        >
          {node.status}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Position:</span>
        <span className="ml-2 text-gray-300">
          ({Math.round(node.position.x)}, {Math.round(node.position.y)})
        </span>
      </div>

      <div className="pt-3 border-t border-gray-700">
        <h4 className="text-gray-400 font-medium mb-2">Interfaces</h4>
        {node.interfaces.map((iface) => (
          <div key={iface.id} className="flex items-center justify-between py-1">
            <span className="text-gray-300">{iface.name}</span>
            <span className="text-gray-500">{iface.ip || 'No IP'}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Link Details Panel
const LinkDetails: React.FC<{ link: SDNLink; onRemove: () => void }> = ({ link, onRemove }) => (
  <div className="p-4">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-white">Link Details</h3>
      <button
        onClick={onRemove}
        className="p-1 hover:bg-red-900/50 rounded text-red-400"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>

    <div className="space-y-3 text-xs">
      <div>
        <span className="text-gray-500">Status:</span>
        <span
          className={`ml-2 ${
            link.status === 'up'
              ? 'text-green-400'
              : link.status === 'down'
              ? 'text-red-400'
              : 'text-yellow-400'
          }`}
        >
          {link.status}
        </span>
      </div>

      <div className="pt-3 border-t border-gray-700">
        <h4 className="text-gray-400 font-medium mb-2">Statistics</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-500">Bytes In:</span>
            <span className="ml-1 text-gray-300">{formatBytes(link.stats.bytesIn)}</span>
          </div>
          <div>
            <span className="text-gray-500">Bytes Out:</span>
            <span className="ml-1 text-gray-300">{formatBytes(link.stats.bytesOut)}</span>
          </div>
          <div>
            <span className="text-gray-500">Latency:</span>
            <span className="ml-1 text-gray-300">{link.stats.latencyMs}ms</span>
          </div>
          <div>
            <span className="text-gray-500">Errors:</span>
            <span className="ml-1 text-gray-300">{link.stats.errorsIn + link.stats.errorsOut}</span>
          </div>
        </div>
      </div>

      {link.qos && (
        <div className="pt-3 border-t border-gray-700">
          <h4 className="text-gray-400 font-medium mb-2">QoS Settings</h4>
          {link.qos.bandwidthLimit && (
            <div>
              <span className="text-gray-500">Bandwidth:</span>
              <span className="ml-1 text-gray-300">{formatBits(link.qos.bandwidthLimit)}/s</span>
            </div>
          )}
          {link.qos.latency && (
            <div>
              <span className="text-gray-500">Added Latency:</span>
              <span className="ml-1 text-gray-300">{link.qos.latency}ms</span>
            </div>
          )}
          {link.qos.packetLoss !== undefined && (
            <div>
              <span className="text-gray-500">Packet Loss:</span>
              <span className="ml-1 text-gray-300">{link.qos.packetLoss}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

// Helper functions
function getNodeColor(type: string, status: string) {
  const colors = {
    router: { bg: '#1e3a5f', border: '#3b82f6' },
    vm: { bg: '#1e3a3a', border: '#10b981' },
    switch: { bg: '#3d1e5f', border: '#8b5cf6' },
    external: { bg: '#3d2e1e', border: '#f59e0b' },
  };

  const base = colors[type as keyof typeof colors] || colors.vm;

  if (status === 'offline') {
    return { bg: '#292524', border: '#78716c' };
  }

  return base;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatBits(bits: number): string {
  if (bits === 0) return '0 bps';
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(bits) / Math.log(k));
  return parseFloat((bits / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Icons
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const MinusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);

const TerraformIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M1.5 3.5v7l6.5 3.75v-7L1.5 3.5zM9 7.25v7L15.5 18v-7L9 7.25zM16.5 3.5v7l6.5 3.75v-7L16.5 3.5z" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RouterIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
    <rect x="2" y="8" width="20" height="8" rx="2" />
    <line x1="6" y1="12" x2="6" y2="12" strokeWidth="3" strokeLinecap="round" />
    <line x1="10" y1="12" x2="10" y2="12" strokeWidth="3" strokeLinecap="round" />
    <line x1="14" y1="8" x2="14" y2="4" />
    <line x1="18" y1="8" x2="18" y2="4" />
  </svg>
);

const VMIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <line x1="3" y1="14" x2="21" y2="14" />
    <line x1="8" y1="18" x2="8" y2="20" />
    <line x1="16" y1="18" x2="16" y2="20" />
    <line x1="6" y1="20" x2="18" y2="20" />
  </svg>
);

const SwitchIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="6" cy="12" r="1.5" fill="#a78bfa" />
    <circle cx="10" cy="12" r="1.5" fill="#a78bfa" />
    <circle cx="14" cy="12" r="1.5" fill="#a78bfa" />
    <circle cx="18" cy="12" r="1.5" fill="#a78bfa" />
  </svg>
);

const CloudIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
  </svg>
);

export default NetworkDiagram;
