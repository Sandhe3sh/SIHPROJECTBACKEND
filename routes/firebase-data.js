const express = require('express');
const { db, realtimeDb } = require('../firebase');
const router = express.Router();

// Get sensor data from Firestore
router.get('/sensors', async (req, res) => {
  try {
    const snapshot = await db.collection('sensorData').orderBy('timestamp', 'desc').limit(10).get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save sensor data to Firestore
router.post('/sensors', async (req, res) => {
  try {
    const docRef = await db.collection('sensorData').add({
      ...req.body,
      timestamp: new Date()
    });
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time data from Realtime Database
router.get('/realtime/:path', async (req, res) => {
  try {
    const snapshot = await realtimeDb.ref(req.params.path).once('value');
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;