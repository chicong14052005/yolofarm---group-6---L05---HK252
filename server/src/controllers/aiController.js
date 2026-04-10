const axios = require('axios');
const path = require('path');

const aiController = {
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
