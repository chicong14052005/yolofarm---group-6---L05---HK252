const pool = require('../config/db');

const ScheduleModel = {
  // Luôn trả về TẤT CẢ schedules (shared), JOIN users + devices
  async findAll() {
    const [rows] = await pool.query(`
      SELECT s.*, u.full_name AS creator_name, d.device_type, d.device_name
      FROM schedules s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN devices d ON s.device_id = d.id
      ORDER BY s.start_time
    `);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(`
      SELECT s.*, u.full_name AS creator_name, d.device_type, d.device_name
      FROM schedules s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN devices d ON s.device_id = d.id
      WHERE s.id = ?
    `, [id]);
    return rows[0];
  },

  async create({ user_id, device_id, schedule_name, start_time, duration_minutes, repeat_days, start_date, end_date }) {
    const fields = ['user_id', 'device_id', 'schedule_name', 'start_time', 'duration_minutes', 'repeat_days'];
    const values = [user_id, device_id || 1, schedule_name, start_time, duration_minutes, repeat_days || 'daily'];
    if (start_date) { fields.push('start_date'); values.push(start_date); }
    if (end_date) { fields.push('end_date'); values.push(end_date); }
    const placeholders = fields.map(() => '?').join(', ');
    const [result] = await pool.query(
      `INSERT INTO schedules (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const allowed = ['schedule_name', 'start_time', 'duration_minutes', 'repeat_days', 'is_active', 'device_id', 'start_date', 'end_date'];
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && allowed.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    await pool.query('DELETE FROM schedules WHERE id = ?', [id]);
  },

  async checkOverlap({ device_id, start_time, duration_minutes, repeat_days, start_date, end_date, exclude_id }) {
    // Lấy tất cả schedule active của cùng device
    let query = `
      SELECT s.*, d.device_type FROM schedules s
      LEFT JOIN devices d ON s.device_id = d.id
      WHERE s.is_active = TRUE AND s.device_id = ?
    `;
    const params = [device_id];
    if (exclude_id) {
      query += ' AND s.id != ?';
      params.push(exclude_id);
    }
    const [rows] = await pool.query(query, params);

    // Tính end_time mới
    const [h, m] = start_time.split(':').map(Number);
    const newStartMin = h * 60 + m;
    const newEndMin = newStartMin + parseInt(duration_minutes);

    const newDays = (repeat_days || 'daily').toLowerCase().split(',').map(d => d.trim());

    for (const existing of rows) {
      // 1) Kiểm tra date range overlap
      if (start_date && end_date && existing.start_date && existing.end_date) {
        const ns = start_date, ne = end_date;
        const toStr = (d) => typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
        const es = toStr(existing.start_date), ee = toStr(existing.end_date);
        if (ne < es || ns > ee) continue; // Không overlap date range
      }

      // 2) Kiểm tra day overlap
      const existDays = (existing.repeat_days || 'daily').toLowerCase().split(',').map(d => d.trim());
      const dayOverlap = newDays.includes('daily') || existDays.includes('daily') ||
        newDays.some(d => existDays.includes(d));
      if (!dayOverlap) continue;

      // 3) Kiểm tra time overlap
      const existTime = existing.start_time.toString().slice(0, 5);
      const [eh, em] = existTime.split(':').map(Number);
      const existStartMin = eh * 60 + em;
      const existEndMin = existStartMin + parseInt(existing.duration_minutes);

      if (newStartMin < existEndMin && newEndMin > existStartMin) {
        return existing; // Xung đột!
      }
    }
    return null; // Không xung đột
  },

  async getActive() {
    const [rows] = await pool.query(`
      SELECT s.*, d.device_type, d.device_name
      FROM schedules s
      LEFT JOIN devices d ON s.device_id = d.id
      WHERE s.is_active = TRUE
    `);
    return rows;
  }
};

module.exports = ScheduleModel;
