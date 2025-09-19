const express = require('express');
const firebaseService = require('../firebaseService');
const router = express.Router();

// Get latest sensor data
router.get('/latest', async (req, res) => {
  try {
    const latestData = await firebaseService.getSensorData(10);
    res.json(latestData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get historical data
router.get('/history', async (req, res) => {
  try {
    const { deviceType, startDate, endDate } = req.query;
    const query = {};
    
    if (deviceType) query.deviceType = deviceType;
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const data = await SensorData.find(query).sort({ timestamp: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add sensor data (for IoT devices)
router.post('/data', async (req, res) => {
  try {
    const id = await firebaseService.saveSensorData(req.body);
    res.status(201).json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;