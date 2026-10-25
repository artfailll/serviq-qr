const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set } = require('firebase/database');

const cfg = {
  apiKey: "AIzaSyAWInJHzYJCmUqK_YTom9msRYT_LpujzaA",
  authDomain: "sofra-restoran.firebaseapp.com",
  databaseURL: "https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sofra-restoran",
  storageBucket: "sofra-restoran.firebasestorage.app",
  messagingSenderId: "401656388209",
  appId: "1:401656388209:web:7f1302e2c90c990cd3d9d0"
};

async function seedStaff() {
  const app = initializeApp(cfg);
  const db = getDatabase(app);

  const initialStaff = [
    {
      name: "Sezgin Usta",
      role: "owner",
      phone: "(0212) 727 11 28",
      pin: "1234",
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      name: "Kasiyer 1",
      role: "cashier",
      phone: "",
      pin: "2222",
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      name: "Garson 1",
      role: "waiter",
      phone: "",
      pin: "1111",
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  const aliases = [
    'sezgin-usta-doner',
    'sezgin-usta-döner',
    'Sezgin-Usta-Döner',
    'Sezgin-Usta-Doner',
    'sezgin-usta'
  ];

  for (const alias of aliases) {
    console.log(`Setting staff for ${alias}...`);
    const staffRef = ref(db, `businesses/${alias}/staff/members`);
    const membersMap = {};
    for (let i = 0; i < initialStaff.length; i++) {
      const id = 'staff_' + (i + 1);
      membersMap[id] = initialStaff[i];
    }
    await set(staffRef, membersMap);
  }

  console.log('Initial staff successfully seeded for Sezgin Usta!');
  process.exit(0);
}

seedStaff();
