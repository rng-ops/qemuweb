import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Check if we should use the new router-based UI
// Use ?legacy=true to access the old UI
const urlParams = new URLSearchParams(window.location.search);
const useLegacyUI = urlParams.get('legacy') === 'true';

async function render() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  
  if (useLegacyUI) {
    // Load legacy App component
    const { default: App } = await import('./App');
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    // Use new router-based UI
    const { AppRouter } = await import('./app/AppRouter');
    root.render(
      <React.StrictMode>
        <AppRouter />
      </React.StrictMode>
    );
  }
}

render();
