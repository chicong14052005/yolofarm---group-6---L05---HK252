const pool = require('../config/db');

const SettingsModel = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM settings ORDER BY setting_key');
    return rows;
  },

  async get(key) {
    const [rows] = await pool.query('SELECT * FROM settings WHERE setting_key = ?', [key]);
    return rows[0];
  },

  async set(key, value) {
    await pool.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [key, value, value]
    );
    return this.get(key);
  }
};

module.exports = SettingsModel;
