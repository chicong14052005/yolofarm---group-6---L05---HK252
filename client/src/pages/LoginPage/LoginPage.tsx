import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import authService from '../../services/authService';
import { toast } from 'react-toastify';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { BsSun, BsMoon } from 'react-icons/bs';
import './LoginPage.css';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '' });
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const data = await authService.login({ username: form.username, password: form.password });
        login(data.user, data.token);
        toast.success(t('login.loginSuccess'));
      } else {
        const data = await authService.register({
          username: form.username, email: form.email,
          password: form.password, full_name: form.full_name
        });
        login(data.user, data.token);
        toast.success(t('login.registerSuccess'));
      }
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const data = await authService.googleLogin(credentialResponse.credential);
      login(data.user, data.token);
      toast.success(t('login.loginSuccess'));
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Google login failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="hero-overlay">
          <div className="hero-content">
            <div className="hero-logo">
              <span className="hero-logo-icon">🌱</span>
              <span className="hero-logo-text">Smart Farm</span>
            </div>
            <h1 className="hero-title">
              Smart farming for a <span className="text-highlight">sustainable</span> future.
            </h1>
            <p className="hero-subtitle">
              Monitor soil health, automate irrigation, and maximize your yield
              with our next-generation greenhouse ecosystem.
            </p>
          </div>
          <p className="hero-footer">© 2026 SmartFarm Technologies. All rights reserved.</p>
        </div>
      </div>

      <div className="login-form-section">
        <button className="theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? <BsMoon /> : <BsSun />}
        </button>

        <div className="login-form-wrapper">
          <h2 className="form-title">{isLogin ? t('login.welcomeBack') : t('login.createAccount')}</h2>
          <p className="form-subtitle">
            {isLogin ? t('login.enterCredentials') : t('login.fillDetails')}
          </p>

          <div className="google-login-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google login failed')}
              size="large"
              width="100%"
              text={isLogin ? 'signin_with' : 'signup_with'}
            />
          </div>

          <div className="divider">
            <span>{t('login.orContinue')}</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="input-group">
                <label>{t('login.fullName')}</label>
                <div className="input-field">
                  <HiOutlineMail className="input-icon" />
                  <input type="text" name="full_name" placeholder="Nguyen Van A"
                    value={form.full_name} onChange={handleChange} required />
                </div>
              </div>
            )}

            <div className="input-group">
              <label>{t('login.username')}</label>
              <div className="input-field">
                <HiOutlineMail className="input-icon" />
                <input type="text" name="username" placeholder="username"
                  value={form.username} onChange={handleChange} required />
              </div>
            </div>

            {!isLogin && (
              <div className="input-group">
                <label>{t('login.emailAddress')}</label>
                <div className="input-field">
                  <HiOutlineMail className="input-icon" />
                  <input type="email" name="email" placeholder="name@company.com"
                    value={form.email} onChange={handleChange} required />
                </div>
              </div>
            )}

            <div className="input-group">
              <div className="label-row">
                <label>{t('login.password')}</label>
                {isLogin && <a href="#" className="forgot-link">{t('login.forgotPassword')}</a>}
              </div>
              <div className="input-field">
                <HiOutlineLockClosed className="input-icon" />
                <input type={showPassword ? 'text' : 'password'} name="password"
                  placeholder="••••••••" value={form.password} onChange={handleChange} required />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                </button>
              </div>
            </div>

            {isLogin && (
              <label className="remember-label">
                <input type="checkbox" /> <span>{t('login.rememberDevice')}</span>
              </label>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? '⟳' : (isLogin ? t('login.signIn') : t('login.createAccount'))}
              {!loading && <span>→</span>}
            </button>
          </form>

          <p className="switch-text">
            {isLogin ? t('login.dontHaveAccount') : t('login.alreadyHaveAccount')}
            <button className="switch-btn" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? t('login.createAccount') : t('login.signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
