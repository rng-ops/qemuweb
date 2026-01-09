/**
 * Atlas Iframe Protocol
 * 
 * Defines the message types and utilities for postMessage communication
 * between the main application and the Atlas iframe.
 * 
 * Messages flow bidirectionally:
 * - main → iframe: State init, route changes, DOM events, settings
 * - iframe → main: Ready signal, state updates, focus requests
 */

import type { AtlasConfig } from './atlasAgent';
import type { A11yEvent, A11yEventBatch, A11yObserverConfig } from './accessibilityEvents';
import type { PersistedAtlasState } from './atlasPersistence';
import type { ServiceInfo, ImageInfo, DashboardContext } from './dashboardContext';

// ============ Message Types ============

/**
 * Messages sent FROM main app TO Atlas iframe
 */
export type MainToAtlasMessage =
  | { type: 'main:init-state'; payload: PersistedAtlasState | null }
  | { type: 'main:route-change'; payload: { path: string; search: string; hash: string } }
  | { type: 'main:dom-event'; payload: DOMEventPayload }
  | { type: 'main:settings-update'; payload: Partial<AtlasConfig> }
  | { type: 'main:a11y-event'; payload: A11yEvent }
  | { type: 'main:a11y-batch'; payload: A11yEventBatch }
  | { type: 'main:a11y-config'; payload: Partial<A11yObserverConfig> }
  | { type: 'main:request-state' }
  | { type: 'main:clear-state' }
  // File events for context
  | { type: 'main:file-open'; payload: FileEventPayload }
  | { type: 'main:file-save'; payload: FileEventPayload }
  | { type: 'main:file-update'; payload: FileUpdatePayload }
  | { type: 'main:file-diff'; payload: FileDiffPayload }
  // Terminal events
  | { type: 'main:terminal-command'; payload: TerminalCommandPayload }
  | { type: 'main:terminal-output'; payload: TerminalOutputPayload }
  // Dashboard context
  | { type: 'main:dashboard-context'; payload: DashboardContextPayload };

/**
 * Messages sent FROM Atlas iframe TO main app
 */
export type AtlasToMainMessage =
  | { type: 'atlas:ready' }
  | { type: 'atlas:state-update'; payload: AtlasStateUpdatePayload }
  | { type: 'atlas:request-focus' }
  | { type: 'atlas:save-state'; payload: PersistedAtlasState }
  | { type: 'atlas:announce'; payload: { message: string; politeness: 'polite' | 'assertive' } }
  | { type: 'atlas:error'; payload: { error: string; context?: string } };

export type AtlasIframeMessage = MainToAtlasMessage | AtlasToMainMessage;

// ============ Payload Types ============

export interface DOMEventPayload {
  eventType: 'click' | 'focus' | 'scroll' | 'input' | 'mutation' | 'visibility';
  target?: {
    tagName: string;
    id?: string;
    className?: string;
    role?: string;
    ariaLabel?: string;
    textContent?: string;
  };
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface AtlasStateUpdatePayload {
  unreadCount?: number;
  isTyping?: boolean;
  currentTab?: 'chat' | 'thoughts' | 'events' | 'settings';
  messageCount?: number;
  thoughtCount?: number;
  eventCount?: number;
}

export interface ChatMessagePayload {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ============ Dashboard Context Payload ============

export interface DashboardContextPayload {
  services: ServiceInfo[];
  images: ImageInfo[];
  currentView: DashboardContext['currentView'];
  timestamp: number;
}

// ============ File & Terminal Event Payloads ============

export interface FileEventPayload {
  fileId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  timestamp: number;
  size?: number;
  contentPreview?: string; // First ~500 chars
}

export interface FileUpdatePayload extends FileEventPayload {
  changeType: 'edit' | 'create' | 'delete' | 'rename';
  oldPath?: string; // For rename
  linesChanged?: number;
}

export interface FileDiffPayload {
  fileId: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  diff: string; // Unified diff format
  additions: number;
  deletions: number;
  beforePreview?: string; // Preview of before state
  afterPreview?: string; // Preview of after state
}

export interface TerminalCommandPayload {
  sessionId: string;
  command: string;
  timestamp: number;
  cwd?: string;
  exitCode?: number | null; // null if still running
}

export interface TerminalOutputPayload {
  sessionId: string;
  output: string;
  timestamp: number;
  streamType: 'stdout' | 'stderr';
  isComplete: boolean;
  exitCode?: number;
}

// ============ Message Origin Validation ============

const ATLAS_MESSAGE_PREFIX = 'atlas:';
const MAIN_MESSAGE_PREFIX = 'main:';

/**
 * Validates that a message is a valid Atlas protocol message
 */
export function isAtlasMessage(data: unknown): data is AtlasIframeMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as { type?: string };
  return typeof msg.type === 'string' && 
    (msg.type.startsWith(ATLAS_MESSAGE_PREFIX) || msg.type.startsWith(MAIN_MESSAGE_PREFIX));
}

/**
 * Validates origin for security
 */
export function isValidOrigin(origin: string): boolean {
  // In development, allow same origin
  if (origin === window.location.origin) return true;
  
  // Allow specific trusted origins if needed
  const trustedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];
  
  return trustedOrigins.includes(origin);
}

// ============ Message Sending ============

/**
 * Send a message to the Atlas iframe
 */
export function sendToAtlasIframe(
  iframeWindow: Window,
  message: MainToAtlasMessage,
  targetOrigin: string = '*'
): void {
  try {
    iframeWindow.postMessage(message, targetOrigin);
  } catch (err) {
    console.error('[AtlasProtocol] Failed to send message to iframe:', err);
  }
}

/**
 * Send a message to the parent window (from iframe)
 */
export function sendToParent(
  message: AtlasToMainMessage,
  targetOrigin: string = '*'
): void {
  if (!window.parent || window.parent === window) {
    console.warn('[AtlasProtocol] No parent window found');
    return;
  }
  
  try {
    window.parent.postMessage(message, targetOrigin);
  } catch (err) {
    console.error('[AtlasProtocol] Failed to send message to parent:', err);
  }
}

// ============ Message Listening ============

export type MainMessageHandler = (message: AtlasToMainMessage) => void;
export type IframeMessageHandler = (message: MainToAtlasMessage) => void;

/**
 * Listen for messages from Atlas iframe (in main app)
 */
export function listenFromAtlasIframe(handler: MainMessageHandler): () => void {
  const listener = (event: MessageEvent) => {
    if (!isValidOrigin(event.origin)) return;
    if (!isAtlasMessage(event.data)) return;
    
    const message = event.data;
    if (message.type.startsWith(ATLAS_MESSAGE_PREFIX)) {
      handler(message as AtlasToMainMessage);
    }
  };
  
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/**
 * Listen for messages from parent window (in iframe)
 */
export function listenFromParent(handler: IframeMessageHandler): () => void {
  const listener = (event: MessageEvent) => {
    if (!isValidOrigin(event.origin)) return;
    if (!isAtlasMessage(event.data)) return;
    
    const message = event.data;
    if (message.type.startsWith(MAIN_MESSAGE_PREFIX)) {
      handler(message as MainToAtlasMessage);
    }
  };
  
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

// ============ Convenience Creators ============

export const createMainMessage = {
  initState: (state: PersistedAtlasState | null): MainToAtlasMessage => ({
    type: 'main:init-state',
    payload: state,
  }),
  
  routeChange: (path: string, search: string, hash: string): MainToAtlasMessage => ({
    type: 'main:route-change',
    payload: { path, search, hash },
  }),
  
  domEvent: (payload: DOMEventPayload): MainToAtlasMessage => ({
    type: 'main:dom-event',
    payload,
  }),
  
  a11yEvent: (event: A11yEvent): MainToAtlasMessage => ({
    type: 'main:a11y-event',
    payload: event,
  }),
  
  a11yBatch: (batch: A11yEventBatch): MainToAtlasMessage => ({
    type: 'main:a11y-batch',
    payload: batch,
  }),
  
  // File events
  fileOpen: (payload: FileEventPayload): MainToAtlasMessage => ({
    type: 'main:file-open',
    payload,
  }),
  
  fileSave: (payload: FileEventPayload): MainToAtlasMessage => ({
    type: 'main:file-save',
    payload,
  }),
  
  fileUpdate: (payload: FileUpdatePayload): MainToAtlasMessage => ({
    type: 'main:file-update',
    payload,
  }),
  
  fileDiff: (payload: FileDiffPayload): MainToAtlasMessage => ({
    type: 'main:file-diff',
    payload,
  }),
  
  // Terminal events
  terminalCommand: (payload: TerminalCommandPayload): MainToAtlasMessage => ({
    type: 'main:terminal-command',
    payload,
  }),
  
  terminalOutput: (payload: TerminalOutputPayload): MainToAtlasMessage => ({
    type: 'main:terminal-output',
    payload,
  }),
};

export const createAtlasMessage = {
  ready: (): AtlasToMainMessage => ({
    type: 'atlas:ready',
  }),
  
  stateUpdate: (payload: AtlasStateUpdatePayload): AtlasToMainMessage => ({
    type: 'atlas:state-update',
    payload,
  }),
  
  requestFocus: (): AtlasToMainMessage => ({
    type: 'atlas:request-focus',
  }),
  
  saveState: (state: PersistedAtlasState): AtlasToMainMessage => ({
    type: 'atlas:save-state',
    payload: state,
  }),
  
  announce: (message: string, politeness: 'polite' | 'assertive' = 'polite'): AtlasToMainMessage => ({
    type: 'atlas:announce',
    payload: { message, politeness },
  }),
  
  error: (error: string, context?: string): AtlasToMainMessage => ({
    type: 'atlas:error',
    payload: { error, context },
  }),
};
