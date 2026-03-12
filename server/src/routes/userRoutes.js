const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/', authMiddleware, roleMiddleware('admin'), userController.getAll);
router.get('/:id', authMiddleware, roleMiddleware('admin'), userController.getById);
router.post('/', authMiddleware, roleMiddleware('admin'), userController.create);
router.put('/:id', authMiddleware, roleMiddleware('admin'), userController.update);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), userController.delete);
router.patch('/:id/role', authMiddleware, roleMiddleware('admin'), userController.updateRole);
router.patch('/:id/ban', authMiddleware, roleMiddleware('admin'), userController.toggleBan);

module.exports = router;
