module.exports = {
  SENSOR_TYPES: ['temperature', 'humidity', 'soil_moisture', 'light'],
  DEVICE_TYPES: ['pump1', 'pump2', 'led_rgb'],
  USER_ROLES: ['user', 'admin'],
  DEFAULT_THRESHOLDS: {
    soil_moisture: 40,
    temperature_warning: 35,
    humidity_warning_low: 30
  }
};
