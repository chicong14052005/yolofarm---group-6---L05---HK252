import { useState, useEffect } from 'react';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineTrash } from 'react-icons/hi';
import { MdOutlineBlock, MdOutlineCheckCircle } from 'react-icons/md';
import { toast } from 'react-toastify';
import ConfirmModal from '../../components/common/ConfirmModal/ConfirmModal';
import api from '../../services/api';
import '../../pages/DashboardPage/DashboardPage.css';
import './UserManagementPage.css';

interface User {
  id: number; username: string; email: string; full_name: string;
  role: string; status: string; avatar_url: string; created_at: string;
}

const UserManagementPage = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  useEffect(() => {
    api.get('/users').then(({ data }) => setUsers(data)).catch(() => {});
  }, []);

  // Guard: admin cannot delete themselves
  const handleDeleteClick = (u: User) => {
    if (u.id === currentUser?.id) {
      toast.error(t('userManagement.cannotDeleteSelf'));
      return;
    }
    setDeleteTarget(u);
  };

  // Delete user with ConfirmModal
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      toast.success(t('userManagement.userDeleted').replace('{name}', deleteTarget.full_name || deleteTarget.username), {
        style: { background: '#2BAE66', color: 'white' }
      });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('userManagement.deleteError');
      toast.error(message);
    }
    setDeleteTarget(null);
  };

  // Toggle role
  const toggleRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await api.patch(`/users/${user.id}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      toast.success(t('userManagement.roleChanged').replace('{name}', user.full_name || user.username).replace('{role}', newRole.toUpperCase()));
    } catch {
      toast.error(t('userManagement.roleError'));
    }
  };

  // Toggle banned
  const toggleBan = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error(t('userManagement.cannotBanSelf'));
      return;
    }
    const newStatus = user.status === 'banned' ? 'active' : 'banned';
    try {
      await api.patch(`/users/${user.id}/ban`, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      toast.success(
        newStatus === 'banned'
          ? t('userManagement.banned').replace('{name}', user.full_name || user.username)
          : t('userManagement.unbanned').replace('{name}', user.full_name || user.username)
      );
    } catch {
      toast.error(t('userManagement.banError'));
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const statusConfig: Record<string, { color: string; label: string }> = {
    active: { color: 'var(--success)', label: 'Active' },
    inactive: { color: 'var(--text-muted)', label: 'Inactive' },
    banned: { color: 'var(--danger)', label: 'Banned' },
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('userManagement.title')}</h1>
            <p className="page-subtitle">{t('userManagement.subtitle')}</p>
          </div>
        </header>

        <div className="user-filters">
          <div className="input-field search-input">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder={t('userManagement.searchPlaceholder')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-pills">
            <button className={`filter-pill ${roleFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRoleFilter('all')}>{t('userManagement.allUsers')}</button>
            <button className={`filter-pill ${roleFilter === 'admin' ? 'active' : ''}`}
              onClick={() => setRoleFilter('admin')}>{t('userManagement.administrators')}</button>
          </div>
        </div>

        <div className="card user-table-card desktop-only">
          <table className="user-table">
            <thead>
              <tr>
                <th>{t('userManagement.name')}</th>
                <th>{t('userManagement.email')}</th>
                <th>{t('userManagement.role')}</th>
                <th>{t('userManagement.status')}</th>
                <th>{t('userManagement.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const st = statusConfig[u.status] || statusConfig.inactive;
                return (
                  <tr key={u.id} className="animate-fadeInUp" style={{ animationDelay: `${i * 60}ms` }}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm" style={{ background: 'var(--primary)' }}>
                          {u.full_name?.charAt(0) || u.username.charAt(0).toUpperCase()}
                        </div>
                        <span>{u.full_name || u.username}</span>
                      </div>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <span
                        className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-info'} badge-clickable`}
                        onClick={() => toggleRole(u)}
                        title={t('userManagement.toggleRole')}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: st.color }}>● {st.label}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className={`action-icon ${u.status === 'banned' ? 'unban' : 'ban'}`}
                          onClick={() => toggleBan(u)}
                          title={u.id === currentUser?.id ? t('userManagement.cannotBanSelf') : (u.status === 'banned' ? t('userManagement.unban') : t('userManagement.ban'))}
                        >
                          {u.status === 'banned' ? <MdOutlineCheckCircle /> : <MdOutlineBlock />}
                        </button>
                        <button className="action-icon delete" onClick={() => handleDeleteClick(u)}
                          title={u.id === currentUser?.id ? t('userManagement.cannotDeleteSelf') : t('userManagement.deleteAction')}>
                          <HiOutlineTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            <span className="text-muted">
              {t('userManagement.showing')} {filtered.length} {t('userManagement.of')} {users.length} {t('userManagement.users')}
            </span>
          </div>
        </div>

        {/* Mobile card list */}
        <div className="user-card-list mobile-only">
          {filtered.map((u, i) => {
            const st = statusConfig[u.status] || statusConfig.inactive;
            return (
              <div key={u.id} className="card user-card animate-fadeInUp" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="user-card-top">
                  <div className="user-cell">
                    <div className="user-avatar-sm" style={{ background: 'var(--primary)' }}>
                      {u.full_name?.charAt(0) || u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="user-card-name">{u.full_name || u.username}</span>
                      <span className="user-card-email">{u.email}</span>
                    </div>
                  </div>
                  <span
                    className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-info'} badge-clickable`}
                    onClick={() => toggleRole(u)}
                  >
                    {u.role.toUpperCase()}
                  </span>
                </div>
                <div className="user-card-bottom">
                  <span style={{ color: st.color, fontSize: '0.8rem' }}>● {st.label}</span>
                  <div className="table-actions">
                    <button
                      className={`action-icon ${u.status === 'banned' ? 'unban' : 'ban'}`}
                      onClick={() => toggleBan(u)}
                    >
                      {u.status === 'banned' ? <MdOutlineCheckCircle /> : <MdOutlineBlock />}
                    </button>
                    <button className="action-icon delete" onClick={() => handleDeleteClick(u)}>
                      <HiOutlineTrash />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="table-footer">
            <span className="text-muted">
              {t('userManagement.showing')} {filtered.length} {t('userManagement.of')} {users.length} {t('userManagement.users')}
            </span>
          </div>
        </div>

        {/* Confirm Modal for Delete */}
        <ConfirmModal
          isOpen={!!deleteTarget}
          title={t('userManagement.deleteUser')}
          message={t('userManagement.deleteConfirm').replace('{name}', deleteTarget?.full_name || deleteTarget?.username || '')}
          confirmText={t('userManagement.deleteAction')}
          cancelText={t('userManagement.cancelAction')}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          variant="danger"
        />
      </main>
    </div>
  );
};

export default UserManagementPage;
