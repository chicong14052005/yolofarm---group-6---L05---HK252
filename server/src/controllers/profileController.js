const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

const profileController = {
  // PUT /api/profile/avatar — Upload avatar lên Cloudinary
  async updateAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn file ảnh' });
      }

      // Upload buffer lên Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'yolofarm/avatars',
            public_id: `user_${req.user.id}_${Date.now()}`,
            transformation: [
              { width: 300, height: 300, crop: 'fill', gravity: 'face' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        const stream = Readable.from(req.file.buffer);
        stream.pipe(uploadStream);
      });

      const avatarUrl = result.secure_url;
      await UserModel.updateAvatar(req.user.id, avatarUrl);

      res.json({ avatar_url: avatarUrl, message: 'Cập nhật avatar thành công' });
    } catch (err) {
      console.error('Upload avatar error:', err);
      res.status(500).json({ error: 'Lỗi khi upload avatar: ' + err.message });
    }
  },

  // PUT /api/profile/username — Đổi full_name
  async updateUsername(req, res) {
    try {
      const { full_name } = req.body;
      if (!full_name || !full_name.trim()) {
        return res.status(400).json({ error: 'Tên không được để trống' });
      }
      await UserModel.updateFullName(req.user.id, full_name.trim());
      res.json({ message: 'Cập nhật tên thành công', full_name: full_name.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // PUT /api/profile/password — Đổi mật khẩu (cần mật khẩu cũ)
  async updatePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu cũ và mới' });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }

      const user = await UserModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }

      // Chặn đổi mật khẩu nếu tài khoản Google OAuth
      if (user.google_id) {
        return res.status(403).json({ error: 'Tài khoản Google không thể đổi mật khẩu tại đây. Vui lòng quản lý mật khẩu tại Google.' });
      }

      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);
      await UserModel.updatePassword(req.user.id, hashedPassword);
      res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = profileController;
