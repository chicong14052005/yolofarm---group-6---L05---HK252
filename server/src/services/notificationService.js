const NotificationModel = require('../models/notificationModel');
const pool = require('../config/db');
const socketManager = require('../config/socketManager');

const THRESHOLDS = {
  temperature: { min: 10, max: 40, unit: '°C', label: 'Nhiệt độ' },
  humidity: { min: 40, max: 100, unit: '%', label: 'Độ ẩm không khí' },
  soil_moisture: { min: 15, max: 60, unit: '%', label: 'Độ ẩm đất' },
  light: { min: null, max: 75000, unit: ' lux', label: 'Cường độ ánh sáng' },
};

// Debounce: không gửi cùng loại cảnh báo quá gần nhau (15 phút)
const lastAlertTime = {};

const notificationService = {
  async createAlert(userId, type, title, message) {
    return NotificationModel.create({ user_id: userId, type, title, message });
  },

  async checkSensorThresholds(sensorType, value) {
    const config = THRESHOLDS[sensorType];
    if (!config) return;

    let isWarning = false;
    let direction = '';

    if (config.min !== null && value <= config.min) {
      isWarning = true;
      direction = `dưới ngưỡng tối thiểu (${config.min}${config.unit})`;
    } else if (value >= config.max) {
      isWarning = true;
      direction = `trên ngưỡng tối đa (${config.max}${config.unit})`;
    }

    if (!isWarning) return;

    // Debounce: 15 phút
    const key = `${sensorType}_warning`;
    const now = Date.now();
    if (lastAlertTime[key] && now - lastAlertTime[key] < 15 * 60 * 1000) return;
    lastAlertTime[key] = now;

    // Lấy tất cả users
    const [users] = await pool.query('SELECT id FROM users');
    const title = `Cảnh báo ${config.label}`;
    const message = `Cảnh báo: ${config.label} được ghi nhận hiện tại là ${value}${config.unit}, ${direction}. Điều này có thể ảnh hưởng xấu đến cây trồng của bạn.`;

    const io = socketManager.getIO();
    for (const user of users) {
      await NotificationModel.create({
        user_id: user.id, type: 'warning', title, message
      });
      if (io) {
        io.to(`user_${user.id}`).emit('notification', { type: 'warning', title, message });
      }
    }
    console.log(`[Notification] Cảnh báo ${sensorType}: ${value}${config.unit} → gửi ${users.length} users`);
  },

  async sendScheduleReminder(userId, scheduleName, startTime) {
    const title = 'Lịch trình sắp diễn ra';
    const message = `Sự kiện "${scheduleName}" sẽ bắt đầu lúc ${startTime}. Chỉ còn 5 phút nữa!`;
    await NotificationModel.create({
      user_id: userId, type: 'info', title, message
    });
    const io = socketManager.getIO();
    if (io) {
      io.to(`user_${userId}`).emit('notification', { type: 'info', title, message });
    }
    console.log(`[Notification] Reminder: "${scheduleName}" cho user ${userId}`);
  },

  async sendScheduleStarted(userId, scheduleName, deviceType, startTime) {
    const title = 'Thiết bị đã được bật tự động';
    const message = `Sự kiện "${scheduleName}" đã bắt đầu lúc ${startTime}. Thiết bị ${deviceType} đã được BẬT tự động theo lịch trình.`;
    await NotificationModel.create({
      user_id: userId, type: 'info', title, message
    });
    const io = socketManager.getIO();
    if (io) {
      io.to(`user_${userId}`).emit('notification', { type: 'info', title, message });
    }
    console.log(`[Notification] Schedule started: "${scheduleName}" → ${deviceType} ON`);
  },

  async sendScheduleEnded(userId, scheduleName, deviceType, endTime) {
    const title = 'Thiết bị đã được tắt tự động';
    const message = `Sự kiện "${scheduleName}" đã kết thúc lúc ${endTime}. Thiết bị ${deviceType} đã được TẮT tự động.`;
    await NotificationModel.create({
      user_id: userId, type: 'info', title, message
    });
    const io = socketManager.getIO();
    if (io) {
      io.to(`user_${userId}`).emit('notification', { type: 'info', title, message });
    }
    console.log(`[Notification] Schedule ended: "${scheduleName}" → ${deviceType} OFF`);
  }
};

module.exports = notificationService;
