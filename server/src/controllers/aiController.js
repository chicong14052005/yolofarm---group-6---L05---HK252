const axios = require('axios');
const aiForecastService = require('../services/aiForecastService');

const aiController = {
  async getCachedForecast(req, res) {
    try {
      const cached = await aiForecastService.getCachedForecast({ sensor_type: 'humidity' });
      const refreshInProgress = aiForecastService.isForecastRefreshRunning();
      if (!cached) {
        return res.json({
          sensor_type: 'humidity',
          predictions: [],
          historical_predictions: [],
          generated_at: null,
          cache_status: refreshInProgress ? 'refreshing' : 'empty',
          refresh_in_progress: refreshInProgress,
        });
      }

      res.json({
        ...cached,
        cache_status: refreshInProgress ? 'refreshing' : 'cached',
        refresh_in_progress: refreshInProgress,
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi đọc cache dự báo: ' + err.message });
    }
  },

  async predict(req, res) {
    try {
      const { sensor_type, hours = 24 } = req.body;
      const aiUrl = (process.env.AI_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
      const response = await axios.post(`${aiUrl}/predict`, { sensor_type, hours });
      res.json(response.data);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi kết nối đến AI service: ' + err.message });
    }
  },

  async forecastHumidity(req, res) {
    try {
      const {
        history_hours = 72,
        horizon_hours = 24,
        confidence_threshold = 0.7,
        force = true,
      } = req.body || {};

      const forecast = await aiForecastService.predictHumidity({
        history_hours: Number(history_hours),
        horizon_hours: Number(horizon_hours),
        confidence_threshold: Number(confidence_threshold),
        force: force !== false,
      });
      res.json(forecast);
    } catch (err) {
      const cached = await aiForecastService.getCachedForecast({ sensor_type: 'humidity' }).catch(() => null);
      if (cached) {
        return res.json({
          ...cached,
          cache_status: 'stale',
          cache_fallback: true,
          error: 'Lỗi dự báo độ ẩm: ' + err.message,
        });
      }

      res.status(500).json({ error: 'Lỗi dự báo độ ẩm: ' + err.message });
    }
  },

  async getHumidityWeeklySummary(req, res) {
    try {
      const summary = await aiForecastService.getHumidityWeeklySummary({
        days: req.query.days,
      });
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi đọc thống kê độ ẩm: ' + err.message });
    }
  },

  async detectDisease(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng upload ảnh' });
      }
      const aiUrl = (process.env.AI_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname || `upload-${Date.now()}.jpg`,
        contentType: req.file.mimetype || 'application/octet-stream',
        knownLength: req.file.size,
      });

      const response = await axios.post(`${aiUrl}/detect-disease`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000,
      });
      res.json(response.data);
    } catch (err) {
      const upstreamMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message;

      res.status(500).json({ error: 'Lỗi nhận diện sâu bệnh: ' + upstreamMessage });
    }
  }
};

module.exports = aiController;
