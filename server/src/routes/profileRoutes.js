const router = require('express').Router();
const multer = require('multer');
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Multer memory storage (không lưu file local, upload trực tiếp lên Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh'), false);
    }
  }
});

router.put('/avatar', authMiddleware, upload.single('avatar'), profileController.updateAvatar);
router.put('/username', authMiddleware, profileController.updateUsername);
router.put('/password', authMiddleware, profileController.updatePassword);

module.exports = router;
