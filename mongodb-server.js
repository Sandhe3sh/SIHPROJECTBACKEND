const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

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

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://SandheeshS:Vishnu%402006@cluster0.r78zvli.mongodb.net/solar_microgrid?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'user' },
  homeId: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  senderId: String,
  senderName: String,
  recipientId: String,
  title: String,
  content: String,
  type: String,
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

const Message = mongoose.model('Message', messageSchema);

// Real-time data for all registered homes
const userSensorData = {
  'admin@solar.com': {
    solarPanel: { voltage: '25.2', current: '9.1', power: '2294' },
    battery: { soc: '91', voltage: '13.1', current: '6.8', temperature: '30' },
    loads: { L1: '520', L2: '680', L3: '445' }
  },
  'admin@gov.com': {
    solarPanel: { voltage: '26.1', current: '9.5', power: '2480' },
    battery: { soc: '88', voltage: '13.2', current: '7.1', temperature: '29' },
    loads: { L1: '580', L2: '720', L3: '490' }
  },
  'vichu@gmail.com': {
    solarPanel: { voltage: '24.3', current: '8.7', power: '2114' },
    battery: { soc: '76', voltage: '12.9', current: '5.8', temperature: '31' },
    loads: { L1: '420', L2: '0', L3: '0' }
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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    let user = await User.findOne({ email });
    
    // If user doesn't exist in DB, check hardcoded users
    if (!user) {
      const hardcodedUsers = [
        { id: '1', email: 'admin@solar.com', password: 'admin123', name: 'Admin', role: 'admin' },
        { id: '2', email: 'user@solar.com', password: 'user123', name: 'User', role: 'user' },
        { id: '3', email: 'jee018@gmail.com', password: 'jee123', name: 'Jee', role: 'user', homeId: 'Home2' },
        { id: '5', email: 'jane@solar.com', password: 'jane123', name: 'Jane', role: 'user', homeId: 'Home3' },
        { id: '6', email: 'bob@solar.com', password: 'bob123', name: 'Bob', role: 'user', homeId: 'Home4' }
      ];
      
      const hardcodedUser = hardcodedUsers.find(u => u.email === email && u.password === password);
      
      if (hardcodedUser) {
        const token = jwt.sign({ userId: hardcodedUser.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        return res.json({
          token,
          user: { id: hardcodedUser.id, name: hardcodedUser.name, email: hardcodedUser.email, role: hardcodedUser.role, homeId: hardcodedUser.homeId }
        });
      }
    } else {
      // Check password for DB user
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        return res.json({
          token,
          user: { id: user._id, name: user.name, email: user.email, role: user.role, homeId: user.homeId }
        });
      }
    }
    
    res.status(401).json({ message: 'Invalid credentials' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, homeId } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      homeId
    });
    
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, homeId: user.homeId }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
        // Use default data for unknown users
        userData = {
          solarPanel: { voltage: '24.0', current: '8.0', power: '1920' },
          battery: { soc: '75', voltage: '12.8', current: '5.0', temperature: '28' },
          loads: { L1: '400', L2: '0', L3: '0' }
        };
        console.log('Using default data for user:', userEmail);
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

// Messages endpoints
app.post('/api/messages', async (req, res) => {
  try {
    console.log('✅ Message received:', req.body);
    const message = new Message(req.body);
    await message.save();
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    // Add hardcoded users if DB is empty
    if (users.length === 0) {
      const mockUsers = [
        { _id: '1', name: 'Admin', email: 'admin@solar.com', homeId: 'Admin', createdAt: new Date() },
        { _id: '2', name: 'User', email: 'user@solar.com', homeId: 'Home1', createdAt: new Date() },
        { _id: '3', name: 'Jee', email: 'jee018@gmail.com', homeId: 'Home2', createdAt: new Date() },
        { _id: '5', name: 'Jane', email: 'jane@solar.com', homeId: 'Home3', createdAt: new Date() },
        { _id: '6', name: 'Bob', email: 'bob@solar.com', homeId: 'Home4', createdAt: new Date() }
      ];
      return res.json(mockUsers);
    }
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5003;
server.listen(PORT, () => {
  console.log(`MongoDB server running on port ${PORT}`);
});