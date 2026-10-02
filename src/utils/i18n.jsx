import React, { createContext, useContext, useMemo } from 'react';
import it from '../locales/it';
import en from '../locales/en';

const dictionaries = { it, en };

const I18nContext = createContext({
  language: 'it',
  t: (key) => key,
  setLanguage: () => {}
});

function resolveKey(dict, path) {
  if (!dict || !path) return null;
  const parts = path.split('.');
  let current = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

export function translate(key, lang = 'it', params = {}) {
  const primaryDict = dictionaries[lang] || dictionaries.it;
  let text = resolveKey(primaryDict, key);
  
  // Fallback to Italian or key
  if (text == null) {
    text = resolveKey(dictionaries.it, key) || key;
  }

  // Parameter interpolation: {param}
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([paramKey, val]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
    });
  }

  return text;
}

export function I18nProvider({ language = 'it', onLanguageChange, children }) {
  const value = useMemo(() => {
    const activeLang = language in dictionaries ? language : 'it';
    return {
      language: activeLang,
      t: (key, params) => translate(key, activeLang, params),
      setLanguage: (newLang) => {
        if (onLanguageChange && newLang in dictionaries) {
          onLanguageChange(newLang);
        }
      }
    };
  }, [language, onLanguageChange]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
