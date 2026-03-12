require('dotenv').config();

module.exports = {
  username: process.env.AIO_USERNAME || '',
  key: process.env.AIO_KEY || '',
  feeds: {
    temperature: process.env.AIO_FEED_TEMPERATURE || 'yolofarm.temperature',
    humidity: process.env.AIO_FEED_HUMIDITY || 'yolofarm.humidity',
    soilMoisture: process.env.AIO_FEED_SOIL_MOISTURE || 'yolofarm.soil_moisture',
    light: process.env.AIO_FEED_LIGHT || 'yolofarm.light',
    pump1: process.env.AIO_FEED_PUMP1 || 'yolofarm.pump1',
    pump2: process.env.AIO_FEED_PUMP2 || 'yolofarm.pump2',
    led: process.env.AIO_FEED_LED || 'yolofarm.led_rgb'
  },
  restApiUrl: 'https://io.adafruit.com/api/v2'
};
