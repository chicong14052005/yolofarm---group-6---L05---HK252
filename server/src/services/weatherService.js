const axios = require('axios');
const adafruitConfig = require('../config/adafruit');
const SensorDataModel = require('../models/sensorDataModel');
const notificationService = require('./notificationService');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_PARAMS = {
  latitude: 10.823,
  longitude: 106.6296,
  current: 'temperature_2m,relative_humidity_2m,is_day',
  hourly: 'soil_moisture_3_to_9cm',
  minutely_15: 'direct_radiation',
  timezone: 'auto',
  forecast_days: 1,
};

let io = null;

const weatherService = {
  setSocketIO(socketIo) {
    io = socketIo;
  },

  async fetchAndPublish() {
    try {
      console.log('[Weather] Đang lấy dữ liệu từ Open-Meteo...');
      const { data } = await axios.get(OPEN_METEO_URL, { params: OPEN_METEO_PARAMS });

      // 1. Temperature (°C) — lấy trực tiếp từ current
      const temperature = data.current.temperature_2m;

      // 2. Humidity (%) — lấy trực tiếp từ current
      const humidity = data.current.relative_humidity_2m;

      // 3. Soil Moisture (%) — lấy giờ gần nhất từ hourly, chuyển m³/m³ → %
      const now = new Date();
      const currentHour = now.getHours();
      const soilMoistureRaw = data.hourly.soil_moisture_3_to_9cm[currentHour] || 0.2;
      const soilMoisture = Math.round(soilMoistureRaw * 100);

      // 4. Light Intensity (lux) — chuyển đổi từ direct_radiation (W/m²)
      const isDay = data.current.is_day;
      let lightIntensity = 0;
      if (isDay === 1 && data.minutely_15 && data.minutely_15.direct_radiation) {
        // Tìm mốc minutely_15 gần nhất
        const minuteIndex = Math.min(
          Math.floor((currentHour * 60 + now.getMinutes()) / 15),
          data.minutely_15.direct_radiation.length - 1
        );
        const radiation = data.minutely_15.direct_radiation[minuteIndex] || 0;
        lightIntensity = Math.round(radiation * 120); // W/m² → lux (xấp xỉ)
      }

      console.log(`[Weather] Dữ liệu: temp=${temperature}°C, hum=${humidity}%, soil=${soilMoisture}%, light=${lightIntensity}lux`);

      // Gửi lên Adafruit IO + lưu DB + emit socket
      const sensorData = [
        { type: 'temperature', value: temperature, feed: adafruitConfig.feeds.temperature },
        { type: 'humidity', value: humidity, feed: adafruitConfig.feeds.humidity },
        { type: 'soil_moisture', value: soilMoisture, feed: adafruitConfig.feeds.soilMoisture },
        { type: 'light', value: lightIntensity, feed: adafruitConfig.feeds.light },
      ];

      for (const sensor of sensorData) {
        try {
          // Gửi lên Adafruit IO
          const url = `${adafruitConfig.restApiUrl}/${adafruitConfig.username}/feeds/${sensor.feed}/data`;
          await axios.post(url, { value: String(sensor.value) }, {
            headers: { 'X-AIO-Key': adafruitConfig.key }
          });

          // Lưu vào DB
          await SensorDataModel.create({
            sensor_type: sensor.type,
            value: sensor.value,
            feed_key: sensor.feed,
          });

          // Emit qua socket cho frontend
          if (io) {
            io.emit('sensorData', { type: sensor.type, value: sensor.value, timestamp: new Date() });
          }

          console.log(`[Weather] Đã gửi ${sensor.type}: ${sensor.value}`);

          // Kiểm tra ngưỡng cảnh báo
          await notificationService.checkSensorThresholds(sensor.type, sensor.value);

          // Delay 1 giây giữa các request để tránh rate limit Adafruit
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`[Weather] Lỗi gửi ${sensor.type}:`, err.message);
        }
      }

      console.log('[Weather] Hoàn tất cập nhật dữ liệu');
    } catch (err) {
      console.error('[Weather] Lỗi lấy dữ liệu Open-Meteo:', err.message);
    }
  }
};

module.exports = weatherService;
