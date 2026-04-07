import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { GoogleOAuthProvider } from '@react-oauth/google';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import AppRoutes from './routes/AppRoutes';
import './assets/styles/global.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/* Modal hiện khi admin xóa tài khoản user đang online */
const AccountDeletedModal = () => {
  const { accountDeletedModal, dismissAccountDeleted } = useAuth();
  const { t } = useLanguage();
  if (!accountDeletedModal) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--card-bg, #fff)', borderRadius: 16, padding: '2rem 2.5rem',
        maxWidth: 420, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#E74C3C' }}>
          person_off
        </span>
        <h2 style={{ margin: '1rem 0 .5rem' }}>
          {t('common.accountDeletedTitle')}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {t('common.accountDeletedMsg')}
        </p>
        <button className="btn btn-primary" onClick={dismissAccountDeleted}>
          {t('common.leaveSystem')}
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <AppRoutes />
              <AccountDeletedModal />
              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnHover
                theme="colored"
              />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;

