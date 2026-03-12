const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/latest', authMiddleware, sensorController.getLatest);
router.get('/history/:type', authMiddleware, sensorController.getHistory);
router.get('/stats/:type', authMiddleware, sensorController.getStats);

module.exports = router;
