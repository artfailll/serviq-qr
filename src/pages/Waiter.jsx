import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UtensilsCrossed, Search, Plus, Minus, X, Send, ArrowLeft,
  LayoutGrid, Check, Trash2, StickyNote, LogOut,
} from 'lucide-react'
import {
  useProfile, useCategories, useProducts, useTables, createOrder, useBusinessId, useActiveStaff,
} from '../lib/store'
// StaffPicker kaldirildi
import { money } from '../lib/format'
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

  function add(p, variant = null) {
    if (sendingRef.current) return
    const itemName = variant ? `${p.name} (${variant.name})` : p.name
    const itemPrice = variant ? Number(variant.price) : Number(p.price)
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === p.id && i.name === itemName && !i.note)
      if (idx >= 0) { const c = [...prev]; c[idx] = { ...c[idx], qty: c[idx].qty + 1 }; return c }
      return [...prev, { productId: p.id, name: itemName, price: itemPrice, qty: 1, note: '' }]
    })
    showToast(`${itemName} eklendi`)
  }

  function handleProductClick(p) {
    const vars = getVariants(p)
    if (vars.length > 0) {
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
    await createOrder(bizId, {
      tableId: table.id, tableNo: table.no,
      items: cart.map((i) => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty, note: i.note || '' })),
      staffId,
    })
    setCart([]); setCartOpen(false); setSent(true)
    setTimeout(() => setSent(false), 1800)
    } catch (error) { setSendError(error.message || 'Sipariş kaydedilemedi. Sepet korunuyor.') }
    finally { sendingRef.current = false; setSending(false) }
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
            {tables.map((t) => (
              <button key={t.id} onClick={() => setTable(t)}
                className="aspect-square rounded-2xl bg-white border-2 border-ink-200 hover:border-brand-400 hover:bg-brand-50 active:scale-95 transition-all grid place-items-center">
                <span className="font-display text-lg font-extrabold text-ink-800">{t.no}</span>
              </button>
            ))}
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
          <ProductList items={results} qtyOf={qtyOf} onSelect={handleProductClick} getVariants={getVariants} />
        ) : (
          categories.map((c) => (
            <section key={c.id} id={'cat-' + c.id} className="pt-4" style={{ scrollMarginTop: 120 }}>
              <h2 className="font-display font-bold text-ink-800 mb-2 px-1">{c.name}</h2>
              <ProductList items={grouped[c.id] || []} qtyOf={qtyOf} onSelect={handleProductClick} getVariants={getVariants} />
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

      {/* Porsiyon Seçim Penceresi */}
      {portionProduct && (
        <PortionModal
          product={portionProduct}
          variants={getVariants(portionProduct)}
          cart={cart}
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

function ProductList({ items, qtyOf, onSelect, getVariants }) {
  if (!items.length) return <p className="text-ink-400 text-sm py-4 px-1">Ürün yok.</p>
  return (
    <div className="space-y-2">
      {items.map((p) => {
        const q = qtyOf(p.id)
        const variants = getVariants ? getVariants(p) : []
        const hasVariants = variants.length > 0
        const prices = hasVariants ? variants.map((v) => Number(v.price)).filter(Number.isFinite) : [p.price]
        const minPrice = prices.length ? Math.min(...prices) : p.price
        const maxPrice = prices.length ? Math.max(...prices) : p.price

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left active:scale-[.99] transition-all ${
              hasVariants ? 'bg-white border-amber-200/90 hover:border-amber-400' : 'bg-white border-ink-200 hover:border-brand-300'
            }`}
          >
            <div className="grow min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-ink-800 truncate">{p.name}</p>
                {hasVariants && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full shrink-0">
                    Porsiyonlu
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

function PortionModal({ product, variants, cart, onClose, onAdd }) {
  if (!product || !variants.length) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[85vh] overflow-y-auto animate-fade-up">
        {/* Başlık */}
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

        {/* Porsiyon Listesi */}
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
                  onAdd(product, v)
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

        {/* Kapat butonu */}
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
          <button onClick={send} disabled={sending || !cart.length} className="btn-primary w-full !py-3.5 text-base">
            <Send className="h-5 w-5" /> {sending ? 'Gönderiliyor…' : 'Siparişi Onayla'}
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
