import { useState, useCallback } from 'react';

/**
 * Hook réutilisable pour la configuration des widgets par module.
 * Gère la visibilité, l'ordre et les tailles personnalisées.
 *
 * @param {string} moduleId - Identifiant du module (ex: 'monitoring')
 * @param {Array<{id: string, defaultVisible?: boolean}>} defaultWidgets - Widgets par défaut
 * @param {Object} defaultSizes - Tailles par défaut (ex: { sidebarWidth: 360 })
 */
export default function useModuleConfig(moduleId, defaultWidgets, defaultSizes = {}) {
  const storageKey = `${moduleId}_widget_config`;

  const [config, setConfig] = useState(() => {
    try {
      const data = localStorage.getItem(storageKey);
      if (!data) {
        return {
          widgets: defaultWidgets.map(w => ({ id: w.id, visible: w.defaultVisible !== false })),
          sizes: { ...defaultSizes },
        };
      }
      const parsed = JSON.parse(data);
      const storedIds = (parsed.widgets || []).map(w => w.id);
      // Fusionner : garder l'ordre stocké + ajouter les nouveaux widgets en fin
      const merged = [
        ...(parsed.widgets || []).filter(w => defaultWidgets.some(d => d.id === w.id)),
        ...defaultWidgets
          .filter(d => !storedIds.includes(d.id))
          .map(d => ({ id: d.id, visible: d.defaultVisible !== false })),
      ];
      // Préserver les champs extras (presentationMode, widgetColors, etc.)
      const { widgets: _w, sizes: _s, ...extras } = parsed;
      return {
        widgets: merged,
        sizes: { ...defaultSizes, ...parsed.sizes },
        ...extras,
      };
    } catch {
      return {
        widgets: defaultWidgets.map(w => ({ id: w.id, visible: w.defaultVisible !== false })),
        sizes: { ...defaultSizes },
      };
    }
  });

  const persist = useCallback((newConfig) => {
    setConfig(newConfig);
    localStorage.setItem(storageKey, JSON.stringify(newConfig));
  }, [storageKey]);

  const isVisible = useCallback((widgetId) => {
    const w = config.widgets.find(w => w.id === widgetId);
    return w ? w.visible : true;
  }, [config.widgets]);

  const toggleWidget = useCallback((widgetId) => {
    const newWidgets = config.widgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    persist({ ...config, widgets: newWidgets });
  }, [config, persist]);

  const moveWidget = useCallback((widgetId, direction) => {
    const idx = config.widgets.findIndex(w => w.id === widgetId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= config.widgets.length) return;
    const newWidgets = [...config.widgets];
    [newWidgets[idx], newWidgets[newIdx]] = [newWidgets[newIdx], newWidgets[idx]];
    persist({ ...config, widgets: newWidgets });
  }, [config, persist]);

  const getSize = useCallback((key, fallback) => {
    return config.sizes[key] ?? fallback;
  }, [config.sizes]);

  const setSize = useCallback((key, value) => {
    persist({ ...config, sizes: { ...config.sizes, [key]: Number(value) } });
  }, [config, persist]);

  const getExtra = useCallback((key, defaultValue) => {
    return config[key] ?? defaultValue;
  }, [config]);

  const setExtra = useCallback((key, value) => {
    persist({ ...config, [key]: value });
  }, [config, persist]);

  const resetConfig = useCallback(() => {
    const defaults = {
      widgets: defaultWidgets.map(w => ({ id: w.id, visible: w.defaultVisible !== false })),
      sizes: { ...defaultSizes },
    };
    persist(defaults);
  }, [defaultWidgets, defaultSizes, persist]);

  return {
    widgets: config.widgets,
    isVisible,
    toggleWidget,
    moveWidget,
    getSize,
    setSize,
    getExtra,
    setExtra,
    resetConfig,
  };
}
