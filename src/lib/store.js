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

// ───────── İşletme OS: stok, ekip, müşteri ve şube ─────────
// Bu kaynaklar dış entegrasyon gerektirmeden Firebase/demo adaptörlerinin
// ikisinde de aynı şekilde çalışır. ERP ekranları tek bir veri sözleşmesine
// bağlanır; ileride satın alma ve e-fatura modülleri bu kayıtlara eklenebilir.
export const INVENTORY_UNITS = [
  { key: 'adet', label: 'Adet' }, { key: 'kg', label: 'Kg' }, { key: 'g', label: 'Gram' },
  { key: 'lt', label: 'Litre' }, { key: 'ml', label: 'Ml' }, { key: 'paket', label: 'Paket' },
]
export const STAFF_ROLES = [
  { key: 'owner', label: 'İşletme sahibi' }, { key: 'manager', label: 'Yönetici' },
  { key: 'cashier', label: 'Kasa' }, { key: 'waiter', label: 'Garson' }, { key: 'kitchen', label: 'Mutfak' },
]

export const useInventory = (bizId) =>
  useList(bizId ? p(bizId, 'inventory/items') : null,
    (a, b) => (a.name || '').localeCompare(b.name || '', 'tr'))
export const useStaff = (bizId) =>
  useList(bizId ? p(bizId, 'staff/members') : null,
    (a, b) => (a.name || '').localeCompare(b.name || '', 'tr'))
export const useShifts = (bizId) =>
  useList(bizId ? p(bizId, 'staff/shifts') : null,
    (a, b) => (b.startedAt || 0) - (a.startedAt || 0))
export const useCustomers = (bizId) =>
  useList(bizId ? p(bizId, 'crm/customers') : null,
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
export const useBranches = (bizId) =>
  useList(bizId ? p(bizId, 'branches') : null,
    (a, b) => (a.name || '').localeCompare(b.name || '', 'tr'))

export function addInventoryItem(bizId, item) {
  const name = String(item.name || '').trim()
  if (!name) return null
  return pushItem(p(bizId, 'inventory/items'), {
    name: name.slice(0, 120), unit: item.unit || 'adet', stock: Math.max(0, Number(item.stock) || 0),
    minStock: Math.max(0, Number(item.minStock) || 0), cost: Math.max(0, Number(item.cost) || 0),
    category: String(item.category || 'Genel').slice(0, 80), supplier: String(item.supplier || '').slice(0, 120),
    updatedAt: now(), createdAt: now(),
  })
}
export const updateInventoryItem = (bizId, id, patch) => updateValue(p(bizId, `inventory/items/${id}`), { ...patch, updatedAt: now() })
export const removeInventoryItem = (bizId, id) => removeValue(p(bizId, `inventory/items/${id}`))
export function adjustInventory(bizId, id, delta, reason = 'Manuel stok düzeltmesi') {
  const amount = Number(delta) || 0
  if (!amount) return null
  const key = pushItem(p(bizId, 'inventory/movements'), { itemId: id, delta: amount, reason: String(reason).slice(0, 160), createdAt: now() })
  return key
}
export const addStaffMember = (bizId, member) => {
  const name = String(member.name || '').trim()
  if (!name) return null
  return pushItem(p(bizId, 'staff/members'), { name: name.slice(0, 100), role: member.role || 'waiter', phone: String(member.phone || '').slice(0, 30), active: member.active !== false, createdAt: now(), updatedAt: now() })
}
export const updateStaffMember = (bizId, id, patch) => updateValue(p(bizId, `staff/members/${id}`), { ...patch, updatedAt: now() })
export const removeStaffMember = (bizId, id) => removeValue(p(bizId, `staff/members/${id}`))
export const startShift = (bizId, staffId, note = '') => pushItem(p(bizId, 'staff/shifts'), { staffId, note: String(note).slice(0, 160), startedAt: now(), status: 'open' })
export const endShift = (bizId, id) => updateValue(p(bizId, `staff/shifts/${id}`), { status: 'closed', endedAt: now() })
export const upsertCustomer = (bizId, customer) => {
  const id = customer.id || pushItem(p(bizId, 'crm/customers'), { name: String(customer.name || '').slice(0, 100), phone: String(customer.phone || '').slice(0, 30), points: Math.max(0, Number(customer.points) || 0), visits: Math.max(0, Number(customer.visits) || 0), spend: Math.max(0, Number(customer.spend) || 0), consent: customer.consent !== false, createdAt: now(), updatedAt: now() })
  if (customer.id) updateValue(p(bizId, `crm/customers/${customer.id}`), { ...customer, updatedAt: now() })
  return id
}
export const addBranch = (bizId, branch) => {
  const name = String(branch.name || '').trim()
  if (!name) return null
  return pushItem(p(bizId, 'branches'), { name: name.slice(0, 100), address: String(branch.address || '').slice(0, 180), active: branch.active !== false, createdAt: now(), updatedAt: now() })
}
export const updateBranch = (bizId, id, patch) => updateValue(p(bizId, `branches/${id}`), { ...patch, updatedAt: now() })
export const removeBranch = (bizId, id) => removeValue(p(bizId, `branches/${id}`))

export const useTables = (bizId) =>
  useList(bizId ? p(bizId, 'menu/tables') : null,
    (a, b) => (a.no || 0) - (b.no || 0))

// ───────── Menü yazma aksiyonları ─────────
export const addProduct = (bizId, prod) =>
  pushItem(p(bizId, 'menu/products'), {
    name: prod.name, desc: prod.desc || '', price: Number(prod.price) || 0,
    cost: Math.max(0, Number(prod.cost) || 0),
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

export function createOrder(bizId, { tableId, tableNo, items, note, customer }) {
  const total = items.reduce((s, it) => s + it.price * it.qty, 0)
  const count = items.reduce((s, it) => s + it.qty, 0)
  const id = pushItem(p(bizId, 'orders'), {
    tableId, tableNo: tableNo ?? null, items, total, count,
    note: note || '', customer: customer?.name || customer?.phone ? { name: String(customer.name || '').slice(0, 100), phone: String(customer.phone || '').slice(0, 30), consent: customer.consent !== false } : null,
    status: 'new', createdAt: now(), updatedAt: now(),
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

// ───────── Finans / gider defteri ─────────
// Ciro raporunun kâr ve nakit görünümünü tamamlamak için giderler ayrı tutulur.
// Siparişler gibi işletme bazında izole edilir ve Firebase/demo adaptörlerinin
// ikisinde de aynı API üzerinden çalışır.
export const EXPENSE_CATEGORIES = [
  { key: 'malzeme', label: 'Malzeme / Stok' },
  { key: 'personel', label: 'Personel' },
  { key: 'kira', label: 'Kira' },
  { key: 'fatura', label: 'Fatura / Abonelik' },
  { key: 'vergi', label: 'Vergi / Resmî' },
  { key: 'pazarlama', label: 'Pazarlama' },
  { key: 'bakim', label: 'Bakım / Ekipman' },
  { key: 'diger', label: 'Diğer' },
]

export const useExpenses = (bizId) =>
  useList(bizId ? p(bizId, 'finance/expenses') : null,
    (a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0))

export function addExpense(bizId, expense) {
  const amount = Math.max(0, Number(expense.amount) || 0)
  if (!amount) return null
  return pushItem(p(bizId, 'finance/expenses'), {
    date: Number(expense.date) || now(),
    category: expense.category || 'diger',
    amount,
    note: String(expense.note || '').slice(0, 240),
    vendor: String(expense.vendor || '').slice(0, 120),
    paymentMethod: expense.paymentMethod || 'nakit',
    createdAt: now(),
    updatedAt: now(),
  })
}

export const updateExpense = (bizId, id, patch) =>
  updateValue(p(bizId, `finance/expenses/${id}`), { ...patch, updatedAt: now() })

export const removeExpense = (bizId, id) =>
  removeValue(p(bizId, `finance/expenses/${id}`))

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
