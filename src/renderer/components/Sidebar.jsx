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
  Settings,
  Minus,
  X,
} from 'lucide-react';
import { getWebviewIcon } from '../utils/webviewIcons';
import { useTranslation } from '../i18n';

// Modules natifs — labelKey résolu au rendu via t()
const menuItems = [
  { id: 'monitoring', icon: Monitor, labelKey: 'sidebar.monitoring' },
  { id: 'weather', icon: Sun, labelKey: 'sidebar.weather' },
  { id: 'calendar', icon: Calendar, labelKey: 'sidebar.calendar' },
  { id: 'homeassistant', icon: Home, labelKey: 'sidebar.homeassistant' },
  { id: 'volume', icon: Volume2, labelKey: 'sidebar.volume' },
  { id: 'timer', icon: Wrench, labelKey: 'sidebar.timer' },
  { id: 'news', icon: Newspaper, labelKey: 'sidebar.news' },
  { id: 'clipboard', icon: ClipboardList, labelKey: 'sidebar.clipboard' },
  { id: 'settings', icon: Settings, labelKey: 'sidebar.settings' },
];

function Sidebar({ activeModule, onModuleChange, sidebarOrder, hiddenModules = [], customWebviews = [] }) {
  const { t } = useTranslation();

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

  // Combiner modules natifs + webviews custom
  const allItems = [...nativeItems, ...customItems];

  // Trier selon l'ordre personnalisé (si défini) et filtrer les modules masqués
  const orderedItems = (sidebarOrder
    ? [
        ...sidebarOrder.map(id => allItems.find(item => item.id === id)).filter(Boolean),
        ...allItems.filter(item => !sidebarOrder.includes(item.id))
      ]
    : allItems
  ).filter(item => !hiddenModules.includes(item.id));

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
