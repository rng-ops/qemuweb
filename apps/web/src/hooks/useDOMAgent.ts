/**
 * React Hook for DOM Agent
 * 
 * Provides access to the DOM agent for executing actions,
 * processing user requests, and receiving state updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  DOMAgent, 
  AgentConfig, 
  AgentState, 
  createAgent, 
  getAgent, 
  destroyAgent 
} from '../services/domAgent';
import { getEventTracker } from '../services/eventTracker';

export interface UseDOMAgentOptions {
  agentId?: string;
  autoConnect?: boolean;
  model?: AgentConfig['model'];
}

export interface UseDOMAgentReturn {
  agent: DOMAgent | null;
  state: AgentState | null;
  isConnected: boolean;
  isProcessing: boolean;
  error: string | null;
  connect: (config?: Partial<AgentConfig>) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (message: string) => Promise<string>;
  executeAction: (action: { type: string; target?: string; params?: Record<string, unknown> }) => Promise<unknown>;
}

const DEFAULT_CONFIG: AgentConfig = {
  id: 'default-dom-agent',
  name: 'DOM Agent',
  capabilities: [
    'dom_manipulation',
    'code_generation',
    'code_execution',
    'view_creation',
    'report_generation',
  ],
  mcpServers: [],
  model: {
    provider: 'local',
    modelId: 'llama3.2',
    endpoint: 'http://localhost:11434/api/generate',
  },
};

export function useDOMAgent(options: UseDOMAgentOptions = {}): UseDOMAgentReturn {
  const { agentId = 'default-dom-agent', autoConnect = false, model } = options;
  
  const [agent, setAgent] = useState<DOMAgent | null>(null);
  const [state, setState] = useState<AgentState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Connect to or create an agent
  const connect = useCallback(async (config?: Partial<AgentConfig>) => {
    try {
      setError(null);
      
      // Check if agent already exists
      let existingAgent = getAgent(agentId);
      
      if (!existingAgent) {
        const fullConfig: AgentConfig = {
          ...DEFAULT_CONFIG,
          ...config,
          id: agentId,
          model: model || config?.model || DEFAULT_CONFIG.model,
        };
        
        existingAgent = await createAgent(fullConfig);
      }
      
      setAgent(existingAgent);
      setIsConnected(true);
      setState(existingAgent.getState());
      
      // Subscribe to state updates
      unsubscribeRef.current = existingAgent.subscribe((newState) => {
        setState(newState);
        setIsProcessing(newState.isRunning);
      });

      // Track connection
      const tracker = await getEventTracker();
      tracker.trackAgentAction({
        agentId,
        action: 'connect',
        reasoning: 'User connected to DOM agent',
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to agent';
      setError(message);
      console.error('Agent connection failed:', err);
    }
  }, [agentId, model]);

  // Disconnect from agent
  const disconnect = useCallback(async () => {
    try {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      await destroyAgent(agentId);
      setAgent(null);
      setIsConnected(false);
      setState(null);

      // Track disconnection
      const tracker = await getEventTracker();
      tracker.trackAgentAction({
        agentId,
        action: 'disconnect',
        reasoning: 'User disconnected from DOM agent',
      });

    } catch (err) {
      console.error('Agent disconnection failed:', err);
    }
  }, [agentId]);

  // Send a message to the agent
  const sendMessage = useCallback(async (message: string): Promise<string> => {
    if (!agent) {
      throw new Error('Agent not connected');
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await agent.processUserRequest(message);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process message';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [agent]);

  // Execute a specific action
  const executeAction = useCallback(async (action: { type: string; target?: string; params?: Record<string, unknown> }): Promise<unknown> => {
    if (!agent) {
      throw new Error('Agent not connected');
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await agent.executeAction({
        id: `action_${Date.now()}`,
        type: action.type as any,
        target: action.target,
        params: action.params || {},
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute action';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [agent]);

  // Auto-connect on mount if specified
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      // Clean up subscription but don't destroy agent (may be shared)
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [autoConnect, connect]);

  return {
    agent,
    state,
    isConnected,
    isProcessing,
    error,
    connect,
    disconnect,
    sendMessage,
    executeAction,
  };
}

export default useDOMAgent;
