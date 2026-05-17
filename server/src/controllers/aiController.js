const axios = require('axios');
const path = require('path');
const aiForecastService = require('../services/aiForecastService');

const aiController = {
  async getCachedForecast(req, res) {
    try {
      const cached = await aiForecastService.getCachedForecast({ sensor_type: 'humidity' });
      if (!cached) {
        return res.json({
          sensor_type: 'humidity',
          predictions: [],
          historical_predictions: [],
          generated_at: null,
          cache_status: 'empty',
        });
      }

      res.json({
        ...cached,
        cache_status: 'cached',
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi đọc cache dự báo: ' + err.message });
    }
  },

  async predict(req, res) {
    try {
      const { sensor_type, hours = 24 } = req.body;
      const aiUrl = process.env.AI_API_URL || 'http://localhost:8000';
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
      } = req.body || {};

      const forecast = await aiForecastService.predictHumidity({
        history_hours: Number(history_hours),
        horizon_hours: Number(horizon_hours),
        confidence_threshold: Number(confidence_threshold),
      });

      const alertStatus = await aiForecastService.processForecastAlerts(forecast);

      const responseData = {
        ...forecast,
        alert_status: alertStatus,
      };

      await aiForecastService.saveForecastCache({
        sensor_type: 'humidity',
        ...responseData,
      }).catch((cacheErr) => {
        console.error('Failed to save forecast cache:', cacheErr.message);
      });

      res.json(responseData);
    } catch (err) {
      res.status(500).json({
        error: 'Lỗi dự báo độ ẩm: ' + err.message,
      });
    }
  },

  async detectDisease(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng upload ảnh' });
      }
      const aiUrl = process.env.AI_API_URL || 'http://localhost:8000';
      const FormData = require('form-data');
      const fs = require('fs');
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const response = await axios.post(`${aiUrl}/detect-disease`, formData, {
        headers: formData.getHeaders()
      });
      res.json(response.data);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi nhận diện sâu bệnh: ' + err.message });
    }
  }
};

module.exports = aiController;
