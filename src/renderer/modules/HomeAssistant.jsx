import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Home, Settings, X, RefreshCw, Wifi, WifiOff,
  AlertCircle, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw,
} from 'lucide-react';
import useModuleConfig from '../hooks/useModuleConfig';
import { useTranslation } from '../i18n';
import { ALL_DOMAINS, DOMAIN_ICONS } from './homeassistant/constants';
import { sortEntities } from './homeassistant/helpers';
import useAreas from './homeassistant/useAreas';
import useHistory from './homeassistant/useHistory';
import RoomCard from './homeassistant/RoomCard';
import DomainTabs from './homeassistant/DomainTabs';
import ColorPopover from './homeassistant/ColorPopover';
import SensorDetailModal from './homeassistant/SensorDetailModal';
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
  const [sensorModal, setSensorModal] = useState(null);
  const [detailedHistory, setDetailedHistory] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const colorDebounceRef = useRef(null);

  // Domaines et entités masquées
  const [visibleDomains, setVisibleDomains] = useState(() => {
    const saved = localStorage.getItem('ha_visible_domains');
    return saved ? JSON.parse(saved) : ['light', 'switch', 'climate', 'cover'];
  });
  const [hiddenEntities, setHiddenEntities] = useState(() => {
    const saved = localStorage.getItem('ha_hidden_entities');
    return saved ? JSON.parse(saved) : [];
  });

  // Pièces repliées
  const [collapsedRooms, setCollapsedRooms] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ha_collapsed_rooms') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('ha_hidden_entities', JSON.stringify(hiddenEntities));
  }, [hiddenEntities]);

  useEffect(() => {
    localStorage.setItem('ha_collapsed_rooms', JSON.stringify(collapsedRooms));
  }, [collapsedRooms]);

  // Hooks areas & history
  const { areas, areaEntityMap, refresh: refreshAreas } = useAreas(haUrl, haToken, isConnected);
  const { getHistory, fetchBatch, fetchDetailed } = useHistory(haUrl, haToken);

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
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [haUrl, haToken, t]);

  // Auto-refresh 30s
  useEffect(() => {
    if (haUrl && haToken) {
      fetchEntities();
      const interval = setInterval(fetchEntities, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchEntities, haUrl, haToken]);

  // Fetch historique pour les capteurs visibles
  useEffect(() => {
    const sensorIds = entities
      .filter(e => {
        const d = e.entity_id.split('.')[0];
        if (d !== 'sensor') return false;
        if (!visibleDomains.includes(d)) return false;
        if (hiddenEntities.includes(e.entity_id)) return false;
        if (activeDomainFilter && d !== activeDomainFilter) return false;
        return !isNaN(parseFloat(e.state));
      })
      .map(e => e.entity_id);

    if (sensorIds.length > 0) {
      fetchBatch(sensorIds);
    }
  }, [entities, visibleDomains, hiddenEntities, activeDomainFilter, fetchBatch]);

  // Actions entités
  const toggleEntity = useCallback(async (entityId) => {
    if (!window.electronAPI?.callHomeAssistantService) return;
    const domain = entityId.split('.')[0];
    try {
      const result = await window.electronAPI.callHomeAssistantService(haUrl, haToken, domain, 'toggle', { entity_id: entityId });
      if (result.success) setTimeout(fetchEntities, 500);
    } catch {}
  }, [haUrl, haToken, fetchEntities]);

  const controlCover = useCallback(async (entityId, action) => {
    if (!window.electronAPI?.callHomeAssistantService) return;
    const serviceMap = { open: 'open_cover', close: 'close_cover', stop: 'stop_cover' };
    try {
      const result = await window.electronAPI.callHomeAssistantService(haUrl, haToken, 'cover', serviceMap[action], { entity_id: entityId });
      if (result.success) setTimeout(fetchEntities, 500);
    } catch {}
  }, [haUrl, haToken, fetchEntities]);

  const setLightColor = useCallback((entityId, rgbColor) => {
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(async () => {
      if (!window.electronAPI?.callHomeAssistantService) return;
      try {
        await window.electronAPI.callHomeAssistantService(haUrl, haToken, 'light', 'turn_on', { entity_id: entityId, rgb_color: rgbColor });
        setTimeout(fetchEntities, 500);
      } catch {}
    }, 300);
  }, [haUrl, haToken, fetchEntities]);

  const setLightBrightness = useCallback((entityId, brightness) => {
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(async () => {
      if (!window.electronAPI?.callHomeAssistantService) return;
      try {
        await window.electronAPI.callHomeAssistantService(haUrl, haToken, 'light', 'turn_on', { entity_id: entityId, brightness: parseInt(brightness) });
        setTimeout(fetchEntities, 500);
      } catch {}
    }, 300);
  }, [haUrl, haToken, fetchEntities]);

  const showColorPopover = useCallback((entityId, e) => {
    if (colorPopover?.entityId === entityId) {
      setColorPopover(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setColorPopover({
        entityId,
        x: Math.min(rect.left, window.innerWidth - 230),
        y: rect.bottom + 8,
      });
    }
  }, [colorPopover]);

  const hideEntity = useCallback((entityId) => {
    setHiddenEntities(prev => [...prev, entityId]);
  }, []);

  const openSensorDetail = useCallback(async (entityId) => {
    setSensorModal({ entityId });
    setDetailedHistory(null);
    setDetailLoading(true);
    const data = await fetchDetailed(entityId);
    setDetailedHistory(data);
    setDetailLoading(false);
  }, [fetchDetailed]);

  const closeSensorDetail = useCallback(() => {
    setSensorModal(null);
    setDetailedHistory(null);
  }, []);

  // Settings
  const saveSettings = () => {
    localStorage.setItem('ha_url', tempUrl);
    localStorage.setItem('ha_token', tempToken);
    localStorage.setItem('ha_visible_domains', JSON.stringify(visibleDomains));
    setHaUrl(tempUrl);
    setHaToken(tempToken);
    setShowSettings(false);
    setError(null);
  };

  const toggleDomainVisibility = (domain) => {
    setVisibleDomains(prev => prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]);
  };

  const toggleRoomCollapse = useCallback((areaId) => {
    setCollapsedRooms(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    );
  }, []);

  // Filtrage et groupement par pièce
  const filteredEntities = useMemo(() => {
    return entities.filter(entity => {
      const domain = entity.entity_id.split('.')[0];
      if (!visibleDomains.includes(domain)) return false;
      if (hiddenEntities.includes(entity.entity_id)) return false;
      if (activeDomainFilter && domain !== activeDomainFilter) return false;
      return true;
    });
  }, [entities, visibleDomains, hiddenEntities, activeDomainFilter]);

  const availableDomains = useMemo(() => {
    return [...new Set(
      entities
        .filter(e => {
          const d = e.entity_id.split('.')[0];
          return visibleDomains.includes(d) && !hiddenEntities.includes(e.entity_id);
        })
        .map(e => e.entity_id.split('.')[0])
    )].sort((a, b) => t('homeassistant.domains.' + a).localeCompare(t('homeassistant.domains.' + b)));
  }, [entities, visibleDomains, hiddenEntities, t]);

  const groupedByRoom = useMemo(() => {
    const groups = new Map();

    for (const entity of filteredEntities) {
      const areaId = areaEntityMap.get(entity.entity_id) || '__none__';
      if (!groups.has(areaId)) groups.set(areaId, []);
      groups.get(areaId).push(entity);
    }

    // Trier les entités dans chaque groupe
    for (const [, list] of groups) {
      list.sort(sortEntities);
    }

    // Trier les pièces : nommées d'abord (alpha), puis "__none__" en dernier
    const sortedIds = [...groups.keys()].sort((a, b) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      const nameA = areas.get(a)?.name || '';
      const nameB = areas.get(b)?.name || '';
      return nameA.localeCompare(nameB);
    });

    return sortedIds.map(id => ({
      areaId: id,
      area: id === '__none__' ? null : areas.get(id) || null,
      entities: groups.get(id),
    }));
  }, [filteredEntities, areaEntityMap, areas]);

  // ========== Rendu ==========

  // Settings overlay
  if (showSettings) {
    return (
      <div className="ha-module">
        <div className="ha-settings">
          <div className="settings-header">
            <Settings size={20} />
            <span>{t('homeassistant.configTitle')}</span>
            <button className="close-btn" onClick={() => setShowSettings(false)}><X size={18} /></button>
          </div>
          <div className="settings-form">
            <div className="form-group">
              <label>{t('homeassistant.haUrl')}</label>
              <input type="text" value={tempUrl} onChange={(e) => setTempUrl(e.target.value)} placeholder="http://homeassistant.local:8123" />
              <small>{t('homeassistant.urlHelp')}</small>
            </div>
            <div className="form-group">
              <label>{t('homeassistant.accessToken')}</label>
              <input type="password" value={tempToken} onChange={(e) => setTempToken(e.target.value)} placeholder="eyJ0eXAiOiJKV1QiLCJhbGc..." />
              <small>{t('homeassistant.tokenHelp')}</small>
            </div>
            <div className="form-group">
              <label>{t('homeassistant.domainsToShow')}</label>
              <div className="domain-toggles">
                {ALL_DOMAINS.map(domain => (
                  <label key={domain} className="domain-toggle">
                    <input type="checkbox" checked={visibleDomains.includes(domain)} onChange={() => toggleDomainVisibility(domain)} />
                    <span>{t('homeassistant.domains.' + domain)}</span>
                  </label>
                ))}
              </div>
            </div>
            {hiddenEntities.length > 0 && (
              <div className="form-group">
                <label>{t('homeassistant.hiddenEntities')} ({hiddenEntities.length})</label>
                <button className="reset-btn" onClick={() => setHiddenEntities([])}>
                  <RotateCcw size={14} />
                  {t('homeassistant.showAllEntities')}
                </button>
              </div>
            )}
            <div className="form-group widget-toggles-section">
              <label>{t('homeassistant.displaySections')}</label>
              <div className="widget-toggle-list">
                {haWidgets.map((widget, index) => {
                  const def = resolvedWidgetDefs[widget.id];
                  if (!def) return null;
                  const IconComp = def.icon;
                  return (
                    <div key={widget.id} className={`widget-toggle-item ${!widget.visible ? 'hidden-widget' : ''}`}>
                      <button className={`widget-toggle-btn ${!widget.visible ? 'off' : ''}`} onClick={() => toggleWidget(widget.id)}>
                        {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <IconComp size={14} className="widget-toggle-icon" />
                      <span className="widget-toggle-label">{def.label}</span>
                      <div className="widget-toggle-arrows">
                        <button className="widget-arrow-btn" onClick={() => moveWidget(widget.id, -1)} disabled={index === 0}><ChevronUp size={12} /></button>
                        <button className="widget-arrow-btn" onClick={() => moveWidget(widget.id, 1)} disabled={index === haWidgets.length - 1}><ChevronDown size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ha-size-row">
                <label className="ha-size-label">{t('homeassistant.minTileWidth')}</label>
                <input type="range" className="ha-size-slider" min={120} max={250} step={5} value={minTileWidth} onChange={(e) => setSize('minTileWidth', e.target.value)} />
                <span className="ha-size-value">{minTileWidth}px</span>
              </div>
              <button className="widget-reset-btn" onClick={resetWidgetConfig}>
                <RotateCcw size={12} /><span>{t('common.resetWidgets')}</span>
              </button>
            </div>
            {error && <div className="error-message">{error}</div>}
            <button className="save-btn" onClick={saveSettings}>{t('common.save')}</button>
          </div>
        </div>
      </div>
    );
  }

  // Setup screen
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
            {isConnected ? <Wifi size={16} className="status-connected" /> : <WifiOff size={16} className="status-disconnected" />}
            <span>{isConnected ? t('homeassistant.connected') : t('homeassistant.disconnected')}</span>
            {lastUpdate && (
              <span className="last-update">
                {lastUpdate.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="ha-actions">
            <button className={`action-btn ${isLoading ? 'spinning' : ''}`} onClick={() => { fetchEntities(); refreshAreas(); }} title={t('common.refresh')}>
              <RefreshCw size={15} />
            </button>
            <button className="action-btn" onClick={() => { setTempUrl(haUrl); setTempToken(haToken); setShowSettings(true); }} title={t('common.settings')}>
              <Settings size={15} />
            </button>
          </div>
        </div>
      )}

      {!isVisible('statusBar') && (
        <div className="ha-header-minimal">
          <button className="action-btn" onClick={() => { setTempUrl(haUrl); setTempToken(haToken); setShowSettings(true); }} title={t('common.settings')}>
            <Settings size={15} />
          </button>
        </div>
      )}

      {/* Error */}
      {isVisible('errorBar') && error && (
        <div className="ha-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Domain tabs */}
      {isVisible('domainGrid') && (
        <DomainTabs
          availableDomains={availableDomains}
          activeDomainFilter={activeDomainFilter}
          onFilterChange={setActiveDomainFilter}
          t={t}
        />
      )}

      {/* Room cards */}
      {isVisible('domainGrid') && groupedByRoom.length > 0 && (
        <div className="ha-rooms-container">
          {groupedByRoom.map(({ areaId, area, entities: roomEntities }) => (
            <RoomCard
              key={areaId}
              area={area}
              entities={roomEntities}
              collapsed={collapsedRooms.includes(areaId)}
              onToggleCollapse={() => toggleRoomCollapse(areaId)}
              onToggle={toggleEntity}
              onControlCover={controlCover}
              onShowColorPopover={showColorPopover}
              onHide={hideEntity}
              onSensorClick={openSensorDetail}
              getHistory={getHistory}
              minTileWidth={minTileWidth}
              t={t}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}

      {isVisible('domainGrid') && filteredEntities.length === 0 && !isLoading && (
        <div className="ha-empty">
          <Home size={48} />
          <p>{t('homeassistant.noEntities')}</p>
          <small>{t('homeassistant.addDomainsHint')}</small>
        </div>
      )}

      {/* Color popover */}
      {colorPopover && (
        <ColorPopover
          entity={entities.find(e => e.entity_id === colorPopover.entityId)}
          position={{ x: colorPopover.x, y: colorPopover.y }}
          onClose={() => setColorPopover(null)}
          onColorChange={setLightColor}
          onBrightnessChange={setLightBrightness}
        />
      )}

      {sensorModal && (
        <SensorDetailModal
          entity={entities.find(e => e.entity_id === sensorModal.entityId)}
          detailedHistory={detailedHistory}
          loading={detailLoading}
          onClose={closeSensorDetail}
          t={t}
          dateLocale={dateLocale}
        />
      )}
    </div>
  );
}

export default HomeAssistantModule;
