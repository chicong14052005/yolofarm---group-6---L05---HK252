import { useState, useEffect, useRef } from 'react';
import { io as socketIO } from 'socket.io-client';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { useLanguage } from '../../context/LanguageContext';
import { HiOutlineBell, HiOutlineBookmark, HiOutlineTrash } from 'react-icons/hi';
import { MdOutlineWarningAmber, MdCheckCircleOutline, MdInfoOutline } from 'react-icons/md';
import { toast } from 'react-toastify';
import api from '../../services/api';
import '../../pages/DashboardPage/DashboardPage.css';
import './NotificationPage.css';
import { useAuth } from '../../context/AuthContext';

interface Notification {
  id: number; user_id: number; type: string; title: string;
  message: string; is_read: boolean; is_saved: boolean; created_at: string;
  user_name?: string;
}

interface UserOption {
  id: number; full_name: string; email: string;
}

const iconMap: Record<string, React.ReactNode> = {
  warning: <MdOutlineWarningAmber />, info: <MdCheckCircleOutline />,
  error: <MdOutlineWarningAmber />, system: <MdInfoOutline />, ai_alert: <MdInfoOutline />,
};

const NotificationPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const badgeMap: Record<string, string> = {
    warning: t('notifications.badgeWarning'), info: t('notifications.badgeInfo'),
    error: t('notifications.badgeError'), system: t('notifications.badgeSystem'), ai_alert: t('notifications.badgeAi'),
  };
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');

  // Delete all states
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'mine' | 'user' | 'all'>('mine');

  // Custom dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';

  const fetchNotifications = async (f: string = filter) => {
    try {
      const { data } = await api.get(`/notifications?filter=${f}`);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      // Notify Sidebar badge to refresh
      window.dispatchEvent(new CustomEvent('notif-count-changed'));
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchNotifications(); }, [filter]);

  // Fetch users list for admin dropdown
  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then(({ data }) => setUsers(data)).catch(() => {});
    }
  }, [isAdmin]);

  // Close custom dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Socket.IO: auto-refresh khi nhận notification mới
  useEffect(() => {
    if (!user) return;
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = socketIO(SOCKET_URL);
    socket.emit('register', user.id);
    socket.on('notification', () => { fetchNotifications(); });
    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filter]);

  const markAsRead = async (id: number) => {
    await api.put(`/notifications/${id}/read`);
    fetchNotifications();
  };
  const markAllAsRead = async () => {
    await api.put('/notifications/read-all');
    toast.success(t('notifications.markAllAsRead'));
    fetchNotifications();
  };
  const toggleSave = async (id: number) => {
    await api.put(`/notifications/${id}/save`);
    fetchNotifications();
  };
  const deleteNotification = async (id: number) => {
    await api.delete(`/notifications/${id}`);
    toast.success(t('notifications.deleted'));
    fetchNotifications();
  };

  const deleteAllNotifications = async () => {
    try {
      if (deleteTarget === 'mine') {
        await api.delete('/notifications/delete-all');
      } else if (deleteTarget === 'user' && selectedUserId) {
        await api.delete('/notifications/admin/delete-all', { data: { userId: selectedUserId } });
      } else if (deleteTarget === 'all') {
        await api.delete('/notifications/admin/delete-all');
      }
      setShowDeleteConfirm(false);
      setSelectedUserId('');
      toast.success(t('notifications.allDeleted'));
      fetchNotifications();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('notifications.minutesAgo').replace('{n}', String(mins));
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('notifications.hoursAgo').replace('{n}', String(hrs));
    return t('notifications.daysAgo').replace('{n}', String(Math.floor(hrs / 24)));
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('notifications.title')}</h1>
            <p className="page-subtitle">{t('notifications.subtitle')}</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={markAllAsRead}>
              <HiOutlineBell /> {t('notifications.markAsRead')}
            </button>
            <button className="btn btn-danger" onClick={() => { setDeleteTarget(isAdmin ? 'all' : 'mine'); setShowDeleteConfirm(true); }}>
              <HiOutlineTrash /> {t('notifications.deleteAll')}
            </button>
          </div>
        </header>

        {/* Admin: custom dropdown to select user & delete notifications */}
        {isAdmin && (
          <div className="admin-notif-actions">
            <div className="custom-select-wrapper" ref={dropdownRef}>
              <button
                className={`custom-select-trigger ${dropdownOpen ? 'open' : ''} ${selectedUserId ? 'has-value' : ''}`}
                onClick={() => setDropdownOpen(prev => !prev)}
              >
                <span className="material-symbols-outlined custom-select-icon">person_search</span>
                <span className="custom-select-text">
                  {selectedUserId
                    ? users.find(u => String(u.id) === selectedUserId)?.full_name || ''
                    : t('notifications.selectUser')}
                </span>
                <span className={`material-symbols-outlined custom-select-chevron ${dropdownOpen ? 'open' : ''}`}>
                  expand_more
                </span>
              </button>

              {dropdownOpen && (
                <div className="custom-select-dropdown">
                  <div
                    className={`custom-select-option ${selectedUserId === '' ? 'active' : ''}`}
                    onClick={() => { setSelectedUserId(''); setDropdownOpen(false); }}
                  >
                    <span className="material-symbols-outlined custom-option-icon">group</span>
                    <span>{t('notifications.selectUser')}</span>
                  </div>
                  {users.map((u, i) => (
                    <div
                      key={u.id}
                      className={`custom-select-option ${String(u.id) === selectedUserId ? 'active' : ''}`}
                      style={{ animationDelay: `${i * 30}ms` }}
                      onClick={() => { setSelectedUserId(String(u.id)); setDropdownOpen(false); }}
                    >
                      <div className="custom-option-avatar">
                        {u.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="custom-option-info">
                        <span className="custom-option-name">{u.full_name}</span>
                        <span className="custom-option-email">{u.email}</span>
                      </div>
                      {String(u.id) === selectedUserId && (
                        <span className="material-symbols-outlined custom-option-check">check_circle</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn btn-danger"
              onClick={() => { setDeleteTarget('user'); setShowDeleteConfirm(true); }}
              disabled={!selectedUserId}
            >
              <HiOutlineTrash /> {t('notifications.deleteUserNotifs')}
            </button>
          </div>
        )}

        <div className="notif-tabs">
          <button className={`notif-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            {t('notifications.all')} <span className="notif-count">{notifications.length}</span>
          </button>
          <button className={`notif-tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
            {t('notifications.unread')} <span className="notif-count">{unreadCount}</span>
          </button>
          <button className={`notif-tab ${filter === 'saved' ? 'active' : ''}`} onClick={() => setFilter('saved')}>
            {t('notifications.saved')}
          </button>
        </div>

        <div className="notif-list">
          {notifications.map((n, i) => (
            <div key={n.id} className={`card notif-item animate-fadeInUp ${n.is_read ? 'read' : ''}`}
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className={`notif-icon-wrap ${n.type}`}>{iconMap[n.type]}</div>
              <div className="notif-content">
                <div className="notif-meta">
                  <span className={`badge badge-${n.type === 'warning' || n.type === 'error' ? 'danger' : 'info'}`}>
                    {badgeMap[n.type]}
                  </span>
                  <span className="notif-time">• {timeAgo(n.created_at)}</span>
                </div>
                <h4>{n.title}</h4>
                <p>{n.message}</p>
              </div>
              <div className="notif-actions">
                {!n.is_read && <button className="action-link" onClick={() => markAsRead(n.id)}>{t('notifications.markAsRead')}</button>}
                <button className={`action-icon ${n.is_saved ? 'saved' : ''}`} onClick={() => toggleSave(n.id)}><HiOutlineBookmark /></button>
                <button className="action-icon delete" onClick={() => deleteNotification(n.id)}><HiOutlineTrash /></button>
              </div>
            </div>
          ))}
          {notifications.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{t('notifications.noNotifications')}</p>}
        </div>

        {/* Confirm Delete Dialog */}
        {showDeleteConfirm && (
          <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
              <span className="material-symbols-outlined confirm-icon">warning</span>
              <p>{t('notifications.deleteConfirmMsg')}</p>
              <div className="confirm-actions">
                <button className="btn btn-danger" onClick={deleteAllNotifications}>
                  {t('notifications.confirmDelete')}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                  {t('notifications.cancelDelete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default NotificationPage;
