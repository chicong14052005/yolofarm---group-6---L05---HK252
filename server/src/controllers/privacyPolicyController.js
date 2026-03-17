const PrivacyPolicyModel = require('../models/privacyPolicyModel');
const translate = require('@iamtraction/google-translate');

const privacyPolicyController = {
  async getActive(req, res) {
    try {
      const policy = await PrivacyPolicyModel.getActive();
      res.json(policy || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAll(req, res) {
    try {
      const policies = await PrivacyPolicyModel.getAll();
      res.json(policies);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async create(req, res) {
    try {
      const { title, content, content_vi, content_en, version } = req.body;
      const policy = await PrivacyPolicyModel.create({
        title, content, content_vi, content_en, version,
        created_by: req.user.id
      });
      res.status(201).json(policy);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async update(req, res) {
    try {
      const { title, content, content_vi, content_en, is_active } = req.body;
      await PrivacyPolicyModel.update(req.params.id, { title, content, content_vi, content_en, is_active });
      res.json({ message: 'Cập nhật thành công' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async delete(req, res) {
    try {
      await PrivacyPolicyModel.delete(req.params.id);
      res.json({ message: 'Đã xóa' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async translateAndCache(req, res) {
    try {
      const { id } = req.params;
      const { targetLang } = req.body;

      if (!['vi', 'en'].includes(targetLang)) {
        return res.status(400).json({ error: 'Supported languages: vi, en' });
      }

      const policy = await PrivacyPolicyModel.getById(id);
      if (!policy) {
        return res.status(404).json({ error: 'Policy not found' });
      }

      const targetColumn = targetLang === 'vi' ? 'content_vi' : 'content_en';

      // Return cached translation if available
      if (policy[targetColumn]) {
        return res.json({ translatedText: policy[targetColumn], cached: true });
      }

      // Determine source text and language
      const sourceLang = targetLang === 'vi' ? 'en' : 'vi';
      const sourceColumn = sourceLang === 'vi' ? 'content_vi' : 'content_en';
      const sourceText = policy[sourceColumn] || policy.content;

      if (!sourceText) {
        return res.status(400).json({ error: 'No source content to translate' });
      }

      const result = await translate(sourceText, { from: sourceLang, to: targetLang });
      const translatedText = result.text;

      // Cache the translation in the database
      await PrivacyPolicyModel.updateTranslation(id, targetColumn, translatedText);

      res.json({ translatedText, cached: false });
    } catch (err) {
      res.status(500).json({ error: 'Translation failed: ' + err.message });
    }
  }
};

module.exports = privacyPolicyController;
