import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';
import te from './locales/te.json';
import ta from './locales/ta.json';

export const LOCALES = ['en', 'hi', 'bn', 'mr', 'te', 'ta'];

const STORAGE_KEY = 'btl_lang';

// Map browser/device locale prefixes to supported app locales.
const PREFIX_MAP = {
  bn: 'bn',
  mr: 'mr',
  te: 'te',
  ta: 'ta',
  hi: 'hi',
  en: 'en',
};

function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  const navLang = (navigator.language || 'en').toLowerCase();
  const prefix = navLang.split('-')[0];
  return PREFIX_MAP[prefix] || 'en';
}

const lng = detectLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
    mr: { translation: mr },
    te: { translation: te },
    ta: { translation: ta },
  },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (lang) => {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  } catch {
    /* ignore */
  }
});
document.documentElement.lang = lng;

export default i18n;