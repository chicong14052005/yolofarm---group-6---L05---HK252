const db = require('../config/db');

const TermsModel = {
  async getActive() {
    const [rows] = await db.query('SELECT * FROM terms WHERE is_active = TRUE ORDER BY version DESC LIMIT 1');
    return rows[0];
  },
  async getAll() {
    const [rows] = await db.query('SELECT * FROM terms ORDER BY version DESC');
    return rows;
  },
  async getById(id) {
    const [rows] = await db.query('SELECT * FROM terms WHERE id = ?', [id]);
    return rows[0];
  },
  async create({ title, content, version, created_by }) {
    const [result] = await db.query(
      'INSERT INTO terms (title, content, version, created_by) VALUES (?, ?, ?, ?)',
      [title, content, version, created_by]
    );
    return { id: result.insertId, title, content, version, created_by };
  },
  async update(id, { title, content, is_active }) {
    await db.query('UPDATE terms SET title = ?, content = ?, is_active = ? WHERE id = ?', [title, content, is_active, id]);
  },
  async delete(id) {
    await db.query('DELETE FROM terms WHERE id = ?', [id]);
  }
};

module.exports = TermsModel;
