import React from 'react';
import {
  Monitor,
  Sun,
  Calendar,
  Home,
  Volume2,
  Wrench,
  Newspaper,
  ClipboardList,
  Video,
  Mic,
  Settings,
  Minus,
  X,
} from 'lucide-react';

// Icône Docker (baleine avec conteneurs) — style lucide
function DockerIcon({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Conteneurs sur le dos de la baleine */}
      <rect x="7" y="5" width="3" height="2.5" rx="0.3" />
      <rect x="10.5" y="5" width="3" height="2.5" rx="0.3" />
      <rect x="7" y="8" width="3" height="2.5" rx="0.3" />
      <rect x="10.5" y="8" width="3" height="2.5" rx="0.3" />
      <rect x="14" y="8" width="3" height="2.5" rx="0.3" />
      <rect x="10.5" y="2" width="3" height="2.5" rx="0.3" />
      {/* Corps de la baleine */}
      <path d="M4 11.5c0 0 0.5-1 2-1h13c1.5 0 2.5 1 3 2s0 3-1 4-3 2.5-6.5 2.5H10c-4 0-6.5-2-7-4S3 11.5 4 11.5z" />
      {/* Oeil */}
      <circle cx="19" cy="13" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
import { getWebviewIcon } from '../utils/webviewIcons';
import { useTranslation } from '../i18n';
import { useLicense } from '../contexts/LicenseContext';

// Modules natifs — labelKey résolu au rendu via t()
const menuItems = [
  { id: 'monitoring', icon: Monitor, labelKey: 'sidebar.monitoring' },
  { id: 'weather', icon: Sun, labelKey: 'sidebar.weather' },
  // { id: 'calendar', icon: Calendar, labelKey: 'sidebar.calendar' }, // Désactivé en attendant validation Google
  { id: 'homeassistant', icon: Home, labelKey: 'sidebar.homeassistant' },
  { id: 'volume', icon: Volume2, labelKey: 'sidebar.volume' },
  { id: 'timer', icon: Wrench, labelKey: 'sidebar.timer' },
  { id: 'news', icon: Newspaper, labelKey: 'sidebar.news' },
  { id: 'clipboard', icon: ClipboardList, labelKey: 'sidebar.clipboard' },
  { id: 'obs', icon: Video, labelKey: 'sidebar.obs' },
  { id: 'voicecommands', icon: Mic, labelKey: 'sidebar.voicecommands' },
  { id: 'docker', icon: DockerIcon, labelKey: 'sidebar.docker' },
];

// Settings toujours en dernière position
const settingsItem = { id: 'settings', icon: Settings, labelKey: 'sidebar.settings' };

// Modules autorisés en version gratuite
const FREE_MODE_MODULES = ['monitoring', 'volume', 'news'];

function Sidebar({ activeModule, onModuleChange, sidebarOrder, hiddenModules = [], customWebviews = [] }) {
  const { t } = useTranslation();
  const { isFreeMode } = useLicense();

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };

  // Construire les items custom à partir des webviews configurées
  const customItems = customWebviews.map(w => ({
    id: w.id,
    icon: getWebviewIcon(w.icon),
    label: w.name,
  }));

  // Résoudre les labels natifs via t()
  const nativeItems = menuItems.map(item => ({
    ...item,
    label: t(item.labelKey),
  }));

  // En free mode : seulement monitoring + 1 webview custom max
  const filteredNative = isFreeMode
    ? nativeItems.filter(item => FREE_MODE_MODULES.includes(item.id))
    : nativeItems;
  const filteredCustom = isFreeMode ? customItems.slice(0, 1) : customItems;

  // Combiner modules natifs + webviews custom
  const allItems = [...filteredNative, ...filteredCustom];

  // Trier selon l'ordre personnalisé (si défini) et filtrer les modules masqués
  // Settings est exclu de l'ordre personnalisé — toujours en dernière position
  const orderedItems = (sidebarOrder
    ? [
        ...sidebarOrder.filter(id => id !== 'settings').map(id => allItems.find(item => item.id === id)).filter(Boolean),
        ...allItems.filter(item => item.id !== 'settings' && !sidebarOrder.includes(item.id))
      ]
    : allItems.filter(item => item.id !== 'settings')
  ).filter(item => !hiddenModules.includes(item.id));

  const isSettingsActive = activeModule === 'settings';

  return (
    <aside className="sidebar">
      <div className="sidebar-menu">
        {orderedItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onModuleChange(item.id)}
              title={item.label}
            >
              <IconComponent strokeWidth={isActive ? 2.5 : 1.5} />
            </button>
          );
        })}
      </div>

      <div className="sidebar-controls">
        <button
          className={`sidebar-item ${isSettingsActive ? 'active' : ''}`}
          onClick={() => onModuleChange('settings')}
          title={t(settingsItem.labelKey)}
        >
          <Settings strokeWidth={isSettingsActive ? 2.5 : 1.5} />
        </button>
        <button className="control-btn minimize" onClick={handleMinimize} title={t('sidebar.minimize')}>
          <Minus />
        </button>
        <button className="control-btn close" onClick={handleClose} title={t('sidebar.close')}>
          <X />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
