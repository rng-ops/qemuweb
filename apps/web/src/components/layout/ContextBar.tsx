import React, { useState, useCallback, useEffect } from 'react';

interface ContextBarProps {
  onNewFile?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onToggleTerminal?: () => void;
  activeFileName?: string;
}

export const ContextBar: React.FC<ContextBarProps> = ({
  onNewFile,
  onOpenCommandPalette,
  onOpenSettings,
  onToggleTerminal,
  activeFileName,
}) => {
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const handleMenuClick = (menu: string) => {
    setShowMenu(showMenu === menu ? null : menu);
  };

  useEffect(() => {
    const handleClickOutside = () => setShowMenu(null);
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const menus = {
    file: [
      { label: 'New File', shortcut: '⌘N', action: onNewFile },
      { label: 'Open...', shortcut: '⌘O', action: () => {} },
      { label: 'Save', shortcut: '⌘S', action: () => {} },
      { label: 'Save As...', shortcut: '⇧⌘S', action: () => {} },
      { divider: true },
      { label: 'Import Bundle...', action: () => {} },
      { label: 'Export Bundle...', action: () => {} },
    ],
    edit: [
      { label: 'Undo', shortcut: '⌘Z', action: () => {} },
      { label: 'Redo', shortcut: '⇧⌘Z', action: () => {} },
      { divider: true },
      { label: 'Cut', shortcut: '⌘X', action: () => {} },
      { label: 'Copy', shortcut: '⌘C', action: () => {} },
      { label: 'Paste', shortcut: '⌘V', action: () => {} },
      { divider: true },
      { label: 'Find', shortcut: '⌘F', action: () => {} },
      { label: 'Replace', shortcut: '⌥⌘F', action: () => {} },
    ],
    view: [
      { label: 'Command Palette...', shortcut: '⇧⌘P', action: onOpenCommandPalette },
      { divider: true },
      { label: 'Explorer', shortcut: '⇧⌘E', action: () => {} },
      { label: 'Terminal', shortcut: '⌃`', action: onToggleTerminal },
      { label: 'Assistant', shortcut: '⌃⇧A', action: () => {} },
      { divider: true },
      { label: 'Zoom In', shortcut: '⌘+', action: () => {} },
      { label: 'Zoom Out', shortcut: '⌘-', action: () => {} },
    ],
    vm: [
      { label: 'Launch VM...', shortcut: '⌘⏎', action: () => {} },
      { label: 'Stop VM', action: () => {} },
      { divider: true },
      { label: 'VM Settings...', action: () => {} },
      { label: 'Snapshots...', action: () => {} },
    ],
    help: [
      { label: 'Documentation', action: () => window.open('https://github.com/user/qemuweb', '_blank') },
      { label: 'Keyboard Shortcuts', shortcut: '⌘K ⌘S', action: () => {} },
      { divider: true },
      { label: 'About QemuWeb', action: () => {} },
    ],
  };

  return (
    <div className="flex items-center h-9 bg-gray-900 border-b border-gray-700 px-2 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 px-2">
        <LogoIcon className="w-4 h-4 text-indigo-400" />
      </div>

      {/* Menu Bar */}
      <div className="flex items-center">
        {Object.entries(menus).map(([key, items]) => (
          <div key={key} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMenuClick(key);
              }}
              className={`px-3 py-1 text-sm capitalize ${
                showMenu === key
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              } rounded`}
            >
              {key}
            </button>

            {showMenu === key && (
              <div
                className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[200px] z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {items.map((item, i) =>
                  'divider' in item ? (
                    <div key={i} className="border-t border-gray-700 my-1" />
                  ) : (
                    <button
                      key={i}
                      onClick={() => {
                        item.action?.();
                        setShowMenu(null);
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs text-gray-500">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Center - Active File */}
      <div className="flex-1 flex items-center justify-center">
        {activeFileName && (
          <span className="text-sm text-gray-400">{activeFileName}</span>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenCommandPalette}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          title="Command Palette (⇧⌘P)"
        >
          <SearchIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Command Palette Modal
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: Command[];
}

interface Command {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands = defaultCommands,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category?.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-800 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-gray-700">
          <SearchIcon className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm ${
                  i === selectedIndex
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-200 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {cmd.category && (
                    <span className={`text-xs ${i === selectedIndex ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {cmd.category}
                    </span>
                  )}
                  <span>{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <span className={`text-xs ${i === selectedIndex ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const defaultCommands: Command[] = [
  { id: 'new-file', label: 'New File', category: 'File', shortcut: '⌘N', action: () => {} },
  { id: 'open-file', label: 'Open File', category: 'File', shortcut: '⌘O', action: () => {} },
  { id: 'save-file', label: 'Save', category: 'File', shortcut: '⌘S', action: () => {} },
  { id: 'import-bundle', label: 'Import Bundle', category: 'File', action: () => {} },
  { id: 'export-bundle', label: 'Export Bundle', category: 'File', action: () => {} },
  { id: 'launch-vm', label: 'Launch VM', category: 'VM', shortcut: '⌘⏎', action: () => {} },
  { id: 'stop-vm', label: 'Stop VM', category: 'VM', action: () => {} },
  { id: 'vm-settings', label: 'VM Settings', category: 'VM', action: () => {} },
  { id: 'generate-terraform', label: 'Generate Terraform Plan', category: 'Generate', action: () => {} },
  { id: 'generate-diagram', label: 'Generate Diagram', category: 'Generate', action: () => {} },
  { id: 'validate-config', label: 'Validate Configuration', category: 'Tools', action: () => {} },
  { id: 'toggle-terminal', label: 'Toggle Terminal', category: 'View', shortcut: '⌃`', action: () => {} },
  { id: 'toggle-assistant', label: 'Toggle Assistant', category: 'View', shortcut: '⌃⇧A', action: () => {} },
  { id: 'toggle-explorer', label: 'Toggle Explorer', category: 'View', shortcut: '⇧⌘E', action: () => {} },
  { id: 'settings', label: 'Open Settings', category: 'Preferences', shortcut: '⌘,', action: () => {} },
];

// Icons
const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor">
    <rect x="10" y="20" width="80" height="60" rx="5" stroke="currentColor" strokeWidth="4" fill="none" />
    <circle cx="30" cy="40" r="8" />
    <circle cx="70" cy="40" r="8" />
    <rect x="25" y="55" width="50" height="10" rx="2" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
