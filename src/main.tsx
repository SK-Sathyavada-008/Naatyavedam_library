import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles/globals.css';

// Register PWA service worker with auto-update capability
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new version of Naatyavedam Library is available. Reload now?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Naatyavedam Library is ready to work offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
