const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://10.207.56.26:3000'],
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Real-time data for all registered homes
const userSensorData = {
  'admin@solar.com': {
    solarPanel: { voltage: '25.2', current: '9.1', power: '2294' },
    battery: { soc: '91', voltage: '13.1', current: '6.8', temperature: '30' },
    loads: { L1: '520', L2: '680', L3: '445' }
  },
  'user@solar.com': {
    solarPanel: { voltage: '24.5', current: '8.2', power: '2009' },
    battery: { soc: '85', voltage: '12.8', current: '5.5', temperature: '28' },
    loads: { L1: '450', L2: '0', L3: '0' }
  },
  'jee018@gmail.com': {
    solarPanel: { voltage: '23.8', current: '7.5', power: '1785' },
    battery: { soc: '72', voltage: '12.6', current: '4.2', temperature: '26' },
    loads: { L1: '380', L2: '0', L3: '0' }
  },

  'jane@solar.com': {
    solarPanel: { voltage: '24.8', current: '8.5', power: '2108' },
    battery: { soc: '78', voltage: '12.7', current: '5.1', temperature: '27' },
    loads: { L1: '410', L2: '0', L3: '0' }
  },
  'bob@solar.com': {
    solarPanel: { voltage: '23.2', current: '7.8', power: '1810' },
    battery: { soc: '83', voltage: '12.9', current: '4.7', temperature: '29' },
    loads: { L1: '395', L2: '0', L3: '0' }
  }
};

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const users = [
    { id: '1', email: 'admin@solar.com', password: 'admin123', name: 'Admin', role: 'admin' },
    { id: '2', email: 'user@solar.com', password: 'user123', name: 'User', role: 'user' },
    { id: '3', email: 'jee018@gmail.com', password: 'jee123', name: 'Jee', role: 'user', homeId: 'Home2' },

    { id: '5', email: 'jane@solar.com', password: 'jane123', name: 'Jane', role: 'user', homeId: 'Home3' },
    { id: '6', email: 'bob@solar.com', password: 'bob123', name: 'Bob', role: 'user', homeId: 'Home4' }
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

// Socket.IO with user-specific data
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('user-login', (userEmail) => {
    console.log('User logged in:', userEmail);
    
    const interval = setInterval(() => {
      const userData = userSensorData[userEmail];
    
    if (!userData) {
      console.log('No data found for user:', userEmail);
      return;
    }
    
    console.log('Sending personalized data for:', userEmail);
      
      // Add some random variation
      const variation = () => (Math.random() - 0.5) * 0.1;
      
      const mockSensorData = {
        timestamp: new Date(),
        solarPanel: {
          voltage: (parseFloat(userData.solarPanel.voltage) + variation()).toFixed(1),
          current: (parseFloat(userData.solarPanel.current) + variation()).toFixed(1),
          power: (parseFloat(userData.solarPanel.power) + variation() * 50).toFixed(0)
        },
        battery: {
          soc: (parseFloat(userData.battery.soc) + variation() * 2).toFixed(0),
          voltage: (parseFloat(userData.battery.voltage) + variation()).toFixed(1),
          current: (parseFloat(userData.battery.current) + variation()).toFixed(1),
          temperature: (parseFloat(userData.battery.temperature) + variation()).toFixed(0)
        },
        loads: {
          L1: (parseFloat(userData.loads.L1) + variation() * 20).toFixed(0),
          L2: (parseFloat(userData.loads.L2) + variation() * 20).toFixed(0),
          L3: (parseFloat(userData.loads.L3) + variation() * 20).toFixed(0)
        }
      };
      
      socket.emit('sensor-data', mockSensorData);
    }, 3000);
    
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      clearInterval(interval);
    });
  });
});

// Messages endpoints with file persistence
const fs = require('fs');
const messagesFile = './messages.json';

// Load messages from file
let messages = [];
try {
  if (fs.existsSync(messagesFile)) {
    messages = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
    console.log(`Loaded ${messages.length} messages from file`);
  }
} catch (error) {
  console.log('No existing messages file found');
}

// Save messages to file
const saveMessages = () => {
  fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
};

app.post('/api/messages', (req, res) => {
  console.log('✅ Message received:', req.body);
  const newMessage = {
    _id: Date.now().toString(),
    ...req.body,
    timestamp: new Date(),
    isRead: false
  };
  messages.push(newMessage);
  saveMessages(); // Save to file
  
  // Broadcast new message to all connected users
  io.emit('new-message', newMessage);
  console.log('📢 Message broadcasted to all users');
  
  res.json({ success: true, message: 'Message sent successfully!' });
});

app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.get('/api/users', (req, res) => {
  const mockUsers = [
    { _id: '1', name: 'Admin', email: 'admin@solar.com', homeId: 'Admin', createdAt: new Date() },
    { _id: '2', name: 'User', email: 'user@solar.com', homeId: 'Home1', createdAt: new Date() },
    { _id: '3', name: 'Jee', email: 'jee018@gmail.com', homeId: 'Home2', createdAt: new Date() },

    { _id: '5', name: 'Jane', email: 'jane@solar.com', homeId: 'Home3', createdAt: new Date() },
    { _id: '6', name: 'Bob', email: 'bob@solar.com', homeId: 'Home4', createdAt: new Date() }
  ];
  res.json(mockUsers);
});

const PORT = process.env.PORT || 5003;
server.listen(PORT, () => {
  console.log(`Firebase-like realtime server with messaging running on port ${PORT}`);
});