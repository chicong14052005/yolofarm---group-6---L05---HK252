const db = require('../config/db');

const PreferencesModel = {
  async getByUserId(userId) {
    const [rows] = await db.query('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
    return rows[0];
  },
  async upsert(userId, prefs) {
    const { theme, locale, primary_color, border_radius, layout_mode, font_family } = prefs;
    const values = [
      theme || 'light', locale || 'vi', primary_color || '#2BAE66',
      border_radius || 8, layout_mode || 'desktop', font_family || "'Inter'"
    ];
    await db.query(
      `INSERT INTO user_preferences (user_id, theme, locale, primary_color, border_radius, layout_mode, font_family)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         theme = ?, locale = ?, primary_color = ?,
         border_radius = ?, layout_mode = ?, font_family = ?`,
      [userId, ...values, ...values]
    );
  }
};

module.exports = PreferencesModel;
