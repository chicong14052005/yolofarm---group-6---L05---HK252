import { useState, useEffect } from 'react';
import { io as socketIO } from 'socket.io-client';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { useLanguage } from '../../context/LanguageContext';
import { toast } from 'react-toastify';
import api from '../../services/api';
import '../../pages/DashboardPage/DashboardPage.css';
import './ControlPage.css';

interface Device {
  id: number; device_name: string; device_type: string;
  feed_key: string; status: string; last_toggled_at?: string;
}

const iconMap: Record<string, string> = {
  pump1: 'water_drop', pump2: 'water_drop',
  led_rgb: 'lightbulb',
};
const colorMap: Record<string, string> = {
  pump1: '#3498DB', pump2: '#2BAE66', led_rgb: '#F5A623',
};
const descMap: Record<string, { en: string; vi: string }> = {
  pump1:   { en: 'Main irrigation pump — waters the primary zone', vi: 'Máy bơm tưới chính — tưới vùng chính' },
  pump2:   { en: 'Secondary pump — waters zone 2', vi: 'Máy bơm phụ — tưới vùng 2' },
  led_rgb: { en: 'LED grow light — adjustable spectrum lighting', vi: 'Đèn LED trồng cây — dải phổ có thể điều chỉnh' },
};

const ControlPage = () => {
  const { t, locale } = useLanguage();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api.get('/devices').then(({ data }) => setDevices(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = socketIO(SOCKET_URL);
    socket.on('deviceStatus', ({ type, status }: { type: string; status: string }) => {
      setDevices(prev => prev.map(d =>
        d.device_type === type ? { ...d, status } : d
      ));
    });
    return () => { socket.disconnect(); };
  }, []);

  const toggleDevice = async (dev: Device) => {
    const newStatus = dev.status === 'on' ? 'off' : 'on';
    setLoading(l => ({ ...l, [dev.id]: true }));
    try {
      await api.post('/devices/control', { device_type: dev.device_type, status: newStatus });
      setDevices(prev => prev.map(d => d.id === dev.id
        ? { ...d, status: newStatus, last_toggled_at: new Date().toISOString() }
        : d
      ));
      toast.success(`${t(`devices.${dev.device_type}`)}: ${newStatus === 'on' ? t('control.on') : t('control.off')}`);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('control.controlError');
      toast.error(message);
    } finally {
      setLoading(l => ({ ...l, [dev.id]: false }));
    }
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('control.title')}</h1>
            <p className="page-subtitle">{t('control.subtitle')}</p>
          </div>
          <div className="control-status-bar">
            <span className={`cs-dot ${devices.some(d => d.status === 'on') ? 'active' : ''}`} />
            <span className="cs-label">
              {devices.filter(d => d.status === 'on').length} / {devices.length}{' '}
              {locale === 'vi' ? 'thiết bị bật' : 'devices active'}
            </span>
          </div>
        </header>

        <div className="control-grid">
          {devices.map(dev => {
            const color = colorMap[dev.device_type] || '#999';
            const isOn = dev.status === 'on';
            const busy = loading[dev.id];
            const desc = descMap[dev.device_type]?.[locale === 'vi' ? 'vi' : 'en'] || '';
            return (
              <div
                key={dev.id}
                className={`control-card ${isOn ? 'on' : 'off'}`}
                style={{ '--device-color': color } as React.CSSProperties}
              >
                <div className="control-card-strip" />

                <div className="control-card-header">
                  <div className="device-icon-wrap">
                    <span className="material-symbols-outlined">{iconMap[dev.device_type] || 'device_unknown'}</span>
                  </div>
                  <div className={`device-status-pill ${isOn ? 'on' : 'off'}`}>
                    <span className="status-dot" />
                    {isOn ? t('control.active') : t('control.inactive')}
                  </div>
                </div>

                <div className="control-card-body">
                  <h3 className="device-name">{t(`devices.${dev.device_type}`)}</h3>
                  <p className="device-desc">{desc}</p>
                </div>

                <div className="control-card-divider" />

                <div className="control-card-footer">
                  <div className="last-toggled">
                    <span className="material-symbols-outlined">history</span>
                    <span>{fmtTime(dev.last_toggled_at)}</span>
                  </div>
                  <button
                    className={`power-btn ${isOn ? 'on' : 'off'} ${busy ? 'busy' : ''}`}
                    onClick={() => toggleDevice(dev)}
                    disabled={busy}
                    title={isOn ? t('control.off') : t('control.on')}
                  >
                    {busy
                      ? <span className="material-symbols-outlined spinning">sync</span>
                      : <span className="material-symbols-outlined">power_settings_new</span>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default ControlPage;
