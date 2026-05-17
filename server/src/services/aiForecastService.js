const axios = require('axios');
const pool = require('../config/db');
const SettingsModel = require('../models/settingsModel');
const NotificationModel = require('../models/notificationModel');
const ForecastCacheModel = require('../models/forecastCacheModel');
const socketManager = require('../config/socketManager');

const ALERT_DEBOUNCE_MS = Math.max(Number(process.env.FORECAST_ALERT_DEBOUNCE_MS || 15 * 60 * 1000), 0);
const FORECAST_TIMEOUT_MS = Math.max(Number(process.env.FORECAST_REQUEST_TIMEOUT_MS || 120000), 1000);
const FORECAST_CACHE_TTL_MS = Math.max(Number(process.env.FORECAST_CACHE_TTL_MS || 10 * 60 * 1000), 0);

const lastForecastAlertSentAt = new Map();
let lastForecastCache = null;

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

const aiForecastService = {
  async getCachedForecast({ sensor_type = 'humidity' } = {}) {
    return ForecastCacheModel.getBySensorType(sensor_type);
  },

  async saveForecastCache({ sensor_type = 'humidity', ...forecastData }) {
    await ForecastCacheModel.upsert(sensor_type, forecastData);
  },

  async predictHumidity({ history_hours = 72, horizon_hours = 24, confidence_threshold = 0.7 } = {}) {
    const aiUrl = process.env.AI_API_URL || 'http://localhost:8000';
    const aiToken = process.env.AI_SERVICE_TOKEN;

    const payload = {
      sensor_type: 'humidity',
      history_hours,
      horizon_hours,
      confidence_threshold,
    };

    try {
      const response = await axios.post(`${aiUrl}/forecast/humidity`, payload, {
        timeout: FORECAST_TIMEOUT_MS,
        headers: aiToken
          ? { Authorization: `Bearer ${aiToken}` }
          : undefined,
      });

      lastForecastCache = {
        data: response.data,
        cachedAt: Date.now(),
      };

      return response.data;
    } catch (error) {
      if (lastForecastCache && Date.now() - lastForecastCache.cachedAt <= FORECAST_CACHE_TTL_MS) {
        return {
          ...lastForecastCache.data,
          cache_fallback: true,
          cache_age_ms: Date.now() - lastForecastCache.cachedAt,
        };
      }

      throw error;
    }
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
