import { createRoot } from 'react-dom/client';

import App from './App';
import IntroSplash from './components/intro-splash';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('X-Store PWA service worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <>
    <IntroSplash />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </>,
);
