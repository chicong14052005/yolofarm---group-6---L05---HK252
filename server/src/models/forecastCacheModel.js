const db = require('../config/db');

const ForecastCacheModel = {
  async getBySensorType(sensorType) {
    const [rows] = await db.query(
      'SELECT * FROM forecast_cache WHERE sensor_type = ?',
      [sensorType]
    );
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      predictions: typeof row.predictions === 'string' ? JSON.parse(row.predictions) : row.predictions,
      historical_predictions: typeof row.historical_predictions === 'string' ? JSON.parse(row.historical_predictions) : row.historical_predictions,
      data_summary: typeof row.data_summary === 'string' ? JSON.parse(row.data_summary) : row.data_summary,
      alert_status: typeof row.alert_status === 'string' ? JSON.parse(row.alert_status) : row.alert_status,
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
        generated_at,
        fallback,
      ]
    );
  },

  async delete(sensorType) {
    await db.query('DELETE FROM forecast_cache WHERE sensor_type = ?', [sensorType]);
  },
};

module.exports = ForecastCacheModel;
