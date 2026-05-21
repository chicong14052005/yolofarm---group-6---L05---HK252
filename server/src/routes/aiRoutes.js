const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/predict', authMiddleware, aiController.predict);
router.get('/forecast/humidity', authMiddleware, aiController.getCachedForecast);
router.get('/forecast/humidity/weekly-summary', authMiddleware, aiController.getHumidityWeeklySummary);
router.post('/forecast/humidity', authMiddleware, aiController.forecastHumidity);
router.post('/detect-disease', authMiddleware, upload.single('image'), aiController.detectDisease);

module.exports = router;
