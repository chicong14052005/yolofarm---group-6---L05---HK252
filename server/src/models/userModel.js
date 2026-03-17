const db = require('../config/db');

const UserModel = {
  async findById(id) {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  },
  async findByUsername(username) {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0];
  },
  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },
  async findByGoogleId(googleId) {
    const [rows] = await db.query('SELECT * FROM users WHERE google_id = ?', [googleId]);
    return rows[0];
  },
  async findAll() {
    const [rows] = await db.query('SELECT id, username, email, full_name, role, status, avatar_url, google_id, created_at, updated_at FROM users ORDER BY created_at DESC');
    return rows;
  },
  async create({ username, email, password, full_name, avatar_url, google_id }) {
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, full_name, avatar_url, google_id) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, password, full_name || null, avatar_url || null, google_id || null]
    );
    return this.findById(result.insertId);
  },
  async updateGoogleId(id, googleId) {
    await db.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, id]);
  },
  async update(id, data) {
    const { full_name, email, role, status, avatar_url } = data;
    await db.query('UPDATE users SET full_name=?, email=?, role=?, status=?, avatar_url=? WHERE id=?',
      [full_name, email, role, status, avatar_url, id]);
  },
  async updateAvatar(id, avatar_url) {
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar_url, id]);
  },
  async updateFullName(id, full_name) {
    await db.query('UPDATE users SET full_name = ? WHERE id = ?', [full_name, id]);
  },
  async updatePassword(id, hashedPassword) {
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
  },
  async delete(id) {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
  }
};

module.exports = UserModel;
