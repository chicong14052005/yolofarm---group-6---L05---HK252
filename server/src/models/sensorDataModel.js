const pool = require('../config/db');

const SENSOR_DEDUP_SECONDS = Math.max(Number(process.env.SENSOR_DEDUP_SECONDS || 8), 0);

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

  async getHistory(sensorType, hours = 24) {
    const [rows] = await pool.query(
      'SELECT * FROM sensor_data WHERE sensor_type = ? AND recorded_at >= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) - INTERVAL ? HOUR ORDER BY recorded_at ASC',
      [sensorType, hours]
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

    return { id: result.insertId, sensor_type, value, feed_key };
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
