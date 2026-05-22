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
  return Number.isNaN(date.getTime()) ? null : formatDateLocal(date);
};

const toApiDateTime = (value) => {
  const dateTime = toMySqlDateTime(value);
  return dateTime ? dateTime.replace(' ', 'T') : null;
};

const toNullableNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildRunId = (sensorType, generatedAt) => {
  const stamp = String(generatedAt || formatDateLocal(new Date()) || Date.now())
    .replace(/[^\d]/g, '')
    .slice(0, 14);
  return `${sensorType}-${stamp}-${Date.now().toString(36)}`;
};

const ForecastHistoryModel = {
  async saveForecastRun(sensorType, forecastData) {
    const {
      historical_predictions = [],
      predictions = [],
      model_version = null,
      horizon_hours = 24,
      interval_minutes = 15,
      generated_at = null,
      fallback = false,
    } = forecastData;

    const generatedAt = toMySqlDateTime(generated_at) || formatDateLocal(new Date());
    const runId = buildRunId(sensorType, generatedAt);

    const rows = [];
    for (const point of historical_predictions) {
      rows.push([
        sensorType,
        runId,
        'historical',
        toMySqlDateTime(point.timestamp),
        toNullableNumber(point.actual),
        toNullableNumber(point.predicted),
        null,
        null,
        null,
        model_version,
        horizon_hours,
        interval_minutes,
        generatedAt,
        Boolean(fallback),
      ]);
    }

    for (const point of predictions) {
      rows.push([
        sensorType,
        runId,
        'future',
        toMySqlDateTime(point.timestamp),
        null,
        toNullableNumber(point.value),
        toNullableNumber(point.lower),
        toNullableNumber(point.upper),
        toNullableNumber(point.confidence),
        model_version,
        horizon_hours,
        interval_minutes,
        generatedAt,
        Boolean(fallback),
      ]);
    }

    const validRows = rows.filter((row) => row[3] && row[5] !== null);
    if (validRows.length === 0) {
      return { run_id: runId, inserted: 0 };
    }

    await db.query(
      `INSERT INTO forecast_history
       (sensor_type, run_id, point_type, target_timestamp, actual_value, predicted_value,
        lower_value, upper_value, confidence, model_version, horizon_hours, interval_minutes,
        generated_at, fallback)
       VALUES ?`,
      [validRows]
    );

    return { run_id: runId, inserted: validRows.length };
  },

  async getHistoricalDailyAverages({ sensorType = 'humidity', startDate, endDate }) {
    const [rows] = await db.query(
      `SELECT
         DATE(fh.target_timestamp) AS date,
         ROUND(AVG(fh.predicted_value), 2) AS predicted_avg,
         COUNT(*) AS predicted_count,
         MAX(fh.generated_at) AS latest_generated_at
       FROM forecast_history fh
       INNER JOIN (
         SELECT MAX(id) AS id
         FROM forecast_history
         WHERE sensor_type = ?
           AND point_type = 'historical'
           AND target_timestamp >= ?
           AND target_timestamp < ?
           AND predicted_value IS NOT NULL
         GROUP BY target_timestamp
       ) latest ON latest.id = fh.id
       GROUP BY DATE(fh.target_timestamp)`,
      [sensorType, `${startDate} 00:00:00`, `${endDate} 00:00:00`]
    );

    return rows.map((row) => ({
      date: toApiDateTime(row.date)?.slice(0, 10) || String(row.date).slice(0, 10),
      predicted_avg: toNullableNumber(row.predicted_avg),
      predicted_count: Number(row.predicted_count || 0),
      latest_generated_at: toApiDateTime(row.latest_generated_at),
    }));
  },

  async getSameDayFutureDailyAverages({ sensorType = 'humidity', startDate, endDate }) {
    const windowStart = `${startDate} 00:00:00`;
    const windowEnd = `${endDate} 00:00:00`;

    const [rows] = await db.query(
      `SELECT
         DATE(fh.target_timestamp) AS date,
         ROUND(AVG(fh.predicted_value), 2) AS predicted_avg,
         COUNT(*) AS predicted_count,
         MIN(fh.target_timestamp) AS first_prediction_at,
         MAX(fh.target_timestamp) AS last_prediction_at,
         MAX(fh.generated_at) AS latest_generated_at
       FROM forecast_history fh
       INNER JOIN (
         SELECT DATE(generated_at) AS forecast_date, MAX(generated_at) AS latest_generated_at
         FROM forecast_history
         WHERE sensor_type = ?
           AND point_type = 'future'
           AND generated_at >= ?
           AND generated_at < ?
           AND predicted_value IS NOT NULL
         GROUP BY DATE(generated_at)
       ) latest
         ON DATE(fh.generated_at) = latest.forecast_date
        AND fh.generated_at = latest.latest_generated_at
       WHERE fh.sensor_type = ?
         AND fh.point_type = 'future'
         AND fh.predicted_value IS NOT NULL
         AND fh.generated_at >= ?
         AND fh.generated_at < ?
         AND fh.target_timestamp >= fh.generated_at
         AND DATE(fh.target_timestamp) = DATE(fh.generated_at)
       GROUP BY DATE(fh.target_timestamp)`,
      [sensorType, windowStart, windowEnd, sensorType, windowStart, windowEnd]
    );

    return rows.map((row) => ({
      date: toApiDateTime(row.date)?.slice(0, 10) || String(row.date).slice(0, 10),
      predicted_avg: toNullableNumber(row.predicted_avg),
      predicted_count: Number(row.predicted_count || 0),
      first_prediction_at: toApiDateTime(row.first_prediction_at),
      last_prediction_at: toApiDateTime(row.last_prediction_at),
      latest_generated_at: toApiDateTime(row.latest_generated_at),
    }));
  },
};

module.exports = ForecastHistoryModel;
