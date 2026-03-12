const ScheduleModel = require('../models/scheduleModel');

const scheduleController = {
  // Tất cả user đều thấy chung bảng lịch trình
  async getAll(req, res) {
    try {
      const schedules = await ScheduleModel.findAll();
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    try {
      const { start_date, start_time } = req.body;
      // Validate: start_date không được trong quá khứ
      if (start_date) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (start_date < todayStr) {
          return res.status(400).json({ error: 'Không thể đặt lịch trong quá khứ' });
        }
        // Nếu cùng ngày, kiểm tra start_time >= giờ hiện tại
        if (start_date === todayStr && start_time) {
          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          if (start_time < currentTime) {
            return res.status(400).json({ error: 'Thời gian bắt đầu không được trong quá khứ' });
          }
        }
      }
      // Validate: multi-day range requires repeat days
      const { device_id, duration_minutes, repeat_days, end_date } = req.body;
      const hasRepeatDays = repeat_days && repeat_days.split(',').filter(Boolean).length > 0;
      if (!hasRepeatDays && start_date && end_date && start_date !== end_date) {
        return res.status(400).json({
          error: 'Lịch nhiều ngày phải chọn ngày lặp lại. Nếu không cần lặp, hãy đặt cùng ngày bắt đầu và kết thúc.'
        });
      }

      // Validate: kiểm tra xung đột khung giờ cùng thiết bị
      const conflict = await ScheduleModel.checkOverlap({
        device_id: device_id || 1,
        start_time,
        duration_minutes,
        repeat_days: repeat_days || 'daily',
        start_date: start_date || null,
        end_date: end_date || null,
      });
      if (conflict) {
        return res.status(409).json({
          error: `Xung đột lịch với "${conflict.schedule_name}" (${conflict.start_time?.toString().slice(0, 5)} - ${conflict.duration_minutes} phút)`
        });
      }

      const schedule = await ScheduleModel.create({ user_id: req.user.id, ...req.body });
      res.status(201).json(schedule);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Chỉ cho sửa schedule của chính mình, hoặc admin sửa tất cả
  async update(req, res) {
    try {
      const existing = await ScheduleModel.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Schedule not found' });
      if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền chỉnh sửa' });
      }
      const schedule = await ScheduleModel.update(req.params.id, req.body);
      res.json(schedule);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Chỉ cho xóa schedule của chính mình, hoặc admin xóa tất cả
  async delete(req, res) {
    try {
      const existing = await ScheduleModel.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Schedule not found' });
      if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền xóa' });
      }
      await ScheduleModel.delete(req.params.id);
      res.json({ message: 'Đã xóa lịch trình' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = scheduleController;
