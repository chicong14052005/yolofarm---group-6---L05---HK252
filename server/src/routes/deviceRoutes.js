const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, deviceController.getAll);
router.post('/control', authMiddleware, deviceController.control);
router.get('/status/:type', authMiddleware, deviceController.getStatus);

module.exports = router;
