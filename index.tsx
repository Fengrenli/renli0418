// POLYFILL MUST BE FIRST - DO NOT MOVE THIS
declare global {
  interface Window {
    util?: {
      inherits?: (ctor: any, superCtor: any) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  if (!window.util) {
    window.util = {};
  }
  if (!window.util.inherits) {
    window.util.inherits = function(ctor: any, superCtor: any) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  }
}


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

/** 生产环境不向 DOM 注入报错层，避免信息泄露与糟糕体验；开发环境仅控制台 */
window.addEventListener('error', (e) => {
  console.error('Global JS Error:', e.message, e.filename, e.lineno);
  if (import.meta.env.DEV) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText =
      'position:fixed;bottom:12px;right:12px;max-width:min(420px,calc(100vw - 24px));background:#1e293b;color:#f8fafc;padding:12px 14px;border-radius:10px;font:12px/1.4 system-ui;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,.25);';
    errorDiv.setAttribute('role', 'status');
    errorDiv.textContent = `[dev] ${e.message} (${e.filename}:${e.lineno})`;
    document.body.appendChild(errorDiv);
    window.setTimeout(() => errorDiv.remove(), 8000);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const text = reason instanceof Error ? reason.message : String(reason);
  console.error('Unhandled Promise rejection:', reason);
  if (import.meta.env.DEV) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText =
      'position:fixed;bottom:12px;right:12px;max-width:min(420px,calc(100vw - 24px));background:#7f1d1d;color:#fef2f2;padding:12px 14px;border-radius:10px;font:12px/1.4 system-ui;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,.25);';
    errorDiv.setAttribute('role', 'status');
    errorDiv.textContent = `[dev] Promise: ${text}`;
    document.body.appendChild(errorDiv);
    window.setTimeout(() => errorDiv.remove(), 8000);
  }
});

if (import.meta.env.DEV) {
  console.log('Index script started (dev)');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
  });
}
