const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc không tồn tại' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret);

    // Verify user still exists in the database
    const [rows] = await db.query('SELECT id, role, status FROM users WHERE id = ?', [decoded.id]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.' });
    }
    if (rows[0].status === 'banned' || rows[0].status === 'inactive') {
      return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa.' });
    }

    req.user = { ...decoded, role: rows[0].role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
  }
};

module.exports = authMiddleware;
