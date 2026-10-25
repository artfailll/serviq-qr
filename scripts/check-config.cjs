const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const cfg = {
  apiKey: "AIzaSyAWInJHzYJCmUqK_YTom9msRYT_LpujzaA",
  authDomain: "sofra-restoran.firebaseapp.com",
  databaseURL: "https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sofra-restoran",
  storageBucket: "sofra-restoran.firebasestorage.app",
  messagingSenderId: "401656388209",
  appId: "1:401656388209:web:7f1302e2c90c990cd3d9d0"
};

async function checkConfig() {
  const app = initializeApp(cfg);
  const db = getDatabase(app);
  
  const aliases = [
    'sezgin-usta-doner',
    'sezgin-usta-döner',
    'Sezgin-Usta-Döner',
    'Sezgin-Usta-Doner',
    'sezgin-usta'
  ];

  for (const a of aliases) {
    const snap = await get(ref(db, `businesses/${a}/config`));
    console.log(`Config for ${a}:`, snap.val());
  }
  process.exit(0);
}

checkConfig();
