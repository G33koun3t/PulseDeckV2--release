import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Plus, X, Save, Image, Trash2, Check, Download, Upload, Power, RotateCcw, Moon, Lock, Trash, Layers, Minus, Home, Loader, Lightbulb, ToggleRight, PanelTop, Wind } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useLicense } from '../contexts/LicenseContext';
import './StreamDeck.css';

const STORAGE_KEY = 'streamdeck_buttons';
const SETTINGS_KEY = 'app_settings';

const SYSTEM_ACTIONS = [
  { id: 'shutdown', labelKey: 'launcher.systemActions.shutdown', icon: Power, dangerous: true },
  { id: 'restart', labelKey: 'launcher.systemActions.restart', icon: RotateCcw, dangerous: true },
  { id: 'sleep', labelKey: 'launcher.systemActions.sleep', icon: Moon, dangerous: false },
  { id: 'lock', labelKey: 'launcher.systemActions.lock', icon: Lock, dangerous: false },
  { id: 'empty-recycle-bin', labelKey: 'launcher.systemActions.emptyRecycleBin', icon: Trash, dangerous: false },
];

const HA_DOMAINS = {
  light:         { services: ['toggle', 'turn_on', 'turn_off'], hasColor: true },
  switch:        { services: ['toggle', 'turn_on', 'turn_off'] },
  cover:         { services: ['open_cover', 'close_cover', 'stop_cover'] },
  fan:           { services: ['toggle', 'turn_on', 'turn_off'] },
  input_boolean: { services: ['toggle', 'turn_on', 'turn_off'] },
};

const DOMAIN_PICKER_ICONS = {
  light: Lightbulb,
  switch: ToggleRight,
  cover: PanelTop,
  fan: Wind,
  input_boolean: ToggleRight,
};

function isHaConfigured() {
  return !!(localStorage.getItem('ha_url') && localStorage.getItem('ha_token'));
}

function getEntityStateText(state, t) {
  const key = `launcher.haStates.${state}`;
  const translated = t(key);
  return translated !== key ? translated : (state ? state.charAt(0).toUpperCase() + state.slice(1) : '');
}

function encodeHaAction(entityId, action, serviceData) {
  const base = `ha|${action}|${entityId}`;
  if (serviceData && Object.keys(serviceData).length > 0) {
    return `${base}|${JSON.stringify(serviceData)}`;
  }
  return base;
}

function decodeHaAction(str) {
  if (!str || !str.startsWith('ha|')) return null;
  try {
    const parts = str.split('|');
    return {
      action: parts[1] || '',
      entityId: parts[2] || '',
      serviceData: parts.length > 3 ? JSON.parse(parts.slice(3).join('|')) : {},
    };
  } catch {
    return null;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function loadButtons() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveButtons(buttons) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buttons));
}

function getGridSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return { columns: 7, rows: 5 };
    const parsed = JSON.parse(data);
    return {
      columns: parsed.layout?.gridColumns || 7,
      rows: parsed.layout?.gridRows || 5,
    };
  } catch {
    return { columns: 7, rows: 5 };
  }
}

// Composant partagé pour le picker d'entités HA (style Dashboard HA OS)
function HaEntityPicker({ value, onChange, entities, loading, error, t }) {
  const [activeDomain, setActiveDomain] = useState(null);

  // Auto-sélectionner le domaine de l'entité choisie, ou le 1er domaine disponible
  useEffect(() => {
    if (value.entityId) {
      setActiveDomain(value.entityId.split('.')[0]);
      return;
    }
    const actionable = Object.keys(HA_DOMAINS);
    const first = actionable.find(d => entities.some(e => e.entity_id.startsWith(d + '.')));
    if (first && !activeDomain) setActiveDomain(first);
  }, [entities, value.entityId]);

  if (loading) {
    return (
      <div className="streamdeck-ha-loading">
        <Loader size={16} className="spinning" />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return <div className="streamdeck-ha-error">{error}</div>;
  }

  const actionable = Object.keys(HA_DOMAINS);
  const availableDomains = actionable.filter(d => entities.some(e => e.entity_id.startsWith(d + '.')));
  const filteredEntities = activeDomain
    ? entities.filter(e => e.entity_id.startsWith(activeDomain + '.')).sort((a, b) => (a.attributes?.friendly_name || a.entity_id).localeCompare(b.attributes?.friendly_name || b.entity_id))
    : [];

  const selectedDomain = value.entityId ? value.entityId.split('.')[0] : null;
  const domainDef = selectedDomain ? HA_DOMAINS[selectedDomain] : null;

  const colorHex = (() => {
    const rgb = value.serviceData?.rgb_color;
    if (rgb) return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
    return '#ffffff';
  })();

  return (
    <div className="ha-picker">
      {/* Onglets domaine */}
      <div className="ha-picker-domain-tabs">
        {availableDomains.map(domain => {
          const Icon = DOMAIN_PICKER_ICONS[domain] || Home;
          return (
            <button
              key={domain}
              className={`ha-picker-domain-tab ${activeDomain === domain ? 'active' : ''}`}
              onClick={() => setActiveDomain(domain)}
            >
              <Icon size={14} />
              <span>{t(`launcher.haDomains.${domain}`)}</span>
            </button>
          );
        })}
      </div>

      {/* Grille de tiles entités */}
      <div className="ha-picker-entity-grid">
        {filteredEntities.map(entity => {
          const isSelected = value.entityId === entity.entity_id;
          const isOn = entity.state === 'on' || entity.state === 'open';
          const friendlyName = entity.attributes?.friendly_name || entity.entity_id.split('.')[1];
          const DomainIcon = DOMAIN_PICKER_ICONS[activeDomain] || Home;

          return (
            <button
              key={entity.entity_id}
              className={`ha-picker-entity-tile ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                const domain = entity.entity_id.split('.')[0];
                const def = HA_DOMAINS[domain];
                const defaultService = def?.services[0] || 'toggle';
                onChange({
                  entityId: entity.entity_id,
                  action: `${domain}.${defaultService}`,
                  serviceData: {},
                  friendlyName,
                });
              }}
            >
              <div className={`ha-picker-entity-icon ${isOn ? 'on' : 'off'}`}>
                <DomainIcon size={18} />
              </div>
              <div className="ha-picker-entity-info">
                <span className="ha-picker-entity-name">{friendlyName}</span>
                <span className={`ha-picker-entity-state ${isOn ? 'on' : 'off'}`}>
                  {isOn ? '\u25CF' : '\u25CB'} {getEntityStateText(entity.state, t)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Service buttons */}
      {value.entityId && domainDef && (
        <>
          <label className="ha-picker-section-label">{t('launcher.haService')}</label>
          <div className="ha-picker-service-list">
            {domainDef.services.map(svc => (
              <button
                key={svc}
                className={`ha-picker-service-btn ${value.action === `${selectedDomain}.${svc}` ? 'active' : ''}`}
                onClick={() => onChange({ ...value, action: `${selectedDomain}.${svc}`, serviceData: {} })}
              >
                {t(`launcher.haServices.${svc}`)}
              </button>
            ))}
          </div>

          {/* Contrôles lumière */}
          {selectedDomain === 'light' && (value.action === 'light.turn_on' || value.action === 'light.toggle') && (() => {
            const selectedEntity = entities.find(e => e.entity_id === value.entityId);
            const modes = selectedEntity?.attributes?.supported_color_modes || [];
            const entitySupportsColor = modes.some(m => ['rgb', 'hs', 'xy', 'rgbw', 'rgbww'].includes(m));
            const entitySupportsBrightness = modes.some(m => m !== 'onoff');
            if (!entitySupportsBrightness && !entitySupportsColor) return null;
            return (
              <div className="ha-picker-light-controls">
                {entitySupportsColor && (
                  <div className="ha-picker-color-row">
                    <div className="ha-picker-color-swatch" style={{ backgroundColor: colorHex }} />
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => {
                        const hex = e.target.value;
                        const r = parseInt(hex.slice(1, 3), 16);
                        const g = parseInt(hex.slice(3, 5), 16);
                        const b = parseInt(hex.slice(5, 7), 16);
                        onChange({ ...value, serviceData: { ...value.serviceData, rgb_color: [r, g, b] } });
                      }}
                    />
                    <label>{t('launcher.haColor')}</label>
                  </div>
                )}
                {entitySupportsBrightness && (
                  <div className="ha-picker-brightness-row">
                    <label>{t('launcher.haBrightness')}</label>
                    <input
                      type="range"
                      min="1"
                      max="255"
                      value={value.serviceData?.brightness || 255}
                      onChange={(e) => onChange({ ...value, serviceData: { ...value.serviceData, brightness: parseInt(e.target.value) } })}
                    />
                    <span className="ha-picker-brightness-value">{Math.round((value.serviceData?.brightness || 255) / 255 * 100)}%</span>
                  </div>
                )}
                <div className="ha-picker-hint">{t('launcher.haColorHint')}</div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function StreamDeck() {
  const { t } = useTranslation();
  const { isFreeMode } = useLicense();
  const [buttons, setButtons] = useState(loadButtons);
  const [editMode, setEditMode] = useState(false);
  const [editingButton, setEditingButton] = useState(null);
  const [gridSettings, setGridSettings] = useState(getGridSettings);
  const [confirmAction, setConfirmAction] = useState(null);
  const [haEntities, setHaEntities] = useState([]);
  const [haLoading, setHaLoading] = useState(false);
  const [haError, setHaError] = useState(null);
  const [profileHaPicker, setProfileHaPicker] = useState(null);
  const modalRef = useRef(null);

  // Écouter les changements de settings (grille)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === SETTINGS_KEY) {
        setGridSettings(getGridSettings());
      }
    };
    // Aussi vérifier périodiquement (même onglet)
    const interval = setInterval(() => {
      const current = getGridSettings();
      setGridSettings(prev => {
        if (prev.columns !== current.columns || prev.rows !== current.rows) return current;
        return prev;
      });
    }, 500);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Sauvegarder quand les boutons changent
  useEffect(() => {
    saveButtons(buttons);
  }, [buttons]);

  // Reset HA picker quand le type change
  useEffect(() => {
    setProfileHaPicker(null);
  }, [editingButton?.type]);

  // Charger les entités HA quand l'éditeur ouvre avec type homeassistant ou profile
  useEffect(() => {
    const needHa = editingButton && (editingButton.type === 'homeassistant' || (editingButton.type === 'profile' && isHaConfigured()));
    if (!needHa) {
      setHaEntities([]);
      setHaError(null);
      return;
    }
    const haUrl = localStorage.getItem('ha_url');
    const haToken = localStorage.getItem('ha_token');
    if (!haUrl || !haToken || !window.electronAPI?.fetchHomeAssistant) {
      setHaError('Home Assistant non configuré');
      return;
    }
    setHaLoading(true);
    setHaError(null);
    window.electronAPI.fetchHomeAssistant(haUrl, haToken, 'states')
      .then(result => {
        if (result.success) {
          const actionable = Object.keys(HA_DOMAINS);
          const filtered = result.data.filter(e => {
            const domain = e.entity_id.split('.')[0];
            return actionable.includes(domain);
          });
          setHaEntities(filtered);
        } else {
          setHaError(result.error || 'Connexion échouée');
        }
      })
      .catch(err => setHaError(err.message))
      .finally(() => setHaLoading(false));
  }, [editingButton?.type]);

  // Exécuter une action Home Assistant
  const executeHomeAssistant = useCallback(async (button) => {
    const haUrl = localStorage.getItem('ha_url');
    const haToken = localStorage.getItem('ha_token');
    if (!haUrl || !haToken || !window.electronAPI?.callHomeAssistantService) return;
    if (!button.action || !button.haEntityId) return;
    const [domain, service] = button.action.split('.');
    const data = { entity_id: button.haEntityId, ...(button.haServiceData || {}) };
    try {
      await window.electronAPI.callHomeAssistantService(haUrl, haToken, domain, service, data);
    } catch (err) {
      console.error('Erreur Home Assistant:', err);
    }
  }, []);

  // Exécuter une action système
  const executeSystemAction = useCallback(async (actionId) => {
    if (!window.electronAPI?.systemAction) return;
    try {
      await window.electronAPI.systemAction(actionId);
    } catch (err) {
      console.error('Erreur systemAction:', err);
    }
  }, []);

  // Exécuter un profil (actions séquentielles : URL ou HA)
  const executeProfile = useCallback(async (actions) => {
    for (const action of actions) {
      if (!action) continue;
      try {
        if (action.startsWith('ha|')) {
          const ha = decodeHaAction(action);
          if (ha) {
            const haUrl = localStorage.getItem('ha_url');
            const haToken = localStorage.getItem('ha_token');
            if (haUrl && haToken && window.electronAPI?.callHomeAssistantService) {
              const [domain, service] = ha.action.split('.');
              const data = { entity_id: ha.entityId, ...ha.serviceData };
              await window.electronAPI.callHomeAssistantService(haUrl, haToken, domain, service, data);
            }
          }
        } else {
          if (window.electronAPI?.openExternal) {
            await window.electronAPI.openExternal(action);
          }
        }
      } catch (err) {
        console.error('Erreur profil action:', err);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }, []);

  // Lancer une action
  const handleButtonClick = useCallback(async (button) => {
    const type = button.type || 'app';

    if (type === 'system') {
      const systemDef = SYSTEM_ACTIONS.find(a => a.id === button.action);
      if (systemDef?.dangerous) {
        setConfirmAction({ button, systemDef });
        return;
      }
      await executeSystemAction(button.action);
      return;
    }

    if (type === 'profile') {
      if (button.actions?.length) {
        await executeProfile(button.actions);
      }
      return;
    }

    if (type === 'homeassistant') {
      await executeHomeAssistant(button);
      return;
    }

    // type === 'app' (défaut)
    if (!button.action || !window.electronAPI?.openExternal) return;
    try {
      await window.electronAPI.openExternal(button.action);
    } catch (err) {
      console.error('Erreur openExternal:', err);
    }
  }, [executeSystemAction, executeProfile, executeHomeAssistant]);

  // Confirmer action dangereuse
  const handleConfirmDangerous = useCallback(async () => {
    if (!confirmAction) return;
    await executeSystemAction(confirmAction.button.action);
    setConfirmAction(null);
  }, [confirmAction, executeSystemAction]);

  // Ouvrir le formulaire d'édition
  const openEditor = useCallback((position, existingButton = null) => {
    setEditingButton({
      position,
      id: existingButton?.id || null,
      name: existingButton?.name || '',
      image: existingButton?.image || '',
      action: existingButton?.action || '',
      type: existingButton?.type || 'app',
      actions: existingButton?.actions || [''],
      haEntityId: existingButton?.haEntityId || '',
      haServiceData: existingButton?.haServiceData || {},
    });
  }, []);

  // Choisir une image
  const handleSelectImage = useCallback(async () => {
    if (!window.electronAPI?.selectImage) return;
    try {
      const result = await window.electronAPI.selectImage();
      if (result.success && result.image) {
        setEditingButton(prev => ({ ...prev, image: result.image }));
      }
    } catch (err) {
      console.error('Erreur selectImage:', err);
    }
  }, []);

  // Sauvegarder un bouton
  const handleSave = useCallback(() => {
    if (!editingButton) return;
    const { position, id, name, image, action, type, actions } = editingButton;

    const buttonData = { name, image, position, type: type || 'app' };

    if (type === 'system') {
      buttonData.action = action;
    } else if (type === 'profile') {
      buttonData.actions = actions.filter(a => a.trim());
    } else if (type === 'homeassistant') {
      buttonData.action = action;
      buttonData.haEntityId = editingButton.haEntityId;
      buttonData.haServiceData = editingButton.haServiceData;
    } else {
      buttonData.action = action;
    }

    if (id) {
      setButtons(prev => prev.map(b => b.id === id ? { ...b, ...buttonData } : b));
    } else {
      setButtons(prev => [...prev, { id: generateId(), ...buttonData }]);
    }
    setEditingButton(null);
  }, [editingButton]);

  // Supprimer un bouton
  const handleDelete = useCallback((buttonId) => {
    setButtons(prev => prev.filter(b => b.id !== buttonId));
    setEditingButton(null);
  }, []);

  // Exporter la configuration
  const handleExport = useCallback(async () => {
    if (!window.electronAPI?.exportLauncherConfig) return;
    try {
      const result = await window.electronAPI.exportLauncherConfig(buttons);
      if (result.success) {
        console.log('Configuration exportée:', result.path);
      }
    } catch (err) {
      console.error('Erreur export:', err);
    }
  }, [buttons]);

  // Importer la configuration
  const handleImport = useCallback(async () => {
    if (!window.electronAPI?.importLauncherConfig) return;
    try {
      const result = await window.electronAPI.importLauncherConfig();
      if (result.success && result.config) {
        setButtons(result.config);
        console.log('Configuration importée:', result.config.length, 'boutons');
      }
    } catch (err) {
      console.error('Erreur import:', err);
    }
  }, []);

  // Fermer le modal au clic extérieur
  useEffect(() => {
    if (!editingButton) return;
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setEditingButton(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingButton]);

  // Icône pour un bouton système dans la grille
  const getSystemIcon = (actionId) => {
    const def = SYSTEM_ACTIONS.find(a => a.id === actionId);
    return def ? def.icon : Power;
  };

  // Construire la grille (clampée en free mode)
  const effectiveGrid = isFreeMode
    ? { columns: Math.min(gridSettings.columns, 4), rows: Math.min(gridSettings.rows, 4) }
    : gridSettings;
  const totalSlots = effectiveGrid.columns * effectiveGrid.rows;
  const grid = Array.from({ length: totalSlots }, (_, i) => {
    return buttons.find(b => b.position === i) || null;
  });

  // Rendu du contenu d'un bouton dans la grille
  const renderButtonContent = (button) => {
    const type = button.type || 'app';

    if (button.image) {
      return <img src={button.image} alt={button.name} className="streamdeck-button-img" draggable={false} />;
    }

    // Pas d'image custom : icône lucide pour system/profile
    if (type === 'system') {
      const IconComponent = getSystemIcon(button.action);
      return <div className="streamdeck-button-system-icon"><IconComponent size={28} /></div>;
    }

    if (type === 'profile') {
      return <div className="streamdeck-button-system-icon"><Layers size={28} /></div>;
    }

    if (type === 'homeassistant') {
      return <div className="streamdeck-button-system-icon"><Home size={28} /></div>;
    }

    return <div className="streamdeck-button-placeholder" />;
  };

  return (
    <div className="streamdeck-panel">
      {/* Header */}
      <div className="streamdeck-header">
        <span className="streamdeck-title">{t('launcher.title')}</span>
        <div className="streamdeck-header-actions">
          {editMode && (
            <>
              <button className="streamdeck-action-btn" onClick={handleExport} title={t('common.export')}>
                <Download size={16} />
              </button>
              <button className="streamdeck-action-btn" onClick={handleImport} title={t('common.import')}>
                <Upload size={16} />
              </button>
            </>
          )}
          <button
            className={`streamdeck-edit-btn ${editMode ? 'active' : ''}`}
            onClick={() => { setEditMode(!editMode); setEditingButton(null); }}
          >
            {editMode ? <Check size={16} /> : <Settings size={16} />}
            <span>{editMode ? t('launcher.done') : t('launcher.editBtn')}</span>
          </button>
        </div>
      </div>

      {/* Grille */}
      <div className="streamdeck-grid-wrapper">
      <div className="streamdeck-grid" style={{ gridTemplateColumns: `repeat(${effectiveGrid.columns}, 1fr)` }}>
        {grid.map((button, index) => {
          if (button) {
            return (
              <button
                key={button.id}
                className={`streamdeck-button ${editMode ? 'edit-mode' : ''}`}
                onClick={() => editMode ? openEditor(index, button) : handleButtonClick(button)}
                title={button.name}
              >
                {renderButtonContent(button)}
                {button.name && <span className="streamdeck-button-name">{button.name}</span>}
                {editMode && (
                  <div className="streamdeck-button-edit-badge">
                    <Settings size={12} />
                  </div>
                )}
              </button>
            );
          }

          // Emplacement vide
          if (editMode) {
            return (
              <button
                key={`empty-${index}`}
                className="streamdeck-button empty"
                onClick={() => openEditor(index)}
              >
                <Plus size={24} />
              </button>
            );
          }

          return <div key={`empty-${index}`} className="streamdeck-slot-hidden" />;
        })}
      </div>
      </div>

      {/* Modal d'édition */}
      {editingButton && (
        <div className="streamdeck-modal-overlay">
          <div className="streamdeck-modal" ref={modalRef}>
            <div className="streamdeck-modal-header">
              <span>{editingButton.id ? t('launcher.editButton') : t('launcher.newButton')}</span>
              <button className="streamdeck-modal-close" onClick={() => setEditingButton(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="streamdeck-modal-body">
              {/* Sélecteur de type (masqué en free mode — app uniquement) */}
              {!isFreeMode && (
                <div className="streamdeck-type-selector">
                  <label>{t('launcher.buttonType')}</label>
                  <div className="streamdeck-type-options">
                    {['app', 'system', 'profile', ...(isHaConfigured() ? ['homeassistant'] : [])].map(type => (
                      <button
                        key={type}
                        className={`streamdeck-type-option ${editingButton.type === type ? 'active' : ''}`}
                        onClick={() => setEditingButton(prev => ({
                          ...prev,
                          type,
                          action: type === prev.type ? prev.action : '',
                          actions: type === 'profile' ? (prev.type === 'profile' ? prev.actions : ['']) : prev.actions,
                          haEntityId: type === 'homeassistant' ? (prev.type === 'homeassistant' ? prev.haEntityId : '') : '',
                          haServiceData: type === 'homeassistant' ? (prev.type === 'homeassistant' ? prev.haServiceData : {}) : {},
                        }))}
                      >
                        {t(`launcher.types.${type}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prévisualisation */}
              <div className="streamdeck-preview">
                <div
                  className="streamdeck-preview-button"
                  onClick={handleSelectImage}
                  title={t('launcher.chooseIcon')}
                >
                  {editingButton.image ? (
                    <img src={editingButton.image} alt="preview" className="streamdeck-preview-img" draggable={false} />
                  ) : (
                    <div className="streamdeck-preview-empty">
                      <Image size={32} />
                      <span>{t('launcher.chooseIcon')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Champs */}
              <div className="streamdeck-form">
                <div className="streamdeck-field">
                  <label>{t('common.name')}</label>
                  <input
                    type="text"
                    value={editingButton.name}
                    onChange={(e) => setEditingButton(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={editingButton.type === 'profile' ? 'Gaming Setup' : 'Counter-Strike 2'}
                  />
                </div>

                {/* Type App : champ action libre */}
                {editingButton.type === 'app' && (
                  <>
                    <div className="streamdeck-field">
                      <label>{t('launcher.action')}</label>
                      <input
                        type="text"
                        value={editingButton.action}
                        onChange={(e) => setEditingButton(prev => ({ ...prev, action: e.target.value }))}
                        placeholder="steam://rungameid/730"
                      />
                    </div>
                    <div className="streamdeck-field-hint">
                      {t('launcher.examplesHint')}
                    </div>
                  </>
                )}

                {/* Type System : liste radio des actions */}
                {editingButton.type === 'system' && (
                  <div className="streamdeck-field">
                    <label>{t('launcher.systemAction')}</label>
                    <div className="streamdeck-system-action-list">
                      {SYSTEM_ACTIONS.map(sa => {
                        const Icon = sa.icon;
                        return (
                          <button
                            key={sa.id}
                            className={`streamdeck-system-action-item ${editingButton.action === sa.id ? 'active' : ''}`}
                            onClick={() => setEditingButton(prev => ({ ...prev, action: sa.id }))}
                          >
                            <Icon size={18} />
                            <span>{t(sa.labelKey)}</span>
                            {sa.dangerous && <span className="streamdeck-dangerous-badge">!</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Type Profile : liste d'actions (URL + HA) */}
                {editingButton.type === 'profile' && (
                  <div className="streamdeck-field">
                    <label>{t('launcher.profileActions')}</label>
                    <div className="streamdeck-profile-actions">
                      {editingButton.actions.map((action, idx) => {
                        const ha = action && action.startsWith('ha|') ? decodeHaAction(action) : null;
                        if (ha) {
                          const entity = haEntities.find(e => e.entity_id === ha.entityId);
                          const friendlyName = entity?.attributes?.friendly_name || ha.entityId;
                          const svc = ha.action.split('.')[1] || '';
                          return (
                            <div key={idx} className="streamdeck-profile-action-row streamdeck-profile-ha-row">
                              <Home size={16} />
                              <span className="streamdeck-profile-ha-label">{friendlyName} — {t(`launcher.haServices.${svc}`)}</span>
                              {editingButton.actions.length > 1 && (
                                <button
                                  className="streamdeck-profile-action-remove"
                                  onClick={() => {
                                    const newActions = editingButton.actions.filter((_, i) => i !== idx);
                                    setEditingButton(prev => ({ ...prev, actions: newActions }));
                                  }}
                                >
                                  <Minus size={16} />
                                </button>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="streamdeck-profile-action-row">
                            <input
                              type="text"
                              value={action}
                              onChange={(e) => {
                                const newActions = [...editingButton.actions];
                                newActions[idx] = e.target.value;
                                setEditingButton(prev => ({ ...prev, actions: newActions }));
                              }}
                              placeholder="steam://rungameid/730"
                            />
                            {editingButton.actions.length > 1 && (
                              <button
                                className="streamdeck-profile-action-remove"
                                onClick={() => {
                                  const newActions = editingButton.actions.filter((_, i) => i !== idx);
                                  setEditingButton(prev => ({ ...prev, actions: newActions }));
                                }}
                              >
                                <Minus size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div className="streamdeck-profile-add-buttons">
                        <button
                          className="streamdeck-profile-add-btn"
                          onClick={() => setEditingButton(prev => ({ ...prev, actions: [...prev.actions, ''] }))}
                        >
                          <Plus size={14} />
                          <span>{t('launcher.addAction')}</span>
                        </button>
                        {isHaConfigured() && (
                          <button
                            className="streamdeck-profile-add-btn"
                            onClick={() => setProfileHaPicker({ entityId: '', action: '', serviceData: {} })}
                          >
                            <Home size={14} />
                            <span>{t('launcher.addHaAction')}</span>
                          </button>
                        )}
                      </div>

                      {/* Picker HA inline pour profil */}
                      {profileHaPicker && (
                        <div className="streamdeck-profile-ha-picker">
                          <HaEntityPicker
                            value={profileHaPicker}
                            onChange={setProfileHaPicker}
                            entities={haEntities}
                            loading={haLoading}
                            error={haError}
                            t={t}
                          />
                          <div className="streamdeck-profile-ha-picker-actions">
                            <button className="streamdeck-btn secondary" onClick={() => setProfileHaPicker(null)}>
                              {t('common.cancel')}
                            </button>
                            <button
                              className="streamdeck-btn primary"
                              disabled={!profileHaPicker.entityId || !profileHaPicker.action}
                              onClick={() => {
                                const encoded = encodeHaAction(profileHaPicker.entityId, profileHaPicker.action, profileHaPicker.serviceData);
                                setEditingButton(prev => ({ ...prev, actions: [...prev.actions.filter(a => a.trim()), encoded] }));
                                setProfileHaPicker(null);
                              }}
                            >
                              <Plus size={14} />
                              <span>{t('common.add')}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="streamdeck-field-hint">
                      {t('launcher.profileHint')}
                    </div>
                  </div>
                )}

                {/* Type Home Assistant : picker style Dashboard HA */}
                {editingButton.type === 'homeassistant' && (
                  <div className="streamdeck-field">
                    <label>{t('launcher.haEntity')}</label>
                    <HaEntityPicker
                      value={{
                        entityId: editingButton.haEntityId,
                        action: editingButton.action,
                        serviceData: editingButton.haServiceData,
                      }}
                      onChange={({ entityId, action, serviceData, friendlyName }) => {
                        setEditingButton(prev => ({
                          ...prev,
                          haEntityId: entityId,
                          action,
                          haServiceData: serviceData,
                          name: prev.name || friendlyName || '',
                        }));
                      }}
                      entities={haEntities}
                      loading={haLoading}
                      error={haError}
                      t={t}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="streamdeck-modal-footer">
              {editingButton.id && (
                <button className="streamdeck-btn danger" onClick={() => handleDelete(editingButton.id)}>
                  <Trash2 size={16} />
                  <span>{t('common.delete')}</span>
                </button>
              )}
              <div className="streamdeck-modal-spacer" />
              <button className="streamdeck-btn secondary" onClick={() => setEditingButton(null)}>
                {t('common.cancel')}
              </button>
              <button className="streamdeck-btn primary" onClick={handleSave}>
                <Save size={16} />
                <span>{t('launcher.save')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de confirmation pour actions dangereuses */}
      {confirmAction && (
        <div className="streamdeck-confirm-overlay" onClick={() => setConfirmAction(null)}>
          <div className="streamdeck-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="streamdeck-confirm-icon">
              {(() => { const Icon = confirmAction.systemDef.icon; return <Icon size={32} />; })()}
            </div>
            <p className="streamdeck-confirm-text">
              {t('launcher.confirmDangerous')}
            </p>
            <p className="streamdeck-confirm-action-name">
              {t(confirmAction.systemDef.labelKey)}
            </p>
            <div className="streamdeck-confirm-actions">
              <button className="streamdeck-btn secondary" onClick={() => setConfirmAction(null)}>
                {t('common.cancel')}
              </button>
              <button className="streamdeck-btn danger" onClick={handleConfirmDangerous}>
                {t('launcher.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StreamDeck;
