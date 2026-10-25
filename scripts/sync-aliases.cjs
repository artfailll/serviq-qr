const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

const cfg = {
  apiKey: "AIzaSyAWInJHzYJCmUqK_YTom9msRYT_LpujzaA",
  authDomain: "sofra-restoran.firebaseapp.com",
  databaseURL: "https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sofra-restoran",
  storageBucket: "sofra-restoran.firebasestorage.app",
  messagingSenderId: "401656388209",
  appId: "1:401656388209:web:7f1302e2c90c990cd3d9d0"
};

async function syncMirrors() {
  const app = initializeApp(cfg);
  const db = getDatabase(app);
  
  // Read primary data from sezgin-usta-doner
  const menuSnap = await get(ref(db, 'businesses/sezgin-usta-doner/menu'));
  const menuVal = menuSnap.val();
  
  const aliases = [
    'sezgin-usta-döner',
    'Sezgin-Usta-Döner',
    'Sezgin-Usta-Doner',
    'sezginusta',
    'sezgin-usta'
  ];
  
  for (const alias of aliases) {
    console.log(`Syncing ${alias}...`);
    await set(ref(db, `businesses/${alias}/menu`), menuVal);
  }
  console.log('All aliases synced successfully!');
  process.exit(0);
}

syncMirrors();
