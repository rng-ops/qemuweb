/**
 * Internal Browser
 * 
 * Browser component for accessing services within the virtual architecture:
 * - Connect to VMs via internal IP addresses
 * - Browse web services running in containers
 * - Integrated with network topology
 * - Bookmark management
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getMCPRouter } from '../../services/mcpRouter';
import { getAuditLog } from '../../services/auditLog';

// ============ Types ============

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  loading: boolean;
  error?: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  icon?: string;
  category: string;
}

interface ServiceEndpoint {
  id: string;
  name: string;
  type: 'vm' | 'container' | 'service';
  ip: string;
  port: number;
  protocol: 'http' | 'https';
  status: 'online' | 'offline' | 'unknown';
  vmId?: string;
  containerId?: string;
}

// ============ Address Bar ============

interface AddressBarProps {
  url: string;
  onNavigate: (url: string) => void;
  onRefresh: () => void;
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
}

const AddressBar: React.FC<AddressBarProps> = ({
  url,
  onNavigate,
  onRefresh,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  loading,
}) => {
  const [inputValue, setInputValue] = useState(url);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(url);
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = inputValue.trim();
    
    // Add protocol if missing
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      // Check if it looks like an IP address
      if (/^\d+\.\d+\.\d+\.\d+/.test(targetUrl)) {
        targetUrl = `http://${targetUrl}`;
      } else if (targetUrl.includes('.')) {
        targetUrl = `http://${targetUrl}`;
      } else {
        // Treat as internal hostname
        targetUrl = `http://${targetUrl}.vm.local`;
      }
    }
    
    onNavigate(targetUrl);
  };

  const getSecurityIndicator = () => {
    if (!url) return null;
    if (url.startsWith('https://')) {
      return <span className="text-green-500">🔒</span>;
    }
    if (url.startsWith('http://')) {
      return <span className="text-yellow-500">⚠️</span>;
    }
    return null;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="p-1.5 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Go back"
        >
          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onForward}
          disabled={!canGoForward}
          className="p-1.5 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Go forward"
        >
          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
          title="Refresh"
        >
          {loading ? (
            <svg className="w-4 h-4 text-zinc-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>

      {/* Address input */}
      <form onSubmit={handleSubmit} className="flex-1">
        <div className="flex items-center gap-2 bg-zinc-700 rounded-lg px-3 py-1.5">
          {getSecurityIndicator()}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter IP address or URL..."
            className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-500 outline-none"
          />
        </div>
      </form>
    </div>
  );
};

// ============ Tab Bar ============

interface TabBarProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  return (
    <div className="flex items-center bg-zinc-800 border-b border-zinc-700 overflow-x-auto">
      <div className="flex items-center flex-1 min-w-0">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] cursor-pointer
              border-r border-zinc-700 transition-colors
              ${tab.id === activeTabId ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'}
            `}
          >
            {tab.loading && (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <span className="flex-1 text-sm text-zinc-300 truncate">
              {tab.title || 'New Tab'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="p-0.5 rounded hover:bg-zinc-600 transition-colors"
            >
              <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onNewTab}
        className="p-2 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
        title="New tab"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

// ============ Service Discovery Panel ============

interface ServiceDiscoveryProps {
  onNavigate: (url: string) => void;
  endpoints: ServiceEndpoint[];
  bookmarks: Bookmark[];
  onAddBookmark: (bookmark: Omit<Bookmark, 'id'>) => void;
}

const ServiceDiscoveryPanel: React.FC<ServiceDiscoveryProps> = ({
  onNavigate,
  endpoints,
  bookmarks,
}) => {
  const [showBookmarks, setShowBookmarks] = useState(true);

  return (
    <div className="w-64 bg-zinc-800 border-r border-zinc-700 overflow-auto">
      {/* Bookmarks */}
      <div className="border-b border-zinc-700">
        <button
          onClick={() => setShowBookmarks(!showBookmarks)}
          className="flex items-center justify-between w-full px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700"
        >
          <span>📑 Bookmarks</span>
          <svg 
            className={`w-4 h-4 transition-transform ${showBookmarks ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showBookmarks && (
          <div className="pb-2">
            {bookmarks.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">No bookmarks yet</p>
            ) : (
              bookmarks.map(bookmark => (
                <button
                  key={bookmark.id}
                  onClick={() => onNavigate(bookmark.url)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-zinc-700 transition-colors"
                >
                  <span>{bookmark.icon || '🔗'}</span>
                  <span className="text-sm text-zinc-300 truncate">{bookmark.title}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Discovered Services */}
      <div>
        <div className="px-3 py-2 text-sm text-zinc-400 font-medium">
          🔍 Discovered Services
        </div>
        {endpoints.length === 0 ? (
          <p className="px-3 py-2 text-xs text-zinc-500">No services discovered</p>
        ) : (
          <div className="pb-2">
            {endpoints.map(endpoint => (
              <button
                key={endpoint.id}
                onClick={() => onNavigate(`${endpoint.protocol}://${endpoint.ip}:${endpoint.port}`)}
                className="flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-zinc-700 transition-colors"
              >
                <span className={`mt-0.5 ${
                  endpoint.status === 'online' ? 'text-green-500' :
                  endpoint.status === 'offline' ? 'text-red-500' :
                  'text-yellow-500'
                }`}>
                  {endpoint.type === 'vm' ? '🖥️' : 
                   endpoint.type === 'container' ? '📦' : '⚙️'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-300 truncate">{endpoint.name}</div>
                  <div className="text-xs text-zinc-500">
                    {endpoint.ip}:{endpoint.port}
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full mt-1.5 ${
                  endpoint.status === 'online' ? 'bg-green-500' :
                  endpoint.status === 'offline' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ Browser View (iframe wrapper) ============

interface BrowserViewProps {
  url: string;
  onLoad: (title: string) => void;
  onError: (error: string) => void;
}

const BrowserView: React.FC<BrowserViewProps> = ({ url, onLoad, onError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [proxyUrl, setProxyUrl] = useState<string>('');

  useEffect(() => {
    if (!url) {
      setProxyUrl('');
      return;
    }

    // For internal IPs, we route through the busybox router proxy
    const router = getMCPRouter();
    const routerConfig = router.getRouterConfig();
    
    try {
      const urlObj = new URL(url);
      const isInternal = urlObj.hostname.match(/^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./);
      
      if (isInternal) {
        // Route through proxy
        setProxyUrl(`http://${routerConfig.busyboxRouterIp}:${routerConfig.busyboxRouterPort}/proxy${urlObj.pathname}?target=${encodeURIComponent(url)}`);
      } else {
        setProxyUrl(url);
      }
    } catch {
      setProxyUrl(url);
    }
  }, [url]);

  const handleLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      const title = doc?.title || new URL(url).hostname;
      onLoad(title);
    } catch {
      // Cross-origin - can't access title
      onLoad(new URL(url).hostname);
    }
  };

  const handleError = () => {
    onError('Failed to load page');
  };

  if (!url) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🌐</div>
          <h2 className="text-xl font-medium text-zinc-300 mb-2">Internal Browser</h2>
          <p className="text-zinc-500 max-w-md">
            Enter an IP address or hostname to connect to services running in your virtual infrastructure.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left max-w-md mx-auto">
            <div className="p-3 bg-zinc-800 rounded-lg">
              <div className="text-zinc-400 text-sm">Example</div>
              <code className="text-green-400 text-sm">10.0.0.5:8080</code>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <div className="text-zinc-400 text-sm">Vault</div>
              <code className="text-green-400 text-sm">vault.vm.local:8200</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={proxyUrl}
      onLoad={handleLoad}
      onError={handleError}
      className="flex-1 w-full h-full bg-white"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      title="Internal Browser"
    />
  );
};

// ============ Main Internal Browser Component ============

interface InternalBrowserProps {
  className?: string;
  initialUrl?: string;
}

export const InternalBrowser: React.FC<InternalBrowserProps> = ({ 
  className = '',
  initialUrl,
}) => {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 'tab-1',
      title: 'New Tab',
      url: initialUrl || '',
      loading: false,
      canGoBack: false,
      canGoForward: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [showSidebar, setShowSidebar] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([
    { id: 'b1', title: 'Vault UI', url: 'http://10.0.0.2:8200', icon: '🔐', category: 'Infrastructure' },
    { id: 'b2', title: 'Router Admin', url: 'http://10.0.0.1:8080', icon: '🌐', category: 'Infrastructure' },
  ]);
  const [endpoints] = useState<ServiceEndpoint[]>([
    { id: 'ep1', name: 'Vault Server', type: 'vm', ip: '10.0.0.2', port: 8200, protocol: 'http', status: 'online', vmId: 'vault-1' },
    { id: 'ep2', name: 'Busybox Router', type: 'vm', ip: '10.0.0.1', port: 8080, protocol: 'http', status: 'online', vmId: 'router-1' },
    { id: 'ep3', name: 'Alpine Dev', type: 'vm', ip: '10.0.0.10', port: 22, protocol: 'http', status: 'offline', vmId: 'alpine-1' },
  ]);
  const historyRef = useRef<Map<string, string[]>>(new Map());
  const historyIndexRef = useRef<Map<string, number>>(new Map());

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Navigate to URL
  const navigate = useCallback(async (url: string) => {
    if (!activeTabId) return;

    // Log to audit
    const auditLog = await getAuditLog();
    await auditLog.logNavigation('internal-browser', url);

    setTabs(prev => prev.map(tab => {
      if (tab.id !== activeTabId) return tab;
      
      // Update history
      const history = historyRef.current.get(tab.id) || [];
      const historyIndex = historyIndexRef.current.get(tab.id) ?? -1;
      
      // Truncate forward history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(url);
      historyRef.current.set(tab.id, newHistory);
      historyIndexRef.current.set(tab.id, newHistory.length - 1);

      return {
        ...tab,
        url,
        loading: true,
        canGoBack: newHistory.length > 1,
        canGoForward: false,
      };
    }));
  }, [activeTabId]);

  const goBack = useCallback(() => {
    if (!activeTabId) return;
    
    const history = historyRef.current.get(activeTabId) || [];
    const historyIndex = historyIndexRef.current.get(activeTabId) ?? 0;
    
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      historyIndexRef.current.set(activeTabId, newIndex);
      const url = history[newIndex];
      
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId
          ? {
              ...tab,
              url,
              loading: true,
              canGoBack: newIndex > 0,
              canGoForward: newIndex < history.length - 1,
            }
          : tab
      ));
    }
  }, [activeTabId]);

  const goForward = useCallback(() => {
    if (!activeTabId) return;
    
    const history = historyRef.current.get(activeTabId) || [];
    const historyIndex = historyIndexRef.current.get(activeTabId) ?? 0;
    
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      historyIndexRef.current.set(activeTabId, newIndex);
      const url = history[newIndex];
      
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId
          ? {
              ...tab,
              url,
              loading: true,
              canGoBack: newIndex > 0,
              canGoForward: newIndex < history.length - 1,
            }
          : tab
      ));
    }
  }, [activeTabId]);

  const refresh = useCallback(() => {
    if (!activeTabId) return;
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId
        ? { ...tab, loading: true }
        : tab
    ));
  }, [activeTabId]);

  const newTab = useCallback(() => {
    const id = `tab-${Date.now()}`;
    setTabs(prev => [...prev, {
      id,
      title: 'New Tab',
      url: '',
      loading: false,
      canGoBack: false,
      canGoForward: false,
    }]);
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (filtered.length === 0) {
        // Keep at least one tab
        return [{
          id: `tab-${Date.now()}`,
          title: 'New Tab',
          url: '',
          loading: false,
          canGoBack: false,
          canGoForward: false,
        }];
      }
      return filtered;
    });
    
    if (activeTabId === id) {
      setTabs(prev => {
        const remaining = prev.filter(t => t.id !== id);
        if (remaining.length > 0) {
          setActiveTabId(remaining[0].id);
        }
        return prev;
      });
    }
    
    // Clean up history
    historyRef.current.delete(id);
    historyIndexRef.current.delete(id);
  }, [activeTabId]);

  const handlePageLoad = useCallback((title: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId
        ? { ...tab, title, loading: false, error: undefined }
        : tab
    ));
  }, [activeTabId]);

  const handlePageError = useCallback((error: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId
        ? { ...tab, loading: false, error }
        : tab
    ));
  }, [activeTabId]);

  const addBookmark = useCallback((bookmark: Omit<Bookmark, 'id'>) => {
    setBookmarks(prev => [...prev, {
      ...bookmark,
      id: `bookmark-${Date.now()}`,
    }]);
  }, []);

  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onNewTab={newTab}
      />

      {/* Address Bar */}
      <AddressBar
        url={activeTab?.url || ''}
        onNavigate={navigate}
        onRefresh={refresh}
        onBack={goBack}
        onForward={goForward}
        canGoBack={activeTab?.canGoBack || false}
        canGoForward={activeTab?.canGoForward || false}
        loading={activeTab?.loading || false}
      />

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar Toggle */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-1 bg-zinc-700 rounded-r hover:bg-zinc-600 transition-colors"
        >
          <svg className={`w-4 h-4 text-zinc-400 transition-transform ${showSidebar ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Service Discovery Sidebar */}
        {showSidebar && (
          <ServiceDiscoveryPanel
            onNavigate={navigate}
            endpoints={endpoints}
            bookmarks={bookmarks}
            onAddBookmark={addBookmark}
          />
        )}

        {/* Browser View */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeTab?.error ? (
            <div className="flex-1 flex items-center justify-center bg-zinc-900">
              <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h2 className="text-xl font-medium text-red-400 mb-2">Connection Failed</h2>
                <p className="text-zinc-500 max-w-md">{activeTab.error}</p>
                <button
                  onClick={refresh}
                  className="mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <BrowserView
              url={activeTab?.url || ''}
              onLoad={handlePageLoad}
              onError={handlePageError}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default InternalBrowser;
