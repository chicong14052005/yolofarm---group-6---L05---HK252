const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'yolofarm'
  });

  try {
    await conn.execute("ALTER TABLE user_preferences ADD COLUMN font_family VARCHAR(50) DEFAULT '''Inter'''");
    console.log('OK: font_family column added successfully');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column font_family already exists - no action needed');
    } else {
      console.error('Error:', e.message);
    }
  }

  await conn.end();
})();
