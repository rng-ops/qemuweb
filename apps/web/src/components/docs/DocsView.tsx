import { useState, useRef } from 'react';

interface DocsViewProps {
  className?: string;
}

/**
 * DocsView embeds the Starlight documentation site in an iframe.
 * The docs are served from /docs/ path after build integration.
 */
export function DocsView({ className = '' }: DocsViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Determine docs URL based on environment
  const getDocsUrl = () => {
    // In development, docs might be served separately
    if (import.meta.env.DEV) {
      // Try the Astro dev server port first
      return 'http://localhost:4321/qemuweb/docs/';
    }
    // In production, docs are embedded at /qemuweb/docs/
    const base = import.meta.env.BASE_URL || '/';
    return `${base}docs/`;
  };

  const docsUrl = getDocsUrl();

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Retry loading after error
  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = docsUrl;
    }
  };

  // Open docs in new tab
  const handleOpenExternal = () => {
    window.open(docsUrl, '_blank');
  };

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-lg">📚</span>
          <h2 className="text-white font-medium">Documentation</h2>
          {isLoading && (
            <span className="text-gray-400 text-sm">Loading...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
            title="Refresh docs"
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleOpenExternal}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
            title="Open in new tab"
          >
            ↗️ Open External
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Loading documentation...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center max-w-md mx-auto p-6">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Documentation Unavailable
              </h3>
              <p className="text-gray-400 mb-4">
                The documentation couldn't be loaded. This might happen in development mode
                if the docs server isn't running.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  Try Again
                </button>
                <a
                  href="https://rng-ops.github.io/qemuweb/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
                >
                  View Online Docs
                </a>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                In development, run: <code className="bg-gray-800 px-2 py-0.5 rounded">pnpm --filter docs-site dev</code>
              </p>
            </div>
          </div>
        )}

        {/* Docs iframe */}
        <iframe
          ref={iframeRef}
          src={docsUrl}
          onLoad={handleLoad}
          onError={handleError}
          className="w-full h-full border-0"
          title="QemuWeb Documentation"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
