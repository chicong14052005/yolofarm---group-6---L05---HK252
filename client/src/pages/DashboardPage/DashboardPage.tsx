import { useState, useEffect, useCallback } from 'react';
import { io as socketIO } from 'socket.io-client';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import ChartCarousel from '../../components/charts/ChartCarousel';
import { useLanguage } from '../../context/LanguageContext';
import { SENSOR_UNITS, type SensorType } from '../../types/sensor';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './DashboardPage.css';

interface SensorReading {
  sensor_type: SensorType; value: number; recorded_at: string;
}

interface Device {
  id: number; device_name: string; device_type: string; status: string;
  last_toggled_at?: string;
}

const SENSOR_ICONS: Record<string, string> = {
  temperature: 'device_thermostat',
  humidity: 'humidity_high',
  soil_moisture: 'water_lock',
  light: 'partly_cloudy_day',
};

const DEVICE_ICONS: Record<string, string> = {
  pump1: 'water_drop',
  pump2: 'water_drop',
  led_rgb: 'lightbulb',
};

const DashboardPage = () => {
  const { t } = useLanguage();

  const sensorLabels: Record<string, string> = {
    temperature: t('dashboard.temperature'), humidity: t('dashboard.humidity'),
    soil_moisture: t('dashboard.soilMoisture'), light: t('dashboard.lightIntensity'),
  };

  const [sensors, setSensors] = useState<{ type: SensorType; value: number; change: number; label: string }[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const fallbackSensors = useCallback(() => [
    { type: 'temperature' as SensorType, value: 24, change: 0, label: sensorLabels.temperature },
    { type: 'humidity' as SensorType, value: 65, change: 0, label: sensorLabels.humidity },
    { type: 'soil_moisture' as SensorType, value: 42, change: 0, label: sensorLabels.soil_moisture },
    { type: 'light' as SensorType, value: 850, change: 0, label: sensorLabels.light },
  ], [sensorLabels.temperature, sensorLabels.humidity, sensorLabels.soil_moisture, sensorLabels.light]);

  useEffect(() => {
    api.get('/sensors/latest').then(({ data }) => {
      const mapped = (data as (SensorReading & { change_pct?: number })[]).map((s) => ({
        type: s.sensor_type, value: s.value, change: s.change_pct ?? 0,
        label: sensorLabels[s.sensor_type] || s.sensor_type,
      }));
      setSensors(mapped.length > 0 ? mapped : fallbackSensors());
    }).catch(() => setSensors(fallbackSensors()));

    api.get('/devices').then(({ data }) => setDevices(data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket.IO: đồng bộ 2 chiều Adafruit ↔ Dashboard
  useEffect(() => {
    const socket = socketIO('http://localhost:5000');
    socket.on('deviceStatus', ({ type, status }: { type: string; status: string }) => {
      setDevices(prev => prev.map(d =>
        d.device_type === type ? { ...d, status, last_toggled_at: new Date().toISOString() } : d
      ));
    });
    socket.on('sensorData', ({ type, value }: { type: string; value: number }) => {
      setSensors(prev => prev.map(s =>
        s.type === type ? { ...s, value } : s
      ));
    });
    return () => { socket.disconnect(); };
  }, []);

  const toggleDevice = async (dev: Device) => {
    const newStatus = dev.status === 'on' ? 'off' : 'on';
    try {
      await api.post('/devices/control', { device_type: dev.device_type, status: newStatus });
      setDevices(prev => prev.map(d => d.id === dev.id
        ? { ...d, status: newStatus, last_toggled_at: new Date().toISOString() } : d));
      toast.success(`${t(`devices.${dev.device_type}`)}: ${newStatus === 'on' ? t('control.on') : t('control.off')}`);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('control.controlError');
      toast.error(message);
    }
  };

  const quickDevices = [...devices]
    .sort((a, b) => {
      if (a.status === 'on' && b.status !== 'on') return -1;
      if (a.status !== 'on' && b.status === 'on') return 1;
      const aTime = a.last_toggled_at ? new Date(a.last_toggled_at).getTime() : 0;
      const bTime = b.last_toggled_at ? new Date(b.last_toggled_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('dashboard.title')}</h1>
            <p className="page-subtitle">{t('dashboard.subtitle')}</p>
          </div>
          <div className="status-badge online">
            <span className="status-dot"></span>
            {t('dashboard.systemOnline')}
          </div>
        </header>

        <div className="sensor-grid">
          {sensors.map(sensor => (
            <div key={sensor.type} className="sensor-card card animate-fadeInUp">
              <div className="sensor-card-header">
                <span className="sensor-label">{sensor.label}</span>
                <span className="material-symbols-outlined sensor-emoji">
                  {SENSOR_ICONS[sensor.type] || 'sensors'}
                </span>
              </div>
              <div className="sensor-value">
                {sensor.value}<span className="sensor-unit">{SENSOR_UNITS[sensor.type]}</span>
              </div>
              <div className={`sensor-change ${sensor.change >= 0 ? 'positive' : 'negative'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                  {sensor.change >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                <span>{sensor.change >= 0 ? '+' : ''}{sensor.change}% {t('dashboard.fromLastHour')}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <div className="card chart-card animate-fadeInUp delay-100">
            <div className="card-header">
              <div>
                <h3>{t('dashboard.environmentTrends')}</h3>
                <p className="card-subtitle">{t('dashboard.smoothCurve')}</p>
              </div>
            </div>
            <ChartCarousel />
          </div>

          <div className="dashboard-right">
            <div className="card animate-fadeInUp delay-200">
              <h3>{t('dashboard.quickControls')}</h3>
              {quickDevices.map(dev => (
                <div key={dev.id} className="control-item">
                  <div className="control-info">
                    <span className="material-symbols-outlined control-icon-wrap">
                      {DEVICE_ICONS[dev.device_type] || 'water_drop'}
                    </span>
                    <span>{t(`devices.${dev.device_type}`)}</span>
                  </div>
                  <div className={`toggle ${dev.status === 'on' ? 'active' : ''}`}
                    onClick={() => toggleDevice(dev)}></div>
                </div>
              ))}
              {quickDevices.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('dashboard.noDevices') || 'No devices'}</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
