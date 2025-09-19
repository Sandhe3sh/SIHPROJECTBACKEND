const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { saveSensorData, realtimeDb } = require('./services/firebaseService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/messages', require('./routes/messages'));

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Listen for sensor data updates from Firebase Realtime Database
  const sensorRef = realtimeDb.ref('sensorData');
  sensorRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    socket.emit('sensor-data', data);
  });
  
  // Listen for alerts
  const alertsRef = realtimeDb.ref('alerts');
  alertsRef.on('child_added', (snapshot) => {
    const alert = snapshot.val();
    socket.emit('new-alert', alert);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Simulate sensor data (for demo)
setInterval(async () => {
  const mockData = {
    solar: {
      voltage: 24 + Math.random() * 4,
      current: 8 + Math.random() * 2,
      power: 200 + Math.random() * 50
    },
    battery: {
      soc: 75 + Math.random() * 20,
      voltage: 12 + Math.random() * 1,
      current: 5 + Math.random() * 2,
      temperature: 25 + Math.random() * 10
    },
    load: {
      totalPower: 150 + Math.random() * 30,
      homes: [
        { id: 'home1', power: 50 + Math.random() * 20 },
        { id: 'home2', power: 45 + Math.random() * 15 },
        { id: 'home3', power: 55 + Math.random() * 25 }
      ]
    }
  };
  
  try {
    await saveSensorData(mockData);
    io.emit('sensor-data', mockData);
  } catch (error) {
    console.error('Error saving sensor data:', error);
  }
}, 5000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Firebase server running on port ${PORT}`);
});