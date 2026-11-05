import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UtensilsCrossed, Search, Plus, Minus, X, Send, ArrowLeft,
  LayoutGrid, Check, Trash2, StickyNote, LogOut, ReceiptText, Printer, Flame,
} from 'lucide-react'
import {
  useProfile, useCategories, useProducts, useTables, createOrder, useBusinessId, useActiveStaff, useOrders, useProductStats, computeOrderCounts, computeBestIds, requestPrint,
  isBreadOrWrap, DEFAULT_BREAD_WRAP_INGREDIENTS, BREAD_WRAP_INGREDIENTS,
} from '../lib/store'
// StaffPicker kaldirildi
import { money } from '../lib/format'
import { printTableBill } from '../lib/receipt'
import AdminLogin, { useRoleAuthState, clearStaffSession, getStaffSession } from './AdminLogin'

export default function Waiter() {
  const bizId = useBusinessId()
  const status = useRoleAuthState('waiter')
  const [justAuthed, setJustAuthed] = useState(false)

  if (status === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-100">
        <div className="h-10 w-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    )
  }
  const unlocked = status === 'open' || status === 'authed' || justAuthed
  if (!unlocked) return <AdminLogin role="waiter" onSuccess={() => setJustAuthed(true)} />

  return <WaiterPOS bizId={bizId} onLogout={() => { clearStaffSession(bizId); setJustAuthed(false); window.location.reload() }} />
}

function WaiterPOS({ bizId, onLogout }) {
  const profile = useProfile(bizId)
  const categories = useCategories(bizId)
  const products = useProducts(bizId)
  const tables = useTables(bizId)
  const orders = useOrders(bizId)
  const stats = useProductStats(bizId)
  const productOrderCounts = useMemo(() => computeOrderCounts(orders, stats), [orders, stats])
  const bestIds = useMemo(() => computeBestIds(productOrderCounts, categories, products), [productOrderCounts, categories, products])
  const { staffId } = useActiveStaff(bizId)

  const portionsEnabled = profile?.portionsEnabled !== false

  const getVariants = (p) => {
    if (!portionsEnabled) return []
    if (p?.portionsEnabled === false) return []
    return Array.isArray(p?.variants) ? p.variants.filter((v) => v && v.name && Number.isFinite(Number(v.price))) : []
  }

  const [table, setTable] = useState(null)      // seçili masa
  const [cart, setCart] = useState([])           // {productId,name,price,qty,note}
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [portionProduct, setPortionProduct] = useState(null)
  const [sent, setSent] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const sendingRef = useRef(false)

  const showToast = (txt) => {
    setToastMsg(txt)
    setTimeout(() => setToastMsg(''), 1800)
  }

  useEffect(() => {
    if (!sending) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [sending])

  const grouped = useMemo(() => {
    const g = {}
    categories.forEach((c) => (g[c.id] = []))
    products.forEach((p) => { if (p.available) (g[p.categoryId] = g[p.categoryId] || []).push(p) })
    return g
  }, [categories, products])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return products.filter((p) => {
      if (!p.available) return false
      if (p.name.toLowerCase().includes(q)) return true
      const vars = getVariants(p)
      return vars.some((v) => v.name.toLowerCase().includes(q))
    })
  }, [query, products, portionsEnabled])

  const count = cart.reduce((s, i) => s + i.qty, 0)
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const qtyOf = (id) => cart.filter((i) => i.productId === id).reduce((s, i) => s + i.qty, 0)

  function add(p, variant = null, note = '', qty = 1) {
    if (sendingRef.current) return
    const itemName = variant ? `${p.name} (${variant.name})` : p.name
    const itemPrice = variant ? Number(variant.price) : Number(p.price)
    const itemNote = (note || '').trim()
    const addQty = Math.max(1, Number(qty) || 1)
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === p.id && i.name === itemName && (i.note || '') === itemNote)
      if (idx >= 0) { const c = [...prev]; c[idx] = { ...c[idx], qty: c[idx].qty + addQty }; return c }
      return [...prev, { productId: p.id, name: itemName, price: itemPrice, qty: addQty, note: itemNote }]
    })
    showToast(`${itemName} eklendi`)
  }

  function handlePrintTableAdisyon(tbl, tblOrders) {
    if (!tblOrders?.length) return
    // 1. Firebase üzerinden Kasa yazıcısına masanın adisyonunu ilet (en son açık sipariş üzerinden)
    const targetOrder = tblOrders[tblOrders.length - 1]
    requestPrint(bizId, targetOrder.id, 'bill')
    // 2. Cihaz yerel yazıcıya bağlıysa doğrudan bas
    try {
      printTableBill(tbl.no, tblOrders, profile)
    } catch {}
    showToast(`Masa ${tbl.no} fişi yazıcıya gönderildi!`)
  }

  function handleProductClick(p) {
    const vars = getVariants(p)
    const bread = isBreadOrWrap(p)
    if (vars.length > 0 || bread) {
      setPortionProduct(p)
    } else {
      add(p)
    }
  }

  function changeQty(i, d) {
    if (sendingRef.current) return
    setCart((prev) => { const c = [...prev]; const n = c[i].qty + d; if (n <= 0) c.splice(i, 1); else c[i] = { ...c[i], qty: n }; return c })
  }
  function setNote(i, note) {
    if (sendingRef.current) return
    setCart((prev) => { const c = [...prev]; c[i] = { ...c[i], note }; return c })
  }

  async function send() {
    if (sendingRef.current || !cart.length || !table) return
    sendingRef.current = true
    setSending(true)
    setSendError('')
    try {
      const orderData = {
        tableId: table.id,
        tableNo: table.no,
        items: cart.map((i) => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty, note: i.note || '' })),
        staffId,
      }
      await createOrder(bizId, orderData)
      setCart([])
      setCartOpen(false)
      setSent(true)
      showToast('Sipariş başarıyla kaydedildi!')
      setTimeout(() => setSent(false), 1800)
    } catch (error) {
      setSendError(error.message || 'Sipariş kaydedilemedi. Sepet korunuyor.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  // ── Masa seçimi ──
  if (!table) {
    return (
      <div className="min-h-screen bg-ink-100">
        <Header profile={profile} title="Garson · Masa Seç" bizId={bizId} onLogout={onLogout} />
        <div className="mx-auto max-w-3xl p-4">
          <div className="mb-3 flex items-center gap-2 text-ink-500">
            <LayoutGrid className="h-4 w-4" /> <span className="font-semibold">Sipariş girmek için masa seçin</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {tables.map((t) => {
              const activeOrders = orders.filter((o) => (o.tableId === t.id || String(o.tableNo) === String(t.no)) && o.status !== 'paid' && o.status !== 'cancelled')
              const tableTotal = activeOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
              const isOccupied = activeOrders.length > 0

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTable(t)}
                  className={`aspect-square rounded-2xl border-2 active:scale-95 transition-all flex flex-col items-center justify-center p-2 relative ${
                    isOccupied
                      ? 'bg-amber-50/80 border-amber-400 hover:border-amber-500 hover:bg-amber-100/70 shadow-xs'
                      : 'bg-white border-ink-200 hover:border-brand-400 hover:bg-brand-50'
                  }`}
                >
                  <span className="font-display text-xl font-black text-ink-900">{t.no}</span>
                  {isOccupied && (
                    <span className="mt-1 text-[11px] font-extrabold text-brand-700 bg-white px-2 py-0.5 rounded-full border border-amber-200 shadow-xs">
                      {money(tableTotal)}
                    </span>
                  )}
                </button>
              )
            })}
            {tables.length === 0 && <p className="col-span-full text-center text-ink-400 py-10">Masa yok. Yönetim panelinden masa ekleyin.</p>}
          </div>
        </div>
        {sent && <Toast text="Sipariş kaydedildi!" />}
      </div>
    )
  }

  // ── Menü + sepet ──
  return (
    <div className="min-h-screen bg-ink-100 pb-28">
      <Header
        profile={profile}
        bizId={bizId}
        title={`Masa ${table.no}`}
        onLogout={onLogout}
        left={<button disabled={sending} onClick={() => { setTable(null); setQuery('') }} className="btn-ghost !py-1.5 !px-2.5"><ArrowLeft className="h-4 w-4" /></button>}
      />

      {/* Masa Açık Hesap / Fiş Yazdırma Barı */}
      {(() => {
        const tableOrders = orders.filter((o) => (o.tableId === table.id || String(o.tableNo) === String(table.no)) && o.status !== 'paid' && o.status !== 'cancelled')
        const tableTotal = tableOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
        if (!tableOrders.length) return null
        return (
          <div className="bg-white border-b border-ink-200 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-ink-700">Masa {table.no} Açık Siparişleri</span>
              </div>
              <p className="text-sm font-black text-brand-600 mt-0.5">
                {money(tableTotal)} <span className="text-xs font-normal text-ink-400">({tableOrders.length} adisyon)</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => handlePrintTableAdisyon(table, tableOrders)}
              className="btn-outline !py-2 !px-3 font-bold text-xs flex items-center gap-1.5 bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 active:scale-95 transition-all shadow-xs"
              title="Masadaki tüm siparişlerin hesap fişini soru sormadan yazdır"
            >
              <ReceiptText className="h-4 w-4 text-brand-600" />
              <span>Adisyon / Fiş Yazdır</span>
            </button>
          </div>
        )
      })()}

      {/* Arama */}
      <div className="sticky top-0 z-20 bg-ink-100/95 backdrop-blur px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl bg-white border border-ink-200 px-3 py-2.5">
          <Search className="h-4 w-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün ara..."
            className="flex-1 outline-none text-sm bg-transparent" />
          {query && <button onClick={() => setQuery('')}><X className="h-4 w-4 text-ink-400" /></button>}
        </div>
        {!query && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map((c) => (
              <button key={c.id} onClick={() => document.getElementById('cat-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="shrink-0 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-600 whitespace-nowrap">
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ürünler */}
      <div className="mx-auto max-w-3xl px-4">
        {results ? (
          <ProductList items={results} qtyOf={qtyOf} onSelect={handleProductClick} getVariants={getVariants} bestIds={bestIds} />
        ) : (
          categories.map((c) => (
            <section key={c.id} id={'cat-' + c.id} className="pt-4" style={{ scrollMarginTop: 120 }}>
              <h2 className="font-display font-bold text-ink-800 mb-2 px-1">{c.name}</h2>
              <ProductList items={grouped[c.id] || []} qtyOf={qtyOf} onSelect={handleProductClick} getVariants={getVariants} bestIds={bestIds} />
            </section>
          ))
        )}
      </div>

      {/* Sepet çubuğu */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3">
          <button onClick={() => setCartOpen(true)}
            className="w-full max-w-3xl mx-auto flex items-center gap-3 rounded-2xl bg-brand-500 text-white px-4 py-3.5 shadow-lg active:scale-[.99]">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-black/20 font-extrabold">{count}</span>
            <span className="flex-1 text-left font-bold">Sepeti Gör · Masa {table.no}</span>
            <span className="font-extrabold">{money(total)}</span>
          </button>
        </div>
      )}

      {/* Porsiyon & Ekmek/Dürüm Malzeme Seçim Penceresi */}
      {portionProduct && (
        <ProductCustomModal
          product={portionProduct}
          variants={getVariants(portionProduct)}
          cart={cart}
          ingredients={profile?.breadWrapIngredients?.length ? profile.breadWrapIngredients : DEFAULT_BREAD_WRAP_INGREDIENTS}
          onClose={() => setPortionProduct(null)}
          onAdd={add}
        />
      )}

      {cartOpen && (
        <CartSheet cart={cart} total={total} tableNo={table.no} sending={sending} sendError={sendError}
          onClose={() => { if (!sendingRef.current) setCartOpen(false) }} changeQty={changeQty} setNote={setNote} send={send} />
      )}
      {sent && <Toast text="Sipariş mutfağa gönderildi!" />}
      {toastMsg && <Toast text={toastMsg} />}
    </div>
  )
}

function ProductList({ items, qtyOf, onSelect, getVariants, bestIds = [] }) {
  if (!items.length) return <p className="text-ink-400 text-sm py-4 px-1">Ürün yok.</p>
  return (
    <div className="space-y-2">
      {items.map((p) => {
        const q = qtyOf(p.id)
        const variants = getVariants ? getVariants(p) : []
        const hasVariants = variants.length > 0
        const bread = isBreadOrWrap(p)
        const prices = hasVariants ? variants.map((v) => Number(v.price)).filter(Number.isFinite) : [p.price]
        const minPrice = prices.length ? Math.min(...prices) : p.price
        const maxPrice = prices.length ? Math.max(...prices) : p.price

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left active:scale-[.99] transition-all ${
              hasVariants
                ? 'bg-white border-amber-200/90 hover:border-amber-400'
                : bread
                ? 'bg-white border-emerald-200/90 hover:border-emerald-400'
                : 'bg-white border-ink-200 hover:border-brand-300'
            }`}
          >
            <div className="grow min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-ink-800 truncate">{p.name}</p>
                {bestIds.includes(p.id) && (
                  <span data-testid="WaiterBestBadge" className="text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                    <Flame size={10} strokeWidth={2.5}/> Çok Satan
                  </span>
                )}
                {p.chef && (
                  <span data-testid="WaiterChefBadge" className="text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                    👨‍🍳 Şefin Önerisi
                  </span>
                )}
                {hasVariants && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full shrink-0">
                    Porsiyonlu
                  </span>
                )}
                {bread && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                    İç Malzeme
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-brand-600 font-bold">
                  {hasVariants && minPrice !== maxPrice
                    ? `${money(minPrice)} – ${money(maxPrice)}`
                    : money(hasVariants ? minPrice : p.price)
                  }
                </p>
                {hasVariants && (
                  <span className="text-xs text-ink-400 truncate">
                    ({variants.map((v) => v.name).join(', ')})
                  </span>
                )}
              </div>
            </div>

            {q > 0 && (
              <span className="grid h-6 min-w-6 px-1.5 place-items-center rounded-full bg-brand-100 text-brand-700 text-xs font-extrabold shrink-0">
                {q}
              </span>
            )}

            {hasVariants ? (
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shrink-0 shadow-sm transition-colors">
                <span>Porsiyon Seç</span>
                <Plus className="h-3.5 w-3.5" />
              </span>
            ) : bread ? (
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 shadow-sm transition-colors">
                <span>Malzeme Seç</span>
                <Plus className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500 text-white">
                <Plus className="h-5 w-5" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ProductCustomModal({ product, variants, cart, onClose, onAdd, ingredients = DEFAULT_BREAD_WRAP_INGREDIENTS }) {
  if (!product) return null
  const bread = isBreadOrWrap(product)
  const hasVariants = variants.length > 0

  const [selectedVariant, setSelectedVariant] = useState(hasVariants ? variants[0] : null)
  const [selectedTags, setSelectedTags] = useState([])
  const [extraNote, setExtraNote] = useState('')
  const [qty, setQty] = useState(1)

  const unitPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price)
  const totalPrice = unitPrice * qty

  const toggleTag = (label, isOnlyMeat = false) => {
    if (isOnlyMeat) {
      if (selectedTags.includes(label)) {
        setSelectedTags(selectedTags.filter((t) => t !== label))
      } else {
        setSelectedTags([label])
      }
      return
    }
    let next = selectedTags.filter((t) => t !== 'Sade (Yalnız Et)')
    if (next.includes(label)) {
      next = next.filter((t) => t !== label)
    } else {
      next = [...next, label]
    }
    setSelectedTags(next)
  }

  const compiledNote = [
    ...selectedTags,
    extraNote.trim(),
  ].filter(Boolean).join(', ')

  const handleAdd = (forceStandard = false) => {
    const finalNote = forceStandard ? '' : compiledNote
    onAdd(product, selectedVariant, finalNote, qty)
    onClose()
  }

  // Sadece porsiyonlu olan ve ekmek/dürüm olmayan ürünler için sade porsiyon seçici
  if (hasVariants && !bread) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[85vh] overflow-y-auto animate-fade-up">
          <div className="flex items-start justify-between pb-3 border-b border-ink-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🍲</span>
                <h3 className="font-display font-extrabold text-xl text-ink-900">{product.name}</h3>
              </div>
              <p className="text-xs font-semibold text-ink-500 mt-1">Lütfen sipariş edilecek porsiyonu seçin:</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-ink-100 text-ink-500 hover:text-ink-800 hover:bg-ink-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-2.5 py-1">
            {variants.map((v) => {
              const inCartQty = cart
                .filter((i) => i.productId === product.id && i.name === `${product.name} (${v.name})` && !i.note)
                .reduce((s, i) => s + i.qty, 0)

              return (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => {
                    onAdd(product, v, '', 1)
                    onClose()
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-ink-50 hover:bg-brand-50 border-2 border-ink-200 hover:border-brand-500 active:scale-[0.98] transition-all text-left group"
                >
                  <div className="grow min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-ink-900 text-base group-hover:text-brand-700 transition-colors">
                        {v.name}
                      </span>
                      {inCartQty > 0 && (
                        <span className="text-[11px] font-extrabold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                          Sepette: {inCartQty}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400 mt-0.5 font-medium">Dokunarak siparişe ekleyin</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-display font-black text-brand-600 text-lg">
                      {money(v.price)}
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white font-bold group-hover:bg-brand-600 shadow transition-colors">
                      <Plus className="h-5 w-5" />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-600 font-bold text-sm transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Ekmek & Dürüm Malzeme Seçimi Ekranı
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[90vh] overflow-y-auto animate-fade-up">
        {/* Başlık */}
        <div className="flex items-start justify-between pb-3 border-b border-ink-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🥙</span>
              <div>
                <h3 className="font-display font-black text-lg text-ink-900 leading-tight">{product.name}</h3>
                <p className="text-xs font-bold text-emerald-700 mt-0.5">Ekmek / Dürüm Malzeme Tercihi</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-ink-100 text-ink-500 hover:text-ink-800 hover:bg-ink-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Porsiyon seçimi (Adana Dürüm vb. için) */}
        {hasVariants && (
          <div>
            <p className="text-[11px] font-extrabold text-ink-500 mb-1.5 uppercase tracking-wide">Porsiyon Seçimi:</p>
            <div className="grid grid-cols-2 gap-2">
              {variants.map((v) => {
                const isSelected = selectedVariant?.name === v.name
                return (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={`p-3 rounded-xl border-2 text-left font-bold text-sm transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-300'
                        : 'border-ink-200 bg-ink-50/70 text-ink-700 hover:border-ink-300'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className="text-brand-600 font-extrabold">{money(v.price)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* İç Malzeme Seçim Alanı */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-ink-700 uppercase tracking-wide">
              İçindekiler & Tercihler
            </span>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold"
              >
                Seçimleri Sıfırla
              </button>
            )}
          </div>

          {/* Çıkarılacak Malzemeler */}
          <div>
            <p className="text-[11px] font-bold text-rose-700 mb-1.5 flex items-center gap-1">
              <span>🚫</span> İstenmeyen Malzemeler (Çıkarılsın):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ingredients.filter((it) => it.type === 'exclude').map((it) => {
                const active = selectedTags.includes(it.label)
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleTag(it.label)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                      active
                        ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-400 font-black'
                        : 'bg-rose-50/70 text-rose-800 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <span>{it.icon}</span>
                    <span>{it.label}</span>
                    {active && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tercihler / Ekstralar */}
          <div>
            <p className="text-[11px] font-bold text-emerald-700 mb-1.5 flex items-center gap-1">
              <span>✨</span> Özel Tercihler & Ekstralar:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ingredients.filter((it) => it.type === 'prefer').map((it) => {
                const active = selectedTags.includes(it.label)
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleTag(it.label, it.id === 'only_meat')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                      active
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400 font-black'
                        : 'bg-emerald-50/70 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <span>{it.icon}</span>
                    <span>{it.label}</span>
                    {active && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Canlı Not Özeti & Ekstra Özel Not */}
        <div className="space-y-2 pt-1">
          {compiledNote ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-2 text-xs text-amber-900 font-bold flex items-center gap-2">
              <span className="text-base">📝</span>
              <div className="min-w-0">
                <span className="text-amber-700 font-semibold text-[11px] block">Fişte Çıkacak Not:</span>
                <span className="font-extrabold text-sm">{compiledNote}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-400 italic px-1">Seçim yapılmazsa standart tam malzeme olarak hazırlanır.</p>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2">
            <StickyNote className="h-4 w-4 text-ink-400 shrink-0" />
            <input
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Ekstra özel istek (örn: Lavaş çift olsun)..."
              className="bg-transparent text-xs w-full outline-none font-medium text-ink-800 placeholder:text-ink-400"
            />
          </div>
        </div>

        {/* Adet & Butonlar */}
        <div className="pt-2 border-t border-ink-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-600">Sipariş Adedi:</span>
            <div className="flex items-center gap-2 bg-ink-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-800 font-bold shadow-xs active:scale-90"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-display font-black text-base px-2">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-800 font-bold shadow-xs active:scale-90"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {compiledNote ? (
              <>
                <button
                  type="button"
                  onClick={() => handleAdd(true)}
                  className="btn-ghost !py-3 font-bold text-xs text-ink-600 hover:text-ink-900 border border-ink-200 rounded-xl"
                >
                  Standart Ekle
                </button>
                <button
                  type="button"
                  onClick={() => handleAdd(false)}
                  className="btn-primary !py-3 font-bold text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-98"
                >
                  <Check className="h-4 w-4" />
                  <span>Seçimle Ekle ({money(totalPrice)})</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleAdd(false)}
                className="col-span-full btn-primary !py-3.5 font-bold text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-98"
              >
                <Plus className="h-4 w-4" />
                <span>Sepete Ekle ({money(totalPrice)})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CartSheet({ cart, total, tableNo, onClose, changeQty, setNote, send, sending, sendError }) {
  const [noteFor, setNoteFor] = useState(-1)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl max-h-[88vh] flex flex-col animate-fade-up">
        <div className="flex items-center justify-between p-4 border-b border-ink-100">
          <h3 className="font-display font-extrabold text-lg">Masa {tableNo} · Sipariş</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-ink-400" /></button>
        </div>
        <div className="grow overflow-y-auto p-4 space-y-3">
          {cart.map((it, i) => (
            <div key={i} className="rounded-xl border border-ink-200 p-3">
              <div className="flex items-center gap-3">
                <div className="grow min-w-0">
                  <p className="font-semibold text-ink-800">{it.name}</p>
                  <p className="text-sm text-ink-500">{money(it.price)} × {it.qty} = <b>{money(it.price * it.qty)}</b></p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-700"><Minus className="h-4 w-4" /></button>
                  <span className="w-6 text-center font-extrabold">{it.qty}</span>
                  <button onClick={() => changeQty(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              {(noteFor === i || it.note) ? (
                <input autoFocus={noteFor === i} value={it.note} onChange={(e) => setNote(i, e.target.value)}
                  placeholder="Not (örn: az pişmiş, soğansız)"
                  className="mt-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
              ) : (
                <button onClick={() => setNoteFor(i)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                  <StickyNote className="h-3.5 w-3.5" /> Not ekle
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-ink-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-ink-500 font-semibold">Toplam</span>
            <span className="font-display text-xl font-extrabold">{money(total)}</span>
          </div>
          {sendError && <p role="alert" className="text-red-700 mb-3">{sendError}</p>}
          {sending && <p role="status" className="mb-3">Sunucu onayı bekleniyor. Sayfayı kapatmayın.</p>}
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || !cart.length}
            className="btn-primary w-full !py-3.5 font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
          >
            <Send className="h-5 w-5" />
            <span>{sending ? 'Gönderiliyor…' : 'Siparişi Onayla'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Header({ profile, title, left, right, bizId, onLogout }) {
  const staffRole = bizId ? getStaffSession(bizId)?.role : null; const canAccessKasa = staffRole && ['cashier', 'manager', 'owner'].includes(staffRole)
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-ink-200">
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
        {left}
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
          <UtensilsCrossed className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="font-display font-extrabold leading-tight truncate">{title}</p>
          <p className="text-xs text-ink-400 leading-tight truncate">{profile?.name || 'serviq'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {right}
          {/* Personel secimi kaldirildi */}
          {canAccessKasa && <Link to={`/kasa?isletme=${encodeURIComponent(bizId)}`} className="btn-outline !py-2 hidden sm:inline-flex">Kasa</Link>}{onLogout && <button onClick={onLogout} className="btn-ghost !p-2 text-ink-400 hover:text-ink-700" title="Çıkış Yap"><LogOut className="h-4 w-4" /></button>}
        </div>
      </div>
    </header>
  )
}

function Toast({ text }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-full bg-green-600 text-white px-5 py-2.5 shadow-lg font-bold text-sm animate-fade-up">
      <Check className="h-4 w-4" /> {text}
    </div>
  )
}
