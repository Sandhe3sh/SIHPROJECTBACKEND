const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// In-memory storage for Firebase simulation
let users = [
  {
    id: 'admin',
    name: 'System Admin',
    email: 'admin@solar.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Txjx/W', // admin123
    role: 'admin'
  },
  {
    id: 'user1',
    name: 'John Doe',
    email: 'user@solar.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Txjx/W', // user123
    role: 'user',
    homeId: 'Home1'
  }
];

let messages = [];
let sensorData = {};
let alerts = [];

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, 'firebase-secret', { expiresIn: '7d' });
    
    console.log(`✅ User logged in: ${user.name} (${email})`);
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        homeId: user.homeId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, homeId } = req.body;
    
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const existingHomeId = users.find(u => u.homeId === homeId && u.role === 'user');
    if (existingHomeId) {
      return res.status(400).json({ message: 'Home ID already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: `user${users.length}`,
      name,
      email,
      password: hashedPassword,
      role: 'user',
      homeId
    };
    
    users.push(newUser);
    console.log(`✅ New user registered: ${name} (${email}) - ${homeId}`);
    
    const token = jwt.sign({ userId: newUser.id }, 'firebase-secret', { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        homeId: newUser.homeId
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get users
app.get('/api/users', (req, res) => {
  const userList = users.filter(u => u.role === 'user').map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    homeId: u.homeId
  }));
  res.json(userList);
});

// Check home ID
app.get('/api/check-home-id/:homeId', (req, res) => {
  const { homeId } = req.params;
  const existingHomeId = users.find(u => u.homeId === homeId && u.role === 'user');
  
  if (existingHomeId) {
    const homeNumbers = users
      .filter(u => u.role === 'user' && u.homeId)
      .map(u => {
        const match = u.homeId.match(/Home (\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    const nextNumber = homeNumbers.length > 0 ? Math.max(...homeNumbers) + 1 : 1;
    res.json({ exists: true, suggestion: `Home ${nextNumber}` });
  } else {
    res.json({ exists: false });
  }
});

// Messages
app.post('/api/messages', (req, res) => {
  const { from, to, message } = req.body;
  const newMessage = {
    id: `msg${messages.length}`,
    from,
    to,
    message,
    isRead: false,
    createdAt: new Date()
  };
  messages.push(newMessage);
  console.log(`📨 Message sent from ${from} to ${to}`);
  
  // Emit to connected clients
  io.emit('newMessage', newMessage);
  
  res.status(201).json({ success: true });
});

app.get('/api/messages', (req, res) => {
  const formattedMessages = messages.map(msg => ({
    _id: msg.id,
    senderId: {
      _id: msg.from === 'Admin' ? 'admin' : 'user',
      name: msg.from,
      role: msg.from === 'Admin' ? 'admin' : 'user'
    },
    receiverId: { _id: msg.to === 'admin' ? 'admin' : 'user', name: msg.to },
    message: msg.message,
    type: msg.to === 'all' ? 'broadcast' : 'personal',
    priority: 'medium',
    isRead: msg.isRead,
    timestamp: msg.createdAt
  }));
  res.json(formattedMessages);
});

app.get('/api/messages/user/:userName', (req, res) => {
  const { userName } = req.params;
  const userMessages = messages.filter(msg => 
    msg.from === userName || msg.to === userName || msg.to === 'all'
  );
  
  const formattedMessages = userMessages.map(msg => ({
    _id: msg.id,
    senderId: {
      _id: msg.from === 'Admin' ? 'admin' : 'user',
      name: msg.from,
      role: msg.from === 'Admin' ? 'admin' : 'user'
    },
    receiverId: { _id: msg.to === 'admin' ? 'admin' : 'user', name: msg.to },
    message: msg.message,
    type: msg.to === 'all' ? 'broadcast' : 'personal',
    priority: 'medium',
    isRead: msg.isRead,
    timestamp: msg.createdAt
  }));
  res.json(formattedMessages);
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);
  
  // Send current sensor data to new connection
  if (Object.keys(sensorData).length > 0) {
    socket.emit('sensor-data', sensorData);
  }
  
  socket.on('join-room', (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined room`);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// Generate realistic sensor data
const generateSensorData = () => {
  const currentHour = new Date().getHours();
  const isDaytime = currentHour >= 6 && currentHour <= 18;
  
  // Solar generation based on time of day
  let solarMultiplier = 0;
  if (isDaytime) {
    const midday = 12;
    const hoursFromMidday = Math.abs(currentHour - midday);
    solarMultiplier = Math.max(0, 1 - (hoursFromMidday / 6)) * (0.8 + Math.random() * 0.4);
  }
  
  sensorData = {
    timestamp: new Date(),
    solarPanel: {
      voltage: parseFloat((220 + Math.random() * 20).toFixed(2)),
      current: parseFloat((solarMultiplier * 20).toFixed(2)),
      power: parseFloat((solarMultiplier * 4000 + Math.random() * 200).toFixed(2))
    },
    battery: {
      soc: parseFloat((60 + Math.random() * 35).toFixed(1)),
      voltage: parseFloat((48 + Math.random() * 4).toFixed(2)),
      current: parseFloat((8 + Math.random() * 6).toFixed(2)),
      temperature: parseFloat((25 + Math.random() * 15).toFixed(1))
    },
    loads: {
      L1: parseFloat((400 + Math.random() * 300).toFixed(2)),
      L2: parseFloat((250 + Math.random() * 200).toFixed(2)),
      L3: parseFloat((350 + Math.random() * 150).toFixed(2))
    }
  };
  
  // Check for alerts
  if (sensorData.battery.temperature > 45) {
    const alert = {
      type: 'high_temperature',
      message: `Battery temperature is ${sensorData.battery.temperature}°C`,
      severity: 'high',
      timestamp: new Date()
    };
    alerts.push(alert);
    io.emit('newAlert', alert);
  }
  
  if (sensorData.battery.soc < 20) {
    const alert = {
      type: 'low_battery',
      message: `Battery SOC is ${sensorData.battery.soc}%`,
      severity: 'medium',
      timestamp: new Date()
    };
    alerts.push(alert);
    io.emit('newAlert', alert);
  }
  
  // Emit sensor data to all connected clients
  io.emit('sensor-data', sensorData);
  console.log('📊 Sensor data updated and broadcasted');
};

// Generate sensor data every 3 seconds
setInterval(generateSensorData, 3000);

// Generate random system alerts
setInterval(() => {
  const alertTypes = [
    { type: 'maintenance', message: 'Solar panel cleaning recommended', severity: 'low' },
    { type: 'efficiency', message: 'System efficiency below optimal', severity: 'medium' },
    { type: 'grid', message: 'Grid connection stable', severity: 'info' },
    { type: 'weather', message: 'Cloudy weather affecting generation', severity: 'low' }
  ];
  
  if (Math.random() > 0.8) {
    const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    randomAlert.timestamp = new Date();
    alerts.push(randomAlert);
    io.emit('newAlert', randomAlert);
  }
}, 25000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🔥 Firebase Server running on port ${PORT}`);
  console.log(`🌐 Frontend should connect to http://localhost:3000`);
  console.log(`🔗 Backend API available at http://localhost:${PORT}`);
  console.log(`📊 Real-time sensor data every 3 seconds`);
  console.log(`🔥 Using Firebase-style real-time updates`);
  console.log(`👤 Demo accounts:`);
  console.log(`   Admin: admin@solar.com / admin123`);
  console.log(`   User: user@solar.com / user123`);
});

module.exports = { app, io };