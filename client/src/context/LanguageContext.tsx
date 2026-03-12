import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import vi from '../i18n/locales/vi.json';
import en from '../i18n/locales/en.json';

type Locale = 'vi' | 'en';
type Translations = typeof vi;

const translations: Record<Locale, Translations> = { vi, en };

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('yolofarm_locale') as Locale) || 'vi';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('yolofarm_locale', newLocale);
  }, []);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let result: any = translations[locale];
    for (const k of keys) {
      result = result?.[k];
    }
    return (result as string) || key;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
