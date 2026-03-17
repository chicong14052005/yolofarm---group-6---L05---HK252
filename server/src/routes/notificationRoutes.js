const router = require('express').Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.get('/', notificationController.getByUser);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/save', notificationController.toggleSave);
router.delete('/delete-all', notificationController.deleteAllMine);
router.delete('/admin/delete-all', roleMiddleware('admin'), notificationController.adminDeleteAll);
router.delete('/:id', notificationController.delete);

module.exports = router;
