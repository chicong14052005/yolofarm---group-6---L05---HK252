const axios = require('axios');
const adafruitConfig = require('../config/adafruit');
const notificationService = require('./notificationService');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const OPEN_METEO_PARAMS = {
  latitude: 10.823,
  longitude: 106.6296,
  current: 'temperature_2m,relative_humidity_2m,is_day',
  hourly: 'soil_moisture_3_to_9cm',
  minutely_15: 'direct_radiation',
  timezone: 'auto',
  forecast_days: 1,
};

const WEATHER_USER_AGENT =
  process.env.WEATHER_USER_AGENT ||
  'YoloFarm-SmartAgricultureApp/1.0 (contact: admin@yolofarm.local)';

let isFetching = false;
let lastSuccessfulWeather = null;

let io = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getVietnamNow = () => {
  const now = new Date();
  const vnDateText = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  return new Date(vnDateText);
};

const normalizeOpenMeteoData = (data) => {
  const temperature = Number(data.current.temperature_2m);
  const humidity = Number(data.current.relative_humidity_2m);

  const now = getVietnamNow();
  const currentHour = now.getHours();
  const soilMoistureRaw = data.hourly.soil_moisture_3_to_9cm[currentHour] || 0.2;
  const soilMoisture = Math.round(Number(soilMoistureRaw) * 100);

  const isDay = Number(data.current.is_day) === 1;
  let lightIntensity = 0;
  if (isDay && data.minutely_15 && data.minutely_15.direct_radiation) {
    const minuteIndex = Math.min(
      Math.floor((currentHour * 60 + now.getMinutes()) / 15),
      data.minutely_15.direct_radiation.length - 1
    );
    const radiation = Number(data.minutely_15.direct_radiation[minuteIndex] || 0);
    lightIntensity = Math.round(radiation * 120);
  }

  return {
    source: 'open-meteo',
    temperature,
    humidity,
    soilMoisture,
    lightIntensity,
  };
};

const fetchFromOpenMeteo = async () => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.get(OPEN_METEO_URL, {
        params: OPEN_METEO_PARAMS,
        timeout: 10000,
        headers: {
          'User-Agent': WEATHER_USER_AGENT,
          Accept: 'application/json',
        },
      });

      return normalizeOpenMeteoData(response.data);
    } catch (error) {
      const status = error.response?.status;
      const retryAfterHeader = error.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      const backoffMs = retryAfterMs || attempt * 2000;

      // Retry only for rate limit and transient upstream errors.
      const shouldRetry = status === 429 || !status || status >= 500;
      if (!shouldRetry || attempt === maxAttempts) {
        throw error;
      }

      console.warn(`[Weather] Open-Meteo attempt ${attempt}/${maxAttempts} failed (status=${status || 'timeout'}). Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }

  throw new Error('Open-Meteo retry exhausted');
};

const fetchFromMetNo = async () => {
  const response = await axios.get(MET_NO_URL, {
    params: {
      lat: OPEN_METEO_PARAMS.latitude,
      lon: OPEN_METEO_PARAMS.longitude,
    },
    timeout: 10000,
    headers: {
      'User-Agent': WEATHER_USER_AGENT,
      Accept: 'application/json',
    },
  });

  const timeseries = response.data?.properties?.timeseries || [];
  if (!timeseries.length) {
    throw new Error('MET.no trả về dữ liệu rỗng');
  }

  const current = timeseries[0]?.data || {};
  const details = current.instant?.details || {};
  const precipitation1h = current.next_1_hours?.details?.precipitation_amount || 0;

  const temperature = Number(details.air_temperature || 30);
  const humidity = Math.round(Number(details.relative_humidity || 70));
  const cloudPercent = Math.round(Number(details.cloud_area_fraction || 40));

  const vnNow = getVietnamNow();
  const hour = vnNow.getHours();
  const isDay = hour >= 6 && hour < 18;

  // Approximate soil moisture from humidity + precipitation when fallback source lacks soil sensor.
  const soilMoisture = clamp(Math.round(humidity * 0.35 + Number(precipitation1h) * 8 + 20), 10, 90);
  const estimatedRadiation = isDay ? Math.max(0, ((100 - cloudPercent) / 100) * 700) : 0;
  const lightIntensity = Math.round(estimatedRadiation * 120);

  return {
    source: 'met-no-fallback',
    temperature,
    humidity,
    soilMoisture,
    lightIntensity,
  };
};

const generateMockWeather = () => {
  const vnNow = getVietnamNow();
  const isDay = vnNow.getHours() >= 6 && vnNow.getHours() <= 18;

  const temperature = Number((28 + Math.random() * 5).toFixed(1));
  const humidity = Math.floor(60 + Math.random() * 20);
  const soilMoisture = Math.floor(20 + Math.random() * 40);
  const lightIntensity = isDay ? Math.floor(12000 + Math.random() * 55000) : Math.floor(Math.random() * 1000);

  return {
    source: 'mock-fallback',
    temperature,
    humidity,
    soilMoisture,
    lightIntensity,
  };
};

const weatherService = {
  setSocketIO(socketIo) {
    io = socketIo;
  },

  async fetchAndPublish() {
    if (isFetching) {
      console.log('[Weather] Skip fetch: lần cập nhật trước vẫn đang chạy');
      return;
    }

    isFetching = true;

    try {
      console.log('[Weather] Đang lấy dữ liệu từ Open-Meteo...');
      let weather;

      try {
        weather = await fetchFromOpenMeteo();
      } catch (openMeteoError) {
        console.error('[Weather] Lỗi lấy dữ liệu Open-Meteo:', openMeteoError.message);
        console.log('[Weather] Thử nguồn dự phòng MET.no...');

        try {
          weather = await fetchFromMetNo();
        } catch (metNoError) {
          console.error('[Weather] Lỗi lấy dữ liệu MET.no:', metNoError.message);

          if (lastSuccessfulWeather) {
            weather = {
              ...lastSuccessfulWeather,
              source: 'last-success-cache',
            };
            console.log('[Weather] Dùng lại dữ liệu thành công gần nhất từ cache');
          } else {
            weather = generateMockWeather();
            console.log('[Weather] Dùng dữ liệu mô phỏng vì tất cả nguồn upstream đều lỗi');
          }
        }
      }

      if (weather.source !== 'mock-fallback' && weather.source !== 'last-success-cache') {
        lastSuccessfulWeather = {
          temperature: weather.temperature,
          humidity: weather.humidity,
          soilMoisture: weather.soilMoisture,
          lightIntensity: weather.lightIntensity,
        };
      }

      const temperature = weather.temperature;
      const humidity = weather.humidity;
      const soilMoisture = weather.soilMoisture;
      const lightIntensity = weather.lightIntensity;

      console.log(`[Weather] Dữ liệu: temp=${temperature}°C, hum=${humidity}%, soil=${soilMoisture}%, light=${lightIntensity} lux`);
      console.log(`[Weather] Nguồn dữ liệu: ${weather.source}`);

      // Gửi lên Adafruit IO + emit socket
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
    } finally {
      isFetching = false;
    }
  }
};

module.exports = weatherService;
