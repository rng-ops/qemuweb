/**
 * Atlas Floating Frame
 * 
 * A floating panel that hosts the Atlas chat in a sandboxed iframe.
 * Features:
 * - Resizable panel on the right side
 * - Collapsible with persist state
 * - PostMessage communication with iframe
 * - State persists across page changes
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAtlasPersistence } from '../../services/atlasPersistence';
import { 
  sendToAtlasIframe, 
  listenFromAtlasIframe,
  type AtlasToMainMessage,
  type DOMEventPayload,
} from '../../services/atlasIframeProtocol';
import { getA11yEvents, type A11yEvent } from '../../services/accessibilityEvents';
import { getFileTracker } from '../../services/atlasFileTracker';
import { getTerminalTracker } from '../../services/atlasTerminalTracker';
import { getDashboardContext } from '../../services/dashboardContext';

// ============ Types ============

interface AtlasFrameProps {
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Initial width in pixels */
  defaultWidth?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
}

interface FrameState {
  collapsed: boolean;
  width: number;
  position: 'right' | 'left';
}

// ============ Constants ============

const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const COLLAPSE_WIDTH = 48;

const FRAME_STATE_KEY = 'atlas-frame-state';

// ============ Frame State Persistence ============

function loadFrameState(): FrameState {
  try {
    const stored = localStorage.getItem(FRAME_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {
    collapsed: false,
    width: DEFAULT_WIDTH,
    position: 'right',
  };
}

function saveFrameState(state: FrameState): void {
  try {
    localStorage.setItem(FRAME_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// ============ Main Component ============

export const AtlasFrame: React.FC<AtlasFrameProps> = ({
  defaultCollapsed,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  
  const [frameState, setFrameState] = useState<FrameState>(() => {
    const loaded = loadFrameState();
    return {
      ...loaded,
      collapsed: defaultCollapsed ?? loaded.collapsed,
      width: defaultWidth ?? loaded.width,
    };
  });
  
  const [isResizing, setIsResizing] = useState(false);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Persist frame state
  useEffect(() => {
    saveFrameState(frameState);
  }, [frameState]);

  // Listen for messages from iframe
  useEffect(() => {
    const cleanup = listenFromAtlasIframe((message: AtlasToMainMessage) => {
      switch (message.type) {
        case 'atlas:ready':
          setIsIframeReady(true);
          // Send initial state to iframe
          sendInitialState();
          // Set iframe reference in trackers
          if (iframeRef.current) {
            getFileTracker().setIframe(iframeRef.current);
            getTerminalTracker().setIframe(iframeRef.current);
          }
          break;
          
        case 'atlas:state-update':
          // Iframe is persisting its own state, we just track unread
          if (message.payload?.unreadCount !== undefined) {
            setUnreadCount(message.payload.unreadCount);
          }
          break;
          
        case 'atlas:request-focus':
          // User clicked in iframe, we might want to expand
          if (frameState.collapsed) {
            setFrameState(prev => ({ ...prev, collapsed: false }));
          }
          break;
      }
    });

    return cleanup;
  }, [frameState.collapsed]);

  // Send initial persisted state to iframe
  const sendInitialState = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) return;
    
    try {
      const persistence = getAtlasPersistence();
      const state = await persistence.loadState();
      
      sendToAtlasIframe(iframeRef.current.contentWindow, {
        type: 'main:init-state',
        payload: state,
      });
    } catch (err) {
      console.error('[AtlasFrame] Failed to load persisted state:', err);
    }
  }, []);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = frameState.position === 'right'
        ? window.innerWidth - e.clientX
        : e.clientX;
      
      setFrameState(prev => ({
        ...prev,
        width: Math.max(minWidth, Math.min(maxWidth, newWidth)),
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, frameState.position, minWidth, maxWidth]);

  // Toggle collapse
  const toggleCollapse = useCallback(() => {
    setFrameState(prev => ({ ...prev, collapsed: !prev.collapsed }));
    // Clear unread when expanding
    if (frameState.collapsed) {
      setUnreadCount(0);
    }
  }, [frameState.collapsed]);

  // Send app events to iframe (e.g., route changes, DOM events)
  useEffect(() => {
    // Notify iframe of location changes
    const handlePopState = () => {
      if (iframeRef.current?.contentWindow && isIframeReady) {
        sendToAtlasIframe(iframeRef.current.contentWindow, {
          type: 'main:route-change',
          payload: {
            path: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
          },
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isIframeReady]);

  // Forward A11y events to iframe
  useEffect(() => {
    if (!isIframeReady) return;
    
    const a11yService = getA11yEvents();
    
    // Forward A11y events
    const unsubscribeA11y = a11yService.onEvent((event: A11yEvent) => {
      if (iframeRef.current?.contentWindow) {
        sendToAtlasIframe(iframeRef.current.contentWindow, {
          type: 'main:a11y-event',
          payload: event,
        });
      }
    });
    
    // Forward batches
    const unsubscribeBatch = a11yService.onBatch((batch) => {
      if (iframeRef.current?.contentWindow) {
        sendToAtlasIframe(iframeRef.current.contentWindow, {
          type: 'main:a11y-batch',
          payload: batch,
        });
      }
    });
    
    return () => {
      unsubscribeA11y();
      unsubscribeBatch();
    };
  }, [isIframeReady]);

  // Track DOM events (clicks, focus, etc.)
  useEffect(() => {
    if (!isIframeReady) return;
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || iframeRef.current?.contains(target)) return;
      
      const payload: DOMEventPayload = {
        eventType: 'click',
        target: {
          tagName: target.tagName,
          id: target.id || undefined,
          className: target.className || undefined,
          role: target.getAttribute('role') || undefined,
          ariaLabel: target.getAttribute('aria-label') || undefined,
          textContent: target.textContent?.slice(0, 50) || undefined,
        },
        timestamp: Date.now(),
      };
      
      if (iframeRef.current?.contentWindow) {
        sendToAtlasIframe(iframeRef.current.contentWindow, {
          type: 'main:dom-event',
          payload,
        });
      }
    };
    
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target || iframeRef.current?.contains(target)) return;
      
      const payload: DOMEventPayload = {
        eventType: 'focus',
        target: {
          tagName: target.tagName,
          id: target.id || undefined,
          role: target.getAttribute('role') || undefined,
          ariaLabel: target.getAttribute('aria-label') || undefined,
        },
        timestamp: Date.now(),
      };
      
      if (iframeRef.current?.contentWindow) {
        sendToAtlasIframe(iframeRef.current.contentWindow, {
          type: 'main:dom-event',
          payload,
        });
      }
    };
    
    document.addEventListener('click', handleClick, true);
    document.addEventListener('focusin', handleFocus, true);
    
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('focusin', handleFocus, true);
    };
  }, [isIframeReady]);

  // Forward dashboard context to iframe
  useEffect(() => {
    if (!isIframeReady) return;
    
    const dashboardContext = getDashboardContext();
    
    // Send initial context immediately if available
    const initialContext = dashboardContext.getContext();
    if (initialContext && iframeRef.current?.contentWindow) {
      console.log('[AtlasFrame] Sending initial dashboard context:', initialContext);
      sendToAtlasIframe(iframeRef.current.contentWindow, {
        type: 'main:dashboard-context',
        payload: {
          services: initialContext.services,
          images: initialContext.images,
          currentView: initialContext.currentView,
          timestamp: Date.now(),
        },
      });
    }
    
    // Subscribe to future updates
    const unsubscribe = dashboardContext.onContextChange((context) => {
      if (iframeRef.current?.contentWindow) {
        console.log('[AtlasFrame] Forwarding dashboard context update:', context);
        sendToAtlasIframe(iframeRef.current.contentWindow, {
          type: 'main:dashboard-context',
          payload: {
            services: context.services,
            images: context.images,
            currentView: context.currentView,
            timestamp: Date.now(),
          },
        });
      }
    });
    
    return unsubscribe;
  }, [isIframeReady]);

  const currentWidth = frameState.collapsed ? COLLAPSE_WIDTH : frameState.width;
  const positionStyle = frameState.position === 'right' 
    ? { right: 0 } 
    : { left: 0 };

  return (
    <div
      className="fixed top-0 bottom-0 z-50 flex"
      style={{
        width: currentWidth,
        ...positionStyle,
        transition: isResizing ? 'none' : 'width 0.2s ease-out',
      }}
      role="complementary"
      aria-label="Atlas AI Assistant"
    >
      {/* Resize Handle (when not collapsed) */}
      {!frameState.collapsed && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          className={`w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors ${
            isResizing ? 'bg-indigo-500' : 'bg-zinc-700'
          } ${frameState.position === 'right' ? 'order-first' : 'order-last'}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Atlas panel"
        />
      )}

      {/* Main Frame Content */}
      <div className="flex-1 flex flex-col bg-zinc-900 border-l border-zinc-700 overflow-hidden">
        {/* Collapsed State */}
        {frameState.collapsed ? (
          <button
            onClick={toggleCollapse}
            className="flex-1 flex flex-col items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
            aria-label="Expand Atlas panel"
          >
            <span className="text-2xl">🌐</span>
            <span className="text-xs text-zinc-400 writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>
              Atlas
            </span>
            {unreadCount > 0 && (
              <span className="absolute top-4 right-1 w-5 h-5 bg-indigo-500 rounded-full text-xs flex items-center justify-center text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ) : (
          <>
            {/* Header Bar */}
            <div className="flex-shrink-0 h-10 flex items-center justify-between px-3 border-b border-zinc-700 bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌐</span>
                <span className="text-sm font-medium text-zinc-200">Atlas</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFrameState(prev => ({ 
                    ...prev, 
                    position: prev.position === 'right' ? 'left' : 'right' 
                  }))}
                  className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                  aria-label={`Move panel to ${frameState.position === 'right' ? 'left' : 'right'}`}
                  title={`Move to ${frameState.position === 'right' ? 'left' : 'right'}`}
                >
                  {frameState.position === 'right' ? '⬅️' : '➡️'}
                </button>
                <button
                  onClick={toggleCollapse}
                  className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                  aria-label="Collapse Atlas panel"
                  title="Collapse"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 relative">
              {!isIframeReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">Loading Atlas...</p>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src="/atlas-iframe.html"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
                title="Atlas AI Assistant"
                aria-label="Atlas chat interface"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AtlasFrame;
