import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types/user';
import authService from '../services/authService';
import api from '../services/api';
import { applyGlobalPrefs, defaultPrefs } from '../utils/themeUtils';
import { useTheme } from './ThemeContext';
import { io as socketIO } from 'socket.io-client';
import { toast } from 'react-toastify';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  loading: boolean;
  accountDeletedModal: boolean;
  dismissAccountDeleted: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// *** SYNCHRONOUS: Apply cached prefs ngay lập tức trước khi React render ***
// Điều này đảm bảo font, color, radius không bị flash về mặc định khi reload
(function applyCachedPrefsSync() {
  try {
    const cached = localStorage.getItem('yolofarm_prefs');
    if (cached) {
      const prefs = { ...defaultPrefs, ...JSON.parse(cached) };
      applyGlobalPrefs(prefs);
      // Set data-theme here synchronously to prevent FOUC (ThemeContext will sync later)
      document.documentElement.setAttribute('data-theme', prefs.theme);
    }
  } catch { /* ignore */ }
})();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => authService.getStoredUser());
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [loading] = useState(false);
  const { setTheme } = useTheme();
  const [accountDeletedModal, setAccountDeletedModal] = useState(false);

  // Khi app khởi động và có user đã login, fetch preferences từ DB (source of truth)
  useEffect(() => {
    if (user && token) {
      api.get('/preferences').then(({ data }) => {
        const prefs = { ...defaultPrefs, ...data };
        applyGlobalPrefs(prefs);
        if (prefs.theme === 'dark' || prefs.theme === 'light') {
          setTheme(prefs.theme);
        }
        localStorage.setItem('yolofarm_prefs', JSON.stringify(prefs));
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  // Socket.IO: lắng nghe notification, accountDeleted, forceLogout
  useEffect(() => {
    if (!user) return;
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = socketIO(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    const userId = Number(user.id);
    const emitPresence = () => {
      if (!Number.isInteger(userId) || userId <= 0) return;
      socket.emit('register', userId);
      socket.emit('presenceHeartbeat', userId);
    };

    socket.on('connect', emitPresence);
    emitPresence();

    const heartbeatTimer = window.setInterval(() => {
      if (socket.connected) {
        socket.emit('presenceHeartbeat', userId);
      }
    }, 15000);

    socket.on('notification', ({ title, message }: { title: string; message?: string }) => {
      toast.info(message || title, { autoClose: 8000 });
    });

    socket.on('accountDeleted', () => {
      setAccountDeletedModal(true);
    });

    socket.on('forceLogout', () => {
      const loc = localStorage.getItem('yolofarm_locale');
      toast.error(loc === 'en' ? 'Your account has been blocked.' : 'Tài khoản của bạn đã bị chặn.');
      logout();
    });

    return () => {
      window.clearInterval(heartbeatTimer);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    authService.logout();
    applyGlobalPrefs(defaultPrefs);
    setTheme(defaultPrefs.theme as 'light' | 'dark');
    localStorage.removeItem('yolofarm_prefs');
  };

  const dismissAccountDeleted = () => {
    setAccountDeletedModal(false);
    logout();
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user && !!token,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      loading,
      accountDeletedModal,
      dismissAccountDeleted
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;

