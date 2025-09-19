const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

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

// Mock data
let users = [
  { id: '1', email: 'admin@solar.com', password: 'admin123', role: 'admin', name: 'Admin' },
  { id: '2', email: 'user@solar.com', password: 'user123', role: 'user', name: 'User' }
];

let sensorData = [];

// Auth routes
app.post('/api/auth/register', (req, res) => {
  console.log('Registration request received:', req.body);
  const { name, email, password, homeId } = req.body;
  
  // Check if user already exists
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    console.log('User already exists:', email);
    return res.status(400).json({ message: 'User already exists' });
  }
  
  // Create new user
  const newUser = {
    id: Date.now().toString(),
    name,
    email,
    password,
    role: 'user',
    homeId
  };
  
  users.push(newUser);
  console.log('New user registered successfully:', newUser);
  
  res.status(201).json({
    token: 'mock-token',
    user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, homeId: newUser.homeId }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    res.json({
      token: 'mock-token',
      user: { id: user.id, name: user.name, email: user.email, role: user.role, homeId: user.homeId }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.get('/api/check-home-id/:homeId', (req, res) => {
  const { homeId } = req.params;
  const exists = users.some(u => u.homeId === homeId);
  
  res.json({
    exists,
    suggestion: exists ? `${homeId}_${Math.floor(Math.random() * 1000)}` : null
  });
});

// Sensor routes
app.get('/api/sensors/latest', (req, res) => {
  res.json(sensorData.slice(-10));
});

app.post('/api/sensors/data', (req, res) => {
  const data = { ...req.body, id: Date.now(), timestamp: new Date() };
  sensorData.push(data);
  res.json(data);
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Simple server running on port ${PORT} - ONLINE`);
});