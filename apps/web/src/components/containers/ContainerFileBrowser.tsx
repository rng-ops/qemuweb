/**
 * Container File Browser
 *
 * File explorer for browsing files inside running container instances.
 * Shows a tree view of the container's filesystem.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { ContainerInstance, ContainerImage } from '@qemuweb/vm-config';

interface ContainerFile {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  permissions?: string;
  modified?: Date;
  children?: ContainerFile[];
}

interface ContainerFileBrowserProps {
  instance: ContainerInstance;
  image: ContainerImage;
  onFileSelect?: (file: ContainerFile) => void;
  onFileOpen?: (file: ContainerFile) => void;
  onClose?: () => void;
}

// Simulated filesystem for demo
const DEMO_FILESYSTEM: ContainerFile = {
  name: '/',
  path: '/',
  type: 'directory',
  children: [
    {
      name: 'bin',
      path: '/bin',
      type: 'directory',
      children: [
        { name: 'sh', path: '/bin/sh', type: 'symlink', size: 0 },
        { name: 'ls', path: '/bin/ls', type: 'file', size: 134848 },
        { name: 'cat', path: '/bin/cat', type: 'file', size: 35064 },
      ],
    },
    {
      name: 'etc',
      path: '/etc',
      type: 'directory',
      children: [
        { name: 'passwd', path: '/etc/passwd', type: 'file', size: 1234 },
        { name: 'hosts', path: '/etc/hosts', type: 'file', size: 256 },
        { name: 'resolv.conf', path: '/etc/resolv.conf', type: 'file', size: 128 },
        {
          name: 'ssh',
          path: '/etc/ssh',
          type: 'directory',
          children: [
            { name: 'sshd_config', path: '/etc/ssh/sshd_config', type: 'file', size: 3456 },
            { name: 'ssh_host_rsa_key.pub', path: '/etc/ssh/ssh_host_rsa_key.pub', type: 'file', size: 512 },
          ],
        },
      ],
    },
    {
      name: 'home',
      path: '/home',
      type: 'directory',
      children: [],
    },
    {
      name: 'opt',
      path: '/opt',
      type: 'directory',
      children: [
        {
          name: 'mcp',
          path: '/opt/mcp',
          type: 'directory',
          children: [
            { name: 'config.json', path: '/opt/mcp/config.json', type: 'file', size: 512 },
            { name: 'mcp-server', path: '/opt/mcp/mcp-server', type: 'file', size: 2048576, permissions: '-rwxr-xr-x' },
            {
              name: 'servers',
              path: '/opt/mcp/servers',
              type: 'directory',
              children: [
                { name: 'filesystem.so', path: '/opt/mcp/servers/filesystem.so', type: 'file', size: 524288 },
                { name: 'container.so', path: '/opt/mcp/servers/container.so', type: 'file', size: 786432 },
              ],
            },
          ],
        },
        {
          name: 'terraform',
          path: '/opt/terraform',
          type: 'directory',
          children: [
            { name: 'main.tf', path: '/opt/terraform/main.tf', type: 'file', size: 1024 },
            { name: 'variables.tf', path: '/opt/terraform/variables.tf', type: 'file', size: 768 },
            { name: 'outputs.tf', path: '/opt/terraform/outputs.tf', type: 'file', size: 256 },
            { name: '.terraform', path: '/opt/terraform/.terraform', type: 'directory', children: [] },
            { name: 'terraform.tfstate', path: '/opt/terraform/terraform.tfstate', type: 'file', size: 4096 },
          ],
        },
      ],
    },
    {
      name: 'root',
      path: '/root',
      type: 'directory',
      children: [
        { name: '.bashrc', path: '/root/.bashrc', type: 'file', size: 512 },
        { name: '.profile', path: '/root/.profile', type: 'file', size: 256 },
        {
          name: '.ssh',
          path: '/root/.ssh',
          type: 'directory',
          children: [
            { name: 'authorized_keys', path: '/root/.ssh/authorized_keys', type: 'file', size: 512 },
            { name: 'known_hosts', path: '/root/.ssh/known_hosts', type: 'file', size: 1024 },
          ],
        },
        {
          name: 'scripts',
          path: '/root/scripts',
          type: 'directory',
          children: [
            { name: 'startup.sh', path: '/root/scripts/startup.sh', type: 'file', size: 256, permissions: '-rwxr-xr-x' },
            { name: 'health-check.sh', path: '/root/scripts/health-check.sh', type: 'file', size: 128, permissions: '-rwxr-xr-x' },
            { name: 'mcp-server.sh', path: '/root/scripts/mcp-server.sh', type: 'file', size: 384, permissions: '-rwxr-xr-x' },
          ],
        },
      ],
    },
    {
      name: 'tmp',
      path: '/tmp',
      type: 'directory',
      children: [
        { name: 'mcp.sock', path: '/tmp/mcp.sock', type: 'file', size: 0 },
      ],
    },
    {
      name: 'var',
      path: '/var',
      type: 'directory',
      children: [
        {
          name: 'log',
          path: '/var/log',
          type: 'directory',
          children: [
            { name: 'messages', path: '/var/log/messages', type: 'file', size: 65536 },
            { name: 'mcp.log', path: '/var/log/mcp.log', type: 'file', size: 8192 },
          ],
        },
      ],
    },
  ],
};

export const ContainerFileBrowser: React.FC<ContainerFileBrowserProps> = ({
  instance,
  image,
  onFileSelect,
  onFileOpen,
  onClose,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (file: ContainerFile) => {
      setSelectedPath(file.path);
      onFileSelect?.(file);
    },
    [onFileSelect]
  );

  const handleOpen = useCallback(
    (file: ContainerFile) => {
      if (file.type === 'directory') {
        toggleExpand(file.path);
      } else {
        onFileOpen?.(file);
      }
    },
    [onFileOpen, toggleExpand]
  );

  // Filter files based on search
  const filterFiles = useMemo(() => {
    if (!searchQuery) return null;
    
    const results: ContainerFile[] = [];
    const search = (file: ContainerFile) => {
      if (file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push(file);
      }
      file.children?.forEach(search);
    };
    search(DEMO_FILESYSTEM);
    return results;
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FolderIcon className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">
            {instance.name}
          </span>
          <span className="text-xs text-gray-400">({image.name})</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <CloseIcon className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-2 border-b border-gray-700">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto p-2">
        {filterFiles ? (
          <div className="space-y-0.5">
            {filterFiles.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">No files found</div>
            ) : (
              filterFiles.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  depth={0}
                  isExpanded={false}
                  isSelected={selectedPath === file.path}
                  showFullPath
                  onToggle={() => {}}
                  onSelect={() => handleSelect(file)}
                  onOpen={() => handleOpen(file)}
                />
              ))
            )}
          </div>
        ) : (
          <FileTreeNode
            file={DEMO_FILESYSTEM}
            depth={0}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            onToggle={toggleExpand}
            onSelect={handleSelect}
            onOpen={handleOpen}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1.5 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex items-center justify-between">
        <span>
          {selectedPath ? selectedPath : 'No file selected'}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Live
          </span>
        </span>
      </div>
    </div>
  );
};

// File tree node component
interface FileTreeNodeProps {
  file: ContainerFile;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (file: ContainerFile) => void;
  onOpen: (file: ContainerFile) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  file,
  depth,
  expandedPaths,
  selectedPath,
  onToggle,
  onSelect,
  onOpen,
}) => {
  const isExpanded = expandedPaths.has(file.path);
  const isSelected = selectedPath === file.path;
  const hasChildren = file.children && file.children.length > 0;

  // Sort children: directories first, then files
  const sortedChildren = useMemo(() => {
    if (!file.children) return [];
    return [...file.children].sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [file.children]);

  return (
    <div>
      <FileItem
        file={file}
        depth={depth}
        isExpanded={isExpanded}
        isSelected={isSelected}
        hasChildren={hasChildren}
        onToggle={() => onToggle(file.path)}
        onSelect={() => onSelect(file)}
        onOpen={() => onOpen(file)}
      />
      {isExpanded && sortedChildren.map((child) => (
        <FileTreeNode
          key={child.path}
          file={child}
          depth={depth + 1}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
};

// Individual file item
interface FileItemProps {
  file: ContainerFile;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  hasChildren?: boolean;
  showFullPath?: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onOpen: () => void;
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  depth,
  isExpanded,
  isSelected,
  hasChildren: _hasChildren,
  showFullPath,
  onToggle,
  onSelect,
  onOpen,
}) => {
  void _hasChildren; // Used via prop type for future expansion indicator
  const isDirectory = file.type === 'directory';
  const isSymlink = file.type === 'symlink';
  const isHidden = file.name.startsWith('.');

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 cursor-pointer rounded text-sm ${
        isSelected
          ? 'bg-indigo-600/30 text-white'
          : 'text-gray-300 hover:bg-gray-800'
      } ${isHidden ? 'opacity-60' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {/* Expand/Collapse Arrow */}
      {isDirectory ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-0.5 hover:bg-gray-700 rounded"
        >
          <ChevronIcon
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>
      ) : (
        <span className="w-4" />
      )}

      {/* Icon */}
      {isDirectory ? (
        <FolderIcon
          className={`w-4 h-4 ${isExpanded ? 'text-yellow-400' : 'text-yellow-500'}`}
        />
      ) : isSymlink ? (
        <SymlinkIcon className="w-4 h-4 text-cyan-400" />
      ) : (
        <FileIcon className="w-4 h-4" type={file.name} />
      )}

      {/* Name */}
      <span className="flex-1 truncate">
        {showFullPath ? file.path : file.name}
      </span>

      {/* Size */}
      {!isDirectory && file.size !== undefined && (
        <span className="text-xs text-gray-500">
          {formatFileSize(file.size)}
        </span>
      )}

      {/* Executable indicator */}
      {file.permissions?.includes('x') && (
        <span className="text-xs text-green-400">*</span>
      )}
    </div>
  );
};

// File icon based on extension
const FileIcon: React.FC<{ className?: string; type: string }> = ({ className, type }) => {
  const ext = type.split('.').pop()?.toLowerCase();
  const colors: Record<string, string> = {
    sh: 'text-green-400',
    tf: 'text-purple-400',
    json: 'text-yellow-400',
    conf: 'text-blue-400',
    log: 'text-gray-400',
    so: 'text-orange-400',
    pub: 'text-cyan-400',
  };

  return (
    <svg className={`${className} ${colors[ext || ''] || 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
};

// Utility function
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'K', 'M', 'G'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)}${sizes[i]}`;
}

// Icons
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

const SymlinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 20 20" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default ContainerFileBrowser;
