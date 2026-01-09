/**
 * Atlas Iframe Entry Point
 * 
 * This is the entry point for the Atlas chat running inside a sandboxed iframe.
 * It communicates with the parent window via postMessage and manages its own
 * persisted state through IndexedDB.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { AtlasIframeApp } from './components/agent/AtlasIframeAppV2';
import './index.css';

// Mount the Atlas iframe app
const rootElement = document.getElementById('atlas-root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AtlasIframeApp />
    </React.StrictMode>
  );
}
