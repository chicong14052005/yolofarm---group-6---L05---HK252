import { useState, useEffect, useCallback, useRef } from 'react';
import EnvironmentChart from './EnvironmentChart';
import { useLanguage } from '../../context/LanguageContext';
import type { SensorType } from '../../types/sensor';
import type { HumidityForecastResult } from '../../types/ai';
import api from '../../services/api';
import aiService from '../../services/aiService';
import {
  formatLocalDateKey,
  getLocalDateKey,
  getYoloFarmTimeMs,
  isSameLocalDate,
  normalizeYoloFarmTimestamp,
} from '../../utils/timeUtils';
import './ChartCarousel.css';

interface SensorHistoryPoint {
  recorded_at: string;
  value: number;
}

interface SensorSocketEvent {
  type: SensorType;
  value: number;
  recorded_at?: string;
  timestamp?: string;
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

interface ChartCarouselProps {
  latestSensorEvent?: SensorSocketEvent | null;
  onActiveTypeChange?: (type: SensorType) => void;
}

const CHART_CONFIGS: ChartConfig[] = [
  { type: 'temperature', labelKey: 'dashboard.temperature', unit: '°C', color: '#ef4444' },
  { type: 'humidity', labelKey: 'dashboard.humidity', unit: '%', color: '#2563eb' },
  { type: 'soil_moisture', labelKey: 'dashboard.soilMoisture', unit: '%', color: '#22c55e' },
  { type: 'light', labelKey: 'dashboard.lightIntensity', unit: 'lux', color: '#f59e0b' },
];

const MAX_FORECAST_POINTS = 120;
const FORECAST_POLL_ATTEMPTS = 20;
const FORECAST_POLL_INTERVAL_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function normalizeSeries<T extends { time: string }>(data: T[]): T[] {
  const byTime = new Map<string, T>();

  for (const item of data) {
    const time = normalizeYoloFarmTimestamp(item.time);
    byTime.set(time, { ...item, time });
  }

  return Array.from(byTime.values())
    .sort((a, b) => getYoloFarmTimeMs(a.time) - getYoloFarmTimeMs(b.time));
}

function limitPoints<T extends { time: string }>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  const sampled = data.filter((_, index) => index % step === 0);
  const last = data[data.length - 1];

  if (sampled[sampled.length - 1]?.time !== last.time) {
    sampled.push(last);
  }

  return sampled.slice(-maxPoints);
}

function prepareDaySeries<T extends { time: string }>(
  data: T[],
  dateKey: string,
): T[] {
  return normalizeSeries(data).filter((point) => isSameLocalDate(point.time, dateKey));
}

function hasForecastData(forecast: HumidityForecastResult | null | undefined) {
  return Boolean(forecast && (forecast.predictions || []).length > 0);
}

const ChartCarousel = ({
  latestSensorEvent = null,
  onActiveTypeChange,
}: ChartCarouselProps) => {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [chartDateKey, setChartDateKey] = useState(() => formatLocalDateKey());
  const [historyData, setHistoryData] = useState<Record<string, { time: string; value: number }[]>>({});
  const [humidityForecast, setHumidityForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastUpdating, setForecastUpdating] = useState(false);
  const forecastRequestRef = useRef<Promise<void> | null>(null);
  const initialForecastRefreshRef = useRef(false);

  const mapForecastData = useCallback((forecast: HumidityForecastResult, dateKey = chartDateKey) => {
    const points = (forecast.predictions || [])
      .map((p) => ({
        time: p.timestamp,
        value: p.value,
        lower: p.lower,
        upper: p.upper,
      }))
      .filter((point) => isSameLocalDate(point.time, dateKey));

    setHumidityForecast(limitPoints(normalizeSeries(points), MAX_FORECAST_POINTS));
  }, [chartDateKey]);

  const pollForecastCache = useCallback(async () => {
    for (let attempt = 0; attempt < FORECAST_POLL_ATTEMPTS; attempt += 1) {
      await sleep(FORECAST_POLL_INTERVAL_MS);
      const cached = await aiService.getCachedForecast();

      if (hasForecastData(cached)) {
        mapForecastData(cached, formatLocalDateKey());
      }

      if (cached.cache_status !== 'refreshing' && !cached.refresh_in_progress) {
        return;
      }
    }
  }, [mapForecastData]);

  const refreshForecast = useCallback(async () => {
    if (forecastRequestRef.current) {
      return forecastRequestRef.current;
    }

    setForecastUpdating(true);
    const request = (async () => {
      try {
        const forecast = await aiService.forecastHumidity(720, 24, 0.7, { force: true });
        if (hasForecastData(forecast)) {
          mapForecastData(forecast, formatLocalDateKey());
        }

        if (forecast.cache_status === 'refreshing' || forecast.refresh_in_progress) {
          await pollForecastCache();
        }
      } catch {
        const cached = await aiService.getCachedForecast().catch(() => null);
        if (hasForecastData(cached)) {
          mapForecastData(cached as HumidityForecastResult, formatLocalDateKey());
        }
      } finally {
        setForecastUpdating(false);
        forecastRequestRef.current = null;
      }
    })();

    forecastRequestRef.current = request;
    return request;
  }, [mapForecastData, pollForecastCache]);

  const fetchAllHistory = useCallback(async () => {
    const dateKey = formatLocalDateKey();
    setChartDateKey(dateKey);
    setLoading(true);
    try {
      const [historyEntries, forecast] = await Promise.all([
        Promise.all(
          CHART_CONFIGS.map(async (config) => {
            try {
              const { data } = await api.get(`/sensors/history/${config.type}?date=${dateKey}`);
              const points = (data as SensorHistoryPoint[]).map((d) => ({
                time: d.recorded_at,
                value: Number(d.value),
              }));

              return [config.type, prepareDaySeries(points, dateKey)] as const;
            } catch {
              return [config.type, []] as const;
            }
          }),
        ),
        aiService.getCachedForecast().catch(() => null),
      ]);

      setHistoryData(Object.fromEntries(historyEntries));

      if (hasForecastData(forecast)) {
        mapForecastData(forecast as HumidityForecastResult, dateKey);
      } else if (!initialForecastRefreshRef.current) {
        initialForecastRefreshRef.current = true;
        void refreshForecast();
      }
    } finally {
      setLoading(false);
    }
  }, [mapForecastData, refreshForecast]);

  useEffect(() => {
    fetchAllHistory();
    const interval = window.setInterval(fetchAllHistory, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [fetchAllHistory]);

  useEffect(() => {
    const currentConfig = CHART_CONFIGS[activeIndex];
    onActiveTypeChange?.(currentConfig.type);
  }, [activeIndex, onActiveTypeChange]);

  useEffect(() => {
    if (!latestSensorEvent?.type) return;

    const eventTime = latestSensorEvent.recorded_at || latestSensorEvent.timestamp;
    const value = Number(latestSensorEvent.value);
    if (!eventTime || Number.isNaN(value)) return;

    const todayKey = formatLocalDateKey();
    if (todayKey !== chartDateKey) {
      void fetchAllHistory();
      return;
    }

    if (getLocalDateKey(eventTime) !== chartDateKey) return;

    setHistoryData((prev) => {
      const existing = prev[latestSensorEvent.type] || [];
      const updated = prepareDaySeries([
        ...existing,
        { time: eventTime, value },
      ], chartDateKey);

      return {
        ...prev,
        [latestSensorEvent.type]: updated,
      };
    });
  }, [chartDateKey, fetchAllHistory, latestSensorEvent]);

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % CHART_CONFIGS.length);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + CHART_CONFIGS.length) % CHART_CONFIGS.length);
  };

  const currentConfig = CHART_CONFIGS[activeIndex];
  const currentData = historyData[currentConfig.type] || [];
  const isHumidityChart = currentConfig.type === 'humidity';
  const showChart = currentData.length > 0 || (isHumidityChart && humidityForecast.length > 0);

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
          {isHumidityChart && (
            <button
              className="carousel-btn forecast-update-btn"
              onClick={refreshForecast}
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
              data={prepareDaySeries(currentData, chartDateKey)}
              forecastData={isHumidityChart ? humidityForecast : []}
              label={t(currentConfig.labelKey)}
              unit={currentConfig.unit}
              color={currentConfig.color}
              isHumidityChart={isHumidityChart}
            />
            {forecastUpdating && isHumidityChart && (
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
