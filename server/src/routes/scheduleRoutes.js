const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, scheduleController.getAll);
router.post('/', authMiddleware, scheduleController.create);
router.put('/:id', authMiddleware, scheduleController.update);
router.delete('/:id', authMiddleware, scheduleController.delete);

module.exports = router;
