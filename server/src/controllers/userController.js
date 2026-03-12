const UserModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const NotificationModel = require('../models/notificationModel');
const socketManager = require('../config/socketManager');

const userController = {
  async getAll(req, res) {
    try {
      const users = await UserModel.findAll();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req, res) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    try {
      const { username, email, password, full_name, role } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await UserModel.create({ username, email, password: hashedPassword, full_name, role });
      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const data = { ...req.body };
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }
      const user = await UserModel.update(req.params.id, data);
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async delete(req, res) {
    try {
      const userId = req.params.id;

      if (String(userId) === String(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không thể tự xóa tài khoản của chính mình' });
      }

      // Emit accountDeleted cho user đang online trước khi xóa
      const io = socketManager.getIO();
      if (io) {
        io.to(`user_${userId}`).emit('accountDeleted', {
          message: 'Quản trị viên đã xóa tài khoản của bạn'
        });
      }

      await UserModel.delete(userId);
      res.json({ message: 'Đã xóa người dùng' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // PATCH /users/:id/role — toggle role
  async updateRole(req, res) {
    try {
      const { role } = req.body;
      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Role không hợp lệ' });
      }
      await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
      const user = await UserModel.findById(req.params.id);

      // Gửi thông báo cho user
      const roleLabel = role === 'admin' ? 'Quản trị viên' : 'Người dùng';
      await NotificationModel.create({
        user_id: req.params.id,
        type: 'system',
        title: 'Vai trò đã thay đổi',
        message: `Quản trị viên đã thay đổi vai trò của bạn thành "${roleLabel}".`
      });
      const io = socketManager.getIO();
      if (io) {
        io.to(`user_${req.params.id}`).emit('notification', {
          type: 'system', title: 'Vai trò đã thay đổi'
        });
      }

      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // PATCH /users/:id/ban — toggle banned status
  async toggleBan(req, res) {
    try {
      if (String(req.params.id) === String(req.user.id)) {
        return res.status(403).json({ error: 'Bạn không thể tự chặn chính mình' });
      }
      const { status } = req.body;
      if (!['active', 'banned'].includes(status)) {
        return res.status(400).json({ error: 'Status không hợp lệ' });
      }
      await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
      const user = await UserModel.findById(req.params.id);

      // Gửi thông báo cho user
      const isBanned = status === 'banned';
      await NotificationModel.create({
        user_id: req.params.id,
        type: isBanned ? 'warning' : 'info',
        title: isBanned ? 'Tài khoản bị chặn' : 'Tài khoản đã mở khóa',
        message: isBanned
          ? 'Quản trị viên đã chặn tài khoản của bạn. Bạn sẽ không thể đăng nhập.'
          : 'Quản trị viên đã mở khóa tài khoản của bạn. Bạn có thể đăng nhập lại.'
      });
      const io = socketManager.getIO();
      if (io) {
        io.to(`user_${req.params.id}`).emit('notification', {
          type: isBanned ? 'warning' : 'info',
          title: isBanned ? 'Tài khoản bị chặn' : 'Tài khoản đã mở khóa'
        });
        if (isBanned) {
          io.to(`user_${req.params.id}`).emit('forceLogout');
        }
      }

      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = userController;
