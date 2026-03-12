const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'yolofarm',
  });
  try {
    await c.query("ALTER TABLE user_preferences ADD COLUMN font_family VARCHAR(50) DEFAULT '''Inter'''");
    console.log('OK: font_family column added');
  } catch (e) {
    console.log('WARN:', e.message);
  }
  await c.end();
})();
