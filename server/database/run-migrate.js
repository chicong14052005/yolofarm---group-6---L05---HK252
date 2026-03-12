// Run: node database/run-migrate.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'yolofarm',
  });
  
  console.log('Connected to MySQL...');
  
  try {
    // Update users status ENUM to include banned + inactive
    await conn.query("ALTER TABLE users MODIFY COLUMN status ENUM('active', 'inactive', 'banned') DEFAULT 'active'");
    console.log('✅ users.status updated');
  } catch (e) {
    console.log('⚠️ users.status:', e.message);
  }

  try {
    await conn.query("ALTER TABLE devices ADD COLUMN manual_override BOOLEAN DEFAULT FALSE");
    console.log('✅ devices.manual_override added');
  } catch (e) {
    console.log('⚠️ devices.manual_override:', e.message);
  }

  try {
    await conn.query("ALTER TABLE devices ADD COLUMN last_toggled_at TIMESTAMP DEFAULT NULL");
    console.log('✅ devices.last_toggled_at added');
  } catch (e) {
    console.log('⚠️ devices.last_toggled_at:', e.message);
  }

  try {
    await conn.query("ALTER TABLE schedules ADD COLUMN start_date DATE DEFAULT NULL");
    console.log('✅ schedules.start_date added');
  } catch (e) {
    console.log('⚠️ schedules.start_date:', e.message);
  }

  try {
    await conn.query("ALTER TABLE schedules ADD COLUMN end_date DATE DEFAULT NULL");
    console.log('✅ schedules.end_date added');
  } catch (e) {
    console.log('⚠️ schedules.end_date:', e.message);
  }

  console.log('Migration done!');
  await conn.end();
}

migrate().catch(console.error);
