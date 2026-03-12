const DeviceModel = require('../models/deviceModel');
const adafruitConfig = require('../config/adafruit');
const axios = require('axios');
const pool = require('../config/db');

// Mapping device_type (DB) → config key (adafruit.js feeds)
const DEVICE_TO_FEED_MAP = {
  pump1: 'pump1',
  pump2: 'pump2',
  led_rgb: 'led',
};

const deviceController = {
  async getAll(req, res) {
    try {
      const devices = await DeviceModel.findAll();
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async control(req, res) {
    try {
      const { device_type, action, status: statusParam } = req.body;
      const status = statusParam || (action === 'on' ? 'on' : 'off');
      const value = status === 'on' ? '1' : '0';

      // Gửi lệnh lên Adafruit IO qua REST API
      const configKey = DEVICE_TO_FEED_MAP[device_type] || device_type;
      const feedKey = adafruitConfig.feeds[configKey] || device_type;
      const url = `${adafruitConfig.restApiUrl}/${adafruitConfig.username}/feeds/${feedKey}/data`;
      await axios.post(url, { value }, {
        headers: { 'X-AIO-Key': adafruitConfig.key }
      });

      // Cập nhật status + last_toggled_at trong DB
      await pool.query(
        'UPDATE devices SET status = ?, last_toggled_at = NOW(), manual_override = TRUE WHERE device_type = ?',
        [status, device_type]
      );
      const device = await DeviceModel.findByType(device_type);
      res.json({ message: `Đã ${status === 'on' ? 'bật' : 'tắt'} ${device_type}`, device });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getStatus(req, res) {
    try {
      const { type } = req.params;
      const device = await DeviceModel.findByType(type);
      if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
      res.json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = deviceController;
