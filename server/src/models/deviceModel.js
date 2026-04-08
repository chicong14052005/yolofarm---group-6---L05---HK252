const pool = require('../config/db');

const DeviceModel = {
  async findAll() {
    const [rows] = await pool.query('SELECT * FROM devices ORDER BY id');
    return rows;
  },

  async findByType(deviceType) {
    const [rows] = await pool.query('SELECT * FROM devices WHERE device_type = ?', [deviceType]);
    return rows[0];
  },

  async updateStatus(deviceType, status) {
    await pool.query('UPDATE devices SET status = ?, last_toggled_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) WHERE device_type = ?', [status, deviceType]);
    return this.findByType(deviceType);
  }
};

module.exports = DeviceModel;
