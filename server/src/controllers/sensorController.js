const SensorDataModel = require('../models/sensorDataModel');

const sensorController = {
  async getLatest(req, res) {
    try {
      const data = await SensorDataModel.getLatest();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getHistory(req, res) {
    try {
      const { type } = req.params;
      const { hours = 24, date } = req.query;
      const data = date
        ? await SensorDataModel.getHistory(type, { date: String(date) })
        : await SensorDataModel.getHistory(type, Number.parseInt(hours, 10) || 24);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getStats(req, res) {
    try {
      const { type } = req.params;
      const { hours = 24 } = req.query;
      const stats = await SensorDataModel.getStats(type, parseInt(hours));
      res.json(stats || {});
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = sensorController;
