import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'app_settings';

// Mapping camelCase → CSS variables
const COLOR_VAR_MAP = {
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgTertiary: '--bg-tertiary',
  bgHover: '--bg-hover',
  accentPrimary: '--accent-primary',
  accentSecondary: '--accent-secondary',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  borderColor: '--border-color',
};

// Thèmes prédéfinis
export const THEMES = {
  default: {
    name: 'Sombre',
    description: 'Thème par défaut',
    colors: {
      bgPrimary: '#0a0a0f',
      bgSecondary: '#12121a',
      bgTertiary: '#1a1a25',
      bgHover: '#252535',
      accentPrimary: '#6366f1',
      accentSecondary: '#8b5cf6',
      textPrimary: '#ffffff',
      textSecondary: '#a0a0b0',
      textMuted: '#606070',
      borderColor: '#2a2a3a',
    }
  },
  midnight: {
    name: 'Bleu Nuit',
    description: 'Tons bleu profond',
    colors: {
      bgPrimary: '#0a0e1a',
      bgSecondary: '#101829',
      bgTertiary: '#182238',
      bgHover: '#213050',
      accentPrimary: '#3b82f6',
      accentSecondary: '#60a5fa',
      textPrimary: '#e8edf5',
      textSecondary: '#8899b5',
      textMuted: '#4a5f80',
      borderColor: '#1e3050',
    }
  },
  forest: {
    name: 'Forêt',
    description: 'Tons vert sombre',
    colors: {
      bgPrimary: '#0a100e',
      bgSecondary: '#111c17',
      bgTertiary: '#1a2b22',
      bgHover: '#253d32',
      accentPrimary: '#22c55e',
      accentSecondary: '#4ade80',
      textPrimary: '#e8f5ec',
      textSecondary: '#88b59a',
      textMuted: '#4a7a5e',
      borderColor: '#1e3d2c',
    }
  },
  sunset: {
    name: 'Crépuscule',
    description: 'Tons chauds orange/rouge',
    colors: {
      bgPrimary: '#120a08',
      bgSecondary: '#1c1210',
      bgTertiary: '#2a1a16',
      bgHover: '#3d2820',
      accentPrimary: '#f97316',
      accentSecondary: '#fb923c',
      textPrimary: '#f5ece8',
      textSecondary: '#b59888',
      textMuted: '#7a5e4a',
      borderColor: '#3d2a1e',
    }
  },
  light: {
    name: 'Clair',
    description: 'Thème lumineux',
    colors: {
      bgPrimary: '#f5f5f7',
      bgSecondary: '#e8e8ed',
      bgTertiary: '#d5d5dd',
      bgHover: '#c5c5d0',
      accentPrimary: '#6366f1',
      accentSecondary: '#8b5cf6',
      textPrimary: '#1a1a2e',
      textSecondary: '#4a4a60',
      textMuted: '#8a8aa0',
      borderColor: '#c5c5d5',
    }
  }
};

export const DEFAULT_SETTINGS = {
  theme: {
    preset: 'default',
    colors: { ...THEMES.default.colors },
  },
  layout: {
    sidebarWidth: 80,
    streamdeckWidth: 910,
    gridColumns: 7,
    gridRows: 5,
  },
  language: 'fr',
  sidebarOrder: null, // null = ordre par défaut de menuItems
  hiddenModules: [], // modules masqués de la sidebar
};

function loadSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(data);
    return {
      theme: {
        preset: parsed.theme?.preset || DEFAULT_SETTINGS.theme.preset,
        colors: { ...DEFAULT_SETTINGS.theme.colors, ...parsed.theme?.colors },
      },
      layout: { ...DEFAULT_SETTINGS.layout, ...parsed.layout },
      language: parsed.language || 'fr',
      sidebarOrder: parsed.sidebarOrder || null,
      hiddenModules: parsed.hiddenModules || [],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function applyColors(colors) {
  const root = document.documentElement;
  Object.entries(COLOR_VAR_MAP).forEach(([key, cssVar]) => {
    if (colors[key]) {
      root.style.setProperty(cssVar, colors[key]);
    }
  });
  // Recalculer le gradient
  root.style.setProperty(
    '--accent-gradient',
    `linear-gradient(135deg, ${colors.accentPrimary} 0%, ${colors.accentSecondary} 100%)`
  );
}

function applyLayout(layout) {
  const root = document.documentElement;
  root.style.setProperty('--sidebar-width', `${layout.sidebarWidth}px`);
  // Largeur lanceur = colonnes × 130 (auto-calculé)
  const streamdeckWidth = (layout.gridColumns || 7) * 130;
  root.style.setProperty('--streamdeck-width', `${streamdeckWidth}px`);
}

const SETTINGS_CHANGED_EVENT = 'app-settings-changed';

export default function useTheme() {
  const [settings, setSettings] = useState(() => {
    const s = loadSettings();
    applyColors(s.theme.colors);
    applyLayout(s.layout);
    return s;
  });

  // Écouter les changements depuis d'autres composants
  useEffect(() => {
    const handler = () => {
      const fresh = loadSettings();
      applyColors(fresh.theme.colors);
      applyLayout(fresh.layout);
      setSettings(fresh);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  }, []);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const defaults = { ...DEFAULT_SETTINGS, theme: { ...DEFAULT_SETTINGS.theme, colors: { ...THEMES.default.colors } } };
    applyColors(defaults.theme.colors);
    applyLayout(defaults.layout);
    setSettings(defaults);
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  }, []);

  return { settings, applyColors, applyLayout, updateSettings, resetToDefaults };
}
