import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, Settings, X, RefreshCw, Lightbulb, Power, Thermometer,
  Droplets, Wind, Zap, Gauge, Sun, ToggleLeft, ToggleRight,
  AlertCircle, Wifi, WifiOff, Eye, EyeOff, Battery, Activity, Clock, RotateCcw,
  ChevronUp, ChevronDown, Square, Palette
} from 'lucide-react';
import useModuleConfig from '../hooks/useModuleConfig';
import { useTranslation } from '../i18n';
import './HomeAssistant.css';

const DEFAULT_WIDGETS = [
  { id: 'statusBar' },
  { id: 'errorBar' },
  { id: 'domainGrid' },
];

const HA_WIDGET_DEFS = {
  statusBar: { labelKey: 'homeassistant.statusBar', icon: Wifi },
  errorBar: { labelKey: 'homeassistant.errorBar', icon: AlertCircle },
  domainGrid: { labelKey: 'homeassistant.domainGrid', icon: Home },
};

const DEFAULT_SIZES = { minTileWidth: 150 };

// Icônes par domaine
const DOMAIN_ICONS = {
  light: Lightbulb,
  switch: Power,
  sensor: Gauge,
  binary_sensor: AlertCircle,
  climate: Thermometer,
  fan: Wind,
  cover: Home,
  media_player: Activity,
  automation: Zap,
  scene: Sun,
  script: Zap,
  input_boolean: ToggleRight,
  default: Home
};

// Icônes pour les capteurs selon leur classe
const SENSOR_ICONS = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  power: Zap,
  energy: Zap,
  battery: Battery,
  illuminance: Sun,
  timestamp: Clock,
  default: Gauge
};

// Couleurs par domaine et état
const DOMAIN_COLORS = {
  light:         { on: '#FFC107', off: '#555' },
  switch:        { on: '#3b82f6', off: '#555' },
  input_boolean: { on: '#3b82f6', off: '#555' },
  fan:           { on: '#06b6d4', off: '#555' },
  cover:         { on: '#8b5cf6', off: '#555' },
  climate:       { on: '#ef4444', off: '#555' },
  sensor:        { on: '#10b981', off: '#555' },
  binary_sensor: { on: '#f97316', off: '#555' },
  automation:    { on: '#eab308', off: '#555' },
  scene:         { on: '#eab308', off: '#555' },
  script:        { on: '#eab308', off: '#555' },
  media_player:  { on: '#3b82f6', off: '#555' },
  default:       { on: '#6366f1', off: '#555' },
};

// Helpers couleur lumières
const supportsColor = (entity) => {
  const modes = entity.attributes?.supported_color_modes || [];
  return modes.some(m => ['rgb', 'hs', 'xy', 'rgbw', 'rgbww'].includes(m));
};

const supportsBrightness = (entity) => {
  const modes = entity.attributes?.supported_color_modes || [];
  return modes.some(m => m !== 'onoff');
};

const rgbToHex = (rgb) => {
  if (!rgb || rgb.length < 3) return '#ffffff';
  return '#' + rgb.slice(0, 3).map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
};

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

// Formater une valeur de capteur
const formatSensorValue = (entity, t, dateLocale) => {
  const state = entity.state;
  const unit = entity.attributes?.unit_of_measurement || '';
  const deviceClass = entity.attributes?.device_class;

  if (state === 'unavailable' || state === 'unknown') {
    return t('homeassistant.na');
  }

  // Formater les dates/timestamps
  if (deviceClass === 'timestamp' || state.match(/^\d{4}-\d{2}-\d{2}T/)) {
    try {
      const date = new Date(state);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(dateLocale, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch {
      // Si le parsing échoue, retourner la valeur brute
    }
  }

  // Arrondir les nombres
  const num = parseFloat(state);
  if (!isNaN(num) && state.includes('.')) {
    return `${num.toFixed(1)}${unit ? ' ' + unit : ''}`;
  }

  return `${state}${unit ? ' ' + unit : ''}`;
};

function HomeAssistantModule() {
  const { t, dateLocale } = useTranslation();

  // Widget config
  const { widgets: haWidgets, isVisible, toggleWidget, moveWidget, getSize, setSize, resetConfig: resetWidgetConfig } = useModuleConfig('homeassistant', DEFAULT_WIDGETS, DEFAULT_SIZES);
  const minTileWidth = getSize('minTileWidth', 150);

  const resolvedWidgetDefs = Object.fromEntries(
    Object.entries(HA_WIDGET_DEFS).map(([id, def]) => [id, { ...def, label: t(def.labelKey) }])
  );

  // Configuration
  const [haUrl, setHaUrl] = useState(() => localStorage.getItem('ha_url') || '');
  const [haToken, setHaToken] = useState(() => localStorage.getItem('ha_token') || '');
  const [tempUrl, setTempUrl] = useState(haUrl);
  const [tempToken, setTempToken] = useState(haToken);

  // État
  const [entities, setEntities] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeDomainFilter, setActiveDomainFilter] = useState(null);
  const [colorPopover, setColorPopover] = useState(null);
  const colorPopoverRef = useRef(null);
  const colorDebounceRef = useRef(null);

  // Domaines à afficher (configurable)
  const [visibleDomains, setVisibleDomains] = useState(() => {
    const saved = localStorage.getItem('ha_visible_domains');
    return saved ? JSON.parse(saved) : ['light', 'switch', 'climate', 'cover'];
  });

  // Entités masquées
  const [hiddenEntities, setHiddenEntities] = useState(() => {
    const saved = localStorage.getItem('ha_hidden_entities');
    return saved ? JSON.parse(saved) : [];
  });

  // Sauvegarder les entités masquées
  useEffect(() => {
    localStorage.setItem('ha_hidden_entities', JSON.stringify(hiddenEntities));
  }, [hiddenEntities]);

  // Masquer une entité
  const hideEntity = (entityId) => {
    setHiddenEntities(prev => [...prev, entityId]);
  };

  // Réinitialiser les entités masquées
  const resetHiddenEntities = () => {
    setHiddenEntities([]);
  };

  // Récupérer les entités
  const fetchEntities = useCallback(async () => {
    if (!haUrl || !haToken || !window.electronAPI?.fetchHomeAssistant) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.fetchHomeAssistant(haUrl, haToken, 'states');

      if (result.success) {
        setEntities(result.data);
        setIsConnected(true);
        setLastUpdate(new Date());
      } else {
        setError(result.error || t('homeassistant.connectionError'));
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Erreur Home Assistant:', err);
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [haUrl, haToken, t]);

  // Charger au démarrage et rafraîchir toutes les 30 secondes
  useEffect(() => {
    if (haUrl && haToken) {
      fetchEntities();
      const interval = setInterval(fetchEntities, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchEntities, haUrl, haToken]);

  // Toggle une entité (light, switch, input_boolean)
  const toggleEntity = async (entityId) => {
    if (!window.electronAPI?.callHomeAssistantService) return;

    const domain = entityId.split('.')[0];

    try {
      const result = await window.electronAPI.callHomeAssistantService(
        haUrl, haToken, domain, 'toggle', { entity_id: entityId }
      );

      if (result.success) {
        setTimeout(fetchEntities, 500);
      }
    } catch (err) {
      console.error('Erreur toggle:', err);
    }
  };

  // Contrôler un volet (open, close, stop)
  const controlCover = async (entityId, action) => {
    if (!window.electronAPI?.callHomeAssistantService) return;

    const serviceMap = {
      open: 'open_cover',
      close: 'close_cover',
      stop: 'stop_cover'
    };

    try {
      const result = await window.electronAPI.callHomeAssistantService(
        haUrl, haToken, 'cover', serviceMap[action], { entity_id: entityId }
      );

      if (result.success) {
        setTimeout(fetchEntities, 500);
      }
    } catch (err) {
      console.error('Erreur cover:', err);
    }
  };

  // Changer la couleur d'une lumière (avec debounce)
  const setLightColor = (entityId, rgbColor) => {
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(async () => {
      if (!window.electronAPI?.callHomeAssistantService) return;
      try {
        await window.electronAPI.callHomeAssistantService(
          haUrl, haToken, 'light', 'turn_on', { entity_id: entityId, rgb_color: rgbColor }
        );
        setTimeout(fetchEntities, 500);
      } catch (err) {
        console.error('Erreur setLightColor:', err);
      }
    }, 300);
  };

  // Changer la luminosité (avec debounce)
  const setLightBrightness = (entityId, brightness) => {
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(async () => {
      if (!window.electronAPI?.callHomeAssistantService) return;
      try {
        await window.electronAPI.callHomeAssistantService(
          haUrl, haToken, 'light', 'turn_on', { entity_id: entityId, brightness: parseInt(brightness) }
        );
        setTimeout(fetchEntities, 500);
      } catch (err) {
        console.error('Erreur setLightBrightness:', err);
      }
    }, 300);
  };

  // Fermer le popover couleur au clic extérieur
  useEffect(() => {
    if (!colorPopover) return;
    const handleClick = (e) => {
      if (colorPopoverRef.current && !colorPopoverRef.current.contains(e.target)) {
        setColorPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPopover]);

  // Sauvegarder les paramètres
  const saveSettings = () => {
    localStorage.setItem('ha_url', tempUrl);
    localStorage.setItem('ha_token', tempToken);
    localStorage.setItem('ha_visible_domains', JSON.stringify(visibleDomains));
    setHaUrl(tempUrl);
    setHaToken(tempToken);
    setShowSettings(false);
    setError(null);
  };

  // Toggle domaine visible
  const toggleDomainVisibility = (domain) => {
    setVisibleDomains(prev => {
      if (prev.includes(domain)) {
        return prev.filter(d => d !== domain);
      }
      return [...prev, domain];
    });
  };

  // Obtenir le composant icône d'un capteur
  const getSensorIconComponent = (entity) => {
    const deviceClass = entity.attributes?.device_class;
    return SENSOR_ICONS[deviceClass] || SENSOR_ICONS.default;
  };

  // Traduire l'état d'une entité
  const getEntityStateText = (entity) => {
    const state = entity.state;
    const domain = entity.entity_id.split('.')[0];
    if (domain === 'sensor' || domain === 'binary_sensor') {
      return formatSensorValue(entity, t, dateLocale);
    }
    const key = `homeassistant.states.${state}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return state ? state.charAt(0).toUpperCase() + state.slice(1) : t('homeassistant.na');
  };

  // Domaines disponibles (pour les onglets filtre)
  const availableDomains = [...new Set(
    entities
      .filter(e => {
        const d = e.entity_id.split('.')[0];
        return visibleDomains.includes(d) && !hiddenEntities.includes(e.entity_id);
      })
      .map(e => e.entity_id.split('.')[0])
  )].sort((a, b) => t('homeassistant.domains.' + a).localeCompare(t('homeassistant.domains.' + b)));

  // Liste plate filtrée et triée
  const flatFilteredEntities = entities
    .filter(entity => {
      const domain = entity.entity_id.split('.')[0];
      if (!visibleDomains.includes(domain)) return false;
      if (hiddenEntities.includes(entity.entity_id)) return false;
      if (activeDomainFilter && domain !== activeDomainFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const isOnA = a.state === 'on' || a.state === 'open' || a.state === 'opening';
      const isOnB = b.state === 'on' || b.state === 'open' || b.state === 'opening';
      if (isOnA && !isOnB) return -1;
      if (!isOnA && isOnB) return 1;
      const nameA = a.attributes?.friendly_name || a.entity_id;
      const nameB = b.attributes?.friendly_name || b.entity_id;
      return nameA.localeCompare(nameB);
    });

  // Écran de configuration
  if (showSettings) {
    const allDomains = ['light', 'switch', 'sensor', 'binary_sensor', 'climate', 'fan', 'cover', 'media_player', 'automation', 'scene', 'script', 'input_boolean'];

    return (
      <div className="ha-module">
        <div className="ha-settings">
          <div className="settings-header">
            <Settings size={20} />
            <span>{t('homeassistant.configTitle')}</span>
            <button className="close-btn" onClick={() => setShowSettings(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="settings-form">
            <div className="form-group">
              <label>{t('homeassistant.haUrl')}</label>
              <input
                type="text"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="http://homeassistant.local:8123"
              />
              <small>{t('homeassistant.urlHelp')}</small>
            </div>
            <div className="form-group">
              <label>{t('homeassistant.accessToken')}</label>
              <input
                type="password"
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                placeholder="eyJ0eXAiOiJKV1QiLCJhbGc..."
              />
              <small>{t('homeassistant.tokenHelp')}</small>
            </div>
            <div className="form-group">
              <label>{t('homeassistant.domainsToShow')}</label>
              <div className="domain-toggles">
                {allDomains.map(domain => (
                  <label key={domain} className="domain-toggle">
                    <input
                      type="checkbox"
                      checked={visibleDomains.includes(domain)}
                      onChange={() => toggleDomainVisibility(domain)}
                    />
                    <span>{t('homeassistant.domains.' + domain)}</span>
                  </label>
                ))}
              </div>
            </div>
            {hiddenEntities.length > 0 && (
              <div className="form-group">
                <label>{t('homeassistant.hiddenEntities')} ({hiddenEntities.length})</label>
                <button className="reset-btn" onClick={resetHiddenEntities}>
                  <RotateCcw size={14} />
                  {t('homeassistant.showAllEntities')}
                </button>
              </div>
            )}
            {/* Widget visibility + sizes */}
            <div className="form-group widget-toggles-section">
              <label>{t('homeassistant.displaySections')}</label>
              <div className="widget-toggle-list">
                {haWidgets.map((widget, index) => {
                  const def = resolvedWidgetDefs[widget.id];
                  if (!def) return null;
                  const IconComp = def.icon;
                  return (
                    <div key={widget.id} className={`widget-toggle-item ${!widget.visible ? 'hidden-widget' : ''}`}>
                      <button
                        className={`widget-toggle-btn ${!widget.visible ? 'off' : ''}`}
                        onClick={() => toggleWidget(widget.id)}
                      >
                        {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <IconComp size={14} className="widget-toggle-icon" />
                      <span className="widget-toggle-label">{def.label}</span>
                      <div className="widget-toggle-arrows">
                        <button className="widget-arrow-btn" onClick={() => moveWidget(widget.id, -1)} disabled={index === 0}>
                          <ChevronUp size={12} />
                        </button>
                        <button className="widget-arrow-btn" onClick={() => moveWidget(widget.id, 1)} disabled={index === haWidgets.length - 1}>
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ha-size-row">
                <label className="ha-size-label">{t('homeassistant.minTileWidth')}</label>
                <input
                  type="range"
                  className="ha-size-slider"
                  min={120}
                  max={250}
                  step={5}
                  value={minTileWidth}
                  onChange={(e) => setSize('minTileWidth', e.target.value)}
                />
                <span className="ha-size-value">{minTileWidth}px</span>
              </div>
              <button className="widget-reset-btn" onClick={resetWidgetConfig}>
                <RotateCcw size={12} />
                <span>{t('common.resetWidgets')}</span>
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            <button className="save-btn" onClick={saveSettings}>{t('common.save')}</button>
          </div>
        </div>
      </div>
    );
  }

  // Écran de configuration initiale
  if (!haUrl || !haToken) {
    return (
      <div className="ha-module">
        <div className="ha-setup">
          <Home size={64} />
          <h2>Home Assistant</h2>
          <p>{t('homeassistant.configDescription')}</p>
          <button className="setup-btn" onClick={() => setShowSettings(true)}>
            <Settings size={18} />
            {t('common.configure')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ha-module">
      {/* Header */}
      {isVisible('statusBar') && (
        <div className="ha-header">
          <div className="ha-status">
            {isConnected ? (
              <Wifi size={16} className="status-connected" />
            ) : (
              <WifiOff size={16} className="status-disconnected" />
            )}
            <span>{isConnected ? t('homeassistant.connected') : t('homeassistant.disconnected')}</span>
            {lastUpdate && (
              <span className="last-update">
                {lastUpdate.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="ha-actions">
            <button
              className={`action-btn ${isLoading ? 'spinning' : ''}`}
              onClick={fetchEntities}
              title={t('common.refresh')}
            >
              ⟳
            </button>
            <button
              className="action-btn"
              onClick={() => {
                setTempUrl(haUrl);
                setTempToken(haToken);
                setShowSettings(true);
              }}
              title={t('common.settings')}
            >
              ⚙
            </button>
          </div>
        </div>
      )}

      {/* Bouton settings si header masqué */}
      {!isVisible('statusBar') && (
        <div className="ha-header-minimal">
          <button
            className="action-btn"
            onClick={() => {
              setTempUrl(haUrl);
              setTempToken(haToken);
              setShowSettings(true);
            }}
            title={t('common.settings')}
          >
            ⚙
          </button>
        </div>
      )}

      {/* Erreur */}
      {isVisible('errorBar') && error && (
        <div className="ha-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Onglets domaine */}
      {isVisible('domainGrid') && availableDomains.length > 0 && (
        <div className="ha-domain-tabs">
          <button
            className={`ha-domain-tab ${activeDomainFilter === null ? 'active' : ''}`}
            onClick={() => setActiveDomainFilter(null)}
          >
            {t('homeassistant.allDomains')}
          </button>
          {availableDomains.map(domain => {
            const DIcon = DOMAIN_ICONS[domain] || DOMAIN_ICONS.default;
            return (
              <button
                key={domain}
                className={`ha-domain-tab ${activeDomainFilter === domain ? 'active' : ''}`}
                onClick={() => setActiveDomainFilter(activeDomainFilter === domain ? null : domain)}
              >
                <DIcon size={14} />
                <span>{t('homeassistant.domains.' + domain)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grille de tiles */}
      {isVisible('domainGrid') && flatFilteredEntities.length > 0 && (
        <div className="ha-tile-grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minTileWidth}px, 1fr))` }}>
          {flatFilteredEntities.map(entity => {
            const domain = entity.entity_id.split('.')[0];
            const isToggleable = ['light', 'switch', 'input_boolean', 'fan'].includes(domain);
            const isCover = domain === 'cover';
            const isSensor = domain === 'sensor' || domain === 'binary_sensor';
            const isOn = entity.state === 'on' || entity.state === 'open' || entity.state === 'opening';
            const name = entity.attributes?.friendly_name || entity.entity_id.split('.')[1];
            const DomainIcon = isSensor ? getSensorIconComponent(entity) : (DOMAIN_ICONS[domain] || DOMAIN_ICONS.default);
            const colors = DOMAIN_COLORS[domain] || DOMAIN_COLORS.default;
            const hasLightColor = domain === 'light' && isOn && entity.attributes?.rgb_color;
            const lightHex = hasLightColor ? rgbToHex(entity.attributes.rgb_color) : null;
            const iconColor = hasLightColor ? lightHex : ((isSensor || isOn) ? colors.on : colors.off);
            const iconBg = hasLightColor ? `${lightHex}22` : ((isSensor || isOn) ? `${colors.on}22` : `${colors.off}22`);
            const isLight = domain === 'light';
            const lightHasControls = isLight && isOn && (supportsColor(entity) || supportsBrightness(entity));

            return (
              <div
                key={entity.entity_id}
                className={`ha-tile ${isToggleable ? 'toggleable' : ''} ${isOn ? 'on' : 'off'}`}
                onClick={isToggleable ? () => toggleEntity(entity.entity_id) : undefined}
              >
                <button
                  className="ha-tile-hide"
                  onClick={(e) => { e.stopPropagation(); hideEntity(entity.entity_id); }}
                  title={t('common.hide')}
                >
                  <EyeOff size={12} />
                </button>

                <div className="ha-tile-icon" style={{ background: iconBg, color: iconColor }}>
                  <DomainIcon size={20} />
                </div>

                <div className="ha-tile-name" title={name}>{name}</div>

                {isCover ? (
                  <div className="ha-tile-cover-controls">
                    <button onClick={(e) => { e.stopPropagation(); controlCover(entity.entity_id, 'open'); }} title={t('homeassistant.open')}>
                      <ChevronUp size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); controlCover(entity.entity_id, 'stop'); }} title={t('homeassistant.stop')}>
                      <Square size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); controlCover(entity.entity_id, 'close'); }} title={t('homeassistant.closeCover')}>
                      <ChevronDown size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={`ha-tile-state ${isOn ? 'on' : 'off'}`}>
                    {getEntityStateText(entity)}
                  </div>
                )}

                {lightHasControls && (
                  <button
                    className="ha-tile-color-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (colorPopover?.entityId === entity.entity_id) {
                        setColorPopover(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setColorPopover({
                          entityId: entity.entity_id,
                          x: Math.min(rect.left, window.innerWidth - 230),
                          y: rect.bottom + 8,
                        });
                      }
                    }}
                    style={{ background: supportsColor(entity) ? (lightHex || colors.on) : 'var(--bg-tertiary)' }}
                    title={supportsColor(entity) ? t('homeassistant.color') : t('homeassistant.brightness')}
                  >
                    {supportsColor(entity) ? <Palette size={12} /> : <Sun size={12} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isVisible('domainGrid') && flatFilteredEntities.length === 0 && !isLoading && (
        <div className="ha-empty">
          <Home size={48} />
          <p>{t('homeassistant.noEntities')}</p>
          <small>{t('homeassistant.addDomainsHint')}</small>
        </div>
      )}

      {/* Popover couleur lumière */}
      {colorPopover && (() => {
        const entity = entities.find(e => e.entity_id === colorPopover.entityId);
        if (!entity || entity.state !== 'on') return null;
        const hasColor = supportsColor(entity);
        const hasBrightness = supportsBrightness(entity);
        const currentRgb = entity.attributes?.rgb_color || [255, 255, 255];
        const currentBrightness = entity.attributes?.brightness || 255;
        const currentHex = rgbToHex(currentRgb);
        return (
          <div
            ref={colorPopoverRef}
            className="ha-color-popover"
            style={{ top: colorPopover.y, left: colorPopover.x }}
          >
            {hasColor && (
              <div className="ha-color-picker-row">
                <input
                  type="color"
                  value={currentHex}
                  onChange={(e) => setLightColor(colorPopover.entityId, hexToRgb(e.target.value))}
                />
                <div className="ha-color-preview" style={{ background: currentHex }} />
                <span className="ha-color-hex">{currentHex}</span>
              </div>
            )}
            {hasBrightness && (
              <div className="ha-brightness-row">
                <Sun size={14} />
                <input
                  type="range"
                  min="1"
                  max="255"
                  value={currentBrightness}
                  onChange={(e) => setLightBrightness(colorPopover.entityId, e.target.value)}
                />
                <span>{Math.round(currentBrightness / 255 * 100)}%</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default HomeAssistantModule;
