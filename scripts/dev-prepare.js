const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const envPath = path.join(serverDir, '.env');

function readEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

async function main() {
  const serverRequire = createRequire(path.join(serverDir, 'package.json'));
  let mysql;
  try {
    mysql = serverRequire('mysql2/promise');
  } catch (error) {
    console.error('[dev:prepare] Missing server dependencies. Run pnpm install first.');
    throw error;
  }

  const env = { ...readEnv(envPath), ...process.env };
  const dbConfig = {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'yolofarm',
    ssl: env.DB_HOST && env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : undefined,
  };

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    await conn.query('SELECT 1');
  } catch (error) {
    console.error('[dev:prepare] Cannot connect to MySQL.');
    console.error(`[dev:prepare] Host=${dbConfig.host} Port=${dbConfig.port} DB=${dbConfig.database} User=${dbConfig.user}`);
    console.error(`[dev:prepare] ${error.message}`);
    process.exit(1);
  }

  try {
    await conn.query('SELECT 1 FROM sensor_data LIMIT 1');
    await conn.query('SELECT 1 FROM forecast_cache LIMIT 1');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS forecast_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        sensor_type VARCHAR(50) NOT NULL,
        run_id VARCHAR(64) NOT NULL,
        point_type ENUM('historical', 'future') NOT NULL,
        target_timestamp TIMESTAMP NOT NULL,
        actual_value FLOAT DEFAULT NULL,
        predicted_value FLOAT DEFAULT NULL,
        lower_value FLOAT DEFAULT NULL,
        upper_value FLOAT DEFAULT NULL,
        confidence FLOAT DEFAULT NULL,
        model_version VARCHAR(50),
        horizon_hours INT DEFAULT 24,
        interval_minutes INT DEFAULT 15,
        generated_at TIMESTAMP NULL,
        fallback BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_forecast_history_lookup (sensor_type, point_type, target_timestamp),
        INDEX idx_forecast_history_run (sensor_type, run_id),
        INDEX idx_forecast_history_generated (generated_at)
      )
    `);
  } catch (error) {
    console.error('[dev:prepare] Database schema is not ready. Import server/database/schema.sql first.');
    console.error(`[dev:prepare] ${error.message}`);
    await conn.end();
    process.exit(1);
  }

  await conn.end();
  console.log('[dev:prepare] Database connection and schema checks passed. forecast_history is ready.');
}

main().catch((error) => {
  console.error(`[dev:prepare] ${error.message}`);
  process.exit(1);
});
