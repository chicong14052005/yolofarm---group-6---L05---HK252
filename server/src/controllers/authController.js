const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const UserModel = require('../models/userModel');
const authConfig = require('../config/auth');

const googleClient = new OAuth2Client(authConfig.google.clientId);

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    authConfig.jwtSecret,
    { expiresIn: authConfig.jwtExpiresIn }
  );
};

const authController = {
  async register(req, res) {
    try {
      const { username, email, password, full_name } = req.body;
      const existingUser = await UserModel.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
      }
      if (email) {
        const existingEmail = await UserModel.findByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ error: 'Email đã được sử dụng' });
        }
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await UserModel.create({ username, email, password: hashedPassword, full_name });
      const token = generateToken(user);
      res.status(201).json({ user, token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async login(req, res) {
    try {
      const { username, password } = req.body;
      const user = await UserModel.findByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
      }
      // Check banned status
      if (user.status === 'banned') {
        return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
      }
      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async googleLogin(req, res) {
    try {
      const { credential } = req.body;
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: authConfig.google.clientId,
      });
      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      // Tìm user đã link Google
      let user = await UserModel.findByGoogleId(googleId);
      if (!user) {
        // Tìm theo email
        user = await UserModel.findByEmail(email);
        if (user) {
          // Link Google ID vào user hiện có
          await UserModel.updateGoogleId(user.id, googleId);
          user = await UserModel.findById(user.id);
        } else {
          // Tạo user mới
          user = await UserModel.create({
            username: email.split('@')[0] + '_' + Date.now().toString(36),
            email,
            password: await bcrypt.hash(Math.random().toString(36), 10),
            full_name: name,
            avatar_url: picture,
            google_id: googleId,
          });
        }
      }

      // Kiểm tra trạng thái tài khoản — chặn user bị khóa
      if (user.status === 'banned') {
        return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên.' });
      }

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (err) {
      console.error('Google OAuth error:', err);
      res.status(401).json({ error: 'Xác thực Google thất bại' });
    }
  },

  async getProfile(req, res) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = authController;
