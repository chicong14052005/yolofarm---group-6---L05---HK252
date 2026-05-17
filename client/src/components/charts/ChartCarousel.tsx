import { useState, useEffect, useCallback } from 'react';
import EnvironmentChart from './EnvironmentChart';
import { useLanguage } from '../../context/LanguageContext';
import type { SensorType } from '../../types/sensor';
import type { HistoricalPredictionPoint } from '../../types/ai';
import api from '../../services/api';
import aiService from '../../services/aiService';
import './ChartCarousel.css';

interface SensorHistoryPoint {
  recorded_at: string;
  value: number;
}

interface ForecastPoint {
  time: string;
  value: number;
  lower: number;
  upper: number;
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

// Downsample data to ~1 hour intervals for cleaner charts
function downsample<T extends { time: string }>(data: T[]): T[] {
  if (data.length < 3) return data;
  const t0 = new Date(data[0].time).getTime();
  const t1 = new Date(data[1].time).getTime();
  const actualMin = (t1 - t0) / 60000;
  if (actualMin <= 0) return data;
  const step = Math.max(1, Math.round(60 / actualMin));
  return step <= 1 ? data : data.filter((_, i) => i % step === 0);
}

// Keep only the last N days of data
function lastDays<T extends { time: string }>(data: T[], days: number): T[] {
  if (data.length === 0) return data;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return data.filter((d) => new Date(d.time).getTime() >= cutoff);
}

const ChartCarousel = () => {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [historyData, setHistoryData] = useState<Record<string, { time: string; value: number }[]>>({});
  const [humidityForecast, setHumidityForecast] = useState<ForecastPoint[]>([]);
  const [historicalPredictions, setHistoricalPredictions] = useState<{ time: string; value: number }[]>([]);
  const [historicalActuals, setHistoricalActuals] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastUpdating, setForecastUpdating] = useState(false);

  const mapForecastData = useCallback((forecast: {
    predictions?: Array<{ timestamp: string; value: number; lower: number; upper: number }>;
    historical_predictions?: Array<{ timestamp: string; actual: number; predicted: number }>;
  }) => {
    setHumidityForecast(
      (forecast.predictions || []).map((p) => ({
        time: p.timestamp,
        value: p.value,
        lower: p.lower,
        upper: p.upper,
      }))
    );
    setHistoricalPredictions(
      (forecast.historical_predictions || []).map((p) => ({
        time: p.timestamp,
        value: p.predicted,
      }))
    );
    setHistoricalActuals(
      (forecast.historical_predictions || []).map((p) => ({
        time: p.timestamp,
        value: p.actual,
      }))
    );
  }, []);

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

      // Fetch cached forecast (fast, no inference)
      try {
        const forecast = await aiService.getCachedForecast();
        mapForecastData(forecast);
      } catch {
        setHumidityForecast([]);
        setHistoricalPredictions([]);
        setHistoricalActuals([]);
      }
    } finally {
      setLoading(false);
    }
  }, [mapForecastData]);

  const updateForecast = useCallback(async () => {
    setForecastUpdating(true);
    try {
      const forecast = await aiService.forecastHumidity(720, 24, 0.7);
      mapForecastData(forecast);
    } catch {
      setHumidityForecast([]);
      setHistoricalPredictions([]);
      setHistoricalActuals([]);
    } finally {
      setForecastUpdating(false);
    }
  }, [mapForecastData]);

  useEffect(() => {
    fetchAllHistory();
    // Auto-refresh history every 5 minutes (cached forecast, no inference)
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
  const humidityData = currentConfig.type === 'humidity' && historicalActuals.length > 0
    ? historicalActuals
    : currentData;
  const showChart = humidityData.length > 0 || humidityForecast.length > 0;

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
          {currentConfig.type === 'humidity' && (
            <button
              className="carousel-btn forecast-update-btn"
              onClick={updateForecast}
              disabled={forecastUpdating}
              title={t('dashboard.updateForecast') || 'Cập nhật dự báo'}
            >
              <span className={`material-symbols-outlined ${forecastUpdating ? 'spin' : ''}`}>
                refresh
              </span>
            </button>
          )}
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
        ) : !showChart ? (
          <div className="carousel-empty">
            <span className="material-symbols-outlined">show_chart</span>
            <p>{t('dashboard.noData') || 'Không có dữ liệu'}</p>
          </div>
        ) : (
          <>
            <EnvironmentChart
              data={currentConfig.type === 'humidity' ? downsample(lastDays(humidityData, 14)) : humidityData}
              historicalPredictions={currentConfig.type === 'humidity' ? downsample(lastDays(historicalPredictions, 14)) : []}
              forecastData={currentConfig.type === 'humidity' ? humidityForecast : []}
              label={t(currentConfig.labelKey)}
              unit={currentConfig.unit}
              color={currentConfig.color}
              showDateLabels={currentConfig.type === 'humidity'}
            />
            {forecastUpdating && currentConfig.type === 'humidity' && (
              <div className="forecast-updating-bar">
                <div className="carousel-spinner" />
                <span>{t('dashboard.updatingForecast') || 'Đang cập nhật dự báo...'}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChartCarousel;
