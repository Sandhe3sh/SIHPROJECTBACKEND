const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
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
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());

// Add request logging for mobile debugging
app.use((req, res, next) => {
  console.log(`📱 ${req.method} ${req.path} - ${req.get('User-Agent') || 'Unknown'}`);  
  next();
});

// MongoDB Connection with retry logic
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://SandheeshS:Vishnu%402006@cluster0.r78zvli.mongodb.net/solar_microgrid?retryWrites=true&w=majority&appName=Cluster0';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      maxPoolSize: 10
    });
    
    console.log('✅ MongoDB Atlas connected successfully!');
    console.log('🔗 Database:', mongoose.connection.name);
    await createDefaultAdmin();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('🔄 Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 Mongoose disconnected from MongoDB Atlas');
});

// Connect to database
connectDB();

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  homeId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);

// Create default admin user
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@gov.com' });
    if (!adminExists) {
      const adminUser = new User({
        name: 'System Admin',
        email: 'admin@gov.com',
        password: 'admin12',
        role: 'admin'
      });
      await adminUser.save();
      console.log('✅ Default admin user created: admin@gov.com / admin12');
    }
  } catch (error) {
    console.log('⚠️ Could not create default admin user:', error.message);
  }
};

// Sensor Data Schema
const sensorDataSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  solarPanel: {
    voltage: Number,
    current: Number,
    power: Number
  },
  battery: {
    soc: Number,
    voltage: Number,
    current: Number,
    temperature: Number
  },
  loads: {
    L1: Number,
    L2: Number,
    L3: Number
  }
});

const SensorData = mongoose.model('SensorData', sensorDataSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  replyTo: { type: String }, // Track which user this is a reply to
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database connection unavailable' });
    }
    
    const { name, email, password, homeId } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Check if home ID already exists
    const existingHomeId = await User.findOne({ homeId, role: 'user' });
    if (existingHomeId) {
      return res.status(400).json({ message: 'Home ID already exists' });
    }
    
    const newUser = new User({
      name,
      email,
      password,
      role: 'user',
      homeId
    });
    
    await newUser.save();
    console.log(`✅ New user registered: ${name} (${email}) - ${homeId}`);
    
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: { 
        id: newUser._id, 
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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Handle default admin login
    if (email === 'admin@gov.com' && password === 'admin12') {
      const token = jwt.sign({ userId: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      console.log(`✅ Admin logged in: ${email}`);
      return res.json({
        token,
        user: { 
          id: 'admin', 
          name: 'System Admin', 
          email: 'admin@gov.com', 
          role: 'admin'
        }
      });
    }
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database connection unavailable' });
    }
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    console.log(`✅ User logged in: ${user.name} (${email})`);
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.json({
      token,
      user: { 
        id: user._id, 
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

// Get users route
app.get('/api/users', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    
    const users = await User.find({ role: 'user' }).select('name email homeId createdAt');
    console.log(`📊 Found ${users.length} users in database`);
    res.json(users);
  } catch (error) {
    console.log('⚠️ Database query failed, returning empty array');
    res.json([]);
  }
});

// Check if home ID exists and get suggestion
app.get('/api/check-home-id/:homeId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ exists: false, suggestion: 'Home 1' });
    }
    
    const { homeId } = req.params;
    const existingHomeId = await User.findOne({ homeId, role: 'user' });
    
    if (existingHomeId) {
      // Get suggestion for next available home ID
      const users = await User.find({ role: 'user' }).select('homeId');
      const homeNumbers = users.map(user => {
        const match = user.homeId?.match(/Home (\d+)/);
        return match ? parseInt(match[1]) : 0;
      }).filter(num => num > 0);
      
      const nextNumber = homeNumbers.length > 0 ? Math.max(...homeNumbers) + 1 : 1;
      res.json({ exists: true, suggestion: `Home ${nextNumber}` });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.log('⚠️ Failed to check home ID');
    res.json({ exists: false, suggestion: 'Home 1' });
  }
});

// Send message
app.post('/api/messages', async (req, res) => {
  try {
    const { from, to, message, replyTo } = req.body;
    const newMessage = new Message({ from, to, message, replyTo });
    await newMessage.save();
    console.log(`📨 Message sent from ${from} to ${to}${replyTo ? ` (reply to ${replyTo})` : ''}`);
    
    // Send message to specific recipient and sender
    const messageData = {
      _id: newMessage._id,
      from,
      to,
      message,
      replyTo,
      timestamp: newMessage.createdAt
    };
    
    // Send to recipient
    io.to(to).emit('newMessage', messageData);
    // Send to sender for confirmation
    io.to(from).emit('newMessage', messageData);
    // Also broadcast to admin room
    io.to('admin').emit('newMessage', messageData);
    
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get messages for admin
app.get('/api/messages', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    
    const messages = await Message.find().sort({ createdAt: -1 });
    // Transform messages to match frontend format
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
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
      replyTo: msg.replyTo,
      timestamp: msg.createdAt
    }));
    res.json(formattedMessages);
  } catch (error) {
    console.log('⚠️ Failed to fetch messages, returning empty array');
    res.json([]);
  }
});

// Get messages for specific user
app.get('/api/messages/user/:userName', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    
    const { userName } = req.params;
    const messages = await Message.find({
      $or: [
        { from: userName },
        { to: userName },
        { to: 'all' }
      ]
    }).sort({ createdAt: -1 });
    
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
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
      replyTo: msg.replyTo,
      timestamp: msg.createdAt
    }));
    res.json(formattedMessages);
  } catch (error) {
    console.log('⚠️ Failed to fetch user messages, returning empty array');
    res.json([]);
  }
});

// Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete message
app.delete('/api/messages/:id', async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });
  
  socket.on('join-user', (userName) => {
    socket.join(userName);
    console.log(`${userName} joined their room`);
  });
  
  socket.on('sendMessage', async (data) => {
    try {
      const { from, to, message } = data;
      const newMessage = new Message({ from, to, message });
      await newMessage.save();
      
      // Send to specific recipient and sender
      const messageData = {
        _id: newMessage._id,
        from,
        to,
        message,
        timestamp: newMessage.createdAt
      };
      
      io.to(to).emit('newMessage', messageData);
      io.to(from).emit('newMessage', messageData);
      io.to('admin').emit('newMessage', messageData);
    } catch (error) {
      console.error('Socket message error:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Generate and store sensor data
const generateSensorData = async () => {
  const sensorData = {
    timestamp: new Date(),
    solarPanel: {
      voltage: parseFloat((220 + Math.random() * 20).toFixed(2)),
      current: parseFloat((15 + Math.random() * 5).toFixed(2)),
      power: parseFloat((3300 + Math.random() * 500).toFixed(2))
    },
    battery: {
      soc: parseFloat((70 + Math.random() * 30).toFixed(1)),
      voltage: parseFloat((48 + Math.random() * 4).toFixed(2)),
      current: parseFloat((10 + Math.random() * 5).toFixed(2)),
      temperature: parseFloat((25 + Math.random() * 10).toFixed(1))
    },
    loads: {
      L1: parseFloat((500 + Math.random() * 200).toFixed(2)),
      L2: parseFloat((300 + Math.random() * 150).toFixed(2)),
      L3: parseFloat((400 + Math.random() * 100).toFixed(2))
    }
  };
  
  // Check for alert conditions
  if (sensorData.battery.temperature > 40) {
    io.emit('newAlert', {
      type: 'high_temperature',
      message: `Battery temperature is ${sensorData.battery.temperature}°C`,
      severity: 'high'
    });
  }
  
  if (sensorData.battery.soc < 25) {
    io.emit('newAlert', {
      type: 'low_battery', 
      message: `Battery SOC is ${sensorData.battery.soc}%`,
      severity: 'medium'
    });
  }
  
  // Solar efficiency check (assuming good weather conditions)
  const solarEfficiency = (sensorData.solarPanel.power / 4000) * 100; // 4000W max capacity
  const isGoodWeather = Math.random() > 0.3; // 70% chance of good weather
  
  if (isGoodWeather && solarEfficiency < 70) {
    io.emit('newAlert', {
      type: 'low_efficiency',
      message: `Solar efficiency is ${solarEfficiency.toFixed(1)}% despite good weather conditions`,
      severity: 'medium'
    });
  }
  
  // Always emit to connected clients
  io.emit('sensor-data', sensorData);
  
  // Try to save to database if connected
  if (mongoose.connection.readyState === 1) {
    try {
      const newSensorData = new SensorData(sensorData);
      await newSensorData.save();
      console.log('📊 Sensor data updated and stored');
    } catch (error) {
      console.log('⚠️ Database save failed, continuing with real-time data');
    }
  } else {
    console.log('📊 Sensor data updated (no database)');
  }
};

// Generate sensor data every 5 seconds
setInterval(generateSensorData, 5000);

// Simulate random alerts every 30 seconds
setInterval(() => {
  const alertTypes = [
    { type: 'maintenance', message: 'Solar panel cleaning required - dust accumulation detected', severity: 'medium' },
    { type: 'efficiency', message: 'Panel angle adjustment needed for optimal sun exposure', severity: 'low' },
    { type: 'shading', message: 'Partial shading detected on solar panels', severity: 'medium' },
    { type: 'inverter', message: 'Inverter efficiency below optimal range', severity: 'high' },
    { type: 'wiring', message: 'Check electrical connections for power loss', severity: 'medium' }
  ];
  
  if (Math.random() > 0.7) {
    const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    io.emit('newAlert', randomAlert);
  }
}, 30000);

const PORT = process.env.PORT || 5003;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Frontend should connect to http://localhost:3000`);
  console.log(`🔗 Backend API available at http://localhost:${PORT}`);
  console.log(`📊 Real-time sensor data every 5 seconds`);
  console.log(`🗄️ Data stored in MongoDB Atlas`);
});

module.exports = { app, io };
 