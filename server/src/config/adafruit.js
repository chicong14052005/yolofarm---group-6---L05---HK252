require('dotenv').config();

module.exports = {
  username: process.env.AIO_USERNAME || '',
  key: process.env.AIO_KEY || '',
  feeds: {
    temperature: process.env.AIO_FEED_TEMPERATURE || '',
    humidity: process.env.AIO_FEED_HUMIDITY || '',
    soilMoisture: process.env.AIO_FEED_SOIL_MOISTURE || '',
    light: process.env.AIO_FEED_LIGHT || '',
    pump1: process.env.AIO_FEED_PUMP1 || '',
    pump2: process.env.AIO_FEED_PUMP2 || '',
    led: process.env.AIO_FEED_LED || ''
  },
  restApiUrl: 'https://io.adafruit.com/api/v2'
};
