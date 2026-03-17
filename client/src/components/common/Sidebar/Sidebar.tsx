import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { io as socketIO } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import { applyGlobalPrefs, defaultPrefs } from '../../../utils/themeUtils';
import api from '../../../services/api';
import './Sidebar.css';

const Sidebar = () => {
  const { user, isAdmin, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 740);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications?filter=all');
      setUnreadCount(data.unreadCount || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount, location.pathname]);

  // Socket.IO: listen for new notifications
  useEffect(() => {
    if (!user) return;
    const socket = socketIO('http://localhost:5000');
    socket.emit('register', user.id);
    socket.on('notification', () => { fetchUnreadCount(); });
    return () => { socket.disconnect(); };
  }, [user?.id, fetchUnreadCount]);

  // Listen for read/delete actions from NotificationPage
  useEffect(() => {
    window.addEventListener('notif-count-changed', fetchUnreadCount);
    return () => window.removeEventListener('notif-count-changed', fetchUnreadCount);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 740);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = () => {
    if (isMobile) setMobileOpen(false);
  };

  const handleSwitchLocale = async (newLocale: 'vi' | 'en') => {
    if (newLocale === locale) { setUserMenuOpen(false); return; }
    setLocale(newLocale);
    const cached = localStorage.getItem('yolofarm_prefs');
    const currentPrefs = cached ? { ...defaultPrefs, ...JSON.parse(cached) } : { ...defaultPrefs };
    const updated = { ...currentPrefs, locale: newLocale };
    applyGlobalPrefs(updated);
    localStorage.setItem('yolofarm_prefs', JSON.stringify(updated));
    try { await api.put('/preferences', updated); } catch { /* silent */ }
    setUserMenuOpen(false);
  };

  // Toggle theme + sync lên Backend
  const handleToggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme as 'light' | 'dark');

    // Lấy prefs hiện tại từ cache, cập nhật theme, apply & lưu
    const cached = localStorage.getItem('yolofarm_prefs');
    const currentPrefs = cached ? { ...defaultPrefs, ...JSON.parse(cached) } : { ...defaultPrefs };
    const updated = { ...currentPrefs, theme: newTheme };
    applyGlobalPrefs(updated);
    localStorage.setItem('yolofarm_prefs', JSON.stringify(updated));

    // Gọi API lưu lên Database
    try {
      await api.put('/preferences', updated);
    } catch { /* silent */ }
  };

  const mainLinks = [
    { to: '/dashboard', icon: 'dashboard', label: t('sidebar.dashboard') },
    { to: '/control', icon: 'toggle_on', label: t('sidebar.control') },
    { to: '/schedule', icon: 'water_lock', label: t('sidebar.schedule') },
    { to: '/ai', icon: 'search', label: t('sidebar.ai') },
    { to: '/notifications', icon: 'notifications', label: t('sidebar.notifications') },
  ];

  const adminLinks = [
    { to: '/admin/users', icon: 'group', label: t('sidebar.adminUsers') },
  ];

  return (
    <>
      {isMobile && (
        <button className={`sidebar-hamburger ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(!mobileOpen)}>
          <span className="material-symbols-outlined">
            {mobileOpen ? 'close' : 'menu'}
          </span>
        </button>
      )}

      {isMobile && <div className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`} onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="material-symbols-outlined logo-icon">eco</span>
            <div className="logo-text">
              <span className="logo-name">Smart Farm</span>
              <span className="logo-subtitle">Eco-Modern Farming</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {mainLinks.map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={handleNavClick}
                >
                  <span className="nav-icon-wrapper">
                    <span className="material-symbols-outlined nav-icon">{link.icon}</span>
                    {link.to === '/notifications' && unreadCount > 0 && (
                      <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </span>
                  <span className="nav-label">{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {isAdmin && (
            <>
              <div className="nav-divider">
                <span>{t('sidebar.admin')}</span>
              </div>
              <ul className="nav-list">
                {adminLinks.map(link => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      onClick={handleNavClick}
                    >
                      <span className="material-symbols-outlined nav-icon">{link.icon}</span>
                      <span className="nav-label">{link.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
            <span className="material-symbols-outlined nav-icon">settings</span>
            <span className="nav-label">{t('sidebar.settings')}</span>
          </NavLink>

          <button className="theme-toggle" onClick={handleToggleTheme} title={t('common.toggleTheme')}>
            <span className="material-symbols-outlined">
              {theme === 'light' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>

          <div className="sidebar-user-wrapper" ref={userMenuRef}>
            <div className="sidebar-user" onClick={() => setUserMenuOpen(prev => !prev)}>
              <div className="user-avatar">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="user-info">
                <span className="user-name">{user?.full_name || 'User'}</span>
                <span className="user-role">{user?.role === 'admin' ? 'Admin' : 'User'}</span>
              </div>
              <span className={`material-symbols-outlined user-menu-chevron ${userMenuOpen ? 'open' : ''}`}>
                expand_more
              </span>
            </div>

            {userMenuOpen && (
              <div className="user-dropdown">
                <button
                  className={`user-dropdown-item ${locale === 'vi' ? 'active' : ''}`}
                  onClick={() => handleSwitchLocale('vi')}
                >
                  <img src="/images/flag_vn.png" alt="VN" className="dropdown-flag" />
                  <span>Tiếng Việt</span>
                  {locale === 'vi' && <span className="material-symbols-outlined dropdown-check">check</span>}
                </button>
                <button
                  className={`user-dropdown-item ${locale === 'en' ? 'active' : ''}`}
                  onClick={() => handleSwitchLocale('en')}
                >
                  <img src="/images/flag_uk.png" alt="EN" className="dropdown-flag" />
                  <span>English</span>
                  {locale === 'en' && <span className="material-symbols-outlined dropdown-check">check</span>}
                </button>
                <div className="user-dropdown-divider" />
                <button className="user-dropdown-item logout" onClick={() => { setUserMenuOpen(false); logout(); }}>
                  <span className="material-symbols-outlined dropdown-item-icon">logout</span>
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
