const pool = require('../config/db');

const SENSOR_DEDUP_SECONDS = Math.max(Number(process.env.SENSOR_DEDUP_SECONDS || 8), 0);
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateOnly = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const addDays = (dateText, days) => {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateOnly(date);
};

const normalizeHistoryOptions = (options) => {
  if (typeof options === 'number') {
    return { mode: 'hours', hours: options };
  }

  if (typeof options === 'object' && options !== null) {
    if (options.date && DATE_ONLY_RE.test(String(options.date))) {
      const date = String(options.date);
      return {
        mode: 'range',
        from: `${date} 00:00:00`,
        to: `${addDays(date, 1)} 00:00:00`,
      };
    }

    if (options.from && options.to) {
      return { mode: 'range', from: options.from, to: options.to };
    }
  }

  return { mode: 'hours', hours: 24 };
};

const SensorDataModel = {
  async getLatest() {
    const [rows] = await pool.query(`
      SELECT cur.sensor_type, cur.value, cur.recorded_at,
        ROUND(
          CASE
            WHEN prev.avg_val IS NULL OR prev.avg_val = 0 THEN 0
            ELSE ((cur.value - prev.avg_val) / prev.avg_val) * 100
          END, 1
        ) AS change_pct
      FROM (
        SELECT s1.* FROM sensor_data s1
        INNER JOIN (
          SELECT sensor_type, MAX(id) as max_id
          FROM sensor_data GROUP BY sensor_type
        ) s2 ON s1.id = s2.max_id
      ) cur
      LEFT JOIN (
        SELECT sensor_type, AVG(value) AS avg_val
        FROM sensor_data
        WHERE recorded_at BETWEEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) - INTERVAL 2 HOUR AND DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) - INTERVAL 1 HOUR
        GROUP BY sensor_type
      ) prev ON cur.sensor_type = prev.sensor_type
    `);
    return rows;
  },

  async getHistory(sensorType, options = 24) {
    const normalized = normalizeHistoryOptions(options);

    const [rows] = normalized.mode === 'range'
      ? await pool.query(
        `SELECT *
         FROM sensor_data
         WHERE sensor_type = ?
           AND recorded_at >= ?
           AND recorded_at < ?
         ORDER BY recorded_at ASC`,
        [sensorType, normalized.from, normalized.to]
      )
      : await pool.query(
        'SELECT * FROM sensor_data WHERE sensor_type = ? AND recorded_at >= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) - INTERVAL ? HOUR ORDER BY recorded_at ASC',
        [sensorType, normalized.hours]
      );

    return rows;
  },

  async create({ sensor_type, value, feed_key }) {
    const [result] = await pool.query(
      `INSERT INTO sensor_data (sensor_type, value, feed_key, recorded_at)
       SELECT ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1
         FROM sensor_data
         WHERE sensor_type = ?
           AND feed_key = ?
           AND ABS(value - ?) < 0.0001
           AND recorded_at >= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) - INTERVAL ? SECOND
       )`,
      [sensor_type, value, feed_key, sensor_type, feed_key, value, SENSOR_DEDUP_SECONDS]
    );

    if (!result.affectedRows) {
      return null;
    }

    const [rows] = await pool.query(
      `SELECT id, sensor_type, value, feed_key, recorded_at
       FROM sensor_data
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return rows[0] || { id: result.insertId, sensor_type, value, feed_key };
  },

  async getStats(sensorType, hours = 24) {
    const [rows] = await pool.query(
      `SELECT sensor_type, MIN(value) as min_val, MAX(value) as max_val, AVG(value) as avg_val, COUNT(*) as count
       FROM sensor_data WHERE sensor_type = ? AND recorded_at >= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) - INTERVAL ? HOUR
       GROUP BY sensor_type`,
      [sensorType, hours]
    );
    return rows[0];
  }
};

module.exports = SensorDataModel;
