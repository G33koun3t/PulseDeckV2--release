import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

import fr from './fr';
import en from './en';
import de from './de';
import nl from './nl';
import es from './es';
import pt from './pt';
import it from './it';
import pl from './pl';
import ja from './ja';

const LOCALES = { fr, en, de, nl, es, pt, it, pl, ja };

export const LOCALE_META = {
  fr: { name: 'Français', dateLocale: 'fr-FR' },
  en: { name: 'English', dateLocale: 'en-US' },
  de: { name: 'Deutsch', dateLocale: 'de-DE' },
  nl: { name: 'Nederlands', dateLocale: 'nl-NL' },
  es: { name: 'Español', dateLocale: 'es-ES' },
  pt: { name: 'Português', dateLocale: 'pt-PT' },
  it: { name: 'Italiano', dateLocale: 'it-IT' },
  pl: { name: 'Polski', dateLocale: 'pl-PL' },
  ja: { name: '日本語', dateLocale: 'ja-JP' },
};

const I18nContext = createContext(null);

const STORAGE_KEY = 'app_settings';
const SETTINGS_CHANGED_EVENT = 'app-settings-changed';

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function interpolate(str, params) {
  if (!params || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.language || 'en';
      }
    } catch {}
    return 'en';
  });

  useEffect(() => {
    const handler = () => {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          const newLang = parsed.language || 'en';
          setLang(prev => prev !== newLang ? newLang : prev);
        }
      } catch {}
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);

  const translations = LOCALES[lang] || LOCALES.en;
  const fallback = LOCALES.en;

  const t = useCallback((key, params) => {
    let value = getNestedValue(translations, key);
    if (value === undefined) {
      value = getNestedValue(fallback, key);
    }
    if (value === undefined) {
      return key;
    }
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return value;
    return interpolate(value, params);
  }, [translations, fallback]);

  const dateLocale = LOCALE_META[lang]?.dateLocale || 'fr-FR';

  const formatDate = useCallback((date, options) => {
    return new Date(date).toLocaleDateString(dateLocale, options);
  }, [dateLocale]);

  const formatTime = useCallback((date, options) => {
    return new Date(date).toLocaleTimeString(dateLocale, options || { hour: '2-digit', minute: '2-digit' });
  }, [dateLocale]);

  const contextValue = useMemo(() => ({
    lang,
    t,
    dateLocale,
    formatDate,
    formatTime,
  }), [lang, t, dateLocale, formatDate, formatTime]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
