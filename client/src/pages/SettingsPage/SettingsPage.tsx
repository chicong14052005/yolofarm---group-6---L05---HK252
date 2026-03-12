import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { applyGlobalPrefs, defaultPrefs, type Prefs } from '../../utils/themeUtils';
import '../../pages/DashboardPage/DashboardPage.css';
import './SettingsPage.css';

const COLOR_SWATCHES = [
  { name: 'Xanh lá', value: '#2BAE66', hover: '#249957' },
  { name: 'Xanh dương', value: '#3498DB', hover: '#2980B9' },
  { name: 'Tím', value: '#9B59B6', hover: '#8E44AD' },
  { name: 'Cam', value: '#F5A623', hover: '#D4911E' },
  { name: 'Đỏ cam', value: '#E74C3C', hover: '#C0392B' },
  { name: 'Hồng', value: '#E91E63', hover: '#C2185B' },
];
const RADIUS_OPTIONS = [4, 8, 12, 16];
const FONT_OPTIONS = [
  { name: 'Inter', value: "'Inter'" },
  { name: 'Great Vibes', value: "'Great Vibes'" },
  { name: 'Chiron Sung HK', value: "'Chiron Sung HK'" },
  { name: 'Poltawski Nowy', value: "'Poltawski Nowy'" },
  { name: 'Viaoda Libre', value: "'Viaoda Libre'" },
];

const SettingsPage = () => {
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const { setLocale, t } = useLanguage();

  const [original, setOriginal] = useState<Prefs>({ ...defaultPrefs });
  const [draft, setDraft] = useState<Prefs>({ ...defaultPrefs });

  useEffect(() => {
    api.get('/preferences').then(({ data }) => {
      const prefs = { ...defaultPrefs, ...data };
      setOriginal(prefs);
      setDraft(prefs);
      // Không gọi applyPrefs ở đây vì AuthContext đã apply khi boot
    }).catch(() => {});
  }, []);

  const updateDraft = (key: keyof Prefs, value: string | number) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await api.put('/preferences', draft);
      setOriginal(draft);
      // Apply CSS variables + theme + locale
      applyGlobalPrefs(draft);
      setTheme(draft.theme as 'light' | 'dark');
      setLocale(draft.locale as 'vi' | 'en');
      localStorage.setItem('yolofarm_prefs', JSON.stringify(draft));
      toast.success(t('settings.saveSuccess'));
    } catch { toast.error(t('settings.saveError')); }
  };

  // Khôi phục mặc định: reset tất cả về defaultPrefs, lưu ngay lên DB
  const handleRestoreDefaults = async () => {
    const defaults = { ...defaultPrefs };
    try {
      await api.put('/preferences', defaults);
      setOriginal(defaults);
      setDraft(defaults);
      applyGlobalPrefs(defaults);
      setTheme(defaults.theme as 'light' | 'dark');
      setLocale(defaults.locale as 'vi' | 'en');
      localStorage.setItem('yolofarm_prefs', JSON.stringify(defaults));
      toast.success(t('settings.restoreSuccess'));
    } catch { toast.error(t('settings.restoreError')); }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(original);

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('settings.title')}</h1>
            <p className="page-subtitle">{t('settings.subtitle')}</p>
          </div>
        </header>

        <div className="settings-layout">
          {/* Profile Card */}
          <div className="card profile-card">
            <div className="avatar-large">{user?.full_name?.charAt(0) || 'U'}</div>
            <h3>{user?.full_name || 'User'}</h3>
            <span className="role-label">{t('settings.proFarmer')}</span>
            <span className="email-label">{user?.email || 'user@yolofarm.com'}</span>
          </div>

          {/* Settings Content */}
          <div className="settings-content">
            {/* Language */}
            <div className="card">
              <h3>🌐 {t('settings.language')}</h3>
              <div className="lang-options">
                <label className={`lang-option ${draft.locale === 'vi' ? 'selected' : ''}`}
                  onClick={() => updateDraft('locale', 'vi')}>
                  <img src="/images/flag_vn.png" alt="VN" className="flag-img" />
                  <div className="lang-text">
                    <span className="lang-name">{t('settings.vietnamese')}</span>
                    <span className="lang-sub">Vietnamese</span>
                  </div>
                </label>
                <label className={`lang-option ${draft.locale === 'en' ? 'selected' : ''}`}
                  onClick={() => updateDraft('locale', 'en')}>
                  <img src="/images/flag_uk.png" alt="UK" className="flag-img" />
                  <div className="lang-text">
                    <span className="lang-name">{t('settings.english')}</span>
                    <span className="lang-sub">United Kingdom</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Appearance */}
            <div className="card">
              <h3>🎨 {t('settings.appearance')}</h3>

              {/* Theme Mode */}
              <div className="setting-section">
                <label className="setting-label">{t('settings.themeMode')}</label>
                <div className="theme-options">
                  <button className={`theme-option ${draft.theme === 'light' ? 'selected' : ''}`}
                    onClick={() => updateDraft('theme', 'light')}>
                    <div className="theme-preview">
                      <img src="/images/tomato.jpg" alt="Light" className="theme-img theme-img-light" />
                    </div>
                    <span>{t('settings.light')}</span>
                  </button>
                  <button className={`theme-option ${draft.theme === 'dark' ? 'selected' : ''}`}
                    onClick={() => updateDraft('theme', 'dark')}>
                    <div className="theme-preview">
                      <img src="/images/tomato.jpg" alt="Dark" className="theme-img theme-img-dark" />
                    </div>
                    <span>{t('settings.dark')}</span>
                  </button>
                </div>
              </div>

              {/* Primary Color */}
              <div className="setting-section">
                <label className="setting-label">{t('settings.primaryColor')}</label>
                <div className="color-swatches">
                  {COLOR_SWATCHES.map(c => (
                    <button key={c.value}
                      className={`color-swatch ${draft.primary_color === c.value ? 'selected' : ''}`}
                      style={{ background: c.value }}
                      onClick={() => updateDraft('primary_color', c.value)}
                      title={c.name} />
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div className="setting-section">
                <label className="setting-label">{t('settings.fontFamily') || 'Font chữ'}</label>
                <div className="font-options">
                  {FONT_OPTIONS.map(f => (
                    <button key={f.name}
                      className={`font-option ${draft.font_family === f.value ? 'selected' : ''}`}
                      style={{ fontFamily: f.value }}
                      onClick={() => updateDraft('font_family', f.value)}>
                      <span className="font-preview" style={{ fontFamily: f.value }}>Aa</span>
                      <span className="font-name">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Radius */}
              <div className="setting-section">
                <label className="setting-label">{t('settings.borderRadius')}</label>
                <div className="radius-pills">
                  {RADIUS_OPTIONS.map(r => (
                    <button key={r}
                      className={`radius-pill ${draft.border_radius === r ? 'selected' : ''}`}
                      onClick={() => updateDraft('border_radius', r)}>
                      <span className="radius-preview" style={{ borderRadius: `${r}px` }} />
                      <span>{r}px</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save / Restore Defaults */}
            <div className="settings-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={!isDirty}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>save</span>
                {t('settings.saveChanges')}
              </button>
              <button className="btn btn-secondary" onClick={handleRestoreDefaults}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>restart_alt</span>
                {t('settings.restoreDefaults') || 'Khôi phục mặc định'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
