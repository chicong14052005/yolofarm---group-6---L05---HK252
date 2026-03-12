const NotificationModel = require('../models/notificationModel');

const notificationController = {
  async getByUser(req, res) {
    try {
      const filter = req.query.filter || 'all';
      // Admin: xem toàn bộ notifications
      if (req.user.role === 'admin') {
        const notifications = await NotificationModel.findAll(filter);
        const unreadCount = await NotificationModel.countUnreadAll();
        return res.json({ notifications, unreadCount });
      }
      const notifications = await NotificationModel.findByUser(req.user.id, filter);
      const unreadCount = await NotificationModel.countUnread(req.user.id);
      res.json({ notifications, unreadCount });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async markAsRead(req, res) {
    try {
      await NotificationModel.markAsRead(req.params.id);
      res.json({ message: 'Đã đánh dấu đã đọc' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async markAllAsRead(req, res) {
    try {
      // Admin: đánh dấu đã đọc toàn bộ thông báo của tất cả users
      if (req.user.role === 'admin') {
        await NotificationModel.markAllAsReadGlobal();
      } else {
        await NotificationModel.markAllAsRead(req.user.id);
      }
      res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async toggleSave(req, res) {
    try {
      await NotificationModel.toggleSave(req.params.id);
      res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async delete(req, res) {
    try {
      await NotificationModel.delete(req.params.id);
      res.json({ message: 'Đã xóa thông báo' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
};

module.exports = notificationController;
