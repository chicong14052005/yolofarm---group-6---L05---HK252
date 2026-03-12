const db = require('../config/db');

const PreferencesModel = {
  async getByUserId(userId) {
    const [rows] = await db.query('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
    return rows[0];
  },
  async upsert(userId, prefs) {
    const { theme, locale, primary_color, border_radius, layout_mode, font_family } = prefs;
    await db.query(
      `INSERT INTO user_preferences (user_id, theme, locale, primary_color, border_radius, layout_mode, font_family)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE theme=VALUES(theme), locale=VALUES(locale),
       primary_color=VALUES(primary_color), border_radius=VALUES(border_radius),
       layout_mode=VALUES(layout_mode), font_family=VALUES(font_family)`,
      [userId, theme || 'light', locale || 'vi', primary_color || '#2BAE66', border_radius || 8, layout_mode || 'desktop', font_family || "'Inter'"]
    );
  }
};

module.exports = PreferencesModel;
