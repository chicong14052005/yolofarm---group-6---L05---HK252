const axios = require('axios');
const pool = require('../config/db');
const SettingsModel = require('../models/settingsModel');
const NotificationModel = require('../models/notificationModel');
const ForecastCacheModel = require('../models/forecastCacheModel');
const ForecastHistoryModel = require('../models/forecastHistoryModel');
const socketManager = require('../config/socketManager');

const ALERT_DEBOUNCE_MS = Math.max(Number(process.env.FORECAST_ALERT_DEBOUNCE_MS || 15 * 60 * 1000), 0);
const FORECAST_TIMEOUT_MS = Math.max(Number(process.env.FORECAST_REQUEST_TIMEOUT_MS || 120000), 1000);
const FORECAST_CACHE_TTL_MS = Math.max(Number(process.env.FORECAST_CACHE_TTL_MS || 10 * 60 * 1000), 0);

const lastForecastAlertSentAt = new Map();
let lastForecastCache = null;
let humidityRefreshPromise = null;

const buildCachedResponse = (cached, cacheStatus, extra = {}) => ({
  ...cached,
  cache_status: cacheStatus,
  refresh_in_progress: Boolean(humidityRefreshPromise),
  ...extra,
});

const getForecastErrorMessage = (error) => (
  error.response?.data?.detail
  || error.response?.data?.error
  || error.code
  || error.message
  || 'Unknown forecast error'
);

const hasUsablePredictions = (forecast) => (
  forecast
  && Array.isArray(forecast.predictions)
  && forecast.predictions.length > 0
);

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateOnly = (date = new Date()) => {
  const parsed = date instanceof Date ? date : new Date(date);
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
};

const addDays = (dateText, days) => {
  const [year, month, day] = String(dateText).slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateOnly(date);
};

const toDateKey = (value) => {
  if (!value) return '';
  if (value instanceof Date) return formatDateOnly(value);
  return String(value).trim().replace('T', ' ').slice(0, 10);
};

const roundNullable = (value, digits = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
};

const classifyHumidityStatus = (actualAvg, predictedAvg) => {
  if (actualAvg === null || predictedAvg === null) return 'missing';
  if (actualAvg < 40) return 'low';
  if (actualAvg > 80) return 'high';
  return 'optimal';
};

const getWeeklyMissingReason = ({ actualAvg, predictedAvg, hasHistory }) => {
  if (predictedAvg !== null) return null;
  if (!hasHistory) return 'no_forecast_history';
  if (actualAvg === null) return 'no_actual_data';
  return 'no_forecast_prediction_for_day';
};

const getSettingNumber = async (key, fallback) => {
  try {
    const setting = await SettingsModel.get(key);
    if (!setting || setting.setting_value === null || setting.setting_value === undefined) {
      return fallback;
    }

    const parsed = Number(setting.setting_value);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
};

const buildAlertKey = (threshold, horizonHours) => `forecast_humidity_${threshold}_${horizonHours}`;

const shouldSendAlert = (key) => {
  const now = Date.now();
  const previous = lastForecastAlertSentAt.get(key);
  if (previous && now - previous < ALERT_DEBOUNCE_MS) {
    return false;
  }

  lastForecastAlertSentAt.set(key, now);
  return true;
};

const notifyAllUsers = async ({ title, message }) => {
  const [users] = await pool.query(
    `SELECT u.id
     FROM users u
     LEFT JOIN user_preferences up ON up.user_id = u.id
     WHERE up.user_id IS NULL OR up.notifications_enabled = TRUE`
  );
  const io = socketManager.getIO();

  for (const user of users) {
    await NotificationModel.create({
      user_id: user.id,
      type: 'ai_alert',
      title,
      message,
    });

    if (io) {
      io.to(`user_${user.id}`).emit('notification', {
        type: 'ai_alert',
        title,
        message,
      });
    }
  }

  return users.length;
};

const requestHumidityForecast = async ({
  history_hours = 72,
  horizon_hours = 24,
  confidence_threshold = 0.7,
} = {}) => {
  const aiUrl = (process.env.AI_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
  const aiToken = process.env.AI_SERVICE_TOKEN;

  const payload = {
    sensor_type: 'humidity',
    history_hours,
    horizon_hours,
    confidence_threshold,
  };

  const response = await axios.post(`${aiUrl}/forecast/humidity`, payload, {
    timeout: FORECAST_TIMEOUT_MS,
    headers: aiToken
      ? { Authorization: `Bearer ${aiToken}` }
      : undefined,
  });

  if (!hasUsablePredictions(response.data)) {
    const error = new Error(response.data?.error || 'Forecast service did not return predictions');
    error.forecastPayload = response.data;
    throw error;
  }

  return response.data;
};

const runHumidityRefresh = async (params) => {
  const forecast = await requestHumidityForecast(params);
  const alertStatus = await aiForecastService.processForecastAlerts(forecast);
  const responseData = {
    ...forecast,
    alert_status: alertStatus,
  };

  await aiForecastService.saveForecastCache({
    sensor_type: 'humidity',
    ...responseData,
  }).catch((cacheErr) => {
    console.error('Failed to save forecast cache:', cacheErr.message);
  });

  await ForecastHistoryModel.saveForecastRun('humidity', responseData).catch((historyErr) => {
    console.error('Failed to save forecast history:', historyErr.message);
  });

  lastForecastCache = {
    data: responseData,
    cachedAt: Date.now(),
  };

  return responseData;
};

const aiForecastService = {
  async getCachedForecast({ sensor_type = 'humidity' } = {}) {
    return ForecastCacheModel.getBySensorType(sensor_type);
  },

  isForecastRefreshRunning() {
    return Boolean(humidityRefreshPromise);
  },

  async saveForecastCache({ sensor_type = 'humidity', ...forecastData }) {
    await ForecastCacheModel.upsert(sensor_type, forecastData);
  },

  startHumidityRefresh(params = {}) {
    if (!humidityRefreshPromise) {
      humidityRefreshPromise = runHumidityRefresh(params)
        .catch((error) => {
          console.error('Humidity forecast refresh failed:', getForecastErrorMessage(error));
          throw error;
        })
        .finally(() => {
          humidityRefreshPromise = null;
        });
    }

    return humidityRefreshPromise;
  },

  async predictHumidity({
    history_hours = 72,
    horizon_hours = 24,
    confidence_threshold = 0.7,
    force = true,
  } = {}) {
    const cached = await this.getCachedForecast({ sensor_type: 'humidity' });

    if (humidityRefreshPromise) {
      if (cached) {
        return buildCachedResponse(cached, 'refreshing');
      }
      return humidityRefreshPromise;
    }

    if (cached && !force) {
      return buildCachedResponse(cached, 'cached');
    }

    if (cached) {
      this.startHumidityRefresh({ history_hours, horizon_hours, confidence_threshold }).catch(() => {});
      return buildCachedResponse(cached, 'refreshing');
    }

    const refreshPromise = this.startHumidityRefresh({ history_hours, horizon_hours, confidence_threshold });
    try {
      return await refreshPromise;
    } catch (error) {
      const persistentCache = await this.getCachedForecast({ sensor_type: 'humidity' }).catch(() => null);
      if (persistentCache) {
        return buildCachedResponse(persistentCache, 'stale', {
          cache_fallback: true,
          error: getForecastErrorMessage(error),
        });
      }

      if (lastForecastCache && Date.now() - lastForecastCache.cachedAt <= FORECAST_CACHE_TTL_MS) {
        return {
          ...lastForecastCache.data,
          cache_status: 'fallback',
          cache_fallback: true,
          cache_age_ms: Date.now() - lastForecastCache.cachedAt,
          error: getForecastErrorMessage(error),
        };
      }

      throw error;
    }
  },

  async getHumidityWeeklySummary({ days = 7 } = {}) {
    const normalizedDays = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 31);
    const today = formatDateOnly(new Date());
    const startDate = addDays(today, -(normalizedDays - 1));
    const endDate = addDays(today, 1);

    const [actualRows] = await pool.query(
      `SELECT DATE(recorded_at) AS date, ROUND(AVG(value), 2) AS actual_avg
       FROM sensor_data
       WHERE sensor_type = 'humidity'
         AND recorded_at >= ?
         AND recorded_at < ?
       GROUP BY DATE(recorded_at)`,
      [`${startDate} 00:00:00`, `${endDate} 00:00:00`]
    );

    const actualByDate = new Map(
      actualRows.map((row) => [toDateKey(row.date), roundNullable(row.actual_avg)])
    );

    const forecastRows = await ForecastHistoryModel.getSameDayFutureDailyAverages({
      sensorType: 'humidity',
      startDate,
      endDate,
    });
    const cached = await this.getCachedForecast({ sensor_type: 'humidity' }).catch(() => null);
    const predictedByDate = new Map(
      forecastRows.map((row) => [toDateKey(row.date), roundNullable(row.predicted_avg)])
    );
    const predictedCountByDate = new Map(
      forecastRows.map((row) => [toDateKey(row.date), Number(row.predicted_count || 0)])
    );
    const firstPredictionByDate = new Map(
      forecastRows.map((row) => [toDateKey(row.date), row.first_prediction_at || null])
    );
    const lastPredictionByDate = new Map(
      forecastRows.map((row) => [toDateKey(row.date), row.last_prediction_at || null])
    );
    const forecastPredictionCount = forecastRows.reduce(
      (total, row) => total + Number(row.predicted_count || 0),
      0
    );
    const latestForecastGeneratedAt = forecastRows
      .map((row) => row.latest_generated_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    const dateKeys = Array.from({ length: normalizedDays }, (_, index) => addDays(startDate, index))
      .reverse();

    const rows = dateKeys.map((date) => {
      const actualAvg = actualByDate.get(date) ?? null;
      const predictedAvg = predictedByDate.get(date) ?? null;
      const variance = actualAvg !== null && predictedAvg !== null
        ? roundNullable(actualAvg - predictedAvg)
        : null;

      return {
        date,
        actual_avg: actualAvg,
        predicted_avg: predictedAvg,
        variance,
        status: classifyHumidityStatus(actualAvg, predictedAvg),
        missing_reason: getWeeklyMissingReason({
          actualAvg,
          predictedAvg,
          hasHistory: forecastPredictionCount > 0,
        }),
        prediction_count: predictedCountByDate.get(date) || 0,
        first_prediction_at: firstPredictionByDate.get(date) || null,
        last_prediction_at: lastPredictionByDate.get(date) || null,
      };
    });

    return {
      sensor_type: 'humidity',
      days: normalizedDays,
      prediction_source: 'same_day_future_forecast',
      forecast_prediction_count: forecastPredictionCount,
      historical_prediction_count: forecastPredictionCount,
      cache_generated_at: cached?.generated_at || null,
      forecast_generated_at: latestForecastGeneratedAt,
      history_generated_at: latestForecastGeneratedAt,
      rows,
    };
  },

  async processForecastAlerts(forecastResult) {
    if (!forecastResult || !Array.isArray(forecastResult.predictions)) {
      return { triggered: false, reason: 'invalid-forecast-payload' };
    }

    const threshold = await getSettingNumber('forecast_humidity_warning_threshold', 40);
    const minConfidence = await getSettingNumber('forecast_humidity_min_confidence', 0.7);
    const horizonHours = Number(forecastResult.horizon_hours || 24);

    const riskyPoint = forecastResult.predictions.find((point) => {
      const value = Number(point?.value);
      const confidence = Number(point?.confidence ?? forecastResult.confidence ?? 0);
      return Number.isFinite(value)
        && Number.isFinite(confidence)
        && value < threshold
        && confidence >= minConfidence;
    });

    if (!riskyPoint) {
      return { triggered: false, reason: 'no-threshold-breach' };
    }

    const alertKey = buildAlertKey(threshold, horizonHours);
    if (!shouldSendAlert(alertKey)) {
      return { triggered: false, reason: 'debounced' };
    }

    const title = 'Cảnh báo AI: Dự báo độ ẩm thấp';
    const message = `AI dự báo độ ẩm sẽ xuống ${Number(riskyPoint.value).toFixed(1)}% (ngưỡng ${threshold}%) trong ${horizonHours} giờ tới.`;

    const count = await notifyAllUsers({ title, message });

    return {
      triggered: true,
      threshold,
      minConfidence,
      usersNotified: count,
      firstBreachAt: riskyPoint.timestamp,
    };
  },
};

module.exports = aiForecastService;
