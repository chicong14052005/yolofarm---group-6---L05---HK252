const PreferencesModel = require('../models/preferencesModel');

const preferencesController = {
  async get(req, res) {
    try {
      const prefs = await PreferencesModel.getByUserId(req.user.id);
      res.json(prefs || { theme: 'light', locale: 'vi', primary_color: '#2BAE66', border_radius: 8, layout_mode: 'desktop', font_family: "'Inter'" });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async update(req, res) {
    try {
      await PreferencesModel.upsert(req.user.id, req.body);
      res.json({ message: 'Đã lưu tùy chọn' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
};

module.exports = preferencesController;
