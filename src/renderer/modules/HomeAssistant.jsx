import React, { useState, useEffect, useCallback } from 'react';
import {
  Home, Settings, X, RefreshCw, Lightbulb, Power, Thermometer,
  Droplets, Wind, Zap, Gauge, Sun, ToggleLeft, ToggleRight,
  AlertCircle, Wifi, WifiOff, Eye, EyeOff, Battery, Activity, Clock, RotateCcw,
  ChevronUp, ChevronDown, Square
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

const DEFAULT_SIZES = { minCardWidth: 300 };

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
  const minCardWidth = getSize('minCardWidth', 300);

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

  // Grouper les entités par domaine (exclure les masquées)
  const groupedEntities = entities.reduce((groups, entity) => {
    const domain = entity.entity_id.split('.')[0];
    if (!visibleDomains.includes(domain)) return groups;
    if (hiddenEntities.includes(entity.entity_id)) return groups;

    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(entity);
    return groups;
  }, {});

  // Obtenir l'icône d'un capteur
  const getSensorIcon = (entity) => {
    const deviceClass = entity.attributes?.device_class;
    const IconComponent = SENSOR_ICONS[deviceClass] || SENSOR_ICONS.default;
    return <IconComponent size={18} />;
  };

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
                <label className="ha-size-label">{t('homeassistant.minCardWidth')}</label>
                <input
                  type="range"
                  className="ha-size-slider"
                  min={250}
                  max={500}
                  step={10}
                  value={minCardWidth}
                  onChange={(e) => setSize('minCardWidth', e.target.value)}
                />
                <span className="ha-size-value">{minCardWidth}px</span>
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

      {/* Grille des domaines */}
      {isVisible('domainGrid') && <div className="ha-grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))` }}>
        {Object.entries(groupedEntities)
          .sort(([a], [b]) => t('homeassistant.domains.' + a).localeCompare(t('homeassistant.domains.' + b)))
          .map(([domain, domainEntities]) => {
            const DomainIcon = DOMAIN_ICONS[domain] || DOMAIN_ICONS.default;
            const isToggleable = ['light', 'switch', 'input_boolean', 'fan'].includes(domain);
            const isCover = domain === 'cover';
            const isSensor = domain === 'sensor' || domain === 'binary_sensor';

            return (
              <div key={domain} className={`ha-card ${domain}`}>
                <div className="card-header">
                  <DomainIcon size={22} />
                  <span>{t('homeassistant.domains.' + domain)}</span>
                  <span className="card-count">{domainEntities.length}</span>
                </div>
                <div className="card-content">
                  {domainEntities
                    .sort((a, b) => {
                      // Trier: ON en premier pour les toggleables
                      if (isToggleable) {
                        if (a.state === 'on' && b.state !== 'on') return -1;
                        if (a.state !== 'on' && b.state === 'on') return 1;
                      }
                      return (a.attributes?.friendly_name || a.entity_id).localeCompare(
                        b.attributes?.friendly_name || b.entity_id
                      );
                    })
                    .map(entity => {
                      const name = entity.attributes?.friendly_name || entity.entity_id.split('.')[1];
                      const shortName = name.length > 28 ? name.substring(0, 26) + '...' : name;
                      // Pour les volets: "open" = on, "closed" = off
                      const isOn = domain === 'cover'
                        ? (entity.state === 'open' || entity.state === 'opening')
                        : entity.state === 'on';

                      if (isSensor) {
                        return (
                          <div key={entity.entity_id} className="entity-row sensor">
                            {getSensorIcon(entity)}
                            <span className="entity-name" title={name}>{shortName}</span>
                            <span className="entity-value">{formatSensorValue(entity, t, dateLocale)}</span>
                            <button
                              className="hide-btn"
                              onClick={(e) => { e.stopPropagation(); hideEntity(entity.entity_id); }}
                              title={t('common.hide')}
                            >
                              <EyeOff size={14} />
                            </button>
                          </div>
                        );
                      }

                      if (isCover) {
                        return (
                          <div key={entity.entity_id} className="entity-row cover-row">
                            <span className="entity-name" title={name}>{shortName}</span>
                            <div className="cover-controls">
                              <button
                                className="cover-btn open"
                                onClick={() => controlCover(entity.entity_id, 'open')}
                                title={t('homeassistant.open')}
                              >
                                <ChevronUp size={18} />
                              </button>
                              <button
                                className="cover-btn stop"
                                onClick={() => controlCover(entity.entity_id, 'stop')}
                                title={t('homeassistant.stop')}
                              >
                                <Square size={14} />
                              </button>
                              <button
                                className="cover-btn close"
                                onClick={() => controlCover(entity.entity_id, 'close')}
                                title={t('homeassistant.closeCover')}
                              >
                                <ChevronDown size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (isToggleable) {
                        return (
                          <div
                            key={entity.entity_id}
                            className={`entity-row toggle ${isOn ? 'on' : 'off'}`}
                            onClick={() => toggleEntity(entity.entity_id)}
                          >
                            {isOn ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                            <span className="entity-name" title={name}>{shortName}</span>
                            <button
                              className="hide-btn"
                              onClick={(e) => { e.stopPropagation(); hideEntity(entity.entity_id); }}
                              title={t('common.hide')}
                            >
                              <EyeOff size={14} />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div key={entity.entity_id} className="entity-row">
                          <DomainIcon size={18} />
                          <span className="entity-name" title={name}>{shortName}</span>
                          <span className="entity-state">{entity.state}</span>
                          <button
                            className="hide-btn"
                            onClick={(e) => { e.stopPropagation(); hideEntity(entity.entity_id); }}
                            title={t('common.hide')}
                          >
                            <EyeOff size={14} />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
      </div>}

      {isVisible('domainGrid') && Object.keys(groupedEntities).length === 0 && !isLoading && (
        <div className="ha-empty">
          <Home size={48} />
          <p>{t('homeassistant.noEntities')}</p>
          <small>{t('homeassistant.addDomainsHint')}</small>
        </div>
      )}
    </div>
  );
}

export default HomeAssistantModule;
