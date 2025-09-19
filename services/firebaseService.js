const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "solar-energy-sih-2024",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://solar-energy-sih-2024-default-rtdb.firebaseio.com"
  });
}

const db = admin.firestore();
const realtimeDb = admin.database();
const auth = admin.auth();

// User operations
const createUser = async (userData) => {
  try {
    const userRecord = await auth.createUser({
      email: userData.email,
      password: userData.password,
      displayName: userData.name
    });
    
    await db.collection('users').doc(userRecord.uid).set({
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      homeId: userData.homeId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return userRecord;
  } catch (error) {
    throw error;
  }
};

const getUserById = async (uid) => {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    return userDoc.exists ? { id: uid, ...userDoc.data() } : null;
  } catch (error) {
    throw error;
  }
};

// Sensor data operations
const saveSensorData = async (data) => {
  try {
    const timestamp = Date.now();
    await realtimeDb.ref('sensorData').push({
      ...data,
      timestamp
    });
    
    // Also save to Firestore for historical data
    await db.collection('sensorData').add({
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

const getLatestSensorData = async () => {
  try {
    const snapshot = await realtimeDb.ref('sensorData').orderByChild('timestamp').limitToLast(1).once('value');
    const data = snapshot.val();
    return data ? Object.values(data)[0] : null;
  } catch (error) {
    throw error;
  }
};

// Alert operations
const createAlert = async (alertData) => {
  try {
    const alertRef = await db.collection('alerts').add({
      ...alertData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      resolved: false
    });
    
    // Also save to realtime database for instant notifications
    await realtimeDb.ref('alerts').push({
      id: alertRef.id,
      ...alertData,
      timestamp: Date.now()
    });
    
    return alertRef.id;
  } catch (error) {
    throw error;
  }
};

const getAlerts = async (limit = 50) => {
  try {
    const snapshot = await db.collection('alerts')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    throw error;
  }
};

// Message operations
const createMessage = async (messageData) => {
  try {
    const messageRef = await db.collection('messages').add({
      ...messageData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });
    
    return messageRef.id;
  } catch (error) {
    throw error;
  }
};

const getMessages = async (userId = null) => {
  try {
    let query = db.collection('messages').orderBy('createdAt', 'desc');
    
    if (userId) {
      query = query.where('recipientId', '==', userId);
    }
    
    const snapshot = await query.limit(50).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    throw error;
  }
};

module.exports = {
  admin,
  db,
  realtimeDb,
  auth,
  createUser,
  getUserById,
  saveSensorData,
  getLatestSensorData,
  createAlert,
  getAlerts,
  createMessage,
  getMessages
};