import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'हिन्दी', native: 'Hindi' },
  { code: 'bn', label: 'বাংলা', native: 'Bengali' },
  { code: 'mr', label: 'मराठी', native: 'Marathi' },
  { code: 'te', label: 'తెలుగు', native: 'Telugu' },
  { code: 'ta', label: 'தமிழ்', native: 'Tamil' },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.split('-')[0] || 'en';

  return (
    <select
      className="lang-switcher"
      aria-label={t('common.language')}
      value={LANGS.some((l) => l.code === current) ? current : 'en'}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          🌐 {l.label} — {l.native}
        </option>
      ))}
    </select>
  );
}