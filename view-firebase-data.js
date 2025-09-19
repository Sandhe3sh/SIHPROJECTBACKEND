const { db } = require('./firebase');

async function viewAllUsers() {
  try {
    console.log('📊 Fetching all registered users from Firebase...\n');
    
    const snapshot = await db.collection('users').get();
    
    if (snapshot.empty) {
      console.log('❌ No users found in Firebase');
      return;
    }
    
    console.log(`✅ Found ${snapshot.size} users:\n`);
    
    snapshot.forEach(doc => {
      const userData = doc.data();
      console.log(`🔹 ID: ${doc.id}`);
      console.log(`   Name: ${userData.name}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Home ID: ${userData.homeId || 'N/A'}`);
      console.log(`   Created: ${userData.createdAt?.toDate() || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
  }
}

async function viewSensorData() {
  try {
    console.log('📊 Fetching sensor data from Firebase...\n');
    
    const snapshot = await db.collection('sensorData')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    if (snapshot.empty) {
      console.log('❌ No sensor data found');
      return;
    }
    
    console.log(`✅ Latest ${snapshot.size} sensor readings:\n`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`🔹 ${data.deviceType}: ${data.power}W at ${data.timestamp?.toDate()}`);
    });
    
  } catch (error) {
    console.error('❌ Error fetching sensor data:', error.message);
  }
}

// Run the functions
viewAllUsers().then(() => {
  viewSensorData().then(() => {
    process.exit(0);
  });
});