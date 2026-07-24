// React tarafı: gerçek zamanlı abonelik hook'ları + tüm yazma aksiyonları
// Multi-tenant: tüm veriler /businesses/{businessId}/... altına yazılır.
import { createContext, useContext, useEffect, useState } from 'react'
import {
  subscribe,
  pushItem,
  setValue,
  updateValue,
  removeValue,
  mapToList,
  now,
} from './db'
import { dateKey } from './format'

// ───────── İşletme Context ─────────
export const BusinessContext = createContext(null)
export const useBusinessId = () => useContext(BusinessContext)

// businessId ile path üret
const p = (bizId, path) => `businesses/${bizId}/${path}`

// ───────── Genel abonelik hook'ları ─────────
export function useValue(path, initial = null) {
  const [val, setVal] = useState(initial)
  useEffect(() => {
    if (!path) return
    const unsub = subscribe(path, (v) => setVal(v))
    return () => unsub && unsub()
  }, [path])
  return val
}

export function useList(path, sortBy) {
  const raw = useValue(path)
  return mapToList(raw, sortBy)
}

// Saniyede bir yeniden render — süre sayaçları için
export function useTicker(ms = 1000) {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

// ───────── İşletme profili ─────────
export const useProfile = (bizId) => useValue(bizId ? p(bizId, 'menu/profile') : null) || {}
export const updateProfile = (bizId, patch) => updateValue(p(bizId, 'menu/profile'), patch)

// ───────── Menü hook'ları (bizId alır) ─────────
export const useCategories = (bizId) =>
  useList(bizId ? p(bizId, 'menu/categories') : null,
    (a, b) => (a.order || 0) - (b.order || 0))

export const useProducts = (bizId) =>
  useList(bizId ? p(bizId, 'menu/products') : null,
    (a, b) => (a.order || 0) - (b.order || 0))

export const useTables = (bizId) =>
  useList(bizId ? p(bizId, 'menu/tables') : null,
    (a, b) => (a.no || 0) - (b.no || 0))

// ───────── Menü yazma aksiyonları ─────────
export const addProduct = (bizId, prod) =>
  pushItem(p(bizId, 'menu/products'), {
    name: prod.name, desc: prod.desc || '', price: Number(prod.price) || 0,
    image: prod.image || '', categoryId: prod.categoryId,
    available: prod.available !== false, order: prod.order || 99,
    featured: !!prod.featured, tags: prod.tags || [], chef: !!prod.chef,
    variants: prod.variants || [], extras: prod.extras || [],
    // Yönetmelik uyumluluğu — 1 Temmuz 2026 Fiyat Etiketi Yönetmeliği
    gram: prod.gram || '', kalori: prod.kalori || '',
    allergens: prod.allergens || [], alkol: !!prod.alkol, domuz: !!prod.domuz,
    icerik: prod.icerik || '',
    // Kampanya/kombo menü — birden fazla ürünü paket fiyatla birleştirir
    comboItems: prod.comboItems || [],
  })

export const updateProduct = (bizId, id, patch) =>
  updateValue(p(bizId, `menu/products/${id}`), patch)

export const removeProduct = (bizId, id) =>
  removeValue(p(bizId, `menu/products/${id}`))

export const toggleProduct = (bizId, id, available) =>
  updateValue(p(bizId, `menu/products/${id}`), { available })

export const addCategory = (bizId, c) =>
  pushItem(p(bizId, 'menu/categories'), { name: c.name, order: c.order || 99 })

export const removeCategory = (bizId, id) =>
  removeValue(p(bizId, `menu/categories/${id}`))

// ───────── Siparişler ─────────
export const ORDER_STATUSES = ['new', 'kitchen', 'ready', 'served']
export const STATUS_LABELS = {
  new: 'Yeni', kitchen: 'Mutfakta', ready: 'Hazır',
  served: 'Servis Edildi', paid: 'Ödendi', cancelled: 'İptal',
}
export const isActiveStatus = (s) => s !== 'paid' && s !== 'cancelled'

export const useOrders = (bizId) =>
  useList(bizId ? p(bizId, 'orders') : null,
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0))

export function createOrder(bizId, { tableId, tableNo, items, note }) {
  const total = items.reduce((s, it) => s + it.price * it.qty, 0)
  const count = items.reduce((s, it) => s + it.qty, 0)
  const id = pushItem(p(bizId, 'orders'), {
    tableId, tableNo: tableNo ?? null, items, total, count,
    note: note || '', status: 'new', createdAt: now(), updatedAt: now(),
  })
  bumpProductStats(bizId, items)
  return id
}

// ───────── Satış istatistiği (otomatik "Çok Satan" rozetleri) ─────────
// Ürün başına toplam satış adedini menu/stats altında tutar.
// (Tek seferlik okuma + yazma; yoğunlukta küçük sapma kabul edilebilir.)
function bumpProductStats(bizId, items) {
  try {
    let unsub = null
    unsub = subscribe(p(bizId, 'menu/stats'), (val) => {
      unsub?.()
      const stats = val || {}
      const patch = {}
      items.forEach((it) => {
        if (!it.productId) return
        patch[it.productId] = (stats[it.productId] || 0) + it.qty
      })
      if (Object.keys(patch).length) updateValue(p(bizId, 'menu/stats'), patch)
    })
  } catch {}
}

export const useProductStats = (bizId) =>
  useValue(bizId ? p(bizId, 'menu/stats') : null) || {}

// ───────── Müşteri geri bildirimi (düşük puan içeride kalır) ─────────
export const saveFeedback = (bizId, { rating, text, tableNo, orderId }) =>
  pushItem(p(bizId, 'feedback'), {
    rating, text: text || '', tableNo: tableNo ?? null,
    orderId: orderId || null, createdAt: now(),
  })

export const setOrderStatus = (bizId, id, status) =>
  updateValue(p(bizId, `orders/${id}`), { status, updatedAt: now() })

// ───────── Ödeme yöntemleri ─────────
// Raporda ciro bu yöntemlere göre ayrışır → takip kolaylaşır.
export const PAYMENT_METHODS = [
  { key: 'nakit',    label: 'Nakit' },
  { key: 'kart',     label: 'Kredi/Banka Kartı' },
  { key: 'multinet', label: 'Multinet' },
  { key: 'setcard',  label: 'Setcard' },
  { key: 'ticket',   label: 'Ticket' },
  { key: 'sodexo',   label: 'Sodexo' },
  { key: 'metropol', label: 'Metropol' },
]
export const PAYMENT_LABELS = PAYMENT_METHODS.reduce((m, p) => { m[p.key] = p.label; return m }, {})

export const markOrderPaid = (bizId, id, paymentMethod = 'nakit') =>
  updateValue(p(bizId, `orders/${id}`), {
    status: 'paid', paymentMethod, paidAt: now(), updatedAt: now(),
  })

export const cancelOrder = (bizId, id) =>
  updateValue(p(bizId, `orders/${id}`), { status: 'cancelled', updatedAt: now() })

export const removeOrder = (bizId, id) =>
  removeValue(p(bizId, `orders/${id}`))

// ───────── Çağrılar ─────────
export const useCalls = (bizId) =>
  useList(bizId ? p(bizId, 'calls') : null,
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0))

export function createCall(bizId, { tableId, tableNo, type }) {
  return pushItem(p(bizId, 'calls'), {
    tableId, tableNo: tableNo ?? null, type, status: 'pending', createdAt: now(),
  })
}
export const resolveCall = (bizId, id) => removeValue(p(bizId, `calls/${id}`))

// ───────── Masa düzeni ─────────
export const useLayout = (bizId) => useValue(bizId ? p(bizId, 'layout') : null) || {}

export const mergeTables = (bizId, sourceId, targetId) =>
  setValue(p(bizId, `layout/${sourceId}`), { mergedInto: targetId })

export const unmergeTable = (bizId, id) =>
  removeValue(p(bizId, `layout/${id}`))

export function moveOrders(bizId, orders, fromTableId, toTableId, toTableNo) {
  orders
    .filter((o) => o.tableId === fromTableId && isActiveStatus(o.status))
    .forEach((o) => updateValue(p(bizId, `orders/${o.id}`), { tableId: toTableId, tableNo: toTableNo }))
}

// ───────── Masa yönetimi ─────────
export const addTable = (bizId, no) =>
  setValue(p(bizId, `menu/tables/masa${no}`), { no, name: 'Masa ' + no })

export const removeTable = (bizId, id) =>
  removeValue(p(bizId, `menu/tables/${id}`))

// ───────── Gün sonu sıfırlama ─────────
// Günü kapat: siparişleri SİLMEZ, tarihe göre arşive taşır — geçmiş ciro
// raporlarının kaybolmaması için. Aktif ekranlar (kasa/bugün) temizlenir.
export async function resetDay(bizId) {
  const orders = await new Promise((resolve) => {
    let unsub = null
    unsub = subscribe(p(bizId, 'orders'), (val) => { unsub?.(); resolve(val || {}) })
  })

  // Siparişleri kendi gününe göre grupla (bazen birden çok gün birikmiş olabilir)
  const byDay = {}
  Object.entries(orders).forEach(([id, o]) => {
    const day = dateKey(o.createdAt)
    byDay[day] = byDay[day] || {}
    byDay[day][id] = o
  })

  // Her günün verisini arşive ekle (üzerine yazmaz, birleştirir)
  await Promise.all(
    Object.entries(byDay).map(([day, dayOrders]) => updateValue(p(bizId, `archive/${day}`), dayOrders))
  )

  removeValue(p(bizId, 'orders'))
  removeValue(p(bizId, 'calls'))
  removeValue(p(bizId, 'layout'))
}

// ───────── Arşiv (geçmiş gün istatistikleri) ─────────
// Belirli bir gün için arşivlenmiş siparişleri döndürür.
export function useArchiveDay(bizId, day) {
  return useList(bizId && day ? p(bizId, `archive/${day}`) : null)
}

// Tüm arşiv ağacını döndürür — { "2026-06-30": {orderId: {...}}, ... }
// Tarih aralığı raporları (bu hafta/bu ay) için ham veri.
export function useArchiveAll(bizId) {
  return useValue(bizId ? p(bizId, 'archive') : null) || {}
}
