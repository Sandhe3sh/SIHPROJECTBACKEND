const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let messages = [];

// View all messages
app.get('/view-messages', (req, res) => {
  console.log('📧 All Messages:');
  messages.forEach((msg, index) => {
    console.log(`${index + 1}. From: ${msg.from} → To: ${msg.to}`);
    console.log(`   Message: ${msg.message}`);
    console.log(`   Time: ${new Date(msg.timestamp).toLocaleString()}`);
    console.log('');
  });
  res.json(messages);
});

// Add message (for testing)
app.post('/add-message', (req, res) => {
  const newMessage = {
    _id: Date.now().toString(),
    ...req.body,
    timestamp: new Date(),
    isRead: false
  };
  messages.push(newMessage);
  console.log('✅ Message added:', newMessage);
  res.json({ success: true });
});

app.listen(5002, () => {
  console.log('Message viewer running on http://localhost:5002/view-messages');
});