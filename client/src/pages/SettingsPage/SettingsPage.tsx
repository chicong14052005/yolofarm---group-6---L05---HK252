import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
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

type SettingsTab = 'appearance' | 'profile' | 'privacy';

const SettingsPage = () => {
  const { setTheme } = useTheme();
  const { user, login } = useAuth();
  const { setLocale, t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [original, setOriginal] = useState<Prefs>({ ...defaultPrefs });
  const [draft, setDraft] = useState<Prefs>({ ...defaultPrefs });

  // Profile states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploading, setUploading] = useState(false);

  // Privacy Policy states
  const [policyContent, setPolicyContent] = useState('');
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyId, setPolicyId] = useState<number | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyData, setPolicyData] = useState<Record<string, string | number | boolean | null> | null>(null);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Editor states for Admin
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editorTab, setEditorTab] = useState<'editor' | 'preview'>('editor');

  const isAdmin = user?.role === 'admin';
  const isGoogleUser = !!(user as { google_id?: string } | null)?.google_id;

  useEffect(() => {
    api.get('/preferences').then(({ data }) => {
      const prefs = { ...defaultPrefs, ...data };
      setOriginal(prefs);
      setDraft(prefs);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setFullName(user?.full_name || '');
    setAvatarUrl(user?.avatar_url || '');
  }, [user]);

  // Load privacy policy
  useEffect(() => {
    if (activeTab === 'privacy') {
      setPolicyLoading(true);
      setTranslatedContent(null);
      if (isAdmin) {
        api.get('/privacy-policy').then(({ data }) => {
          if (data && data.length > 0) {
            const active = data.find((p: { is_active: boolean }) => p.is_active) || data[0];
            setPolicyData(active);
            const localisedContent = locale === 'vi'
              ? (active.content_vi || active.content || '')
              : (active.content_en || active.content || '');
            setPolicyContent(localisedContent);
            setPolicyTitle(active.title || '');
            setPolicyId(active.id);
          }
        }).catch(() => {}).finally(() => setPolicyLoading(false));
      } else {
        api.get('/privacy-policy/active').then(({ data }) => {
          setPolicyData(data);
          const localisedContent = locale === 'vi'
            ? (data?.content_vi || data?.content || '')
            : (data?.content_en || data?.content || '');
          setPolicyContent(localisedContent);
          setPolicyTitle(data?.title || '');
          setPolicyId(data?.id || null);
        }).catch(() => {}).finally(() => setPolicyLoading(false));
      }
    }
  }, [activeTab, isAdmin, locale]);

  // Appearance handlers
  const updateDraft = (key: keyof Prefs, value: string | number) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await api.put('/preferences', draft);
      setOriginal(draft);
      applyGlobalPrefs(draft);
      setTheme(draft.theme as 'light' | 'dark');
      setLocale(draft.locale as 'vi' | 'en');
      localStorage.setItem('yolofarm_prefs', JSON.stringify(draft));
      toast.success(t('settings.saveSuccess'));
    } catch { toast.error(t('settings.saveError')); }
  };

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

  // Profile handlers
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.put('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAvatarUrl(data.avatar_url);
      // Update stored user
      const stored = localStorage.getItem('yolofarm_user');
      if (stored) {
        const u = JSON.parse(stored);
        u.avatar_url = data.avatar_url;
        localStorage.setItem('yolofarm_user', JSON.stringify(u));
        const token = localStorage.getItem('yolofarm_token');
        if (token) login(u, token);
      }
      toast.success(t('settings.avatarUpdated'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || t('settings.avatarError'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!fullName.trim()) return;
    try {
      await api.put('/profile/username', { full_name: fullName.trim() });
      const stored = localStorage.getItem('yolofarm_user');
      if (stored) {
        const u = JSON.parse(stored);
        u.full_name = fullName.trim();
        localStorage.setItem('yolofarm_user', JSON.stringify(u));
        const token = localStorage.getItem('yolofarm_token');
        if (token) login(u, token);
      }
      toast.success(t('settings.nameUpdated'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || t('settings.nameError'));
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    try {
      await api.put('/profile/password', { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('settings.passwordUpdated'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || t('settings.passwordError'));
    }
  };

  // Privacy Policy handlers
  const handleStartEditing = () => {
    setEditContent(policyContent);
    setEditTitle(policyTitle);
    setEditorTab('editor');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditContent('');
    setEditTitle('');
  };

  const handleTranslate = async () => {
    if (!policyId) return;
    setIsTranslating(true);
    try {
      const { data } = await api.post(`/privacy-policy/${policyId}/translate`, { targetLang: locale });
      setTranslatedContent(data.translatedText);
      toast.success(t('settings.translationDone'));
    } catch {
      toast.error(t('settings.translationError'));
    } finally {
      setIsTranslating(false);
    }
  };

  const showTranslateButton = policyData && policyContent
    && ((locale === 'vi' && !policyData.content_vi) || (locale === 'en' && !policyData.content_en));

  const handleSavePolicy = async () => {
    try {
      const contentVi = locale === 'vi' ? editContent : null;
      const contentEn = locale === 'en' ? editContent : null;

      const payload = { title: editTitle, content: editContent, content_vi: contentVi, content_en: contentEn, is_active: true };
      if (policyId) {
        await api.put(`/privacy-policy/${policyId}`, payload);
      } else {
        const { data } = await api.post('/privacy-policy', { ...payload, title: editTitle || 'Privacy Policy', version: 1 });
        setPolicyId(data.id);
      }
      setPolicyContent(editContent);
      setPolicyTitle(editTitle);
      setPolicyData(prev => prev ? { ...prev, content: editContent, content_vi: contentVi, content_en: contentEn } : prev);
      setIsEditing(false);
      toast.success(t('settings.privacyPolicySaved'));
    } catch {
      toast.error(t('settings.privacyPolicyError'));
    }
  };

  const TABS: { key: SettingsTab; icon: string; label: string }[] = [
    { key: 'appearance', icon: 'palette', label: t('settings.tabAppearance') },
    { key: 'profile', icon: 'person', label: t('settings.tabProfile') },
    { key: 'privacy', icon: 'security', label: t('settings.tabPrivacyPolicy') },
  ];

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
          <div className="settings-sidebar">
            <div className="card profile-card">
              <div className="avatar-wrapper">
                <div className="avatar-large-img" onClick={() => fileInputRef.current?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="avatar-image" />
                  ) : (
                    <span className="avatar-initial">{user?.full_name?.charAt(0) || 'U'}</span>
                  )}
                  <div className="avatar-overlay">
                    <span className="material-symbols-outlined">edit</span>
                  </div>
                  {uploading && <div className="avatar-uploading"><div className="spinner" /></div>}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarUpload}
                />
              </div>
              <h3>{user?.full_name || 'User'}</h3>
              <span className="role-label">{t('settings.proFarmer')}</span>
              <span className="email-label">{user?.email || 'user@yolofarm.com'}</span>
            </div>

            {/* Tab Navigation */}
            <nav className="card settings-nav">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`nav-item ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="material-symbols-outlined">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="settings-content">
            {/* ==================== APPEARANCE TAB ==================== */}
            {activeTab === 'appearance' && (
              <>
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
              </>
            )}

            {/* ==================== PROFILE TAB ==================== */}
            {activeTab === 'profile' && (
              <>
                {/* Account Info */}
                <div className="card">
                  <div className="card-header-row">
                    <span className="material-symbols-outlined text-primary">person</span>
                    <h3>{t('settings.profileInfo')}</h3>
                  </div>

                  <div className="profile-form">
                    {/* Login Username — read-only */}
                    <div className="form-group">
                      <label className="form-label">{t('settings.username')}</label>
                      <div className="username-readonly">
                        <span className="material-symbols-outlined username-icon">badge</span>
                        <span className="username-value">{user?.username}</span>
                        <span className="username-hint">{t('settings.usernameReadOnly')}</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('settings.fullName')}</label>
                      <div className="form-row">
                        <input
                          type="text"
                          className="form-input"
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder={t('settings.fullName')}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleUpdateName}
                          disabled={!fullName.trim() || fullName.trim() === user?.full_name}>
                          {t('settings.updateName')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password Change — ẩn nếu Google user */}
                {isGoogleUser ? (
                  <div className="card">
                    <div className="card-header-row">
                      <span className="material-symbols-outlined text-primary">lock</span>
                      <h3>{t('settings.changePassword')}</h3>
                    </div>
                    <div className="google-password-notice">
                      <span className="material-symbols-outlined">info</span>
                      <p>{t('settings.googlePasswordDisabled')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    <div className="card-header-row">
                      <span className="material-symbols-outlined text-primary">lock</span>
                      <h3>{t('settings.changePassword')}</h3>
                    </div>

                    <div className="profile-form">
                      <div className="form-group">
                        <label className="form-label">{t('settings.currentPassword')}</label>
                        <input
                          type="password"
                          className="form-input"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('settings.newPassword')}</label>
                        <input
                          type="password"
                          className="form-input"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('settings.confirmPassword')}</label>
                        <input
                          type="password"
                          className="form-input"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <button className="btn btn-primary" onClick={handleUpdatePassword}
                        disabled={!currentPassword || !newPassword || !confirmPassword}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>lock_reset</span>
                        {t('settings.updatePassword')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ==================== PRIVACY POLICY TAB ==================== */}
            {activeTab === 'privacy' && (
              <div className="card">
                <div className="card-header-row">
                  <span className="material-symbols-outlined text-primary">security</span>
                  <h3>{t('settings.privacyPolicyTitle')}</h3>
                  {isAdmin && !isEditing && (
                    <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleStartEditing}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
                      {t('settings.editButton')}
                    </button>
                  )}
                </div>

                {policyLoading ? (
                  <div className="policy-loading">
                    <div className="spinner" />
                  </div>
                ) : isEditing && isAdmin ? (
                  /* ========== ADMIN EDITOR MODE ========== */
                  <div className="policy-editor">
                  
                    {/* Tabs: Editor / Preview */}
                    <div className="editor-tabs">
                      <button
                        className={`editor-tab ${editorTab === 'editor' ? 'active' : ''}`}
                        onClick={() => setEditorTab('editor')}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>code</span>
                        {t('settings.editorTab')}
                      </button>
                      <button
                        className={`editor-tab ${editorTab === 'preview' ? 'active' : ''}`}
                        onClick={() => setEditorTab('preview')}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>visibility</span>
                        {t('settings.previewTab')}
                      </button>
                    </div>

                    {/* Tab Content */}
                    {editorTab === 'editor' ? (
                      <textarea
                        className="form-textarea editor-textarea"
                        rows={16}
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        placeholder="# Tiêu đề\n\nNội dung markdown..."
                      />
                    ) : (
                      <div className="editor-preview-pane">
                        <div className="prose">
                          <ReactMarkdown>{editContent || '*Chưa có nội dung...*'}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Actions: Save / Cancel */}
                    <div className="editor-actions">
                      <button className="btn btn-primary" onClick={handleSavePolicy}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>save</span>
                        {t('settings.privacyPolicySave')}
                      </button>
                      <button className="btn btn-secondary" onClick={handleCancelEditing}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                        {t('settings.cancelEdit')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ========== READ-ONLY MODE (User + Admin default) ========== */
                  <div className="policy-content">
                    {policyContent ? (
                      <>
                        <div className="prose">
                          <ReactMarkdown>{translatedContent || policyContent}</ReactMarkdown>
                        </div>
                        {showTranslateButton && !translatedContent && (
                          <div className="translate-action">
                            <button
                              className="btn btn-secondary btn-translate"
                              onClick={handleTranslate}
                              disabled={isTranslating}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>translate</span>
                              {isTranslating ? t('settings.translatingInProgress') : t('settings.translateButton')}
                            </button>
                          </div>
                        )}
                        {translatedContent && (
                          <div className="translate-action">
                            <button
                              className="btn btn-secondary btn-translate"
                              onClick={() => setTranslatedContent(null)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>undo</span>
                              {t('settings.showOriginal')}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="no-data">{t('settings.noPrivacyPolicy')}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
