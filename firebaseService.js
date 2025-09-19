const { db } = require('./firebase');
const bcrypt = require('bcryptjs');

class FirebaseService {
  // User operations
  async createUser(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const userRef = await db.collection('users').add({
      ...userData,
      password: hashedPassword,
      createdAt: new Date()
    });
    return userRef.id;
  }

  async getUserByEmail(email) {
    const snapshot = await db.collection('users').where('email', '==', email).get();
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }

  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Sensor data operations
  async saveSensorData(data) {
    const docRef = await db.collection('sensorData').add({
      ...data,
      timestamp: new Date()
    });
    return docRef.id;
  }

  async getSensorData(limit = 10) {
    const snapshot = await db.collection('sensorData')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Alert operations
  async createAlert(alertData) {
    const docRef = await db.collection('alerts').add({
      ...alertData,
      timestamp: new Date()
    });
    return docRef.id;
  }

  async getAlerts(status = 'active') {
    const snapshot = await db.collection('alerts')
      .where('status', '==', status)
      .orderBy('timestamp', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Message operations
  async createMessage(messageData) {
    const docRef = await db.collection('messages').add({
      ...messageData,
      timestamp: new Date()
    });
    return docRef.id;
  }

  async getMessages(userId) {
    const snapshot = await db.collection('messages')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

module.exports = new FirebaseService();