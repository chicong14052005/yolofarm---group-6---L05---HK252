const router = require('express').Router();
const termsController = require('../controllers/termsController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Public: xem điều khoản active
router.get('/active', termsController.getActive);

// Admin: CRUD
router.get('/', authMiddleware, roleMiddleware('admin'), termsController.getAll);
router.post('/', authMiddleware, roleMiddleware('admin'), termsController.create);
router.put('/:id', authMiddleware, roleMiddleware('admin'), termsController.update);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), termsController.delete);

module.exports = router;
