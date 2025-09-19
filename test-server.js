const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ message: 'Backend is working!', port: 5001 });
});

// Registration endpoint
app.post('/api/auth/register', (req, res) => {
  console.log('Registration request:', req.body);
  res.json({ message: 'Registration successful!', user: req.body });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login request:', req.body);
  const { email, password } = req.body;
  
  const users = [
    { id: '1', email: 'admin@solar.com', password: 'admin123', name: 'Admin', role: 'admin' },
    { id: '2', email: 'user@solar.com', password: 'user123', name: 'User', role: 'user' },
    { id: '3', email: 'deve019@gmail.com', password: 'deve123', name: 'Deva', role: 'user', homeId: 'Home6' }
  ];
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    res.json({
      token: 'test-token',
      user: { id: user.id, name: user.name, email: user.email, role: user.role, homeId: user.homeId }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Mock sensor data endpoints
app.get('/api/sensors/latest', (req, res) => {
  const mockData = [
    {
      deviceType: 'solar',
      voltage: 24.5,
      current: 8.2,
      power: 2009,
      timestamp: new Date()
    },
    {
      deviceType: 'battery',
      voltage: 12.8,
      current: 5.5,
      power: 704,
      soc: 85,
      temperature: 28,
      timestamp: new Date()
    },
    {
      deviceType: 'load',
      voltage: 230,
      current: 6.5,
      power: 1495,
      timestamp: new Date()
    }
  ];
  res.json(mockData);
});

app.post('/api/sensors/data', (req, res) => {
  console.log('Sensor data received:', req.body);
  res.json({ success: true, data: req.body });
});

// Users endpoint
app.get('/api/users', (req, res) => {
  const mockUsers = [
    { _id: '1', name: 'John Doe', email: 'john@example.com', homeId: 'Home1', createdAt: new Date() },
    { _id: '2', name: 'Jane Smith', email: 'jane@example.com', homeId: 'Home2', createdAt: new Date() },
    { _id: '3', name: 'Bob Wilson', email: 'bob@example.com', homeId: 'Home3', createdAt: new Date() }
  ];
  res.json(mockUsers);
});

// Messages endpoints
let messages = [];

app.post('/api/messages', (req, res) => {
  console.log('✅ Message received:', req.body);
  try {
    const newMessage = {
      _id: Date.now().toString(),
      ...req.body,
      timestamp: new Date(),
      isRead: false
    };
    messages.push(newMessage);
    console.log('✅ Message saved successfully');
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('❌ Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.get('/api/messages/user/:userName', (req, res) => {
  const userMessages = messages.filter(m => m.to === req.params.userName || m.from === req.params.userName);
  res.json(userMessages);
});

app.put('/api/messages/:id/read', (req, res) => {
  const message = messages.find(m => m._id === req.params.id);
  if (message) {
    message.isRead = true;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

app.delete('/api/messages/:id', (req, res) => {
  messages = messages.filter(m => m._id !== req.params.id);
  res.json({ success: true });
});

// Debug endpoint to view all messages
app.get('/api/debug/messages', (req, res) => {
  console.log('📧 Current stored messages:', messages.length);
  messages.forEach((msg, index) => {
    console.log(`${index + 1}. ${msg.from} → ${msg.to}: ${msg.message}`);
  });
  res.json({ count: messages.length, messages });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send mock sensor data every 5 seconds
  const interval = setInterval(() => {
    const mockSensorData = {
      timestamp: new Date(),
      solarPanel: {
        voltage: '24.5',
        current: '8.2',
        power: '2009'
      },
      battery: {
        soc: '85',
        voltage: '12.8',
        current: '5.5',
        temperature: '28'
      },
      loads: {
        L1: '450',
        L2: '620',
        L3: '425'
      }
    };
    socket.emit('sensor-data', mockSensorData);
  }, 5000);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    clearInterval(interval);
  });
});

server.listen(5001, () => {
  console.log('Test server with Socket.IO running on port 5001');
});