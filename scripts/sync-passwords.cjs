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

async function syncPasswords() {
  const app = initializeApp(cfg);
  const db = getDatabase(app);
  
  const aliases = [
    'sezgin-usta-döner',
    'Sezgin-Usta-Döner',
    'Sezgin-Usta-Doner',
    'sezginusta',
    'sezgin-usta'
  ];
  
  for (const alias of aliases) {
    await set(ref(db, `businesses/${alias}/config/password`), 'sezginusta123');
  }
  console.log('Passwords synced!');
  process.exit(0);
}

syncPasswords();
