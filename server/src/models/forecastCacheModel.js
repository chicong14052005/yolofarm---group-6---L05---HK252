const db = require('../config/db');

const TIMEZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

const pad = (value) => String(value).padStart(2, '0');

const formatDateLocal = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const normalizeLocalDateTimeString = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .replace('T', ' ')
    .replace(/\.\d+/, '')
    .replace(TIMEZONE_SUFFIX_RE, '');

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : null;
};

const toMySqlDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return formatDateLocal(value);
  const localString = normalizeLocalDateTimeString(value);
  if (localString) return localString;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateLocal(date);
};

const toApiDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return formatDateLocal(value)?.replace(' ', 'T') || null;
  }

  const localString = normalizeLocalDateTimeString(value);
  if (localString) return localString.replace(' ', 'T');

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDateLocal(date)?.replace(' ', 'T');
};

const normalizeForecastTimestamp = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(' ', 'T')
    .replace(TIMEZONE_SUFFIX_RE, '');
};

const normalizeForecastPoints = (points) => {
  if (!Array.isArray(points)) return [];
  return points.map((point) => ({
    ...point,
    timestamp: normalizeForecastTimestamp(point.timestamp),
  }));
};

const ForecastCacheModel = {
  async getBySensorType(sensorType) {
    const [rows] = await db.query(
      'SELECT * FROM forecast_cache WHERE sensor_type = ?',
      [sensorType]
    );
    if (!rows[0]) return null;

    const row = rows[0];
    const predictions = typeof row.predictions === 'string' ? JSON.parse(row.predictions) : row.predictions;
    const historicalPredictions = typeof row.historical_predictions === 'string' ? JSON.parse(row.historical_predictions) : row.historical_predictions;

    return {
      ...row,
      predictions: normalizeForecastPoints(predictions),
      historical_predictions: normalizeForecastPoints(historicalPredictions),
      data_summary: typeof row.data_summary === 'string' ? JSON.parse(row.data_summary) : row.data_summary,
      alert_status: typeof row.alert_status === 'string' ? JSON.parse(row.alert_status) : row.alert_status,
      generated_at: toApiDateTime(row.generated_at),
      created_at: toApiDateTime(row.created_at),
      updated_at: toApiDateTime(row.updated_at),
    };
  },

  async upsert(sensorType, data) {
    const {
      predictions = [],
      historical_predictions = [],
      data_summary = null,
      alert_status = null,
      model_version = null,
      horizon_hours = 24,
      interval_minutes = 15,
      generated_at = null,
      fallback = false,
    } = data;

    await db.query(
      `INSERT INTO forecast_cache
       (sensor_type, predictions, historical_predictions, data_summary, alert_status,
        model_version, horizon_hours, interval_minutes, generated_at, fallback)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       predictions = VALUES(predictions),
       historical_predictions = VALUES(historical_predictions),
       data_summary = VALUES(data_summary),
       alert_status = VALUES(alert_status),
       model_version = VALUES(model_version),
       horizon_hours = VALUES(horizon_hours),
       interval_minutes = VALUES(interval_minutes),
       generated_at = VALUES(generated_at),
       fallback = VALUES(fallback)`,
      [
        sensorType,
        JSON.stringify(predictions),
        JSON.stringify(historical_predictions),
        JSON.stringify(data_summary),
        JSON.stringify(alert_status),
        model_version,
        horizon_hours,
        interval_minutes,
        toMySqlDateTime(generated_at),
        fallback,
      ]
    );
  },

  async delete(sensorType) {
    await db.query('DELETE FROM forecast_cache WHERE sensor_type = ?', [sensorType]);
  },
};

module.exports = ForecastCacheModel;
