import { useState, useEffect } from 'react';
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

  // Socket.IO: auto-refresh khi nhận notification mới
  useEffect(() => {
    if (!user) return;
    const socket = socketIO('http://localhost:5000');
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
          <button className="btn btn-secondary" onClick={markAllAsRead}>
            <HiOutlineBell /> {t('notifications.markAsRead')}
          </button>
        </header>

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
      </main>
    </div>
  );
};

export default NotificationPage;
