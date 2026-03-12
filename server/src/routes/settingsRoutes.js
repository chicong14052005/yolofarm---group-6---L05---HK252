const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/', authMiddleware, settingsController.getAll);
router.put('/', authMiddleware, roleMiddleware('admin'), settingsController.update);

module.exports = router;
