import React from 'react';
import { Settings, X, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { useTranslation } from '../i18n';
import './ModuleSettingsPanel.css';

/**
 * Panneau de configuration réutilisable pour les widgets d'un module.
 *
 * @param {string} title - Titre du panneau
 * @param {Array<{id, visible}>} widgets - État des widgets (depuis useModuleConfig)
 * @param {Object} widgetDefs - Définitions { [id]: { label, icon: LucideIcon } }
 * @param {Function} onToggle - (widgetId) => void
 * @param {Function} onMove - (widgetId, direction) => void
 * @param {Function} onClose - () => void
 * @param {Function} onReset - () => void
 * @param {Array<{key, label, min, max, step, value}>} sizes - Sliders de taille (optionnel)
 * @param {Function} onSizeChange - (key, value) => void (optionnel)
 * @param {React.ReactNode} children - Contenu additionnel (ex: config ville météo)
 */
function ModuleSettingsPanel({
  title,
  widgets,
  widgetDefs,
  onToggle,
  onMove,
  onClose,
  onReset,
  sizes,
  onSizeChange,
  children,
}) {
  const { t } = useTranslation();
  return (
    <div className="module-settings-overlay">
      <div className="module-settings-panel">
        {/* Header */}
        <div className="msp-header">
          <div className="msp-title">
            <Settings size={20} />
            <span>{title}</span>
          </div>
          <button className="msp-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="msp-content">
          {/* Contenu custom (config existante du module) */}
          {children && (
            <div className="msp-custom-section">
              {children}
            </div>
          )}

          {/* Section Affichage */}
          <div className="msp-section">
            <h4 className="msp-section-title">{t('common.display')}</h4>
            <div className="msp-widget-list">
              {widgets.map((widget, index) => {
                const def = widgetDefs[widget.id];
                if (!def) return null;
                const IconComp = def.icon;
                return (
                  <div
                    key={widget.id}
                    className={`msp-widget-item ${!widget.visible ? 'hidden-widget' : ''}`}
                  >
                    <button
                      className={`msp-toggle-btn ${!widget.visible ? 'off' : ''}`}
                      onClick={() => onToggle(widget.id)}
                      title={widget.visible ? t('common.hide') : t('common.show')}
                    >
                      {widget.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    {IconComp && <IconComp size={16} className="msp-widget-icon" />}
                    <span className="msp-widget-label">{def.label}</span>
                    <div className="msp-widget-arrows">
                      <button
                        className="msp-arrow-btn"
                        onClick={() => onMove(widget.id, -1)}
                        disabled={index === 0}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        className="msp-arrow-btn"
                        onClick={() => onMove(widget.id, 1)}
                        disabled={index === widgets.length - 1}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Tailles */}
          {sizes && sizes.length > 0 && (
            <div className="msp-section">
              <h4 className="msp-section-title">{t('common.sizes')}</h4>
              <div className="msp-sizes">
                {sizes.map((s) => (
                  <div key={s.key} className="msp-size-row">
                    <label className="msp-size-label">{s.label}</label>
                    <input
                      type="range"
                      className="msp-size-slider"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={s.value}
                      onChange={(e) => onSizeChange(s.key, e.target.value)}
                    />
                    <span className="msp-size-value">{s.value}px</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="msp-footer">
          <button className="msp-reset-btn" onClick={onReset}>
            <RotateCcw size={14} />
            <span>{t('common.reset')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModuleSettingsPanel;
