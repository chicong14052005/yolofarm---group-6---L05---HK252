const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/predict', authMiddleware, aiController.predict);
router.get('/forecast/humidity', authMiddleware, aiController.getCachedForecast);
router.post('/forecast/humidity', authMiddleware, aiController.forecastHumidity);
router.post('/detect-disease', authMiddleware, upload.single('image'), aiController.detectDisease);

module.exports = router;
