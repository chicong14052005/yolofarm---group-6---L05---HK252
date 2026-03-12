const router = require('express').Router();
const preferencesController = require('../controllers/preferencesController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, preferencesController.get);
router.put('/', authMiddleware, preferencesController.update);

module.exports = router;
