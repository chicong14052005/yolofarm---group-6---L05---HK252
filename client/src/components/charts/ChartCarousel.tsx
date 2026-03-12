import { useState, useEffect, useCallback } from 'react';
import EnvironmentChart from './EnvironmentChart';
import { useLanguage } from '../../context/LanguageContext';
import type { SensorType } from '../../types/sensor';
import api from '../../services/api';
import './ChartCarousel.css';

interface SensorHistoryPoint {
  recorded_at: string;
  value: number;
}

interface ChartConfig {
  type: SensorType;
  labelKey: string;
  unit: string;
  color: string;
}

const CHART_CONFIGS: ChartConfig[] = [
  { type: 'temperature', labelKey: 'dashboard.temperature', unit: '°C', color: '#ef4444' },
  { type: 'humidity', labelKey: 'dashboard.humidity', unit: '%', color: '#3b82f6' },
  { type: 'soil_moisture', labelKey: 'dashboard.soilMoisture', unit: '%', color: '#22c55e' },
  { type: 'light', labelKey: 'dashboard.lightIntensity', unit: 'lux', color: '#f59e0b' },
];

const ChartCarousel = () => {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [historyData, setHistoryData] = useState<Record<string, { time: string; value: number }[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchAllHistory = useCallback(async () => {
    setLoading(true);
    try {
      const results: Record<string, { time: string; value: number }[]> = {};
      for (const config of CHART_CONFIGS) {
        try {
          const { data } = await api.get(`/sensors/history/${config.type}?hours=24`);
          results[config.type] = (data as SensorHistoryPoint[]).map((d) => ({
            time: d.recorded_at,
            value: d.value,
          }));
        } catch {
          results[config.type] = [];
        }
      }
      setHistoryData(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllHistory();
    // Auto-refresh mỗi 5 phút
    const interval = setInterval(fetchAllHistory, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllHistory]);

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % CHART_CONFIGS.length);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + CHART_CONFIGS.length) % CHART_CONFIGS.length);
  };

  const currentConfig = CHART_CONFIGS[activeIndex];
  const currentData = historyData[currentConfig.type] || [];

  return (
    <div className="chart-carousel">
      <div className="carousel-header">
        <div className="carousel-title-section">
          <span
            className="carousel-indicator-dot"
            style={{ backgroundColor: currentConfig.color }}
          />
          <span className="carousel-current-label">
            {t(currentConfig.labelKey)}
          </span>
        </div>
        <div className="carousel-nav">
          <button
            className="carousel-btn"
            onClick={goPrev}
            aria-label="Previous chart"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="carousel-dots">
            {CHART_CONFIGS.map((_, idx) => (
              <span
                key={idx}
                className={`carousel-dot ${idx === activeIndex ? 'active' : ''}`}
                onClick={() => setActiveIndex(idx)}
                style={idx === activeIndex ? { backgroundColor: currentConfig.color } : undefined}
              />
            ))}
          </div>
          <button
            className="carousel-btn"
            onClick={goNext}
            aria-label="Next chart"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="carousel-body">
        {loading ? (
          <div className="carousel-loading">
            <div className="carousel-spinner" />
          </div>
        ) : currentData.length === 0 ? (
          <div className="carousel-empty">
            <span className="material-symbols-outlined">show_chart</span>
            <p>{t('dashboard.noData') || 'Không có dữ liệu'}</p>
          </div>
        ) : (
          <EnvironmentChart
            data={currentData}
            label={t(currentConfig.labelKey)}
            unit={currentConfig.unit}
            color={currentConfig.color}
          />
        )}
      </div>
    </div>
  );
};

export default ChartCarousel;
