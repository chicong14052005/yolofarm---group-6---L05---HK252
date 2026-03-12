const TermsModel = require('../models/termsModel');

const termsController = {
  async getActive(req, res) {
    try {
      const term = await TermsModel.getActive();
      res.json(term || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAll(req, res) {
    try {
      const terms = await TermsModel.getAll();
      res.json(terms);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async create(req, res) {
    try {
      const term = await TermsModel.create({ ...req.body, created_by: req.user.id });
      res.status(201).json(term);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async update(req, res) {
    try {
      await TermsModel.update(req.params.id, req.body);
      res.json({ message: 'Cập nhật thành công' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async delete(req, res) {
    try {
      await TermsModel.delete(req.params.id);
      res.json({ message: 'Đã xóa' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
};

module.exports = termsController;
