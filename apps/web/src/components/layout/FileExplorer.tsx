import React, { useState, useMemo, useCallback } from 'react';
import { FileMetadata, ManifestType } from '@qemuweb/storage';
import { useAtlasStore } from '../../hooks/useAtlasStore';

interface FileExplorerProps {
  onFileOpen: (file: FileMetadata) => void;
  onFileSelect?: (file: FileMetadata | null) => void;
  selectedFileId?: string;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  onFileOpen,
  onFileSelect,
  selectedFileId,
}) => {
  const {
    files,
    loading,
    stats,
    uploadFile,
    deleteFile,
    toggleShared,
    refresh: _refresh, // Available for future refresh functionality
  } = useAtlasStore();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileMetadata;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Group files by type as "virtual folders"
  const fileTree = useMemo(() => {
    const filtered = searchQuery
      ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : files;

    const groups: Record<string, FileMetadata[]> = {};
    
    for (const file of filtered) {
      const folder = getTypeFolder(file.type);
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(file);
    }

    // Sort files within each group
    for (const folder of Object.keys(groups)) {
      groups[folder].sort((a, b) => a.name.localeCompare(b.name));
    }

    return groups;
  }, [files, searchQuery]);

  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileMetadata) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      for (const file of droppedFiles) {
        try {
          await uploadFile(file);
        } catch (err) {
          console.error('Upload failed:', err);
        }
      }
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDelete = useCallback(
    async (file: FileMetadata) => {
      if (confirm(`Delete "${file.name}"?`)) {
        await deleteFile(file.name);
      }
      closeContextMenu();
    },
    [deleteFile, closeContextMenu]
  );

  const handleToggleShare = useCallback(
    async (file: FileMetadata) => {
      await toggleShared(file.name);
      closeContextMenu();
    },
    [toggleShared, closeContextMenu]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full ${dragOver ? 'bg-indigo-900/20' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={closeContextMenu}
    >
      {/* Search */}
      <div className="px-2 py-2">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto px-1">
        {Object.entries(fileTree).map(([folder, folderFiles]) => (
          <div key={folder}>
            {/* Folder Header */}
            <button
              onClick={() => toggleFolder(folder)}
              className="flex items-center w-full px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 rounded"
            >
              <ChevronIcon
                className={`w-4 h-4 mr-1 transition-transform ${
                  expandedFolders.has(folder) ? 'rotate-90' : ''
                }`}
              />
              <FolderIcon className={`w-4 h-4 mr-2 ${getFolderColor(folder)}`} />
              <span className="flex-1 text-left truncate">{folder}</span>
              <span className="text-xs text-gray-500">{folderFiles.length}</span>
            </button>

            {/* Folder Contents */}
            {expandedFolders.has(folder) && (
              <div className="ml-4">
                {folderFiles.map((file) => (
                  <FileItem
                    key={file.id}
                    file={file}
                    isSelected={file.id === selectedFileId}
                    onSelect={() => onFileSelect?.(file)}
                    onOpen={() => onFileOpen(file)}
                    onContextMenu={(e) => handleContextMenu(e, file)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {Object.keys(fileTree).length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            {searchQuery ? 'No files match your search' : 'Drop files here to upload'}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500">
          {stats.totalFiles} files • {formatBytes(stats.totalBytes)}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={closeContextMenu}
          onOpen={() => {
            onFileOpen(contextMenu.file);
            closeContextMenu();
          }}
          onDelete={() => handleDelete(contextMenu.file)}
          onToggleShare={() => handleToggleShare(contextMenu.file)}
        />
      )}

      {/* Upload Button */}
      <div className="p-2 border-t border-gray-700">
        <label className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer">
          <UploadIcon className="w-4 h-4" />
          Upload Files
          <input
            type="file"
            multiple
            onChange={async (e) => {
              if (e.target.files) {
                for (const file of Array.from(e.target.files)) {
                  await uploadFile(file);
                }
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
};

// File Item Component
interface FileItemProps {
  file: FileMetadata;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  isSelected,
  onSelect,
  onOpen,
  onContextMenu,
}) => (
  <div
    className={`flex items-center px-2 py-1 text-sm rounded cursor-pointer group ${
      isSelected
        ? 'bg-indigo-600/30 text-white'
        : 'text-gray-300 hover:bg-gray-800'
    }`}
    onClick={() => {
      onSelect();
      onOpen(); // Also open on single click
    }}
    onDoubleClick={onOpen}
    onContextMenu={onContextMenu}
  >
    <FileTypeIcon type={file.type} className="w-4 h-4 mr-2 flex-shrink-0" />
    <span className="flex-1 truncate">{file.name}</span>
    {file.sharedWithAssistant && (
      <ShareIcon className="w-3 h-3 text-indigo-400 ml-1" />
    )}
  </div>
);

// Context Menu
interface ContextMenuProps {
  x: number;
  y: number;
  file: FileMetadata;
  onClose: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onToggleShare: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  file,
  onClose: _onClose, // Called via click-outside handler
  onOpen,
  onDelete,
  onToggleShare,
}) => (
  <div
    className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
    style={{ left: x, top: y }}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={onOpen}
      className="w-full px-3 py-1.5 text-sm text-left text-gray-200 hover:bg-gray-700"
    >
      Open
    </button>
    <button
      onClick={onToggleShare}
      className="w-full px-3 py-1.5 text-sm text-left text-gray-200 hover:bg-gray-700"
    >
      {file.sharedWithAssistant ? 'Unshare with Assistant' : 'Share with Assistant'}
    </button>
    <div className="border-t border-gray-700 my-1" />
    <button
      onClick={onDelete}
      className="w-full px-3 py-1.5 text-sm text-left text-red-400 hover:bg-gray-700"
    >
      Delete
    </button>
  </div>
);

// Helpers
function getTypeFolder(type: ManifestType): string {
  const folders: Record<ManifestType, string> = {
    qcow2: 'Disk Images',
    'raw-disk': 'Disk Images',
    wasm: 'WebAssembly',
    kernel: 'Boot Images',
    initrd: 'Boot Images',
    config: 'Configurations',
    script: 'Scripts',
    plan: 'Terraform Plans',
    report: 'Reports',
    bundle: 'Bundles',
    upload: 'Uploads',
    other: 'Other Files',
  };
  return folders[type] || 'Other Files';
}

function getFolderColor(folder: string): string {
  const colors: Record<string, string> = {
    'Disk Images': 'text-purple-400',
    'WebAssembly': 'text-green-400',
    'Boot Images': 'text-orange-400',
    'Configurations': 'text-blue-400',
    'Scripts': 'text-cyan-400',
    'Terraform Plans': 'text-indigo-400',
    'Reports': 'text-pink-400',
    'Bundles': 'text-teal-400',
    'Uploads': 'text-yellow-400',
    'Other Files': 'text-gray-400',
  };
  return colors[folder] || 'text-gray-400';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Icons
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

const FileTypeIcon: React.FC<{ type: ManifestType; className?: string }> = ({ type, className }) => {
  const colors: Record<ManifestType, string> = {
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
    <svg className={`${className} ${colors[type]}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
};

const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
  </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);
