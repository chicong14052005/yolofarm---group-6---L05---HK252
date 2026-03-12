require('dotenv').config();

module.exports = {
  broker: 'mqtts://io.adafruit.com',
  port: 8883,
  username: process.env.AIO_USERNAME || '',
  password: process.env.AIO_KEY || '',
  options: {
    keepalive: 60,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    clean: true
  }
};
