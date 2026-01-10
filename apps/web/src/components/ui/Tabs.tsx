import { ReactNode, useState } from 'react';

interface Tab {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'boxed';
  className?: string;
}

export function Tabs({ 
  tabs, 
  defaultTab, 
  onChange,
  variant = 'underline',
  className = '' 
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find(t => t.id === activeTab)?.content;

  const baseTabClass = 'px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 focus:ring-offset-zinc-900';
  
  const variantClasses = {
    underline: {
      container: 'border-b border-zinc-800',
      tab: (active: boolean, disabled: boolean) => 
        `${baseTabClass} border-b-2 -mb-px ${
          disabled 
            ? 'text-zinc-600 cursor-not-allowed border-transparent' 
            : active 
              ? 'text-blue-400 border-blue-500' 
              : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:border-zinc-600'
        }`,
    },
    pills: {
      container: 'flex gap-1',
      tab: (active: boolean, disabled: boolean) => 
        `${baseTabClass} rounded-full ${
          disabled 
            ? 'text-zinc-600 cursor-not-allowed' 
            : active 
              ? 'bg-blue-600 text-white' 
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        }`,
    },
    boxed: {
      container: 'bg-zinc-900 p-1 rounded-lg inline-flex',
      tab: (active: boolean, disabled: boolean) => 
        `${baseTabClass} rounded-md ${
          disabled 
            ? 'text-zinc-600 cursor-not-allowed' 
            : active 
              ? 'bg-zinc-700 text-white shadow' 
              : 'text-zinc-400 hover:text-zinc-200'
        }`,
    },
  };

  return (
    <div className={className}>
      <div className={variantClasses[variant].container}>
        <nav className="flex" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              className={variantClasses[variant].tab(activeTab === tab.id, !!tab.disabled)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              disabled={tab.disabled}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-4">
        {activeContent}
      </div>
    </div>
  );
}

// Controlled version for more complex use cases
interface ControlledTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'boxed';
  className?: string;
}

export function ControlledTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  className = ''
}: ControlledTabsProps) {
  return (
    <Tabs
      tabs={tabs}
      defaultTab={activeTab}
      onChange={onTabChange}
      variant={variant}
      className={className}
    />
  );
}
