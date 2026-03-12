const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc không tồn tại' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
  }
};

module.exports = authMiddleware;
