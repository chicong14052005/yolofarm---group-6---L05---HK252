const cron = require('node-cron');
const axios = require('axios');
const ScheduleModel = require('../models/scheduleModel');
const DeviceModel = require('../models/deviceModel');
const pool = require('../config/db');
const adafruitConfig = require('../config/adafruit');
const weatherService = require('./weatherService');
const notificationService = require('./notificationService');

// Mapping device_type (DB) → adafruit config key
const DEVICE_TO_FEED_MAP = {
  pump1: 'pump1',
  pump2: 'pump2',
  led_rgb: 'led',
};

// Helper: lấy ngày hiện tại (local) dạng YYYY-MM-DD
const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Helper: tính thời gian kết thúc từ start_time + duration_minutes
// Trả về "HH:MM" (xử lý cross-midnight, ví dụ 23:30 + 90 = 01:00)
const getEndTime = (startTime, durationMinutes) => {
  const [h, m] = startTime.slice(0, 5).split(':').map(Number);
  const totalMinutes = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

// Helper: kiểm tra currentTime có nằm trong khoảng [start, end) không
// Hỗ trợ cross-midnight (ví dụ start=23:00, end=01:00)
const isTimeInRange = (currentTime, startTime, endTime) => {
  if (startTime <= endTime) {
    // same day: 08:00 → 09:30
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // cross-midnight: 23:00 → 01:00
    return currentTime >= startTime || currentTime < endTime;
  }
};

// Helper: gửi lệnh thiết bị lên Adafruit IO + cập nhật DB
const sendDeviceCommand = async (deviceType, value, io) => {
  try {
    const configKey = DEVICE_TO_FEED_MAP[deviceType] || deviceType;
    const feedKey = adafruitConfig.feeds[configKey] || deviceType;
    const url = `${adafruitConfig.restApiUrl}/${adafruitConfig.username}/feeds/${feedKey}/data`;
    await axios.post(url, { value: String(value) }, {
      headers: { 'X-AIO-Key': adafruitConfig.key }
    });
    const status = Number(value) >= 1 ? 'on' : 'off';
    await DeviceModel.updateStatus(deviceType, status);
    if (io) {
      io.emit('deviceStatus', { type: deviceType, status });
    }
    return true;
  } catch (err) {
    console.error(`[Scheduler] Lỗi gửi lệnh ${deviceType}:`, err.message);
    return false;
  }
};

// Reset manual_override flag khi scheduler tự bật thiết bị
const resetManualOverride = async (deviceType) => {
  await pool.query('UPDATE devices SET manual_override = FALSE WHERE device_type = ?', [deviceType]);
};

let socketIo = null;

// Helper: kiểm tra schedule có áp dụng cho ngày hiện tại không
const isScheduleActiveToday = (schedule, todayStr, currentDay) => {
  // Kiểm tra start_date / end_date
  if (schedule.start_date) {
    const startDateStr = typeof schedule.start_date === 'string'
      ? schedule.start_date.slice(0, 10)
      : new Date(schedule.start_date).toISOString().slice(0, 10);
    if (todayStr < startDateStr) return false;
  }
  if (schedule.end_date) {
    const endDateStr = typeof schedule.end_date === 'string'
      ? schedule.end_date.slice(0, 10)
      : new Date(schedule.end_date).toISOString().slice(0, 10);
    if (todayStr > endDateStr) return false;
  }

  const repeatDays = (schedule.repeat_days || 'daily').toLowerCase();
  return repeatDays === 'daily' || repeatDays.includes(currentDay);
};

const schedulerService = {
  /**
   * Startup recovery: kiểm tra các schedule lẽ ra đang chạy ngay lúc server start.
   * Nếu thiết bị đáng lẽ phải ON mà đang OFF → bật lên.
   */
  async recoverOnStartup(io) {
    try {
      const schedules = await ScheduleModel.getActive();
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayStr = getTodayStr();
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const currentDay = days[now.getDay()];

      for (const schedule of schedules) {
        if (!isScheduleActiveToday(schedule, todayStr, currentDay)) continue;

        const deviceType = schedule.device_type;
        if (!deviceType) continue;

        const startTime = schedule.start_time.slice(0, 5);
        const endTime = getEndTime(startTime, schedule.duration_minutes);

        // Nếu hiện tại đang trong khoảng [start, end) → thiết bị lẽ ra phải ON
        if (isTimeInRange(currentTime, startTime, endTime)) {
          const device = await DeviceModel.findByType(deviceType);
          // Nếu user đã tắt thủ công (manual_override=true) → tôn trọng, không bật lại
          if (device && device.manual_override) {
            console.log(`[Scheduler Recovery] ${deviceType} đã bị tắt thủ công, bỏ qua`);
            continue;
          }
          // Nếu thiết bị đang OFF (do server restart) → bật lại
          if (device && device.status === 'off') {
            console.log(`[Scheduler Recovery] Bật lại ${deviceType} (schedule: ${schedule.schedule_name})`);
            await resetManualOverride(deviceType);
            await sendDeviceCommand(deviceType, '1', io);
            await notificationService.sendScheduleStarted(
              schedule.user_id, schedule.schedule_name, deviceType, startTime
            );
          }
        }
      }
      console.log('[Scheduler Recovery] Kiểm tra khôi phục hoàn tất');
    } catch (err) {
      console.error('[Scheduler Recovery] Lỗi:', err.message);
    }
  },

  start(io) {
    socketIo = io;

    // Truyền Socket.IO vào weatherService
    if (io) {
      weatherService.setSocketIO(io);
    }

    // Kiểm tra lịch tưới mỗi phút — cả START lẫn END
    cron.schedule('* * * * *', async () => {
      try {
        const schedules = await ScheduleModel.getActive();
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const todayStr = getTodayStr();
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const currentDay = days[now.getDay()];

        for (const schedule of schedules) {
          if (!isScheduleActiveToday(schedule, todayStr, currentDay)) continue;

          const deviceType = schedule.device_type;
          if (!deviceType) {
            console.error(`[Scheduler] Schedule #${schedule.id} không có device_type`);
            continue;
          }

          const startTime = schedule.start_time.slice(0, 5);
          const endTime = getEndTime(startTime, schedule.duration_minutes);

          // ═══ CHECK START: Đúng giờ bắt đầu → BẬT thiết bị ═══
          if (startTime === currentTime) {
            console.log(`[Scheduler] Bật ${deviceType} theo lịch: ${schedule.schedule_name}`);
            // Reset manual_override để scheduler có thể quản lý
            await resetManualOverride(deviceType);
            await sendDeviceCommand(deviceType, '1', socketIo);
            // Gửi notification: thiết bị đã được bật tự động
            await notificationService.sendScheduleStarted(
              schedule.user_id, schedule.schedule_name, deviceType, startTime
            );
          }

          // ═══ CHECK END: Đúng giờ kết thúc → TẮT thiết bị (nếu vẫn ON) ═══
          if (endTime === currentTime) {
            const device = await DeviceModel.findByType(deviceType);
            if (device && device.status === 'on') {
              // Nếu user đã tắt thủ công rồi bật lại → manual_override = true → tôn trọng
              if (device.manual_override) {
                console.log(`[Scheduler] ${deviceType} đang ở chế độ thủ công, bỏ qua tắt`);
                continue;
              }
              console.log(`[Scheduler] Tắt ${deviceType} sau ${schedule.duration_minutes} phút (schedule: ${schedule.schedule_name})`);
              await sendDeviceCommand(deviceType, '0', socketIo);
              // Gửi notification: thiết bị đã được tắt tự động
              await notificationService.sendScheduleEnded(
                schedule.user_id, schedule.schedule_name, deviceType, endTime
              );
            } else {
              console.log(`[Scheduler] ${deviceType} đã OFF, bỏ qua (schedule: ${schedule.schedule_name})`);
            }
          }

          // ═══ REMINDER: Nhắc lịch trước 5 phút ═══
          const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
          const fiveMinTime = `${String(fiveMinLater.getHours()).padStart(2, '0')}:${String(fiveMinLater.getMinutes()).padStart(2, '0')}`;
          if (startTime === fiveMinTime && schedule.user_id) {
            await notificationService.sendScheduleReminder(
              schedule.user_id, schedule.schedule_name, startTime
            );
          }
        }
      } catch (err) {
        console.error('[Scheduler] Lỗi:', err.message);
      }
    });

    // Cập nhật dữ liệu thời tiết từ Open-Meteo mỗi 15 phút
    cron.schedule('*/15 * * * *', async () => {
      await weatherService.fetchAndPublish();
    });

    // Startup recovery + fetch weather (delay 5s để đảm bảo DB sẵn sàng)
    setTimeout(async () => {
      console.log('[Scheduler] Kiểm tra khôi phục schedule sau restart...');
      await schedulerService.recoverOnStartup(socketIo);
      console.log('[Scheduler] Fetch dữ liệu thời tiết lần đầu...');
      await weatherService.fetchAndPublish();
    }, 5000);

    console.log('[Scheduler] Cron job lịch tưới đã khởi động (kiểm tra START + END mỗi phút)');
    console.log('[Scheduler] Cron job Open-Meteo weather đã khởi động (mỗi 15 phút)');
  }
};

module.exports = schedulerService;
