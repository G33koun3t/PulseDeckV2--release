import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import OBSModule from './modules/OBS';
import VoiceCommandsModule from './modules/VoiceCommands';
import DockerModule from './modules/Docker';
import PhotoFrameModule from './modules/PhotoFrame';
import useTheme from './hooks/useTheme';
import { useLicense } from './contexts/LicenseContext';

// Clés localStorage importantes à sauvegarder sur disque
// (app_settings et streamdeck_buttons ont leur propre backup dédié)
const BACKUP_KEYS = [
  'ha_url', 'ha_token', 'ha_visible_domains', 'ha_hidden_entities', 'ha_area_cache', 'ha_collapsed_rooms',
  'obs_ws_url', 'obs_ws_password',
  'news_feeds', 'news_feeds_lang', 'news_feeds_custom', 'news_show_crypto',
  'weather_city',
  'calendar_list',
  'monitoring_alerts', 'monitoring_speedtest', 'monitoring_widget_config',
  'custom_webviews',
  'voice_input_device',
  'outils_pomodoro', 'outils_notes', 'outils_screenshots_folder', 'outils_screenshots_screen',
  'docker_ui_state',
  'photoframe_config', 'photoframe_folders',
];

// Modules standard (re-rendus à chaque changement)
const modules = {
  monitoring: { component: MonitoringModule, name: 'Monitoring' },
  weather: { component: WeatherModule, name: 'Météo' },
  calendar: { component: CalendarModule, name: 'Calendrier' },
  homeassistant: { component: HomeAssistantModule, name: 'Home Assistant' },
  volume: { component: VolumeModule, name: 'Volume' },
  news: { component: NewsModule, name: 'Actualités' },
  clipboard: { component: ClipboardModule, name: 'Presse-papiers' },
  voicecommands: { component: VoiceCommandsModule, name: 'Commandes Vocales' },
  docker: { component: DockerModule, name: 'Docker' },
  photoframe: { component: PhotoFrameModule, name: 'Cadre Photo' },
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
  const backupTimerRef = useRef(null);

  // Restaurer les clés localStorage depuis le backup fichier au montage
  useEffect(() => {
    if (!window.electronAPI?.loadLocalStorageBackup) return;
    window.electronAPI.loadLocalStorageBackup().then(result => {
      if (!result?.success || !result.data) return;
      let restored = false;
      for (const key of BACKUP_KEYS) {
        if (!localStorage.getItem(key) && result.data[key] != null) {
          localStorage.setItem(key, result.data[key]);
          restored = true;
        }
      }
      if (restored) {
        // Notifier les composants que des données ont été restaurées
        window.dispatchEvent(new Event('app-settings-changed'));
      }
    }).catch(() => {});
  }, []);

  // Sauvegarder périodiquement les clés localStorage sur disque (toutes les 30s)
  const saveBackup = useCallback(() => {
    if (!window.electronAPI?.saveLocalStorageBackup) return;
    const data = {};
    for (const key of BACKUP_KEYS) {
      const val = localStorage.getItem(key);
      if (val != null) data[key] = val;
    }
    if (Object.keys(data).length > 0) {
      window.electronAPI.saveLocalStorageBackup(data).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Sauvegarde initiale après 5s (le temps que les modules chargent)
    const initialTimeout = setTimeout(saveBackup, 5000);
    // Puis toutes les 30s
    backupTimerRef.current = setInterval(saveBackup, 30000);
    // Aussi sauvegarder quand l'app perd le focus (fermeture possible)
    window.addEventListener('blur', saveBackup);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(backupTimerRef.current);
      window.removeEventListener('blur', saveBackup);
    };
  }, [saveBackup]);

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
        {/* Tous les modules sont des singletons — montés une seule fois, affichés/cachés via display */}
        {/* display: contents = wrapper invisible au layout, le module est enfant direct de main-content */}
        {Object.entries(modules).map(([key, { component: Component }]) => {
          if (isFreeMode && !FREE_MODE_MODULES.includes(key)) return null;
          return (
            <div key={key} style={{ display: activeModule === key ? 'contents' : 'none' }}>
              <Component isActive={activeModule === key} />
            </div>
          );
        })}

        {/* Outils - toujours monté pour conserver les timers en cours */}
        <div style={{ display: activeModule === 'timer' ? 'contents' : 'none' }}>
          <OutilsModule isActive={activeModule === 'timer'} />
        </div>

        {/* OBS - toujours monté, caché si inactif (désactivé en free mode) */}
        {!isFreeMode && (
          <div style={{ display: activeModule === 'obs' ? 'contents' : 'none' }}>
            <OBSModule isActive={activeModule === 'obs'} />
          </div>
        )}

        {/* Webviews personnalisées - toujours montées, cachées si inactives */}
        {activeWebviews.map(webview => (
          <div
            key={webview.id}
            style={{
              display: activeModule === webview.id ? 'contents' : 'none',
            }}
          >
            <CustomWebview id={webview.id} url={webview.url} isActive={activeModule === webview.id} />
          </div>
        ))}
      </main>
      <StreamDeck />
    </div>
  );
}

export default App;
