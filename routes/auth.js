const express = require('express');
const { createUser, getUserById, auth } = require('../services/firebaseService');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, homeId } = req.body;
    
    const userRecord = await createUser({ name, email, password, role, homeId });
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userRecord.uid,
        name,
        email,
        role: role || 'user',
        homeId
      }
    });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'User already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Verify Firebase token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    const decodedToken = await auth.verifyIdToken(token);
    const user = await getUserById(decodedToken.uid);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Get user profile
router.get('/profile/:uid', async (req, res) => {
  try {
    const user = await getUserById(req.params.uid);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;