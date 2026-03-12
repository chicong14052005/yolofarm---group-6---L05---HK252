export interface Prefs {
  theme: string;
  locale: string;
  primary_color: string;
  border_radius: number;
  layout_mode?: string;
  font_family: string;
}

export const defaultPrefs: Prefs = {
  theme: 'light',
  locale: 'vi',
  primary_color: '#2BAE66',
  border_radius: 8,
  font_family: "'Inter'",
};

export function hexToAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const COLOR_SWATCHES = [
  { name: 'Xanh lá', value: '#2BAE66', hover: '#249957' },
  { name: 'Xanh dương', value: '#3498DB', hover: '#2980B9' },
  { name: 'Tím', value: '#9B59B6', hover: '#8E44AD' },
  { name: 'Cam', value: '#F5A623', hover: '#D4911E' },
  { name: 'Đỏ cam', value: '#E74C3C', hover: '#C0392B' },
  { name: 'Hồng', value: '#E91E63', hover: '#C2185B' },
];

export function applyGlobalPrefs(prefs: Prefs) {
  const swatch = COLOR_SWATCHES.find(c => c.value === prefs.primary_color);
  
  // NOTE: Do NOT set data-theme here — ThemeContext manages it via its own state
  
  // Apply Custom CSS variables
  document.documentElement.style.setProperty('--primary', prefs.primary_color);
  document.documentElement.style.setProperty('--primary-hover', swatch?.hover || prefs.primary_color);
  document.documentElement.style.setProperty('--primary-alpha-10', hexToAlpha(prefs.primary_color, 0.1));
  document.documentElement.style.setProperty('--primary-alpha-20', hexToAlpha(prefs.primary_color, 0.2));
  document.documentElement.style.setProperty('--radius-base', `${prefs.border_radius}px`);
  document.documentElement.style.setProperty('--main-font', prefs.font_family);
}
