// ─────────────────────────────────────────────────────────────
//  Firebase başlatma
//  .env doluysa gerçek Firebase, boşsa demo mod kullanılır.
// ─────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// databaseURL + apiKey varsa Firebase'i gerçek modda çalıştır
export const FIREBASE_ENABLED = Boolean(cfg.apiKey && cfg.databaseURL)
if (!FIREBASE_ENABLED && import.meta.env.PROD && import.meta.env.MODE !== 'demo') {
  throw new Error('Canlı veritabanı yapılandırılmamış. Sipariş kabul edilemiyor.')
}

let db = null
if (FIREBASE_ENABLED) {
  const app = initializeApp(cfg)
  db = getDatabase(app)
}

export { db }
