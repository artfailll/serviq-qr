// React tarafı: gerçek zamanlı abonelik hook'ları + tüm yazma aksiyonları
// Multi-tenant: tüm veriler /businesses/{businessId}/... altına yazılır.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  subscribe,
  pushItem,
  pushItemConfirmed,
  setValue,
  updateValue,
  removeValue,
  readValue,
  transactValue,
  mapToList,
  now,
} from './db'
import { dateKey } from './format'
import { getLoyaltyRules, applyLoyaltyCredit, applyRewardRedemption } from './loyalty'

// ───────── İşletme Context ─────────
export const BusinessContext = createContext(null)
export const useBusinessId = () => useContext(BusinessContext)

// businessId ile path üret
const p = (bizId, path) => `businesses/${bizId}/${path}`

// ───────── Genel abonelik hook'ları ─────────
export function useValue(path, initialValue) {
  const initial = arguments.length > 1 ? initialValue : null
  const [val, setVal] = useState(initial)
  useEffect(() => {
    setVal(initial)
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
export const useInventoryMovements = (bizId) =>
  useList(bizId ? p(bizId, 'inventory/movements') : null,
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0))
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
// Elle stok giriş/çıkışı — stoğu ve hareket kaydını tek adımda, otomatik
// düşümle yarışmayacak şekilde günceller.
export async function adjustStockManual(bizId, id, delta, reason) {
  const amount = Number(delta) || 0
  if (!amount) return null
  let before = 0
  const next = await transactValue(p(bizId, `inventory/items/${id}/stock`), (cur) => {
    before = Number(cur) || 0
    return Math.round(Math.max(0, before + amount) * 1000) / 1000
  })
  if (next === null) return null
  const actual = Math.round((next - before) * 1000) / 1000
  if (!actual) return null
  updateValue(p(bizId, `inventory/items/${id}`), { updatedAt: now() })
  return adjustInventory(bizId, id, actual, reason || (actual > 0 ? 'Stok girişi' : 'Stok çıkışı'))
}
export const addStaffMember = (bizId, member) => {
  const name = String(member.name || '').trim()
  if (!name) return null
  return pushItem(p(bizId, 'staff/members'), { name: name.slice(0, 100), role: member.role || 'waiter', phone: String(member.phone || '').slice(0, 30), pin: String(member.pin || '').trim().slice(0, 10), active: member.active !== false, createdAt: now(), updatedAt: now() })
}
export const updateStaffMember = (bizId, id, patch) => updateValue(p(bizId, `staff/members/${id}`), { ...patch, updatedAt: now() })
export const removeStaffMember = (bizId, id) => removeValue(p(bizId, `staff/members/${id}`))
// Aynı personele ikinci bir açık vardiya açılmaz (çift tıklama koruması).
export async function startShift(bizId, staffId, note = '') {
  if (!staffId) return null
  const all = await readValue(p(bizId, 'staff/shifts'))
  const open = Object.entries(all || {}).find(([, s]) => s?.staffId === staffId && s?.status === 'open')
  if (open) return open[0]
  return pushItem(p(bizId, 'staff/shifts'), {
    staffId, note: String(note).slice(0, 160), startedAt: now(), status: 'open',
  })
}
export const endShift = (bizId, id) => updateValue(p(bizId, `staff/shifts/${id}`), { status: 'closed', endedAt: now() })
// Müşteri kartı yazar/günceller. Anahtar telefondan (yoksa isimden) türetilir,
// böylece elle eklenen kart ile siparişten gelen kayıt aynı yerde birleşir.
export function upsertCustomer(bizId, customer) {
  const key = customer.id || customerKey(customer)
  if (!key) return null
  transactValue(p(bizId, `crm/customers/${key}`), (cur) => {
    const base = cur || { visits: 0, spend: 0, points: 0, createdAt: now() }
    return {
      ...base,
      name: String(customer.name ?? base.name ?? '').slice(0, 100),
      phone: String(customer.phone ?? base.phone ?? '').slice(0, 30),
      points: Math.max(0, Number(customer.points ?? base.points) || 0),
      visits: Math.max(0, Number(customer.visits ?? base.visits) || 0),
      spend: Math.max(0, Number(customer.spend ?? base.spend) || 0),
      consent: customer.consent !== false,
      updatedAt: now(),
    }
  })
  return key
}
export const addBranch = (bizId, branch) => {
  const name = String(branch.name || '').trim()
  if (!name) return null
  return pushItem(p(bizId, 'branches'), { name: name.slice(0, 100), address: String(branch.address || '').slice(0, 180), active: branch.active !== false, createdAt: now(), updatedAt: now() })
}
export const updateBranch = (bizId, id, patch) => updateValue(p(bizId, `branches/${id}`), { ...patch, updatedAt: now() })
export const removeBranch = (bizId, id) => removeValue(p(bizId, `branches/${id}`))

// ============================================================
//  REÇETE → STOK KÖPRÜSÜ
//  Ürünün reçetesi (recipe: [{itemId, qty}]) hangi stok kaleminden ne kadar
//  tükettiğini söyler. Sipariş girilir girilmez stok otomatik düşer, sipariş
//  iptal edilirse geri yüklenir. Reçetesi olmayan ürün stoğa dokunmaz —
//  yani özellik kademeli açılabilir, eski menü çalışmaya devam eder.
// ============================================================
const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000

// Sipariş satırlarını { stokKalemiId: toplamMiktar } haritasına çevirir.
// Kombo ürünler içerdikleri ürünlerin reçetesine açılır (özyineleme sınırlı).
export function recipeNeeds(orderItems, products) {
  const byId = {}
  products.forEach((prod) => { byId[prod.id] = prod })
  const needs = {}

  function add(productId, multiplier, depth) {
    const prod = byId[productId]
    if (!prod || multiplier <= 0 || depth > 3) return
    if (prod.comboItems?.length) {
      prod.comboItems.forEach((ci) =>
        add(ci.productId, multiplier * (Number(ci.qty) || 1), depth + 1))
    }
    ;(prod.recipe || []).forEach((r) => {
      const qty = Number(r.qty) || 0
      if (!r.itemId || qty <= 0) return
      needs[r.itemId] = round3((needs[r.itemId] || 0) + qty * multiplier)
    })
  }

  ;(orderItems || []).forEach((it) => add(it.productId, Number(it.qty) || 0, 0))
  return needs
}

// Stoğu düşer (sign -1) ya da geri yükler (sign +1), her kalem için
// inventory/movements'a iz bırakır. Stok eksiye düşmez; gerçekte uygulanan
// fark kaydedilir, böylece hareket defteri stokla tutarlı kalır.
async function applyStock(bizId, orderItems, { sign, reason, orderId }) {
  try {
    const [productsRaw, itemsRaw] = await Promise.all([
      readValue(p(bizId, 'menu/products')),
      readValue(p(bizId, 'inventory/items')),
    ])
    const needs = recipeNeeds(orderItems, mapToList(productsRaw))
    // Yalnızca gerçekten var olan stok kartlarına dokun — silinmiş kalem
    // reçetede kalmış olabilir.
    const ids = Object.keys(needs).filter((id) => itemsRaw && itemsRaw[id])
    if (!ids.length) return []

    const applied = []
    await Promise.all(ids.map(async (itemId) => {
      const want = sign * needs[itemId]
      let before = 0
      const next = await transactValue(
        p(bizId, `inventory/items/${itemId}/stock`),
        (cur) => { before = Number(cur) || 0; return round3(Math.max(0, before + want)) },
      )
      if (next === null) return
      const delta = round3(next - before)
      if (!delta) return
      updateValue(p(bizId, `inventory/items/${itemId}`), { updatedAt: now() })
      pushItem(p(bizId, 'inventory/movements'), {
        itemId, delta, reason: String(reason).slice(0, 160),
        orderId: orderId || null, auto: true, createdAt: now(),
      })
      applied.push({ itemId, delta, stock: next })
    }))
    return applied
  } catch { return [] }
}

// İşletme stok takibini kapatmışsa (profil ayarı) sipariş stoğa hiç dokunmaz.
// Ayar yoksa açık kabul edilir — mevcut işletmelerin davranışı değişmez.
async function stockTrackingOn(bizId) {
  try {
    return (await readValue(p(bizId, 'menu/profile/stockTracking'))) !== false
  } catch { return true }
}

// Sipariş → stok düşümü. Aynı sipariş iki kez düşmesin diye orders/{id}/stockApplied
// bayrağı işlem (transaction) ile kapılır.
export async function consumeOrderStock(bizId, orderId, items, tableNo) {
  if (!(await stockTrackingOn(bizId))) return []
  const claimed = await transactValue(
    p(bizId, `orders/${orderId}/stockApplied`),
    (cur) => (cur ? undefined : true),
  )
  if (claimed === null) return []
  const applied = await applyStock(bizId, items, {
    sign: -1, reason: `Sipariş · Masa ${tableNo ?? '?'}`, orderId,
  })
  if (!applied.length) setValue(p(bizId, `orders/${orderId}/stockApplied`), false)
  return applied
}

// İptal → düşülen stoğu geri yükler.
export async function restoreOrderStock(bizId, orderId, order = null) {
  const target = order || (await readValue(p(bizId, `orders/${orderId}`)))
  if (!target?.items?.length) return []
  const claimed = await transactValue(
    p(bizId, `orders/${orderId}/stockApplied`),
    (cur) => (cur ? false : undefined),
  )
  if (claimed === null) return []
  return applyStock(bizId, target.items, {
    sign: 1, reason: `İptal · Masa ${target.tableNo ?? '?'}`, orderId,
  })
}

// ───────── CRM: sipariş → müşteri kartı ─────────
// Telefon varsa ondan, yoksa isimden türetilen sabit anahtar. Aynı müşteri
// elle de eklense siparişten de gelse tek kartta birleşir.
export function customerKey(customer) {
  const digits = String(customer?.phone || '').replace(/\D/g, '')
  if (digits.length >= 7) return `p${digits}`
  const slug = String(customer?.name || '').trim().toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-').replace(/[.#$/[\]]/g, '')
  return slug ? `n${slug.slice(0, 60)}` : null
}

// Hesap kapanınca ziyaret/harcama/puan müşteri kartına işlenir.
// Müşteri kaydındaki sipariş defteri aynı siparişin iki kez puan kazanmasını önler.
async function creditCustomer(bizId, orderId, order) {
  const target = order || await readValue(p(bizId, `orders/${orderId}`))
  if (!target?.customer?.consent || !target.customer.phone) return null
  const key = customerKey(target.customer)
  if (!key) return null
  const profile = await readValue(p(bizId, 'menu/profile'))
  const at = now()
  // Ledger and balance change atomically on the same customer. A retry can
  // safely resume after a lost connection without awarding the order twice.
  await transactValue(p(bizId, `crm/customers/${key}`), cur => applyLoyaltyCredit(cur, orderId, target, profile, at))
  return key
}

export async function redeemLoyaltyReward(bizId, customerId, redemptionId, staffId) {
  const profile = await readValue(p(bizId, 'menu/profile'))
  const rules = getLoyaltyRules(profile)
  if (!rules.enabled) throw new Error('Sadakat programı yapılandırılmamış.')
  const at = now()
  const result = await transactValue(p(bizId, `crm/customers/${customerId}`), cur => applyRewardRedemption(cur, redemptionId, rules, staffId, at))
  if (!result) throw new Error('Puan yetersiz veya bu ödül işlemi zaten kaydedilmiş.')
  return result
}

// ───────── Aktif personel (cihaz başına seçilir) ─────────
// Kasa/garson ekranında kimin çalıştığı seçilir; girilen sipariş ve alınan
// tahsilat o personele yazılır. Seçim cihazda kalır — tablet kasada, telefon
// garsonda farklı kişi olabilir.
const STAFF_LS_KEY = (bizId) => `serviq_staff_${bizId}`
const staffWatchers = new Set()

export function getActiveStaffId(bizId) {
  try { return localStorage.getItem(STAFF_LS_KEY(bizId)) || null } catch { return null }
}
export function setActiveStaffId(bizId, staffId) {
  try {
    if (staffId) localStorage.setItem(STAFF_LS_KEY(bizId), staffId)
    else localStorage.removeItem(STAFF_LS_KEY(bizId))
  } catch {}
  staffWatchers.forEach((fn) => fn())
}
export function useActiveStaffId(bizId) {
  const [id, setId] = useState(() => getActiveStaffId(bizId))
  useEffect(() => {
    const sync = () => setId(getActiveStaffId(bizId))
    sync()
    staffWatchers.add(sync)
    window.addEventListener('storage', sync)
    return () => { staffWatchers.delete(sync); window.removeEventListener('storage', sync) }
  }, [bizId])
  return id
}

// Seçili personeli, açık vardiyasıyla birlikte çözer.
export function useActiveStaff(bizId) {
  const staffId = useActiveStaffId(bizId)
  const members = useStaff(bizId)
  const shifts = useShifts(bizId)
  return useMemo(() => {
    const member = members.find((m) => m.id === staffId) || null
    const shift = member ? shifts.find((s) => s.staffId === member.id && s.status === 'open') || null : null
    return { staffId: member ? member.id : null, member, shift, onShift: !!shift }
  }, [staffId, members, shifts])
}

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
    // Reçete — satışta stoktan otomatik düşülecek malzemeler
    recipe: normalizeRecipe(prod.recipe),
  })

// Reçete satırlarını temizler: geçersiz/sıfır miktarlı satırlar atılır,
// aynı kalem iki kez yazılmışsa toplanır.
export function normalizeRecipe(recipe) {
  const merged = {}
  ;(recipe || []).forEach((r) => {
    const qty = Number(r?.qty) || 0
    if (!r?.itemId || qty <= 0) return
    merged[r.itemId] = round3((merged[r.itemId] || 0) + qty)
  })
  return Object.entries(merged).map(([itemId, qty]) => ({ itemId, qty }))
}

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

export function requestPrint(bizId, orderId, printType = 'bill') {
  if (!bizId || !orderId) return
  return updateValue(p(bizId, `orders/${orderId}`), {
    printRequestedAt: now(),
    printType,
    updatedAt: now(),
  })
}

export async function createOrder(bizId, { tableId, tableNo, items, note, customer, staffId, printRequested = false, printType = 'kitchen' }) {
  if (!bizId || !tableId || !Number.isInteger(tableNo) || tableNo < 1) throw new Error('Masa tanımlı değil. Masadaki QR kodu tekrar okutun.')
  if (!items?.length || items.some(it => !it.productId || !Number.isFinite(it.price) || it.price < 0 || !Number.isInteger(it.qty) || it.qty < 1)) throw new Error('Sepet bilgileri geçersiz. Ürünleri kontrol edin.')
  const total = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0) * 100) / 100
  const count = items.reduce((s, it) => s + it.qty, 0)
  const id = await pushItemConfirmed(p(bizId, 'orders'), {
    tableId, tableNo: tableNo ?? null, items, total, count,
    note: note || '', customer: customer?.name || customer?.phone ? { name: String(customer.name || '').slice(0, 100), phone: String(customer.phone || '').slice(0, 30), consent: customer.consent !== false } : null,
    // Siparişi kim girdi — garson ekranında seçili personel, QR'dan gelirse null
    staffId: staffId || null,
    status: 'new', createdAt: now(), updatedAt: now(), ...(printRequested ? { printRequestedAt: now(), printType } : {}),
  })
  bumpProductStats(bizId, items).catch(() => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('serviq:data-error', { detail: 'stats-update' }))
  })
  // Yan etkiler yalnızca sunucudan sipariş kaydı onayı geldikten sonra başlar.
  if (id) consumeOrderStock(bizId, id, items, tableNo).catch(() => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('serviq:data-error', { detail: 'stock-update' }))
  })
  return id
}

// ───────── Satış istatistiği (otomatik "Çok Satan" rozetleri) ─────────
// Ürün başına toplam satış adedini menu/stats altında tutar.
// Transaction avoids losing simultaneous orders or recursive cached listeners.
function bumpProductStats(bizId, items) {
  return transactValue(p(bizId, 'menu/stats'), value => {
    const stats = { ...value }
    for (const item of items) {
      if (item.productId) stats[item.productId] = (Number(stats[item.productId]) || 0) + item.qty
    }
    return stats
  })
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

// Hesabı kapatır: tahsilatı kasiyere yazar ve müşteri kartına ziyaret/puan işler.
// `order` verilirse ek okuma yapılmaz (kasa ve masa haritası siparişi elinde tutar).
export async function markOrderPaid(bizId, id, paymentMethod = 'nakit', { order = null, cashierId = null } = {}) {
  await updateValue(p(bizId, `orders/${id}`), {
    status: 'paid', paymentMethod,
    cashierId: cashierId || order?.cashierId || null,
    paidAt: now(), updatedAt: now(),
  })
  await creditCustomer(bizId, id, order)
  return id
}

// İptal: düşülmüş stok varsa geri yüklenir.
export function cancelOrder(bizId, id, order = null) {
  updateValue(p(bizId, `orders/${id}`), { status: 'cancelled', updatedAt: now() })
  restoreOrderStock(bizId, id, order)
  return id
}

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
  if (!tableId || !Number.isInteger(tableNo) || tableNo < 1) return Promise.reject(new Error('Geçerli bir masa seçin.'))
  return pushItemConfirmed(p(bizId, 'calls'), {
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
  const orders = await readValue(p(bizId, 'orders')) || {}
  // Only settled snapshots move. Never delete an entire collection: a new
  // order can arrive while the cashier is closing the day.
  const patch = {}
  Object.entries(orders).forEach(([id, o]) => {
    if (o.status !== 'paid' && o.status !== 'cancelled') return
    const day = dateKey(o.paidAt || o.createdAt)
    patch[`archive/${day}/${id}`] = o
    patch[`orders/${id}`] = null
  })
  if (Object.keys(patch).length) await updateValue(p(bizId, ''), patch)
  return Object.keys(patch).length / 2
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
