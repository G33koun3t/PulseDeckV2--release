import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StreamDeck from './components/StreamDeck';
import MonitoringModule from './modules/Monitoring';
import WeatherModule from './modules/Weather';
import CalendarModule from './modules/Calendar';
import HomeAssistantModule from './modules/HomeAssistant';
import VolumeModule from './modules/Volume';
import OutilsModule from './modules/Outils';
import NewsModule from './modules/News';
import ClipboardModule from './modules/Clipboard';
import SettingsModule from './modules/Settings';
import CustomWebview from './modules/CustomWebview';
import useTheme from './hooks/useTheme';

// Modules standard (re-rendus à chaque changement)
const modules = {
  monitoring: { component: MonitoringModule, name: 'Monitoring' },
  weather: { component: WeatherModule, name: 'Météo' },
  calendar: { component: CalendarModule, name: 'Calendrier' },
  homeassistant: { component: HomeAssistantModule, name: 'Home Assistant' },
  volume: { component: VolumeModule, name: 'Volume' },
  timer: { component: OutilsModule, name: 'Outils' },
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

function App() {
  const [activeModule, setActiveModule] = useState('monitoring');
  const { settings } = useTheme();

  // Webviews personnalisées depuis localStorage
  const [customWebviews, setCustomWebviews] = useState(loadCustomWebviews);

  // Écouter les changements depuis Settings
  useEffect(() => {
    const handler = () => setCustomWebviews(loadCustomWebviews());
    window.addEventListener('custom-webviews-changed', handler);
    return () => window.removeEventListener('custom-webviews-changed', handler);
  }, []);

  const ActiveComponent = modules[activeModule]?.component;

  return (
    <div className="app-container">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        sidebarOrder={settings.sidebarOrder}
        hiddenModules={settings.hiddenModules}
        customWebviews={customWebviews}
      />
      <main className="main-content">
        {/* Modules standard - rendus uniquement quand actifs */}
        {ActiveComponent && <ActiveComponent />}

        {/* Webviews personnalisées - toujours montées, cachées si inactives */}
        {customWebviews.map(webview => (
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
