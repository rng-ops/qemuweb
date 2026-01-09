import React, { useState, useCallback, useEffect } from 'react';
import { FileMetadata } from '@qemuweb/storage';
import { DocumentViewer } from './DocumentViewer';
import { getFileTracker } from '../../services/atlasFileTracker';

export interface TabInfo {
  id: string;
  file: FileMetadata;
  isDirty?: boolean;
}

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onTabReorder?.(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropIndex(null);
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-700 overflow-x-auto">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-gray-700 cursor-pointer select-none min-w-0 max-w-[200px] ${
            tab.id === activeTabId
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          } ${dropIndex === index ? 'border-l-2 border-l-indigo-500' : ''}`}
          onClick={() => onTabSelect(tab.id)}
        >
          <FileIcon type={tab.file.type} className="w-4 h-4 flex-shrink-0" />
          <span className="truncate flex-1">{tab.file.name}</span>
          {tab.isDirty && <span className="w-2 h-2 bg-white rounded-full flex-shrink-0" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className="p-0.5 hover:bg-gray-600 rounded flex-shrink-0"
          >
            <CloseIcon className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

interface TabbedDocumentViewerProps {
  onFileChange?: (file: FileMetadata, content: unknown) => void;
  onGenerateRequest?: (file: FileMetadata, type: string) => void;
}

export const TabbedDocumentViewer: React.FC<TabbedDocumentViewerProps> = ({
  onFileChange,
  onGenerateRequest,
}) => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openFile = useCallback((file: FileMetadata) => {
    // Check if already open
    const existing = tabs.find((t) => t.file.id === file.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    // Add new tab
    const newTab: TabInfo = {
      id: `tab-${file.id}-${Date.now()}`,
      file,
      isDirty: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      const newTabs = prev.filter((t) => t.id !== id);

      // Update active tab if needed
      if (id === activeTabId && newTabs.length > 0) {
        const newIndex = Math.min(index, newTabs.length - 1);
        setActiveTabId(newTabs[newIndex].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }

      return newTabs;
    });
  }, [activeTabId]);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const newTabs = [...prev];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);
      return newTabs;
    });
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Expose openFile method
  useEffect(() => {
    (window as any).__tabbedViewer = { openFile };
    return () => {
      delete (window as any).__tabbedViewer;
    };
  }, [openFile]);

  return (
    <div className="flex flex-col h-full">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={closeTab}
        onTabReorder={reorderTabs}
      />

      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <DocumentViewer
            file={activeTab.file}
            onContentChange={(content: unknown) => {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === activeTab.id ? { ...t, isDirty: true } : t
                )
              );
              // Track file update for Atlas
              const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
              getFileTracker().trackFileUpdate(activeTab.file, 'edit', contentStr);
              onFileChange?.(activeTab.file, content);
            }}
            onGenerateRequest={(type: string) => onGenerateRequest?.(activeTab.file, type)}
            onSave={async (_file: FileMetadata, _content: ArrayBuffer) => {
              // Clear dirty state after successful save
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === activeTab.id ? { ...t, isDirty: false } : t
                )
              );
              // Track file save for Atlas
              const contentStr = new TextDecoder().decode(_content);
              getFileTracker().trackFileSave(_file, contentStr);
            }}
          />
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
};

// Welcome screen when no tabs are open
const WelcomeScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-400">
    <LogoIcon className="w-24 h-24 mb-6 opacity-20" />
    <h2 className="text-xl font-medium mb-2">Welcome to QemuWeb</h2>
    <p className="text-sm text-gray-500 mb-6">
      Open a file from the explorer to get started
    </p>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div className="flex items-center gap-2">
        <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⌘ + O</kbd>
        <span>Open file</span>
      </div>
      <div className="flex items-center gap-2">
        <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⌘ + N</kbd>
        <span>New file</span>
      </div>
      <div className="flex items-center gap-2">
        <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⌘ + P</kbd>
        <span>Quick open</span>
      </div>
      <div className="flex items-center gap-2">
        <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⌘ + ⇧ + P</kbd>
        <span>Command palette</span>
      </div>
    </div>
  </div>
);

// Icons
const FileIcon: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
  const colors: Record<string, string> = {
    qcow2: 'text-purple-400',
    'raw-disk': 'text-purple-300',
    wasm: 'text-green-400',
    kernel: 'text-orange-400',
    initrd: 'text-orange-300',
    config: 'text-blue-400',
    script: 'text-cyan-400',
    plan: 'text-indigo-400',
    report: 'text-pink-400',
    bundle: 'text-teal-400',
    upload: 'text-yellow-400',
    other: 'text-gray-400',
  };

  return (
    <svg className={`${className} ${colors[type] || 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
};

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor">
    <rect x="10" y="20" width="80" height="60" rx="5" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="20" y="30" width="25" height="20" rx="2" />
    <rect x="55" y="30" width="25" height="20" rx="2" />
    <rect x="20" y="55" width="60" height="15" rx="2" />
  </svg>
);

export default TabbedDocumentViewer;
