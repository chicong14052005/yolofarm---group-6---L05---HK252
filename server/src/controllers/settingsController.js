const SettingsModel = require('../models/settingsModel');

const settingsController = {
  async getAll(req, res) {
    try {
      const settings = await SettingsModel.getAll();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const { key, value } = req.body;
      const setting = await SettingsModel.set(key, value);
      res.json(setting);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = settingsController;
