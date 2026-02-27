import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings, RotateCcw, ChevronUp, ChevronDown, Check,
  Monitor, Sun, Calendar, Home, Volume2, Wrench, Image,
  Newspaper, ClipboardList, Video, BookOpen, Mic,
  Eye, EyeOff, Plus, Trash2, Pencil, X, Save, Globe, Shield, ShoppingCart,
  MonitorSmartphone, Download, RefreshCw, CheckCircle, AlertCircle, Loader
} from 'lucide-react';
import { WEBVIEW_ICONS, WEBVIEW_ICON_NAMES, getWebviewIcon } from '../utils/webviewIcons';
import useTheme, { THEMES, DEFAULT_SETTINGS } from '../hooks/useTheme';
import { useTranslation, LOCALE_META } from '../i18n';
import { useLicense } from '../contexts/LicenseContext';
import { STORE_URL, PULSEDECK_V2_URL } from '../config';
import './Settings.css';

// Icône Docker (baleine avec conteneurs)
function DockerIcon({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="7" y="5" width="3" height="2.5" rx="0.3" />
      <rect x="10.5" y="5" width="3" height="2.5" rx="0.3" />
      <rect x="7" y="8" width="3" height="2.5" rx="0.3" />
      <rect x="10.5" y="8" width="3" height="2.5" rx="0.3" />
      <rect x="14" y="8" width="3" height="2.5" rx="0.3" />
      <rect x="10.5" y="2" width="3" height="2.5" rx="0.3" />
      <path d="M4 11.5c0 0 0.5-1 2-1h13c1.5 0 2.5 1 3 2s0 3-1 4-3 2.5-6.5 2.5H10c-4 0-6.5-2-7-4S3 11.5 4 11.5z" />
      <circle cx="19" cy="13" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Icônes des modules natifs
const MODULE_ICONS = {
  monitoring: Monitor,
  weather: Sun,
  calendar: Calendar,
  homeassistant: Home,
  volume: Volume2,
  timer: Wrench,
  news: Newspaper,
  clipboard: ClipboardList,
  obs: Video,
  voicecommands: Mic,
  docker: DockerIcon,
  photoframe: Image,
  settings: Settings,
};

const DEFAULT_ORDER = [
  'monitoring', 'weather', 'calendar', 'homeassistant',
  'volume', 'timer', 'news', 'clipboard', 'obs',
  'voicecommands', 'docker', 'photoframe', 'settings'
];

const MAX_WEBVIEWS = 5;

// Groupes de couleurs - clés i18n, résolues au rendu
const COLOR_GROUPS = [
  {
    titleKey: 'settings.backgrounds',
    colors: [
      { key: 'bgPrimary', labelKey: 'settings.primary' },
      { key: 'bgSecondary', labelKey: 'settings.secondary' },
      { key: 'bgTertiary', labelKey: 'settings.tertiary' },
      { key: 'bgHover', labelKey: 'settings.hover' },
    ]
  },
  {
    titleKey: 'settings.accent',
    colors: [
      { key: 'accentPrimary', labelKey: 'settings.primary' },
      { key: 'accentSecondary', labelKey: 'settings.secondary' },
    ]
  },
  {
    titleKey: 'settings.text',
    colors: [
      { key: 'textPrimary', labelKey: 'settings.primary' },
      { key: 'textSecondary', labelKey: 'settings.secondary' },
      { key: 'textMuted', labelKey: 'settings.muted' },
    ]
  },
  {
    titleKey: 'settings.border',
    colors: [
      { key: 'borderColor', labelKey: 'settings.border' },
    ]
  },
];

const LANG_FLAGS = {
  fr: '\u{1F1EB}\u{1F1F7}',
  en: '\u{1F1EC}\u{1F1E7}',
  de: '\u{1F1E9}\u{1F1EA}',
  nl: '\u{1F1F3}\u{1F1F1}',
  es: '\u{1F1EA}\u{1F1F8}',
  pt: '\u{1F1F5}\u{1F1F9}',
  it: '\u{1F1EE}\u{1F1F9}',
  pl: '\u{1F1F5}\u{1F1F1}',
  ja: '\u{1F1EF}\u{1F1F5}',
};

function loadCustomWebviews() {
  try {
    return JSON.parse(localStorage.getItem('custom_webviews') || '[]');
  } catch {
    return [];
  }
}

function saveCustomWebviews(webviews) {
  localStorage.setItem('custom_webviews', JSON.stringify(webviews));
  window.dispatchEvent(new Event('custom-webviews-changed'));
}

function SettingsModule() {
  const { settings, applyColors, applyLayout, updateSettings, resetToDefaults } = useTheme();
  const { t, lang, dateLocale } = useTranslation();
  const { isFreeMode } = useLicense();
  const maxWebviews = isFreeMode ? 1 : MAX_WEBVIEWS;
  const [customWebviews, setCustomWebviews] = useState(loadCustomWebviews);
  const [editingWebview, setEditingWebview] = useState(null);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [activateKey, setActivateKey] = useState('');
  const [activateError, setActivateError] = useState('');
  const [activating, setActivating] = useState(false);
  const [displays, setDisplays] = useState([]);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');
  const [appVersion, setAppVersion] = useState('');

  // Charger les infos de licence + auto-start au montage
  useEffect(() => {
    if (window.electronAPI?.getLicenseInfo) {
      window.electronAPI.getLicenseInfo().then(info => {
        setLicenseInfo(info);
      }).catch(() => {
        setLicenseInfo(null);
      });
    }
    if (window.electronAPI?.getAutoStart) {
      window.electronAPI.getAutoStart().then(r => setAutoStart(!!r?.enabled)).catch(() => {});
    }
    if (window.electronAPI?.getDisplays) {
      window.electronAPI.getDisplays().then(setDisplays).catch(() => {});
    }
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
    }
    let unlistenPromise;
    if (window.electronAPI?.onUpdateStatus) {
      unlistenPromise = window.electronAPI.onUpdateStatus((data) => {
        setUpdateStatus(data.status);
        if (data.version) setUpdateVersion(data.version);
        if (data.percent != null) setUpdateProgress(data.percent);
        if (data.error) setUpdateError(data.error);
      });
    }
    return () => {
      unlistenPromise?.then(fn => fn());
    };
  }, []);

  // Sélectionner un thème prédéfini
  const handlePresetSelect = (presetId) => {
    const preset = THEMES[presetId];
    if (!preset) return;
    const newSettings = {
      ...settings,
      theme: { preset: presetId, colors: { ...preset.colors } }
    };
    applyColors(preset.colors);
    updateSettings(newSettings);
  };

  // Changer une couleur individuellement
  const handleColorChange = (colorKey, value) => {
    const newColors = { ...settings.theme.colors, [colorKey]: value };
    const newSettings = {
      ...settings,
      theme: { preset: 'custom', colors: newColors }
    };
    applyColors(newColors);
    updateSettings(newSettings);
  };

  // Changer un paramètre de layout
  const handleLayoutChange = (key, value) => {
    const newLayout = { ...settings.layout, [key]: Number(value) };
    if (key === 'gridColumns') {
      newLayout.streamdeckWidth = Number(value) * 130;
    }
    const newSettings = { ...settings, layout: newLayout };
    applyLayout(newLayout);
    updateSettings(newSettings);
  };

  // Changer la langue
  const handleLanguageChange = (code) => {
    updateSettings({ ...settings, language: code });
  };

  // Masquer/afficher un module
  const handleToggleModule = (moduleId) => {
    if (moduleId === 'settings') return;
    const hidden = settings.hiddenModules || [];
    const newHidden = hidden.includes(moduleId)
      ? hidden.filter(id => id !== moduleId)
      : [...hidden, moduleId];
    updateSettings({ ...settings, hiddenModules: newHidden });
  };

  // Déplacer un module dans l'ordre
  const handleMoveModule = (index, direction) => {
    const order = [...getCurrentOrder()];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= order.length) return;
    [order[index], order[newIndex]] = [order[newIndex], order[index]];
    updateSettings({ ...settings, sidebarOrder: order });
  };

  // Ordre actuel incluant les webviews custom
  const getCurrentOrder = () => {
    const baseOrder = settings.sidebarOrder || DEFAULT_ORDER;
    const webviewIds = customWebviews.map(w => w.id);
    const nativeIds = Object.keys(MODULE_ICONS);
    const allValidIds = [...nativeIds, ...webviewIds];
    const cleanOrder = baseOrder.filter(id => allValidIds.includes(id));
    // Ajouter les modules natifs et webviews manquants (nouveaux modules)
    const missingNative = nativeIds.filter(id => !cleanOrder.includes(id));
    const missingWebviews = webviewIds.filter(id => !cleanOrder.includes(id));
    // Insérer les natifs manquants avant 'settings', les webviews après
    const settingsIdx = cleanOrder.indexOf('settings');
    if (settingsIdx >= 0 && missingNative.length > 0) {
      cleanOrder.splice(settingsIdx, 0, ...missingNative);
    } else {
      cleanOrder.push(...missingNative);
    }
    return [...cleanOrder, ...missingWebviews];
  };

  const currentOrder = getCurrentOrder();

  // Résoudre icône + label pour un ID (natif ou custom)
  const getModuleIcon = (moduleId) => {
    if (MODULE_ICONS[moduleId]) return MODULE_ICONS[moduleId];
    const webview = customWebviews.find(w => w.id === moduleId);
    if (webview) return getWebviewIcon(webview.icon);
    return Globe;
  };

  const getModuleLabel = (moduleId) => {
    const sidebarKey = `sidebar.${moduleId}`;
    const translated = t(sidebarKey);
    if (translated !== sidebarKey) return translated;
    const webview = customWebviews.find(w => w.id === moduleId);
    if (webview) return webview.name;
    return moduleId;
  };

  // ---- Gestion webviews ----
  const handleAddWebview = () => {
    if (customWebviews.length >= maxWebviews) return;
    setEditingWebview({
      id: `webview_${Date.now()}`,
      name: '',
      url: '',
      icon: 'Globe',
      isNew: true,
    });
  };

  const handleEditWebview = (webview) => {
    setEditingWebview({ ...webview, isNew: false });
  };

  const handleDeleteWebview = (id) => {
    const updated = customWebviews.filter(w => w.id !== id);
    setCustomWebviews(updated);
    saveCustomWebviews(updated);
    const newOrder = (settings.sidebarOrder || DEFAULT_ORDER).filter(mid => mid !== id);
    const newHidden = (settings.hiddenModules || []).filter(mid => mid !== id);
    updateSettings({ ...settings, sidebarOrder: newOrder, hiddenModules: newHidden });
  };

  const handleSaveWebview = () => {
    if (!editingWebview || !editingWebview.name.trim() || !editingWebview.url.trim()) return;

    let url = editingWebview.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const webviewData = {
      id: editingWebview.id,
      name: editingWebview.name.trim(),
      url,
      icon: editingWebview.icon,
    };

    let updated;
    if (editingWebview.isNew) {
      updated = [...customWebviews, webviewData];
    } else {
      updated = customWebviews.map(w => w.id === webviewData.id ? webviewData : w);
    }

    setCustomWebviews(updated);
    saveCustomWebviews(updated);
    setEditingWebview(null);
  };

  const handleCancelEdit = () => {
    setEditingWebview(null);
  };

  // Changement d'écran cible
  const handleDisplayChange = async (displayId) => {
    if (!window.electronAPI?.setTargetDisplay) return;
    const result = await window.electronAPI.setTargetDisplay(displayId);
    if (result.success) {
      // Rafraîchir la liste des écrans
      const updated = await window.electronAPI.getDisplays();
      setDisplays(updated);
    }
  };

  // Activation de licence depuis Settings (free mode)
  const handleSettingsActivate = async () => {
    if (!activateKey.trim() || activating) return;
    setActivateError('');
    setActivating(true);
    try {
      const result = await window.electronAPI.activateLicense(activateKey.trim());
      if (result.success) {
        window.location.reload();
      } else {
        const errorKey = {
          invalid_key: 'license.invalidKey',
          already_activated: 'license.alreadyActivated',
          network_error: 'license.networkError',
          expired: 'license.expired',
          suspended: 'license.suspended',
          activation_failed: 'license.activationFailed',
        }[result.error] || 'license.invalidKey';
        setActivateError(t(errorKey));
      }
    } catch {
      setActivateError(t('license.networkError'));
    }
    setActivating(false);
  };

  return (
    <div className="settings-module">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-title">
          <Settings size={24} />
          <span>{t('settings.title')}</span>
        </div>
        <button className="settings-reset-btn" onClick={resetToDefaults}>
          <RotateCcw size={16} />
          <span>{t('settings.reset')}</span>
        </button>
      </div>

      {/* Contenu horizontal */}
      <div className="settings-content">
        {/* Section Langue + Thème */}
        <div className="settings-section settings-theme">
          {/* Langue */}
          <h3 className="settings-section-title">{t('settings.language')}</h3>
          <div className="language-grid">
            {Object.entries(LOCALE_META).map(([code, meta]) => (
              <button
                key={code}
                className={`language-btn ${lang === code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(code)}
              >
                <span className="language-flag">{LANG_FLAGS[code]}</span>
                <span className="language-name">{meta.name}</span>
                {lang === code && (
                  <div className="language-check"><Check size={12} /></div>
                )}
              </button>
            ))}
          </div>

          {!isFreeMode && (
            <>
              <h3 className="settings-section-title">{t('settings.general')}</h3>
              <div className="autostart-row">
                <label className="autostart-label">{t('settings.autoStart')}</label>
                <button
                  className={`autostart-toggle ${autoStart ? 'active' : ''}`}
                  onClick={async () => {
                    const next = !autoStart;
                    setAutoStart(next);
                    if (window.electronAPI?.setAutoStart) {
                      await window.electronAPI.setAutoStart(next);
                    }
                  }}
                >
                  <div className="autostart-toggle-knob" />
                </button>
              </div>

              <div className="autostart-row">
                <label className="autostart-label">
                  {t('settings.gamingModeAuto')}
                  <span className={`toggle-status ${settings.gamingMode ? 'on' : 'off'}`}>
                    {settings.gamingMode ? t('settings.enabled') : t('settings.disabled')}
                  </span>
                </label>
                <button
                  className={`autostart-toggle ${settings.gamingMode ? 'active' : ''}`}
                  onClick={() => {
                    const next = !settings.gamingMode;
                    updateSettings({ ...settings, gamingMode: next });
                    if (window.electronAPI?.setGamingAuto) {
                      window.electronAPI.setGamingAuto(next);
                    }
                  }}
                >
                  <div className="autostart-toggle-knob" />
                </button>
              </div>

              <button
                className="settings-guide-btn"
                onClick={() => {
                  if (window.electronAPI?.openGuide) {
                    window.electronAPI.openGuide(lang);
                  }
                }}
              >
                <BookOpen size={18} />
                <span>{t('settings.userGuide')}</span>
              </button>
            </>
          )}

          {/* Thème */}
          <h3 className="settings-section-title">{t('settings.theme')}</h3>

          {/* Thèmes prédéfinis */}
          <div className="theme-presets-grid">
            {Object.entries(THEMES).map(([id, theme]) => (
              <button
                key={id}
                className={`theme-card ${settings.theme.preset === id ? 'active' : ''}`}
                onClick={() => handlePresetSelect(id)}
              >
                <div className="theme-card-colors">
                  <span className="theme-color-dot" style={{ background: theme.colors.bgPrimary, border: `1px solid ${theme.colors.borderColor}` }} />
                  <span className="theme-color-dot" style={{ background: theme.colors.accentPrimary }} />
                  <span className="theme-color-dot" style={{ background: theme.colors.textPrimary, border: `1px solid ${theme.colors.borderColor}` }} />
                  <span className="theme-color-dot" style={{ background: theme.colors.bgSecondary, border: `1px solid ${theme.colors.borderColor}` }} />
                </div>
                <span className="theme-card-name">{theme.name}</span>
                {settings.theme.preset === id && (
                  <div className="theme-card-check"><Check size={14} /></div>
                )}
              </button>
            ))}
          </div>

          {/* Couleurs personnalisées (masqué en free mode) */}
          {!isFreeMode && (
            <>
              <h4 className="settings-subsection-title">{t('settings.customColors')}</h4>
              <div className="color-groups">
                {COLOR_GROUPS.map((group) => (
                  <div key={group.titleKey} className="color-group">
                    <span className="color-group-title">{t(group.titleKey)}</span>
                    <div className="color-group-pickers">
                      {group.colors.map(({ key, labelKey }) => (
                        <div key={key} className="color-picker-row">
                          <label className="color-picker-label">{t(labelKey)}</label>
                          <input
                            type="color"
                            className="color-picker-input"
                            value={settings.theme.colors[key]}
                            onChange={(e) => handleColorChange(key, e.target.value)}
                          />
                          <span className="color-picker-hex">{settings.theme.colors[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Section Webviews */}
        <div className="settings-section settings-webviews">
          <h3 className="settings-section-title">{t('settings.webviews')} ({customWebviews.length}/{maxWebviews})</h3>

          {/* Liste des webviews existantes */}
          <div className="webview-list">
            {customWebviews.map(webview => {
              const IconComp = getWebviewIcon(webview.icon);
              return (
                <div key={webview.id} className="webview-list-item">
                  <IconComp size={18} className="webview-list-icon" />
                  <div className="webview-list-info">
                    <span className="webview-list-name">{webview.name}</span>
                    <span className="webview-list-url">{webview.url}</span>
                  </div>
                  <button
                    className="webview-list-btn edit"
                    onClick={() => handleEditWebview(webview)}
                    title={t('settings.editWebview')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="webview-list-btn delete"
                    onClick={() => handleDeleteWebview(webview.id)}
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}

            {customWebviews.length === 0 && !editingWebview && (
              <div className="webview-empty">
                <Globe size={32} />
                <p>{t('settings.noWebviews')}</p>
                <small>{t('settings.addWebviewsHint', { max: maxWebviews })}</small>
              </div>
            )}
          </div>

          {/* Formulaire ajout/édition */}
          {editingWebview ? (
            <div className="webview-form">
              <h4 className="settings-subsection-title">
                {editingWebview.isNew ? t('settings.newWebview') : t('settings.editWebview')}
              </h4>

              <div className="webview-form-field">
                <label>{t('common.name')}</label>
                <input
                  type="text"
                  value={editingWebview.name}
                  onChange={(e) => setEditingWebview({ ...editingWebview, name: e.target.value })}
                  placeholder={t('settings.webviewNamePlaceholder')}
                  maxLength={30}
                />
              </div>

              <div className="webview-form-field">
                <label>{t('common.url')}</label>
                <input
                  type="text"
                  value={editingWebview.url}
                  onChange={(e) => setEditingWebview({ ...editingWebview, url: e.target.value })}
                  placeholder={t('settings.webviewUrlPlaceholder')}
                />
              </div>

              <div className="webview-form-field">
                <label>{t('common.icon')}</label>
                <div className="webview-icon-grid">
                  {WEBVIEW_ICON_NAMES.map(iconName => {
                    const Icon = WEBVIEW_ICONS[iconName];
                    return (
                      <button
                        key={iconName}
                        className={`webview-icon-btn ${editingWebview.icon === iconName ? 'active' : ''}`}
                        onClick={() => setEditingWebview({ ...editingWebview, icon: iconName })}
                        title={iconName}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="webview-form-actions">
                <button className="webview-form-btn cancel" onClick={handleCancelEdit}>
                  <X size={14} />
                  {t('common.cancel')}
                </button>
                <button
                  className="webview-form-btn save"
                  onClick={handleSaveWebview}
                  disabled={!editingWebview.name.trim() || !editingWebview.url.trim()}
                >
                  <Save size={14} />
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            customWebviews.length < maxWebviews && (
              <button className="webview-add-btn" onClick={handleAddWebview}>
                <Plus size={18} />
                <span>{t('settings.addWebview')}</span>
              </button>
            )
          )}
        </div>

        {/* Section Disposition */}
        <div className="settings-section settings-layout">
          <h3 className="settings-section-title">{t('settings.layout')}</h3>

          {/* Sélecteur d'écran */}
          {displays.length > 1 && (
            <>
              <h4 className="settings-subsection-title">
                <MonitorSmartphone size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {t('settings.targetDisplay')}
              </h4>
              <div className="display-selector-grid">
                {displays.map(d => (
                  <button
                    key={d.id}
                    className={`display-selector-btn ${d.isCurrent ? 'active' : ''}`}
                    onClick={() => handleDisplayChange(d.id)}
                    title={`${d.label} @ (${d.bounds.x}, ${d.bounds.y})`}
                  >
                    <Monitor size={20} />
                    <span className="display-resolution">{d.label}</span>
                    <span className="display-tags">
                      {d.isPrimary && <span className="display-tag primary">{t('settings.primaryDisplay')}</span>}
                      {d.isCurrent && <span className="display-tag current">{t('settings.currentDisplay')}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="layout-sliders">
            <div className="layout-slider-row">
              <label className="layout-slider-label">{t('settings.sidebarWidth')}</label>
              <input
                type="range"
                className="layout-slider"
                min={60}
                max={120}
                step={5}
                value={settings.layout.sidebarWidth}
                onChange={(e) => handleLayoutChange('sidebarWidth', e.target.value)}
              />
              <span className="layout-slider-value">{settings.layout.sidebarWidth}px</span>
            </div>
            <div className="layout-slider-row">
              <label className="layout-slider-label">{t('settings.launcherWidth')}</label>
              <span className="layout-slider-value" style={{ marginLeft: 'auto' }}>{settings.layout.streamdeckWidth}px (auto)</span>
            </div>
          </div>

          <h4 className="settings-subsection-title">{t('settings.launcherGrid')}</h4>
          <div className="layout-sliders">
            <div className="layout-stepper-row">
              <label className="layout-slider-label">{t('settings.columns')}</label>
              <div className="layout-stepper">
                <button
                  className="stepper-btn"
                  onClick={() => settings.layout.gridColumns > 4 && handleLayoutChange('gridColumns', settings.layout.gridColumns - 1)}
                  disabled={settings.layout.gridColumns <= 4}
                >−</button>
                <span className="stepper-value">{settings.layout.gridColumns}</span>
                <button
                  className="stepper-btn"
                  onClick={() => settings.layout.gridColumns < (isFreeMode ? 4 : 12) && handleLayoutChange('gridColumns', settings.layout.gridColumns + 1)}
                  disabled={settings.layout.gridColumns >= (isFreeMode ? 4 : 12)}
                >+</button>
              </div>
            </div>
            <div className="layout-stepper-row">
              <label className="layout-slider-label">{t('settings.rows')}</label>
              <div className="layout-stepper">
                <button
                  className="stepper-btn"
                  onClick={() => settings.layout.gridRows > 3 && handleLayoutChange('gridRows', settings.layout.gridRows - 1)}
                  disabled={settings.layout.gridRows <= 3}
                >−</button>
                <span className="stepper-value">{settings.layout.gridRows}</span>
                <button
                  className="stepper-btn"
                  onClick={() => settings.layout.gridRows < (isFreeMode ? 4 : 12) && handleLayoutChange('gridRows', settings.layout.gridRows + 1)}
                  disabled={settings.layout.gridRows >= (isFreeMode ? 4 : 12)}
                >+</button>
              </div>
            </div>
            <div className="layout-grid-preview">
              {settings.layout.gridColumns} x {settings.layout.gridRows} = {settings.layout.gridColumns * settings.layout.gridRows} {t('settings.slots')}
            </div>
          </div>

          {/* Ordre des modules (masqué en free mode) */}
          {!isFreeMode && (
            <>
              <h4 className="settings-subsection-title">{t('settings.moduleOrder')}</h4>
              <div className="module-order-list">
                {currentOrder.map((moduleId, index) => {
                  const IconComp = getModuleIcon(moduleId);
                  const label = getModuleLabel(moduleId);
                  if (!IconComp) return null;
                  const isHidden = (settings.hiddenModules || []).includes(moduleId);
                  const isSettings = moduleId === 'settings';
                  return (
                    <div key={moduleId} className={`module-order-item ${isHidden ? 'hidden-module' : ''}`}>
                      <IconComp size={18} />
                      <span className="module-order-name">{label}</span>
                      {!isSettings && (
                        <button
                          className={`module-visibility-btn ${isHidden ? 'off' : ''}`}
                          onClick={() => handleToggleModule(moduleId)}
                          title={isHidden ? t('common.show') : t('common.hide')}
                        >
                          {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                      <div className="module-order-arrows">
                        <button
                          className="module-order-btn"
                          onClick={() => handleMoveModule(index, -1)}
                          disabled={index === 0}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          className="module-order-btn"
                          onClick={() => handleMoveModule(index, 1)}
                          disabled={index === currentOrder.length - 1}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Section Mises à jour */}
        <div className="settings-section settings-updates">
          <h3 className="settings-section-title">
            <Download size={18} />
            <span>{t('updates.title')}</span>
          </h3>

          <div className="update-version-row">
            <span className="update-version-label">{t('updates.currentVersion')}</span>
            <span className="update-version-value">{appVersion || '...'}</span>
          </div>

          {/* Bannière migration Electron → Tauri (visible uniquement dans la version Electron) */}
          {!window.__TAURI_INTERNALS__ && (
            <div className="migration-banner">
              <div className="migration-banner-header">
                <CheckCircle size={20} />
                <span>{t('updates.migrationTitle')}</span>
              </div>
              <p className="migration-banner-desc">{t('updates.migrationDesc')}</p>
              <p className="migration-banner-note">{t('updates.migrationNote')}</p>
              <button
                className="migration-download-btn"
                onClick={() => window.electronAPI?.openExternal(PULSEDECK_V2_URL)}
              >
                <Download size={16} />
                <span>{t('updates.migrationDownload')}</span>
              </button>
            </div>
          )}

          {/* Statut mises à jour classique (Tauri uniquement) */}
          {window.__TAURI_INTERNALS__ && (
            <>
              {updateStatus === 'available' && (
                <div className="update-status-banner available">
                  <Download size={16} />
                  <span>{t('updates.available')} — {t('updates.newVersion', { version: updateVersion })}</span>
                </div>
              )}

              {updateStatus === 'downloading' && (
                <div className="update-status-banner downloading">
                  <Loader size={16} className="spin" />
                  <span>{t('updates.downloading')} {t('updates.progress', { percent: updateProgress })}</span>
                  <div className="update-progress-bar">
                    <div className="update-progress-fill" style={{ width: `${updateProgress}%` }} />
                  </div>
                </div>
              )}

              {updateStatus === 'ready' && (
                <div className="update-status-banner ready">
                  <CheckCircle size={16} />
                  <span>{t('updates.ready')} — {t('updates.newVersion', { version: updateVersion })}</span>
                </div>
              )}

              {updateStatus === 'up-to-date' && (
                <div className="update-status-banner up-to-date">
                  <CheckCircle size={16} />
                  <span>{t('updates.upToDate')}</span>
                </div>
              )}

              {updateStatus === 'error' && (
                <div className="update-status-banner error">
                  <AlertCircle size={16} />
                  <span>{t('updates.error')}{updateError ? ` : ${updateError}` : ''}</span>
                </div>
              )}

              <div className="update-actions">
                {updateStatus === 'ready' ? (
                  <button
                    className="update-install-btn"
                    onClick={() => window.electronAPI?.quitAndInstall()}
                  >
                    <Download size={16} />
                    <span>{t('updates.install')}</span>
                  </button>
                ) : (
                  <button
                    className="update-check-btn"
                    onClick={() => {
                      setUpdateStatus('checking');
                      window.electronAPI?.checkForUpdates();
                    }}
                    disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                  >
                    {updateStatus === 'checking' ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
                    <span>{updateStatus === 'checking' ? t('updates.checking') : t('updates.checkForUpdates')}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Section Licence */}
        <div className="settings-section settings-license">
          <h3 className="settings-section-title">
            <Shield size={18} />
            <span>{t('license.title')}</span>
          </h3>

          {isFreeMode ? (
            <>
              <div className="license-status-row">
                <span className="license-status-label">{t('license.status')}</span>
                <span className="license-status-badge inactive">{t('license.freeLabel')}</span>
              </div>
              <p className="license-upgrade-hint">{t('license.upgradeHint')}</p>
              <div className="license-activate-form">
                <input
                  type="text"
                  className="license-activate-input"
                  placeholder={t('license.placeholder')}
                  value={activateKey}
                  onChange={(e) => setActivateKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && activateKey.trim() && !activating) {
                      handleSettingsActivate();
                    }
                  }}
                  disabled={activating}
                />
                <button
                  className="license-activate-btn"
                  disabled={activating || !activateKey.trim()}
                  onClick={handleSettingsActivate}
                >
                  {activating ? t('license.activating') : t('license.activate')}
                </button>
              </div>
              {activateError && (
                <div className="license-activate-error">{activateError}</div>
              )}
              <button
                className="license-buy-settings-btn"
                onClick={() => window.electronAPI?.openExternal(STORE_URL)}
              >
                <ShoppingCart size={16} />
                <span>{t('license.buyLicense')}</span>
              </button>
            </>
          ) : (
            <>
              <div className="license-status-row">
                <span className="license-status-label">{t('license.status')}</span>
                <span className={`license-status-badge ${licenseInfo ? 'active' : 'inactive'}`}>
                  {licenseInfo ? t('license.active') : t('license.inactive')}
                </span>
              </div>

              {licenseInfo && (
                <>
                  <div className="license-info-list">
                    <div className="license-info-item">
                      <span className="license-info-label">{t('license.key')}</span>
                      <span className="license-info-value license-key-value">{licenseInfo.key}</span>
                    </div>
                    <div className="license-info-item">
                      <span className="license-info-label">{t('license.activatedAt')}</span>
                      <span className="license-info-value">
                        {new Date(licenseInfo.activatedAt).toLocaleDateString(dateLocale, {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="license-info-item">
                      <span className="license-info-label">{t('license.lastValidated')}</span>
                      <span className="license-info-value">
                        {new Date(licenseInfo.lastValidated).toLocaleDateString(dateLocale, {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    className="license-deactivate-btn"
                    onClick={() => setShowDeactivateConfirm(true)}
                  >
                    <X size={16} />
                    <span>{t('license.deactivate')}</span>
                  </button>

                  {showDeactivateConfirm && (
                    <div className="license-confirm-overlay" onClick={() => setShowDeactivateConfirm(false)}>
                      <div className="license-confirm-dialog" onClick={e => e.stopPropagation()}>
                        <p>{t('license.confirmDeactivate')}</p>
                        <div className="license-confirm-actions">
                          <button
                            className="license-confirm-cancel"
                            onClick={() => setShowDeactivateConfirm(false)}
                          >
                            {t('license.cancel')}
                          </button>
                          <button
                            className="license-confirm-yes"
                            onClick={async () => {
                              try {
                                await window.electronAPI.deactivateLicense();
                                window.location.reload();
                              } catch (err) {
                                setShowDeactivateConfirm(false);
                              }
                            }}
                          >
                            {t('license.confirmYes')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer liens légaux */}
        <div className="settings-footer">
          <a onClick={() => window.electronAPI?.openExternal('https://g33koun3t.github.io/Monitoring-Dashboard/privacy-policy.html')}>
            {t('settings.privacyPolicy')}
          </a>
          <span className="settings-footer-sep">|</span>
          <a onClick={() => window.electronAPI?.openExternal('https://g33koun3t.github.io/Monitoring-Dashboard/terms-of-use.html')}>
            {t('settings.termsOfUse')}
          </a>
          <span className="settings-footer-sep">|</span>
          <a onClick={() => window.electronAPI?.openExternal('mailto:contact.pulsedeck@gmail.com')}>
            contact.pulsedeck@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}

export default SettingsModule;
