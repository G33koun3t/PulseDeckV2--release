import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider } from './i18n';
import App from './App';
import LicenseGate from './components/LicenseGate';
import './styles/global.css';

// Tauri API bridge — replaces Electron's contextBridge/preload
import tauriAPI from './utils/tauriAPI';
window.electronAPI = tauriAPI;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <LicenseGate>
        <App />
      </LicenseGate>
    </I18nProvider>
  </React.StrictMode>
);
