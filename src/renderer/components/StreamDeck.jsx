import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Plus, X, Save, Image, Trash2, Check, Download, Upload, Power, RotateCcw, Moon, Lock, Trash, Layers, Minus } from 'lucide-react';
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

function StreamDeck() {
  const { t } = useTranslation();
  const { isFreeMode } = useLicense();
  const [buttons, setButtons] = useState(loadButtons);
  const [editMode, setEditMode] = useState(false);
  const [editingButton, setEditingButton] = useState(null);
  const [gridSettings, setGridSettings] = useState(getGridSettings);
  const [confirmAction, setConfirmAction] = useState(null);
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

  // Exécuter une action système
  const executeSystemAction = useCallback(async (actionId) => {
    if (!window.electronAPI?.systemAction) return;
    try {
      await window.electronAPI.systemAction(actionId);
    } catch (err) {
      console.error('Erreur systemAction:', err);
    }
  }, []);

  // Exécuter un profil (actions séquentielles)
  const executeProfile = useCallback(async (actions) => {
    if (!window.electronAPI?.openExternal) return;
    for (const action of actions) {
      if (!action) continue;
      try {
        await window.electronAPI.openExternal(action);
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

    // type === 'app' (défaut)
    if (!button.action || !window.electronAPI?.openExternal) return;
    try {
      await window.electronAPI.openExternal(button.action);
    } catch (err) {
      console.error('Erreur openExternal:', err);
    }
  }, [executeSystemAction, executeProfile]);

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
                    {['app', 'system', 'profile'].map(type => (
                      <button
                        key={type}
                        className={`streamdeck-type-option ${editingButton.type === type ? 'active' : ''}`}
                        onClick={() => setEditingButton(prev => ({
                          ...prev,
                          type,
                          action: type === 'system' ? (prev.type === 'system' ? prev.action : '') : prev.action,
                          actions: type === 'profile' ? (prev.type === 'profile' ? prev.actions : ['']) : prev.actions,
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

                {/* Type Profile : liste d'actions */}
                {editingButton.type === 'profile' && (
                  <div className="streamdeck-field">
                    <label>{t('launcher.profileActions')}</label>
                    <div className="streamdeck-profile-actions">
                      {editingButton.actions.map((action, idx) => (
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
                      ))}
                      <button
                        className="streamdeck-profile-add-btn"
                        onClick={() => setEditingButton(prev => ({ ...prev, actions: [...prev.actions, ''] }))}
                      >
                        <Plus size={14} />
                        <span>{t('launcher.addAction')}</span>
                      </button>
                    </div>
                    <div className="streamdeck-field-hint">
                      {t('launcher.profileHint')}
                    </div>
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
