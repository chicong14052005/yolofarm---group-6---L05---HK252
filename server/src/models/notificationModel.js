const db = require('../config/db');

const NotificationModel = {
  async findByUser(userId, filter = 'all') {
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    if (filter === 'unread') query += ' AND is_read = FALSE';
    if (filter === 'saved') query += ' AND is_saved = TRUE';
    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, [userId]);
    return rows;
  },

  // Admin: xem toàn bộ notifications
  async findAll(filter = 'all') {
    let query = 'SELECT n.*, u.full_name AS user_name FROM notifications n LEFT JOIN users u ON n.user_id = u.id';
    if (filter === 'unread') query += ' WHERE n.is_read = FALSE';
    else if (filter === 'saved') query += ' WHERE n.is_saved = TRUE';
    query += ' ORDER BY n.created_at DESC';
    const [rows] = await db.query(query);
    return rows;
  },

  async countUnread(userId) {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE', [userId]);
    return rows[0].count;
  },

  async countUnreadAll() {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE is_read = FALSE');
    return rows[0].count;
  },

  async markAsRead(id) {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
  },
  async markAllAsRead(userId) {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
  },
  async markAllAsReadGlobal() {
    await db.query('UPDATE notifications SET is_read = TRUE');
  },
  async toggleSave(id) {
    await db.query('UPDATE notifications SET is_saved = NOT is_saved WHERE id = ?', [id]);
  },
  async create({ user_id, type, title, message }) {
    const [result] = await db.query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      [user_id, type, title, message]
    );
    return { id: result.insertId, user_id, type, title, message };
  },
  async delete(id) {
    await db.query('DELETE FROM notifications WHERE id = ?', [id]);
  }
};

module.exports = NotificationModel;
