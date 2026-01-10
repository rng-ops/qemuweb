import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function DocsPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Construct the docs URL based on the current path
  const docsPath = location.pathname.replace('/docs', '') || '/';
  const isDev = import.meta.env.DEV;
  
  // In dev, docs are served separately; in prod, they're at /qemuweb/docs/
  const baseDocsUrl = isDev 
    ? 'http://localhost:4321/qemuweb/docs'
    : '/qemuweb/docs';
  
  const docsUrl = `${baseDocsUrl}${docsPath}`;

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [docsUrl]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError('Failed to load documentation');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span>Documentation</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setLoading(true);
              setError(null);
              // Force iframe reload by updating key
              const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
              if (iframe) {
                const currentSrc = iframe.src;
                iframe.src = '';
                iframe.src = currentSrc;
              }
            }}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
            title="Open in new tab"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-zinc-400">
            <div className="animate-spin w-5 h-5 border-2 border-zinc-600 border-t-blue-500 rounded-full" />
            <span className="text-sm">Loading documentation...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <p className="text-sm text-zinc-500">
              Make sure the docs server is running in development mode.
            </p>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        src={docsUrl}
        className={`flex-1 w-full border-0 bg-zinc-950 ${loading || error ? 'hidden' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        title="QemuWeb Documentation"
      />
    </div>
  );
}
