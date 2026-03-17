const router = require('express').Router();
const privacyPolicyController = require('../controllers/privacyPolicyController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Public: xem chính sách bảo mật active
router.get('/active', privacyPolicyController.getActive);

// Authenticated user: dịch chính sách theo yêu cầu
router.post('/:id/translate', authMiddleware, privacyPolicyController.translateAndCache);

// Admin: CRUD
router.get('/', authMiddleware, roleMiddleware('admin'), privacyPolicyController.getAll);
router.post('/', authMiddleware, roleMiddleware('admin'), privacyPolicyController.create);
router.put('/:id', authMiddleware, roleMiddleware('admin'), privacyPolicyController.update);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), privacyPolicyController.delete);

module.exports = router;
