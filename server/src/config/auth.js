require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'yolofarm_default_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
  }
};
