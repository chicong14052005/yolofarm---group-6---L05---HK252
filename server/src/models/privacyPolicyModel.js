const db = require('../config/db');

const PrivacyPolicyModel = {
  async getActive() {
    const [rows] = await db.query('SELECT * FROM privacy_policy WHERE is_active = TRUE ORDER BY version DESC LIMIT 1');
    return rows[0];
  },
  async getAll() {
    const [rows] = await db.query('SELECT * FROM privacy_policy ORDER BY version DESC');
    return rows;
  },
  async getById(id) {
    const [rows] = await db.query('SELECT * FROM privacy_policy WHERE id = ?', [id]);
    return rows[0];
  },
  async create({ title, content, content_vi, content_en, version, created_by }) {
    const [result] = await db.query(
      'INSERT INTO privacy_policy (title, content, content_vi, content_en, version, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, content, content_vi || null, content_en || null, version, created_by]
    );
    return { id: result.insertId, title, content, content_vi, content_en, version, created_by };
  },
  async update(id, { title, content, content_vi, content_en, is_active }) {
    await db.query(
      'UPDATE privacy_policy SET title = ?, content = ?, content_vi = ?, content_en = ?, is_active = ? WHERE id = ?',
      [title, content, content_vi || null, content_en || null, is_active, id]
    );
  },
  async updateTranslation(id, column, translatedText) {
    await db.query(`UPDATE privacy_policy SET ${column} = ? WHERE id = ?`, [translatedText, id]);
  },
  async delete(id) {
    await db.query('DELETE FROM privacy_policy WHERE id = ?', [id]);
  }
};

module.exports = PrivacyPolicyModel;
