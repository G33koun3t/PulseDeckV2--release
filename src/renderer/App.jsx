import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StreamDeck from './components/StreamDeck';
import MonitoringModule from './modules/Monitoring';
import WeatherModule from './modules/Weather';
// import CalendarModule from './modules/Calendar'; // Désactivé en attendant validation Google
import HomeAssistantModule from './modules/HomeAssistant';
import VolumeModule from './modules/Volume';
import OutilsModule from './modules/Outils';
import NewsModule from './modules/News';
import ClipboardModule from './modules/Clipboard';
import SettingsModule from './modules/Settings';
import CustomWebview from './modules/CustomWebview';
import OBSModule from './modules/OBS';
import useTheme from './hooks/useTheme';
import { useLicense } from './contexts/LicenseContext';

// Modules standard (re-rendus à chaque changement)
const modules = {
  monitoring: { component: MonitoringModule, name: 'Monitoring' },
  weather: { component: WeatherModule, name: 'Météo' },
  // calendar: { component: CalendarModule, name: 'Calendrier' }, // Désactivé en attendant validation Google
  homeassistant: { component: HomeAssistantModule, name: 'Home Assistant' },
  volume: { component: VolumeModule, name: 'Volume' },
  news: { component: NewsModule, name: 'Actualités' },
  clipboard: { component: ClipboardModule, name: 'Presse-papiers' },
  settings: { component: SettingsModule, name: 'Paramètres' },
};

function loadCustomWebviews() {
  try {
    return JSON.parse(localStorage.getItem('custom_webviews') || '[]');
  } catch {
    return [];
  }
}

// Modules autorisés en version gratuite
const FREE_MODE_MODULES = ['monitoring', 'volume', 'news', 'settings'];

function App() {
  const [activeModule, setActiveModule] = useState('monitoring');
  const { settings } = useTheme();
  const { isFreeMode } = useLicense();

  // Webviews personnalisées depuis localStorage
  const [customWebviews, setCustomWebviews] = useState(loadCustomWebviews);

  // Écouter les changements depuis Settings
  useEffect(() => {
    const handler = () => setCustomWebviews(loadCustomWebviews());
    window.addEventListener('custom-webviews-changed', handler);
    return () => window.removeEventListener('custom-webviews-changed', handler);
  }, []);

  // En free mode : limiter les webviews à 1
  const activeWebviews = isFreeMode ? customWebviews.slice(0, 1) : customWebviews;

  const isPersistent = activeModule === 'obs' || activeModule === 'timer' || activeWebviews.some(w => w.id === activeModule);
  // En free mode : bloquer les modules non autorisés
  const isModuleAllowed = !isFreeMode || FREE_MODE_MODULES.includes(activeModule) || activeWebviews.some(w => w.id === activeModule);
  const ActiveComponent = !isPersistent && isModuleAllowed ? modules[activeModule]?.component : null;

  return (
    <div className="app-container">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        sidebarOrder={settings.sidebarOrder}
        hiddenModules={settings.hiddenModules}
        customWebviews={activeWebviews}
      />
      <main className="main-content">
        {/* Modules standard - rendus uniquement quand actifs */}
        {ActiveComponent && <ActiveComponent />}

        {/* Outils - toujours monté pour conserver les timers en cours */}
        <div style={{ display: activeModule === 'timer' ? 'flex' : 'none', width: '100%', height: '100%' }}>
          <OutilsModule />
        </div>

        {/* OBS - toujours monté, caché si inactif (désactivé en free mode) */}
        {!isFreeMode && (
          <div style={{ display: activeModule === 'obs' ? 'flex' : 'none', width: '100%', height: '100%' }}>
            <OBSModule />
          </div>
        )}

        {/* Webviews personnalisées - toujours montées, cachées si inactives */}
        {activeWebviews.map(webview => (
          <div
            key={webview.id}
            style={{
              display: activeModule === webview.id ? 'flex' : 'none',
              width: '100%',
              height: '100%',
            }}
          >
            <CustomWebview id={webview.id} url={webview.url} />
          </div>
        ))}
      </main>
      <StreamDeck />
    </div>
  );
}

export default App;
