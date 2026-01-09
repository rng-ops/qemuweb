import React, { useState, useRef, useCallback, useEffect } from 'react';

interface SplitLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel?: React.ReactNode; // Optional - Atlas is in AppShell now
  leftWidth?: number;
  rightWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  minCenterWidth?: number;
  onLeftWidthChange?: (width: number) => void;
  onRightWidthChange?: (width: number) => void;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  leftWidth: initialLeftWidth = 260,
  rightWidth: initialRightWidth = 340,
  minLeftWidth = 200,
  minRightWidth = 280,
  minCenterWidth = 400,
  onLeftWidthChange,
  onRightWidthChange,
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((side: 'left' | 'right') => {
    setDragging(side);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;

      if (dragging === 'left') {
        const newWidth = Math.max(
          minLeftWidth,
          Math.min(e.clientX - rect.left, containerWidth - rightWidth - minCenterWidth)
        );
        setLeftWidth(newWidth);
        onLeftWidthChange?.(newWidth);
      } else if (dragging === 'right') {
        const newWidth = Math.max(
          minRightWidth,
          Math.min(rect.right - e.clientX, containerWidth - leftWidth - minCenterWidth)
        );
        setRightWidth(newWidth);
        onRightWidthChange?.(newWidth);
      }
    },
    [dragging, leftWidth, rightWidth, minLeftWidth, minRightWidth, minCenterWidth, onLeftWidthChange, onRightWidthChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const actualLeftWidth = leftCollapsed ? 48 : leftWidth;
  const actualRightWidth = !rightPanel || rightCollapsed ? 0 : rightWidth;
  const hasRightPanel = !!rightPanel;

  return (
    <div ref={containerRef} className="flex h-full w-full bg-gray-900 overflow-hidden">
      {/* Left Panel - File Explorer */}
      <div
        className="flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden transition-all duration-200"
        style={{ width: actualLeftWidth }}
      >
        {leftCollapsed ? (
          <CollapsedSidebar onExpand={() => setLeftCollapsed(false)} />
        ) : (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Explorer
              </span>
              <button
                onClick={() => setLeftCollapsed(true)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{leftPanel}</div>
          </>
        )}
      </div>

      {/* Left Resize Handle */}
      {!leftCollapsed && (
        <div
          className={`w-1 bg-gray-700 hover:bg-indigo-500 cursor-col-resize flex-shrink-0 transition-colors ${
            dragging === 'left' ? 'bg-indigo-500' : ''
          }`}
          onMouseDown={() => handleMouseDown('left')}
        />
      )}

      {/* Center Panel - Content Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-800 overflow-hidden">
        {centerPanel}
      </div>

      {/* Right Resize Handle - only if right panel exists */}
      {hasRightPanel && !rightCollapsed && (
        <div
          className={`w-1 bg-gray-700 hover:bg-indigo-500 cursor-col-resize flex-shrink-0 transition-colors ${
            dragging === 'right' ? 'bg-indigo-500' : ''
          }`}
          onMouseDown={() => handleMouseDown('right')}
        />
      )}

      {/* Right Panel - Only render if provided */}
      {hasRightPanel && (
        <div
          className="flex-shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden transition-all duration-200"
          style={{ width: actualRightWidth }}
        >
          {rightCollapsed ? null : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Assistant
                </span>
                <button
                  onClick={() => setRightCollapsed(true)}
                  className="p-1 text-gray-400 hover:text-white rounded"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">{rightPanel}</div>
            </>
          )}
        </div>
      )}

      {/* Collapsed Right Panel Toggle - only if right panel exists */}
      {hasRightPanel && rightCollapsed && (
        <button
          onClick={() => setRightCollapsed(false)}
          className="w-10 bg-gray-900 border-l border-gray-700 flex items-center justify-center hover:bg-gray-800"
        >
          <ChatIcon className="w-5 h-5 text-gray-400" />
        </button>
      )}
    </div>
  );
};

// Collapsed sidebar with icons
const CollapsedSidebar: React.FC<{ onExpand: () => void }> = ({ onExpand }) => (
  <div className="flex flex-col items-center py-2 gap-2">
    <button
      onClick={onExpand}
      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
      title="Expand Explorer"
    >
      <FolderIcon className="w-5 h-5" />
    </button>
  </div>
);

// Icons
const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);
