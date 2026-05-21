const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt');
const adafruitConfig = require('../config/adafruit');
const SensorDataModel = require('../models/sensorDataModel');
const DeviceModel = require('../models/deviceModel');

let client = null;
let io = null;

const mqttClientId = process.env.MQTT_CLIENT_ID
  || (process.env.NODE_ENV === 'production'
    ? 'yolofarm-render-mqtt-writer'
    : `yolofarm-local-${Math.random().toString(16).slice(2, 10)}`);

const sensorFeedMap = {
  [adafruitConfig.feeds.temperature]: 'temperature',
  [adafruitConfig.feeds.humidity]: 'humidity',
  [adafruitConfig.feeds.soilMoisture]: 'soil_moisture',
  [adafruitConfig.feeds.light]: 'light'
};

const deviceFeedMap = {
  [adafruitConfig.feeds.pump1]: 'pump1',
  [adafruitConfig.feeds.pump2]: 'pump2',
  [adafruitConfig.feeds.led]: 'led_rgb'
};

const mqttService = {
  init(socketIo) {
    io = socketIo;

    if (client && client.connected) {
      console.log('[MQTT] Kết nối đã tồn tại, bỏ qua init trùng');
      return;
    }

    if (!adafruitConfig.username || !adafruitConfig.key) {
      console.log('[MQTT] Chưa cấu hình Adafruit IO, bỏ qua kết nối MQTT');
      return;
    }

    client = mqtt.connect(mqttConfig.broker, {
      port: mqttConfig.port,
      username: mqttConfig.username,
      password: mqttConfig.password,
      clientId: mqttClientId,
      ...mqttConfig.options
    });

    client.on('connect', () => {
      console.log('[MQTT] Đã kết nối đến Adafruit IO');
      // Subscribe tất cả feeds
      const allFeeds = [...Object.values(adafruitConfig.feeds)];
      allFeeds.forEach(feed => {
        const topic = `${adafruitConfig.username}/feeds/${feed}`;
        client.subscribe(topic, (err) => {
          if (!err) console.log(`[MQTT] Subscribed: ${topic}`);
        });
      });
    });

    client.on('message', async (topic, message) => {
      try {
        const feedKey = topic.split('/').pop();
        const value = parseFloat(message.toString());

        if (sensorFeedMap[feedKey]) {
          // Lưu dữ liệu cảm biến vào DB
          const inserted = await SensorDataModel.create({
            sensor_type: sensorFeedMap[feedKey],
            value,
            feed_key: feedKey
          });

          if (!inserted) {
            console.log(`[MQTT] Bỏ qua dữ liệu trùng (${sensorFeedMap[feedKey]}=${value})`);
            return;
          }

          // Push realtime đến Frontend
          if (io) {
            const recordedAt = inserted.recorded_at || new Date();
            io.emit('sensorData', {
              type: sensorFeedMap[feedKey],
              value,
              recorded_at: recordedAt,
              timestamp: recordedAt
            });
          }
        }

        if (deviceFeedMap[feedKey]) {
          const status = value >= 1 ? 'on' : 'off';
          await DeviceModel.updateStatus(deviceFeedMap[feedKey], status);
          if (io) {
            io.emit('deviceStatus', { type: deviceFeedMap[feedKey], status });
          }
        }
      } catch (err) {
        console.error('[MQTT] Lỗi xử lý message:', err.message);
      }
    });

    client.on('error', (err) => {
      console.error('[MQTT] Lỗi:', err.message);
    });

    client.on('reconnect', () => {
      console.log('[MQTT] Đang kết nối lại...');
    });
  },

  publish(feed, value) {
    if (!client) return;
    const topic = `${adafruitConfig.username}/feeds/${feed}`;
    client.publish(topic, String(value), { qos: 1 });
  },

  disconnect() {
    if (client) {
      client.end();
      client = null;
    }
  }
};

module.exports = mqttService;
