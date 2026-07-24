// ─────────────────────────────────────────────────────────────
//  Veri katmanı soyutlaması
//  Tek bir API, iki uygulama:
//   1) Firebase Realtime Database (gerçek, cihazlar arası)
//   2) Yerel demo adaptörü (localStorage + BroadcastChannel,
//      aynı tarayıcıda sekmeler arası anlık senkron)
//
//  Ekranlar yalnızca buradaki fonksiyonları kullanır; alttaki
//  motorun ne olduğunu bilmez. Firebase .env'i doldurunca tek
//  satır kod değişmeden gerçek senkrona geçilir.
// ─────────────────────────────────────────────────────────────
import { FIREBASE_ENABLED, db as fdb } from '../firebase'
import {
  ref,
  onValue,
  push as fPush,
  set as fSet,
  update as fUpdate,
  remove as fRemove,
  serverTimestamp,
} from 'firebase/database'

export const IS_DEMO = !FIREBASE_ENABLED

// ===== Ortak yardımcılar =====
export const now = () => Date.now()
export const tsField = () => (IS_DEMO ? Date.now() : serverTimestamp())

// ============================================================
//  FIREBASE ADAPTÖRÜ
// ============================================================
const firebaseAdapter = {
  subscribe(path, cb) {
    const r = ref(fdb, path)
    return onValue(r, (snap) => cb(snap.val()))
  },
  push(path, value) {
    const r = fPush(ref(fdb, path))
    fSet(r, value)
    return r.key
  },
  set(path, value) {
    return fSet(ref(fdb, path), value)
  },
  update(path, value) {
    return fUpdate(ref(fdb, path), value)
  },
  remove(path) {
    return fRemove(ref(fdb, path))
  },
}

// ============================================================
//  YEREL DEMO ADAPTÖRÜ
// ============================================================
const LS_KEY = 'sofra_db_v1'
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sofra_db') : null

const listeners = new Set() // { path, cb }

function readTree() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {}
  } catch {
    return {}
  }
}
function writeTree(tree) {
  localStorage.setItem(LS_KEY, JSON.stringify(tree))
}

function getAtPath(tree, path) {
  if (!path) return tree
  const parts = path.split('/').filter(Boolean)
  let node = tree
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return null
    node = node[p]
  }
  return node === undefined ? null : node
}

function setAtPath(tree, path, value) {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return value ?? {}
  const root = { ...tree }
  let node = root
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    node[key] = node[key] && typeof node[key] === 'object' ? { ...node[key] } : {}
    node = node[key]
  }
  const last = parts[parts.length - 1]
  if (value === null || value === undefined) {
    delete node[last]
  } else {
    node[last] = value
  }
  return root
}

function genKey() {
  // Firebase push key'lerine benzer, zaman sıralı, çakışmasız
  return '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function notifyAll() {
  const tree = readTree()
  for (const { path, cb } of listeners) {
    cb(getAtPath(tree, path))
  }
}

function broadcastChange() {
  if (channel) channel.postMessage({ type: 'change', at: Date.now() })
}

if (channel) {
  channel.onmessage = () => notifyAll()
}
// Aynı sekme içi başka mekanizmalar için storage olayı da dinlenir
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) notifyAll()
  })
}

const localAdapter = {
  subscribe(path, cb) {
    const entry = { path, cb }
    listeners.add(entry)
    // İlk değeri Firebase gibi asenkron ver (çağıran taraf unsub'ı
    // atayabilsin diye — senkron çağrı yarış durumuna yol açıyordu).
    queueMicrotask(() => {
      if (listeners.has(entry)) cb(getAtPath(readTree(), path))
    })
    return () => listeners.delete(entry)
  },
  push(path, value) {
    const key = genKey()
    const tree = setAtPath(readTree(), `${path}/${key}`, value)
    writeTree(tree)
    notifyAll()
    broadcastChange()
    return key
  },
  set(path, value) {
    const tree = setAtPath(readTree(), path, value)
    writeTree(tree)
    notifyAll()
    broadcastChange()
  },
  update(path, value) {
    let tree = readTree()
    const existing = getAtPath(tree, path)
    const merged = { ...(existing && typeof existing === 'object' ? existing : {}), ...value }
    tree = setAtPath(tree, path, merged)
    writeTree(tree)
    notifyAll()
    broadcastChange()
  },
  remove(path) {
    const tree = setAtPath(readTree(), path, null)
    writeTree(tree)
    notifyAll()
    broadcastChange()
  },
}

// ============================================================
//  Dışa aktarılan tek API
// ============================================================
const adapter = IS_DEMO ? localAdapter : firebaseAdapter

export const subscribe = (path, cb) => adapter.subscribe(path, cb)
export const pushItem = (path, value) => adapter.push(path, value)
export const setValue = (path, value) => adapter.set(path, value)
export const updateValue = (path, value) => adapter.update(path, value)
export const removeValue = (path) => adapter.remove(path)

// Bir nesne haritasını ({key: item}) diziye çevirir, isteğe bağlı sıralama
export function mapToList(obj, sortBy) {
  if (!obj) return []
  const list = Object.entries(obj).map(([id, v]) => ({ id, ...v }))
  if (sortBy) list.sort(sortBy)
  return list
}
