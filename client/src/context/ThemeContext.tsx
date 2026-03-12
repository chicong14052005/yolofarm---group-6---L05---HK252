import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Đọc theme từ yolofarm_prefs cache → fallback yolofarm_theme → 'light' */
function getInitialTheme(): Theme {
  try {
    const prefs = localStorage.getItem('yolofarm_prefs');
    if (prefs) {
      const parsed = JSON.parse(prefs);
      if (parsed.theme === 'dark' || parsed.theme === 'light') return parsed.theme;
    }
  } catch { /* ignore */ }
  const stored = localStorage.getItem('yolofarm_theme');
  return (stored === 'dark' ? 'dark' : 'light');
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('yolofarm_theme', theme);
  }, [theme]);

  const toggleTheme = () => setThemeState(t => t === 'light' ? 'dark' : 'light');
  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export default ThemeContext;
