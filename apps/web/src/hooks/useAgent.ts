/**
 * useAgent Hook
 *
 * React hook for accessing the agent service with state subscriptions.
 */

import { useState, useEffect, useMemo } from 'react';
import { getAgentService, type AgentService, type AgentState } from '../services/agentService';
import type { MCPServerConfig, ContainerImage } from '@qemuweb/vm-config';

interface UseAgentReturn {
  /** Agent service instance */
  agent: AgentService;
  /** Current agent state */
  state: AgentState;
  /** Whether agent is initialized */
  isInitialized: boolean;
  /** Agent introspection data */
  introspection: ReturnType<AgentService['introspect']>;
  /** Available actions */
  availableActions: string[];
  /** MCP server operations */
  mcp: {
    connections: Map<string, { name: string; status: string; capabilities: number }>;
    addServer: (config: MCPServerConfig) => Promise<boolean>;
    removeServer: (name: string) => Promise<boolean>;
    connectServer: (name: string) => Promise<boolean>;
    disconnectServer: (name: string) => Promise<boolean>;
    invoke: (serverName: string, capability: string, params?: Record<string, unknown>) => Promise<unknown>;
  };
  /** Terraform operations */
  terraform: {
    plans: AgentState['terraformPlans'];
    generatePlan: (image: ContainerImage) => Promise<void>;
    applyPlan: (planId: string) => Promise<boolean>;
    getMetadata: (imageId: string) => ReturnType<AgentService['getTerraformMetadata']>;
  };
  /** Capability operations */
  capabilities: {
    list: AgentState['context']['capabilities'];
    has: (id: string) => boolean;
    enable: (id: string) => boolean;
    disable: (id: string) => boolean;
  };
  /** Action history */
  actionHistory: AgentState['actionHistory'];
  /** Error state */
  error: string | null;
}

export function useAgent(): UseAgentReturn {
  const agent = useMemo(() => getAgentService(), []);
  const [state, setState] = useState<AgentState>(agent.getState());
  const [error, setError] = useState<string | null>(null);

  // Subscribe to agent state changes
  useEffect(() => {
    const unsubscribe = agent.subscribe(setState);
    return unsubscribe;
  }, [agent]);

  // Initialize agent on mount
  useEffect(() => {
    agent.initialize().catch((err) => {
      setError(err.message || 'Failed to initialize agent');
    });
  }, [agent]);

  // MCP operations
  const mcp = useMemo(
    () => ({
      connections: new Map(
        Array.from(state.mcpConnections.entries()).map(([name, conn]) => [
          name,
          {
            name,
            status: conn.status,
            capabilities: conn.server.capabilities.length,
          },
        ])
      ),
      addServer: async (config: MCPServerConfig) => {
        try {
          return await agent.addMCPServer(config);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to add MCP server');
          return false;
        }
      },
      removeServer: async (name: string) => {
        try {
          return await agent.removeMCPServer(name);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to remove MCP server');
          return false;
        }
      },
      connectServer: async (name: string) => {
        try {
          return await agent.connectMCPServer(name);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to connect to MCP server');
          return false;
        }
      },
      disconnectServer: async (name: string) => {
        try {
          return await agent.disconnectMCPServer(name);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to disconnect from MCP server');
          return false;
        }
      },
      invoke: async (serverName: string, capability: string, params?: Record<string, unknown>) => {
        try {
          return await agent.invokeMCPCapability(serverName, capability, params);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to invoke MCP capability');
          throw err;
        }
      },
    }),
    [agent, state.mcpConnections]
  );

  // Terraform operations
  const terraform = useMemo(
    () => ({
      plans: state.terraformPlans,
      generatePlan: async (image: ContainerImage) => {
        try {
          await agent.generateTerraformPlan(image);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to generate Terraform plan');
        }
      },
      applyPlan: async (planId: string) => {
        try {
          return await agent.applyTerraformPlan(planId);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to apply Terraform plan');
          return false;
        }
      },
      getMetadata: (imageId: string) => agent.getTerraformMetadata(imageId),
    }),
    [agent, state.terraformPlans]
  );

  // Capability operations
  const capabilities = useMemo(
    () => ({
      list: state.context.capabilities,
      has: (id: string) => agent.hasCapability(id),
      enable: (id: string) => agent.enableCapability(id),
      disable: (id: string) => agent.disableCapability(id),
    }),
    [agent, state.context.capabilities]
  );

  // Memoized introspection
  const introspection = useMemo(() => agent.introspect(), [agent, state]);

  // Memoized available actions
  const availableActions = useMemo(() => agent.getAvailableActions(), [agent, state]);

  return {
    agent,
    state,
    isInitialized: state.isInitialized,
    introspection,
    availableActions,
    mcp,
    terraform,
    capabilities,
    actionHistory: state.actionHistory,
    error,
  };
}

export default useAgent;
