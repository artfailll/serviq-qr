import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Minus, BellRing, ReceiptText, Trash2, Check, Wifi, X,
  ChevronRight, Search, Star, Clock, Globe, Megaphone, ChefHat, Flame,
  MapPin, Phone, Instagram, Tag,
} from 'lucide-react'
import {
  useCategories, useProducts, useTables, useProductStats,
  createOrder, createCall, saveFeedback, useBusinessId, useProfile, useOrders,
} from '../lib/store'
import { subscribe, setValue } from '../lib/db'
import { DEFAULT_NOTES, TAG_MAP, ALLERGEN_MAP } from '../lib/seed'
import { getTemplate, getAccent } from '../lib/templates'
import { LANGS, t as tt } from '../lib/i18n'
import { ProductImage } from '../components/ui'
import { money } from '../lib/format'
import { runWaiterToCart } from '../lib/waiterRun'

function toRgb(hex) {
  const h = hex?.startsWith('#') ? hex : '#f97316'
  return `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`
}

// Çalışma saati kontrolü — gece yarısını aşan aralıkları da destekler (23:00–04:00)
function isOpenNow(profile) {
  if (!profile?.hoursEnabled || !profile.hoursOpen || !profile.hoursClose) return true
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = profile.hoursOpen.split(':').map(Number)
  const [ch, cm] = profile.hoursClose.split(':').map(Number)
  const open = oh * 60 + (om || 0), close = ch * 60 + (cm || 0)
  if (open === close) return true
  if (open < close) return cur >= open && cur < close
  return cur >= open || cur < close // gece aşan
}

const MYORD_KEY = (biz) => `sofra_myorders_${biz}`
const RATED_KEY = (biz) => `sofra_rated_${biz}`
const CALL_KEY = (biz, table) => `sofra_lastcall_${biz}_${table}`
const CALL_COOLDOWN_MS = 30000

export default function Customer() {
  const bizId    = useBusinessId()
  const [params] = useSearchParams()
  const masaNo   = params.get('masa') || '?'
  const tableId  = 'masa' + masaNo

  const categories = useCategories(bizId)
  const products   = useProducts(bizId)
  const tables     = useTables(bizId)
  const profile    = useProfile(bizId)
  const stats      = useProductStats(bizId)
  const allOrders  = useOrders(bizId)

  const tableMeta = tables.find(x => String(x.no) === String(masaNo))
  const T      = getTemplate(profile)
  const accent = getAccent(profile, T)
  const rgb    = toRgb(accent)

  // ── Google Font enjeksiyonu (şablona göre) ──
  useEffect(() => {
    if (!T.fontsHref) return
    let link = document.getElementById('tpl-fonts')
    if (!link) {
      link = document.createElement('link')
      link.id = 'tpl-fonts'; link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== T.fontsHref) link.href = T.fontsHref
  }, [T.fontsHref])

  // ── Dil ──
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('sofra_lang') || 'tr' } catch { return 'tr' } })
  const [i18nCache, setI18nCache] = useState(null) // {items:{id:{name,desc}}, categories:{id:name}}
  const [translating, setTranslating] = useState(false)
  const t = (k) => tt(lang, k)

  useEffect(() => { try { localStorage.setItem('sofra_lang', lang) } catch {} }, [lang])

  // Çeviri önbelleği: Firebase'de varsa yükle, yoksa AI ile üretip kaydet
  useEffect(() => {
    if (lang === 'tr' || !bizId) { setI18nCache(null); return }
    let unsub = null
    unsub = subscribe(`businesses/${bizId}/menu/i18n/${lang}`, async (val) => {
      unsub?.()
      if (val) { setI18nCache(val); return }
      if (!products.length) return
      setTranslating(true)
      try {
        const resp = await fetch('/.netlify/functions/translate-menu', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang,
            items: products.map(p2 => ({ id: p2.id, name: p2.name, desc: p2.desc || '' })),
            categories: categories.map(c => ({ id: c.id, name: c.name })),
          }),
        })
        const data = await resp.json()
        if (resp.ok && data.items) {
          setI18nCache(data)
          setValue(`businesses/${bizId}/menu/i18n/${lang}`, data)
        }
      } catch {}
      setTranslating(false)
    })
    return () => unsub?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, bizId, products.length])

  const trName = (p2) => (lang !== 'tr' && i18nCache?.items?.[p2.id]?.name) || p2.name
  const trDesc = (p2) => (lang !== 'tr' && i18nCache?.items?.[p2.id]?.desc) || p2.desc
  const trCat  = (c)  => (lang !== 'tr' && i18nCache?.categories?.[c.id]) || c.name

  // ── Durumlar ──
  const [activeCat, setActiveCat] = useState(null)
  const [cart, setCart]           = useState([])
  const [detail, setDetail]       = useState(null)
  const [cartOpen, setCartOpen]   = useState(false)
  const [toast, setToast]         = useState(null)
  const [placed, setPlaced]       = useState(false)
  const [query, setQuery]         = useState('')
  const [trackOpen, setTrackOpen] = useState(false)
  const [cartBump, setCartBump]   = useState(0)
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', consent: false })
  const catBarRef = useRef(null)

  const open = isOpenNow(profile)

  useEffect(() => {
    if (!activeCat && categories.length) setActiveCat(categories[0].id)
    if (profile.name) document.title = profile.name
  }, [categories, activeCat, profile.name])

  useEffect(() => {
    let last = 0
    const onScroll = () => {
      const n2 = Date.now(); if (n2 - last < 80) return; last = n2
      let cur = null
      document.querySelectorAll('[data-cat-id]').forEach(el => {
        if (el.getBoundingClientRect().top <= 120) cur = el.dataset.catId
      })
      if (cur) setActiveCat(cur)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [categories])

  const grouped = useMemo(() => {
    const g = {}
    categories.forEach(c => (g[c.id] = []))
    products.forEach(p2 => { if (!g[p2.categoryId]) g[p2.categoryId] = []; g[p2.categoryId].push(p2) })
    return g
  }, [categories, products])

  const featured = useMemo(() => products.filter(p2 => p2.featured && p2.available), [products])

  // Çok Satan: satış istatistiğinden ilk 3 (en az 3 satış)
  const bestIds = useMemo(() => {
    return Object.entries(stats).filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
  }, [stats])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return products.filter(p2 =>
      trName(p2)?.toLowerCase().includes(q) || trDesc(p2)?.toLowerCase().includes(q) || p2.name?.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, products, i18nCache, lang])

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  // Kartlar ekrana girdikçe zarifçe belirir (her kart bir kez). Sayfa
  // açılışında hepsinin birden oynamasının verdiği "kötü" hissi giderir;
  // aşağı kaydırırken içerik akıcı şekilde açığa çıkar.
  useEffect(() => {
    const reveal = (el) => el.classList.add('in')
    const els = document.querySelectorAll('.anim-card:not(.in)')
    if (!els.length) return
    if (!('IntersectionObserver' in window)) { els.forEach(reveal); return }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        const el = e.target
        const sibs = el.parentElement ? Array.from(el.parentElement.children) : [el]
        const i = Math.max(0, sibs.indexOf(el))
        el.style.transitionDelay = Math.min(i * 45, 180) + 'ms'
        reveal(el)
        io.unobserve(el)
      })
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
    els.forEach(el => io.observe(el))
    // Güvenlik ağı: IO herhangi bir sebeple gecikirse (arka plan sekmesi,
    // eski tarayıcı) ekrana yakın kartları yine de göster — menü asla boş
    // kalmaz. Ekran dışı kartlar kaydırınca IO ile açığa çıkmaya devam eder.
    const safety = setTimeout(() => {
      document.querySelectorAll('.anim-card:not(.in)').forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.15) reveal(el)
      })
    }, 1000)
    return () => { io.disconnect(); clearTimeout(safety) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length, products.length, query, lang])

  // ── Sipariş takibi ──
  const [myIds, setMyIds] = useState(() => { try { return JSON.parse(localStorage.getItem(MYORD_KEY(bizId)) || '[]') } catch { return [] } })
  const myOrders = useMemo(
    () => allOrders.filter(o => myIds.includes(o.id) && o.status !== 'cancelled').slice(0, 5),
    [allOrders, myIds])
  const myActive = myOrders.filter(o => o.status !== 'paid')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  // ── Garson/hesap çağrısı: masa+tip başına 30 sn bekleme ──
  // (spam'i önler; sayfa yenilense bile localStorage'dan hatırlanır)
  const [lastCallAt, setLastCallAt] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CALL_KEY(bizId, tableId || masaNo)) || '{}') } catch { return {} }
  })

  function addToCart(product, qty, note, unitPrice, label) {
    const name = label || product.name
    const price = unitPrice ?? product.price
    // Kampanya menüsü: mutfak fişinde içerik görünsün diye özel not yoksa
    // ürünün "İçerir: ..." açıklaması otomatik not olarak taşınır.
    const finalNote = (note ? note.trim() : '') || (product.comboItems?.length ? product.desc || '' : '')
    setCart(prev => {
      const idx = prev.findIndex(i => i.productId === product.id && i.note === finalNote && i.name === name)
      if (idx >= 0) { const c=[...prev]; c[idx]={...c[idx],qty:c[idx].qty+qty}; return c }
      return [...prev, { productId: product.id, name, price, image: product.image, qty, note: finalNote }]
    })
    setDetail(null)
    setCartBump(x => x + 1)
    showToast(`${trName(product)} ${t('added')}`)
  }

  function changeQty(i, d) {
    setCart(prev => { const c=[...prev]; const n2=c[i].qty+d; if(n2<=0) c.splice(i,1); else c[i]={...c[i],qty:n2}; return c })
  }

  function confirmOrder() {
    if (!cart.length || !open) return
    const id = createOrder(bizId, { tableId, tableNo: Number(masaNo)||null,
      items: cart.map(i => ({ productId:i.productId, name:i.name, price:i.price, qty:i.qty, note:i.note||'' })), customer: customerInfo.consent ? customerInfo : null })
    if (id) {
      const next = [id, ...myIds].slice(0, 5)
      setMyIds(next)
      try { localStorage.setItem(MYORD_KEY(bizId), JSON.stringify(next)) } catch {}
    }
    setCart([]); setCartOpen(false); setPlaced(true)
    setTimeout(() => setPlaced(false), 3200)
  }

  function call(type) {
    const now2 = Date.now()
    const remain = CALL_COOLDOWN_MS - (now2 - (lastCallAt[type] || 0))
    if (remain > 0) {
      showToast(`${Math.ceil(remain / 1000)} sn sonra tekrar çağırabilirsiniz`)
      return
    }
    createCall(bizId, { tableId, tableNo: Number(masaNo)||null, type })
    const next = { ...lastCallAt, [type]: now2 }
    setLastCallAt(next)
    try { localStorage.setItem(CALL_KEY(bizId, tableId || masaNo), JSON.stringify(next)) } catch {}
    showToast(type === 'waiter' ? t('waiterComing') : t('billComing'))
  }

  function scrollToCat(id) {
    setQuery(''); setActiveCat(id)
    // Yapışkan başlık kaydırırken büyüdüğü için scrollY hesabını sabit tutmak
    // yerine, bölümün `scroll-margin-top`'unu esas alan scrollIntoView kullan —
    // hedef kategori her zaman başlığın hemen altına oturur (zıplama yok).
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-cat-id="${id}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const bar = catBarRef.current
      const btn = bar?.querySelector(`[data-cat="${id}"]`)
      if (bar && btn) bar.scrollTo({ left: btn.offsetLeft - bar.clientWidth/2 + btn.clientWidth/2, behavior: 'smooth' })
    })
  }

  // Upsell: sepette olmayan, uygun kategorilerden en ucuz 3 ürün
  const upsell = useMemo(() => {
    if (!cart.length) return []
    const inCart = new Set(cart.map(i => i.productId))
    const catName = {}; categories.forEach(c => (catName[c.id] = c.name.toLowerCase()))
    return products
      .filter(p2 => p2.available && !inCart.has(p2.id) &&
        (p2.featured || p2.chef || /içecek|tatlı|atıştır|soğuk|sıcak/.test(catName[p2.categoryId] || '')))
      .sort((a, b) => a.price - b.price).slice(0, 3)
  }, [cart, products, categories])

  const initial = (profile.name||'S').trim()[0].toUpperCase()
  const loading = categories.length === 0
  const isRTL = lang === 'ar'
  const D = T.fontDisplay, B = T.fontBody

  const badge = (p2) => ({
    chef: !!p2.chef,
    best: bestIds.includes(p2.id),
    combo: !!p2.comboItems?.length,
  })

  const cardProps = { T, accent, rgb, t, trName, trDesc, badge, onOpen: (p2) => p2.available && setDetail(p2), onQuickAdd: (p2) => addToCart(p2, 1, '') }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background:T.bg, minHeight:'100vh', paddingBottom:170, color:T.text, fontFamily:B, colorScheme:T.dark ? 'dark' : 'light' }}>

      {/* ── HERO ── */}
      <Hero T={T} accent={accent} rgb={rgb} profile={profile} initial={initial}
        tableLabel={tableMeta?.name || `${t('table')} ${masaNo}`} D={D} />

      {/* ── STICKY: dil + arama + kategoriler (sabit yükseklik — zıplama yok) ── */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:T.sticky, backdropFilter:'blur(20px)', borderBottom:`1px solid ${T.divider}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px 4px' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:T.inputBg, border:`1px solid ${T.inputBorder}`, borderRadius:12, padding:'9px 12px' }}>
            <Search size={15} style={{ color:T.textMuted, flexShrink:0 }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')}
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:T.text, fontSize:14, minWidth:0, fontFamily:B }} />
            {query && <button onClick={() => setQuery('')} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:0, display:'flex' }}><X size={15} /></button>}
          </div>
          {/* Dil değiştirici */}
          <LangSwitch lang={lang} setLang={setLang} T={T} accent={accent} busy={translating} />
        </div>
        {!query && (
          <nav ref={catBarRef} style={{ display:'flex', gap:8, padding:'8px 16px 10px', overflowX:'auto', scrollbarWidth:'none' }}>
            {categories.map(c => {
              const active = activeCat === c.id
              return (
                <button key={c.id} data-cat={c.id} onClick={() => scrollToCat(c.id)} style={{
                  flexShrink:0, borderRadius: T.cardLayout==='editorial' ? 4 : 999,
                  padding:'7px 18px', fontSize:13, fontWeight:700, fontFamily:B,
                  border: active ? 'none' : `1px solid ${T.tabBorder}`,
                  background: active ? accent : 'transparent',
                  color: active ? '#fff' : T.tabText,
                  boxShadow: active ? `0 4px 16px rgba(${rgb},.35)` : 'none',
                  cursor:'pointer', whiteSpace:'nowrap', transition:'background .18s,color .18s',
                }}>{trCat(c)}</button>
              )
            })}
          </nav>
        )}
      </div>

      {/* ── Duyuru bandı ── */}
      {profile.announcement && (
        <div style={{ margin:'12px 14px 0', display:'flex', alignItems:'center', gap:10,
          background:`linear-gradient(90deg, rgba(${rgb},.14), rgba(${rgb},.05))`,
          border:`1px solid rgba(${rgb},.3)`, borderRadius:14, padding:'10px 14px' }}>
          <Megaphone size={15} style={{ color:accent, flexShrink:0 }} />
          <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{profile.announcement}</span>
        </div>
      )}

      {/* ── Kapalı bandı ── */}
      {!open && (
        <div style={{ margin:'12px 14px 0', display:'flex', alignItems:'center', gap:10,
          background:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.35)', borderRadius:14, padding:'10px 14px' }}>
          <Clock size={15} style={{ color:'#dc2626', flexShrink:0 }} />
          <span style={{ fontSize:13, fontWeight:700, color:T.text }}>
            {t('closed')} · {t('closedSub')}: {profile.hoursOpen}–{profile.hoursClose}
          </span>
        </div>
      )}

      {/* ── İÇERİK ── */}
      <main style={{ maxWidth:560, margin:'0 auto', padding:'20px 14px 0' }}>
        {loading && <SkeletonList T={T} />}

        {!loading && searchResults && (
          <>
            <p style={{ color:T.textMuted, fontSize:13, fontWeight:600, marginBottom:14 }}>"{query}" · {searchResults.length} {t('results')}</p>
            <div style={listStyle(T)}>
              {searchResults.map((p2, i) => <Card key={p2.id} p={p2} idx={i} {...cardProps} />)}
              {searchResults.length === 0 && <p style={{ color:T.textFaint, textAlign:'center', padding:'40px 0', width:'100%' }}>{t('noResults')}</p>}
            </div>
          </>
        )}

        {!loading && !searchResults && (
          <>
            {featured.length > 0 && (
              <div style={{ marginBottom:30 }}>
                <SectionTitle T={T} D={D} accent={accent} icon={<Star size={16} style={{ color:accent, fill:accent }} />}>{t('featured')}</SectionTitle>
                <div style={{ display:'flex', gap:12, overflowX:'auto', scrollbarWidth:'none', padding:'2px 14px 6px', margin:'0 -14px' }}>
                  {featured.map(p2 => <FeaturedCard key={p2.id} p={p2} {...cardProps} />)}
                </div>
              </div>
            )}

            {categories.map(cat => (
              <section key={cat.id} data-cat-id={cat.id} style={{ scrollMarginTop:116, marginBottom:34 }}>
                <SectionTitle T={T} D={D} accent={accent} count={`${(grouped[cat.id]||[]).filter(x=>x.available).length} ${t('items')}`}>{trCat(cat)}</SectionTitle>
                <div style={listStyle(T)}>
                  {(grouped[cat.id]||[]).map((p2, i) => <Card key={p2.id} p={p2} idx={i} {...cardProps} />)}
                </div>
              </section>
            ))}

            {/* Alt bilgi */}
            <div style={{ textAlign:'center', padding:'8px 0 24px' }}>
              {(profile.address || profile.phone || profile.instagramHandle) && (
                <div style={{ display:'flex', justifyContent:'center', gap:16, flexWrap:'wrap', marginBottom:10 }}>
                  {profile.address && <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:T.textFaint, fontSize:11 }}><MapPin size={11}/>{profile.address}</span>}
                  {profile.phone && <a href={`tel:${profile.phone}`} style={{ display:'inline-flex', alignItems:'center', gap:5, color:T.textFaint, fontSize:11, textDecoration:'none' }}><Phone size={11}/>{profile.phone}</a>}
                  {profile.instagramHandle && <a href={`https://instagram.com/${profile.instagramHandle}`} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:5, color:T.textFaint, fontSize:11, textDecoration:'none' }}><Instagram size={11}/>@{profile.instagramHandle}</a>}
                </div>
              )}
              <p style={{ color:T.textFaint, fontSize:11, fontWeight:500 }}>{profile.name} · serviq</p>
            </div>
          </>
        )}
      </main>

      {/* ── Sipariş takip pili ── */}
      {myActive.length > 0 && (
        <button onClick={() => setTrackOpen(true)} style={{
          position:'fixed', bottom: cartCount>0 ? 116 : 28, [isRTL?'right':'left']:14, zIndex:30,
          display:'flex', alignItems:'center', gap:8, background:accent, border:'none',
          borderRadius:999, padding:'10px 16px', color:'#fff', fontSize:13, fontWeight:800,
          boxShadow:`0 6px 24px rgba(${rgb},.45)`, cursor:'pointer', animation:'pulseSoft 2.4s infinite',
        }}>
          <Clock size={14} /> {t('myOrders')} · {myActive.length}
        </button>
      )}

      {/* ── Köşe butonları ── */}
      <div style={{ position:'fixed', bottom:116, [isRTL?'left':'right']:14, zIndex:30, display:'flex', flexDirection:'column', gap:8 }}>
        {[{ type:'waiter', icon:<BellRing size={14}/>, label:t('waiter') }, { type:'bill', icon:<ReceiptText size={14}/>, label:t('bill') }].map(b2 => (
          <button key={b2.type} onClick={() => call(b2.type)} style={{
            display:'flex', alignItems:'center', gap:8, background:T.fab, backdropFilter:'blur(16px)',
            border:`1px solid ${T.fabBorder}`, borderRadius:999, padding:'9px 16px 9px 10px',
            color:T.text, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:B,
            boxShadow: T.dark ? 'none' : '0 4px 16px rgba(0,0,0,.1)',
          }}>
            <span style={{ width:28, height:28, borderRadius:'50%', background:`rgba(${rgb},.16)`, display:'flex', alignItems:'center', justifyContent:'center', color:accent }}>{b2.icon}</span>
            {b2.label}
          </button>
        ))}
      </div>

      {/* ── Sepet çubuğu ── */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', insetInline:0, bottom:0, zIndex:30, padding:'12px 14px 28px', background:`linear-gradient(to top,${T.bgSolid} 65%,transparent)` }}>
          <button key={cartBump} data-cartbar="1" onClick={() => setCartOpen(true)} style={{
            width:'100%', maxWidth:560, margin:'0 auto', display:'flex', alignItems:'center', gap:12,
            background:`linear-gradient(135deg,${accent},rgba(${rgb},.75))`, boxShadow:`0 8px 32px rgba(${rgb},.5)`,
            borderRadius: T.radius>14 ? 18 : T.radius+6, padding:'14px 18px', color:'#fff', fontWeight:800,
            border:'none', cursor:'pointer', animation:'bump .3s ease', fontFamily:B,
          }}>
            <span style={{ width:34, height:34, borderRadius:10, background:'rgba(0,0,0,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15 }}>{cartCount}</span>
            <span style={{ flex:1, textAlign: isRTL ? 'right':'left', fontSize:15 }}>{t('viewCart')}</span>
            <span style={{ fontWeight:900, fontSize:15 }}>{money(cartTotal)}</span>
            <ChevronRight size={16} style={{ opacity:.7, transform: isRTL?'rotate(180deg)':'none' }} />
          </button>
        </div>
      )}

      {/* ── Ürün detay ── */}
      {detail && (
        <Sheet onClose={() => setDetail(null)} title={trName(detail)} T={T} D={D}>
          <DetailContent product={detail} accent={accent} rgb={rgb} T={T} t={t} trDesc={trDesc}
            quickNotes={(categories.find(c=>c.id===detail.categoryId)?.notes)||DEFAULT_NOTES}
            onAdd={addToCart} disabled={!open} />
        </Sheet>
      )}

      {/* ── Sepet ── */}
      {cartOpen && (
        <Sheet onClose={() => setCartOpen(false)} title={t('cart')} T={T} D={D}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {cart.map((item,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background:T.surface, borderRadius:16, padding:12, border:`1px solid ${T.surfaceBorder}` }}>
                {item.image && (
                  <div style={{ width:52, height:52, borderRadius:12, overflow:'hidden', flexShrink:0, background:T.inputBg }}>
                    <ProductImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:T.text, fontWeight:700, fontSize:14, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</p>
                  {item.note && <p style={{ color:accent, fontSize:11, margin:'2px 0 0' }}>↳ {item.note}</p>}
                  <p style={{ color:T.textMuted, fontSize:12, margin:'2px 0 0' }}>{money(item.price)}</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <button onClick={() => changeQty(i,-1)} style={{ width:30, height:30, borderRadius:'50%', background:T.inputBg, border:`1px solid ${T.inputBorder}`, color:T.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>{item.qty===1 ? <Trash2 size={12}/> : <Minus size={12}/>}</button>
                  <span style={{ color:T.text, fontWeight:900, fontSize:14, width:18, textAlign:'center' }}>{item.qty}</span>
                  <button onClick={() => changeQty(i,1)} style={{ width:30, height:30, borderRadius:'50%', background:accent, border:'none', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Plus size={12}/></button>
                </div>
              </div>
            ))}
          </div>

          {/* Upsell */}
          {upsell.length > 0 && (
            <div style={{ marginTop:18 }}>
              <p style={{ color:T.textMuted, fontWeight:800, fontSize:12, textTransform:'uppercase', letterSpacing:.8, marginBottom:10 }}>{t('upsell')}</p>
              <div style={{ display:'flex', gap:10, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4 }}>
                {upsell.map(p2 => (
                  <button key={p2.id} onClick={() => { addToCart(p2, 1, ''); setCartOpen(true) }} style={{
                    flexShrink:0, width:130, background:T.surface, border:`1px solid ${T.surfaceBorder}`,
                    borderRadius:14, overflow:'hidden', cursor:'pointer', textAlign: isRTL?'right':'left', padding:0 }}>
                    {p2.image && <div style={{ height:64, background:T.inputBg }}><ProductImage src={p2.image} alt="" className="w-full h-full object-cover" /></div>}
                    <div style={{ padding:'8px 10px' }}>
                      <p style={{ color:T.text, fontWeight:700, fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trName(p2)}</p>
                      <p style={{ color:accent, fontWeight:900, fontSize:12, margin:'3px 0 0' }}>+ {money(p2.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ color:T.textMuted, fontWeight:600, fontSize:14 }}>{t('total')}</span>
              <span style={{ color:T.text, fontWeight:900, fontSize:24, fontFamily:D }}>{money(cartTotal)}</span>
            </div>
            <button onClick={confirmOrder} disabled={!open} style={{
              width:'100%', padding:'16px', borderRadius:16, border:'none',
              background: open ? `linear-gradient(135deg,${accent},rgba(${rgb},.75))` : T.inputBg,
              boxShadow: open ? `0 8px 24px rgba(${rgb},.4)` : 'none',
              color: open ? '#fff' : T.textFaint, fontWeight:900, fontSize:16, cursor: open?'pointer':'not-allowed',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:B }}>
              <Check size={18} strokeWidth={3}/> {open ? t('confirm') : t('closed')}
            </button>
            <div style={{ marginTop:14, padding:12, borderRadius:14, background:T.inputBg, border:`1px solid ${T.inputBorder}` }}>
              <div style={{ color:T.text, fontWeight:800, fontSize:12, marginBottom:8 }}>Sadakat puanı kazan (isteğe bağlı)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <input value={customerInfo.name} onChange={e => setCustomerInfo(v => ({ ...v, name:e.target.value }))} placeholder="Ad soyad" style={{ width:'100%', boxSizing:'border-box', borderRadius:10, border:`1px solid ${T.inputBorder}`, background:T.surface, color:T.text, padding:'9px 10px', fontSize:12, outline:'none' }} />
                <input value={customerInfo.phone} onChange={e => setCustomerInfo(v => ({ ...v, phone:e.target.value }))} placeholder="Telefon" inputMode="tel" style={{ width:'100%', boxSizing:'border-box', borderRadius:10, border:`1px solid ${T.inputBorder}`, background:T.surface, color:T.text, padding:'9px 10px', fontSize:12, outline:'none' }} />
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:7, color:T.textMuted, fontSize:11, marginTop:9, cursor:'pointer' }}><input type="checkbox" checked={customerInfo.consent} onChange={e => setCustomerInfo(v => ({ ...v, consent:e.target.checked }))} /> Kampanya ve puan bilgilerini almak istiyorum.</label>
            </div>
            <p style={{ textAlign:'center', color:T.textFaint, fontSize:11, marginTop:10 }}>{t('payNote')}</p>
          </div>
        </Sheet>
      )}

      {/* ── Sipariş takibi ── */}
      {trackOpen && (
        <Sheet onClose={() => setTrackOpen(false)} title={t('myOrders')} T={T} D={D}>
          <OrderTracker orders={myOrders} T={T} accent={accent} rgb={rgb} t={t} D={D}
            bizId={bizId} tableNo={masaNo} profile={profile} />
        </Sheet>
      )}

      {/* ── Sipariş onay ── */}
      {placed && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.82)', backdropFilter:'blur(12px)', padding:20 }}>
          <div style={{ background:T.sheet, borderRadius:28, padding:'40px 32px', textAlign:'center', maxWidth:300, width:'100%', border:`1px solid ${T.surfaceBorder}`, boxShadow:'0 32px 80px rgba(0,0,0,.4)', animation:'pop .4s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', margin:'0 auto 20px', background:`linear-gradient(135deg,${accent},rgba(${rgb},.55))`, boxShadow:`0 12px 40px rgba(${rgb},.5)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Check size={36} strokeWidth={3} color="#fff"/>
            </div>
            <h3 style={{ color:T.text, fontWeight:900, fontSize:22, margin:'0 0 8px', fontFamily:D }}>{t('placed')}</h3>
            <p style={{ color:T.textMuted, fontSize:13, margin:0, lineHeight:1.6, whiteSpace:'pre-line' }}>{t('placedSub')}</p>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:60, pointerEvents:'none', background:accent, borderRadius:999, padding:'10px 20px', color:'#fff', fontSize:13, fontWeight:700, whiteSpace:'nowrap', boxShadow:`0 8px 28px rgba(${rgb},.5)`, animation:'slideD .25s ease both', fontFamily:B }}>{toast}</div>
      )}

      <style>{`
        *{box-sizing:border-box}
        nav::-webkit-scrollbar{display:none}
        @keyframes pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        @keyframes slideD{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes slideU{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bump{0%{transform:scale(1)}40%{transform:scale(1.04)}100%{transform:scale(1)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes pulseSoft{0%,100%{box-shadow:0 6px 24px rgba(0,0,0,.25)}50%{box-shadow:0 6px 32px rgba(0,0,0,.45)}}
        .anim-card{opacity:0;transform:translateY(18px);transition:opacity .5s cubic-bezier(.22,.61,.36,1),transform .5s cubic-bezier(.22,.61,.36,1)}
        .anim-card.in{opacity:1;transform:none}
        @media(prefers-reduced-motion:reduce){.anim-card{opacity:1!important;transform:none!important;transition:none!important}}
        .brut-card{transition:transform .12s ease, box-shadow .12s ease}
        .brut-card:active{transform:translate(3px,3px);box-shadow:1px 1px 0 #111 !important}
        @keyframes wrun-whip{0%{transform:rotate(32deg)}50%{transform:rotate(-42deg)}100%{transform:rotate(32deg)}}
        @keyframes wrun-knee{0%{transform:rotate(4deg)}30%{transform:rotate(8deg)}55%{transform:rotate(22deg)}70%{transform:rotate(82deg)}85%{transform:rotate(36deg)}100%{transform:rotate(4deg)}}
        @keyframes wrun-arm{0%{transform:rotate(-38deg)}50%{transform:rotate(42deg)}100%{transform:rotate(-38deg)}}
        @keyframes wrun-bob{0%,100%{transform:translateY(0)}25%,75%{transform:translateY(-2px)}}
      `}</style>
    </div>
  )
}

/* ══════════ HERO — şablona göre 4 kompozisyon ══════════ */
function Hero({ T, accent, rgb, profile, initial, tableLabel, D }) {
  const TableBadge = (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background: T.dark||T.heroLayout==='photo' ? 'rgba(255,255,255,.14)' : `rgba(${rgb},.1)`,
      backdropFilter:'blur(12px)', border:`1px solid ${T.dark||T.heroLayout==='photo' ? 'rgba(255,255,255,.22)' : `rgba(${rgb},.3)`}`,
      borderRadius:999, padding:'6px 14px', color: T.heroLayout==='photo'||T.dark ? '#fff' : T.text, fontSize:12, fontWeight:700 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:accent, boxShadow:`0 0 8px ${accent}`, display:'inline-block' }} />
      {tableLabel}
    </span>
  )

  // EDITORIAL: tipografik hero — fotoğraf yok, saf zarafet
  if (T.heroLayout === 'typographic') {
    return (
      <div style={{ padding:'44px 24px 28px', textAlign:'center' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>{TableBadge}</div>
        {profile.tagline && <p style={{ color:T.textMuted, fontSize:11, letterSpacing:3, textTransform:'uppercase', margin:'0 0 10px', fontWeight:600 }}>{profile.tagline}</p>}
        <h1 style={{ fontFamily:D, fontSize:38, fontWeight:600, color:T.text, margin:0, lineHeight:1.15 }}>{profile.name || 'Restoran'}</h1>
        <div style={{ width:64, height:1, background:T.divider, margin:'18px auto 3px' }} />
        <div style={{ width:40, height:1, background:T.divider, margin:'0 auto' }} />
        {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, marginTop:14, display:'inline-flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // ZARİF: yumuşak çerçeveli hero
  if (T.heroLayout === 'soft') {
    return (
      <div style={{ padding:'18px 16px 0' }}>
        <div style={{ position:'relative', borderRadius:28, overflow:'hidden', height:190, boxShadow:T.cardShadow, border:`1px solid ${T.surfaceBorder}` }}>
          {profile.cover
            ? <img src={profile.cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <div style={{ width:'100%', height:'100%', background:T.heroFallback }} />}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,.5), rgba(0,0,0,0) 60%)' }} />
          <div style={{ position:'absolute', top:12, right:12 }}>{TableBadge}</div>
          <div style={{ position:'absolute', bottom:12, left:16, right:16 }}>
            <h1 style={{ color:'#fff', fontFamily:D, fontWeight:900, fontSize:24, margin:0, textShadow:'0 2px 10px rgba(0,0,0,.4)' }}>{profile.name || 'Restoran'}</h1>
            {profile.tagline && <p style={{ color:'rgba(255,255,255,.85)', fontSize:15, margin:'2px 0 0', fontFamily:T.fontAccent || undefined }}>{profile.tagline}</p>}
          </div>
        </div>
        {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, margin:'10px 4px 0', display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // GECE: koyu vinyetli hero / altın çerçeve
  if (T.heroLayout === 'dark') {
    return (
      <div style={{ position:'relative', height: profile.cover ? 230 : 190, overflow:'hidden' }}>
        {profile.cover
          ? <img src={profile.cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'brightness(.5) saturate(.9)' }} />
          : <div style={{ width:'100%', height:'100%', background:T.heroFallback }} />}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,.72) 100%)' }} />
        <div style={{ position:'absolute', top:16, right:16 }}>{TableBadge}</div>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'0 24px' }}>
          <div style={{ width:46, height:1, background:accent, marginBottom:14, opacity:.8 }} />
          <h1 style={{ color:'#f4efe6', fontFamily:D, fontSize:30, fontWeight:400, margin:0, letterSpacing:1 }}>{profile.name || 'Restoran'}</h1>
          {profile.tagline && <p style={{ color:'rgba(244,239,230,.6)', fontSize:12, letterSpacing:2.5, textTransform:'uppercase', margin:'8px 0 0' }}>{profile.tagline}</p>}
          <div style={{ width:46, height:1, background:accent, marginTop:14, opacity:.8 }} />
        </div>
        {profile.wifi && <p style={{ position:'absolute', bottom:10, left:16, color:'rgba(244,239,230,.5)', fontSize:11, display:'flex', alignItems:'center', gap:5, margin:0 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // AURORA: ışıltılı cam hero
  if (T.heroLayout === 'aurora') {
    return (
      <div style={{ position:'relative', padding:'20px 20px 26px', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:T.heroFallback, opacity:.9 }} />
        <div style={{ position:'absolute', inset:0, backdropFilter:'blur(30px)', WebkitBackdropFilter:'blur(30px)' }} />
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>{TableBadge}</div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:56, height:56, borderRadius:18, flexShrink:0, overflow:'hidden', border:'1px solid rgba(255,255,255,.25)', background: profile.logo ? 'transparent' : 'rgba(255,255,255,.15)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:22, fontWeight:700, fontFamily:D }}>
              {profile.logo ? <img src={profile.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initial}
            </div>
            <div>
              <h1 style={{ color:'#fff', fontFamily:D, fontWeight:700, fontSize:24, margin:0, lineHeight:1.15, textShadow:'0 2px 20px rgba(0,0,0,.3)' }}>{profile.name || 'Restoran'}</h1>
              {profile.tagline && <p style={{ color:'rgba(255,255,255,.8)', fontSize:12.5, margin:'3px 0 0' }}>{profile.tagline}</p>}
              {profile.wifi && <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:'rgba(255,255,255,.65)', fontSize:11, marginTop:4 }}><Wifi size={11}/> {profile.wifi}</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // BRÜTAL: siyah çerçeveli dev tipografi bloğu
  if (T.heroLayout === 'brut') {
    return (
      <div style={{ background:T.heroFallback, borderBottom:'3px solid #111', padding:'18px 18px 20px', position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
          <div style={{ background:'#111', color:'#fff', fontFamily:D, fontSize:11, fontWeight:400, padding:'5px 12px', borderRadius:2, letterSpacing:1 }}>
            {tableLabel.toUpperCase()}
          </div>
          {profile.logo && <div style={{ width:48, height:48, border:'2.5px solid #111', overflow:'hidden', background:'#fff' }}><img src={profile.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>}
        </div>
        <h1 style={{ color:'#fff', fontFamily:D, fontSize:34, margin:'14px 0 0', lineHeight:.98, textTransform:'uppercase', textShadow:'3px 3px 0 #111', wordBreak:'break-word' }}>{profile.name || 'Restoran'}</h1>
        {profile.tagline && <p style={{ display:'inline-block', background:'#111', color:'#fff', fontSize:12, fontWeight:700, padding:'4px 10px', margin:'12px 0 0' }}>{profile.tagline}</p>}
        {profile.wifi && <p style={{ color:'#111', fontSize:11, fontWeight:700, margin:'10px 0 0', display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // NOIR: dergi kapağı — ince serif, altın çizgiler
  if (T.heroLayout === 'noir') {
    return (
      <div style={{ position:'relative', overflow:'hidden' }}>
        {profile.cover && (
          <div style={{ position:'relative', height:220, overflow:'hidden' }}>
            <img src={profile.cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'brightness(.45) saturate(.85) contrast(1.05)' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(10,10,10,.3), rgba(10,10,10,.95))' }} />
          </div>
        )}
        <div style={{ position: profile.cover ? 'absolute' : 'relative', inset: profile.cover ? 0 : 'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'40px 24px 26px' }}>
          <div style={{ position:'absolute', top:16, right:16 }}>{TableBadge}</div>
          {profile.tagline && <p style={{ color:accent, fontSize:10, letterSpacing:4, textTransform:'uppercase', margin:'0 0 12px', fontFamily:T.fontBody, fontWeight:500 }}>{profile.tagline}</p>}
          <div style={{ display:'flex', alignItems:'center', gap:14, width:'100%', justifyContent:'center' }}>
            <span style={{ flex:1, maxWidth:40, height:1, background:accent, opacity:.6 }} />
            <h1 style={{ color:T.text, fontFamily:D, fontSize:30, fontWeight:500, margin:0, letterSpacing:.5, whiteSpace:'nowrap' }}>{profile.name || 'Restoran'}</h1>
            <span style={{ flex:1, maxWidth:40, height:1, background:accent, opacity:.6 }} />
          </div>
          {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, marginTop:14, display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
        </div>
      </div>
    )
  }

  // TERRA: katmanlı sıcak toprak hero, serif isim
  if (T.heroLayout === 'terra') {
    return (
      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ position:'relative', borderRadius:24, overflow:'hidden', height:196, boxShadow:T.cardShadow }}>
          {profile.cover
            ? <img src={profile.cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <div style={{ width:'100%', height:'100%', background:T.heroFallback }} />}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(40,30,20,.78), rgba(40,30,20,.15) 55%, rgba(40,30,20,0))' }} />
          <div style={{ position:'absolute', top:12, right:12 }}>{TableBadge}</div>
          <div style={{ position:'absolute', bottom:14, left:18, right:18 }}>
            {profile.tagline && <p style={{ color:'rgba(255,248,238,.82)', fontSize:11, letterSpacing:2.5, textTransform:'uppercase', margin:'0 0 5px', fontWeight:600 }}>{profile.tagline}</p>}
            <h1 style={{ color:'#fff', fontFamily:D, fontWeight:600, fontSize:34, margin:0, lineHeight:1.05, textShadow:'0 2px 14px rgba(0,0,0,.4)' }}>{profile.name || 'Restoran'}</h1>
          </div>
        </div>
        {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, margin:'10px 4px 0', display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // MONO: İsviçre minimalizmi — dev tipografi, ince kurallar
  if (T.heroLayout === 'mono') {
    return (
      <div style={{ padding:'26px 18px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${T.divider}`, paddingBottom:10 }}>
          <span style={{ fontFamily:T.fontAccent, fontSize:11, letterSpacing:1, color:T.textMuted }}>{profile.tagline ? profile.tagline.toUpperCase() : ''}</span>
          {TableBadge}
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'22px 0 20px', borderBottom:`2px solid ${T.text}` }}>
          <span style={{ width:10, height:10, borderRadius:'50%', background:accent, marginTop:14, flexShrink:0 }} />
          <h1 style={{ fontFamily:D, fontSize:40, fontWeight:800, color:T.text, margin:0, lineHeight:.98, letterSpacing:'-1.5px' }}>{profile.name || 'Restoran'}</h1>
        </div>
        {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, fontFamily:T.fontAccent, margin:'12px 0 0', display:'flex', alignItems:'center', gap:6 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // MAISON: Paris bistrosu — ortalı serif, altın kural, bordo
  if (T.heroLayout === 'maison') {
    return (
      <div style={{ position:'relative', overflow:'hidden' }}>
        {profile.cover && (
          <div style={{ position:'relative', height:210, overflow:'hidden' }}>
            <img src={profile.cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'brightness(.4) saturate(.85) sepia(.15)' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(28,11,15,.35), rgba(28,11,15,.96))' }} />
          </div>
        )}
        <div style={{ position: profile.cover ? 'absolute' : 'relative', inset: profile.cover ? 0 : 'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'42px 24px 28px' }}>
          <div style={{ position:'absolute', top:16, right:16 }}>{TableBadge}</div>
          {profile.tagline && <p style={{ color:accent, fontSize:10, letterSpacing:5, textTransform:'uppercase', margin:'0 0 14px', fontFamily:T.fontBody, fontWeight:500 }}>{profile.tagline}</p>}
          <div style={{ display:'flex', alignItems:'center', gap:16, width:'100%', justifyContent:'center', maxWidth:340 }}>
            <span style={{ flex:1, height:1, background:`linear-gradient(to right, transparent, ${accent})`, opacity:.7 }} />
            <span style={{ color:accent, fontSize:14 }}>❦</span>
            <span style={{ flex:1, height:1, background:`linear-gradient(to left, transparent, ${accent})`, opacity:.7 }} />
          </div>
          <h1 style={{ color:T.text, fontFamily:D, fontSize:36, fontWeight:500, fontStyle:'italic', margin:'12px 0', lineHeight:1.05 }}>{profile.name || 'Restoran'}</h1>
          <div style={{ width:56, height:1, background:accent, opacity:.6 }} />
          {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, marginTop:14, display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
        </div>
      </div>
    )
  }

  // POP: canlı gradient blok, dev yuvarlak tipografi
  if (T.heroLayout === 'pop') {
    return (
      <div style={{ padding:'14px 14px 0' }}>
        <div style={{ position:'relative', borderRadius:28, overflow:'hidden', background:T.heroFallback, padding:'20px 20px 22px', minHeight:172 }}>
          <div style={{ position:'absolute', top:-30, right:-20, width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,.22)' }} />
          <div style={{ position:'absolute', bottom:-40, left:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.15)' }} />
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
              {profile.logo
                ? <div style={{ width:52, height:52, borderRadius:16, overflow:'hidden', border:'3px solid #fff', boxShadow:'0 4px 14px rgba(0,0,0,.2)' }}><img src={profile.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>
                : <span style={{ width:52, height:52, borderRadius:16, background:'rgba(255,255,255,.25)', border:'3px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:D, fontWeight:800, fontSize:24 }}>{initial}</span>}
              {TableBadge}
            </div>
            <h1 style={{ color:'#fff', fontFamily:D, fontWeight:800, fontSize:34, margin:'16px 0 0', lineHeight:.98, letterSpacing:'-.5px', textShadow:'0 3px 14px rgba(0,0,0,.25)' }}>{profile.name || 'Restoran'}</h1>
            {profile.tagline && <p style={{ display:'inline-block', background:'#fff', color:T.text, fontSize:12.5, fontWeight:700, padding:'5px 12px', borderRadius:999, margin:'12px 0 0' }}>{profile.tagline}</p>}
            {profile.wifi && <span style={{ display:'flex', alignItems:'center', gap:5, color:'rgba(255,255,255,.9)', fontSize:11, fontWeight:600, marginTop:10 }}><Wifi size={11}/> {profile.wifi}</span>}
          </div>
        </div>
      </div>
    )
  }

  // RETRO: koyu kahve zemin, katmanlı güneş kemeri, esnaf lokantası hissi
  if (T.heroLayout === 'retro') {
    return (
      <div style={{ position:'relative', background:'#3B2417', color:'#FFF6E3', padding:'20px 22px 34px', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-74, bottom:-118, width:250, height:250, borderRadius:'50%', background:accent }} />
        <div style={{ position:'absolute', right:-40, bottom:-134, width:182, height:182, borderRadius:'50%', background:T.accent2 || '#E8A33D' }} />
        <div style={{ position:'absolute', right:-12, bottom:-148, width:126, height:126, borderRadius:'50%', background:'#FFF6E3' }} />
        <div style={{ position:'relative', zIndex:1, display:'flex', justifyContent:'flex-end', alignItems:'center' }}>
          <span style={{ border:'2px dashed #FFF6E3', padding:'7px 13px', fontFamily:D, fontSize:13, letterSpacing:1, borderRadius:3 }}>{tableLabel}</span>
        </div>
        <h1 style={{ position:'relative', zIndex:1, marginTop:20, fontFamily:D, fontSize:40, lineHeight:1.05, color:'#fff' }}>{profile.name || 'Restoran'}</h1>
        {profile.tagline && <p style={{ position:'relative', zIndex:1, marginTop:12, fontWeight:600, fontSize:14, lineHeight:1.4, color:'#F2D8A7', maxWidth:220 }}>{profile.tagline}</p>}
        {profile.wifi && <p style={{ position:'relative', zIndex:1, marginTop:14, color:'rgba(255,246,227,.7)', fontSize:11, display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // NEON: ızgara desenli koyu zemin, neon parıltı, sokak lezzeti enerjisi
  if (T.heroLayout === 'neon') {
    return (
      <div style={{ position:'relative', padding:'22px 20px 30px', overflow:'hidden', background:'#0A0B14',
        backgroundImage:'linear-gradient(rgba(34,228,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(34,228,255,.05) 1px,transparent 1px)',
        backgroundSize:'26px 26px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, letterSpacing:3, color:'#22E4FF', fontWeight:700, textShadow:'0 0 10px rgba(34,228,255,.8)' }}>
            {profile.hoursEnabled ? (isOpenNow(profile) ? '● AÇIK' : '● KAPALI') : ''}
          </span>
          <span style={{ border:'1.5px solid #22E4FF', borderRadius:8, padding:'8px 13px', fontSize:12, fontWeight:700, letterSpacing:1.5, color:'#22E4FF', textShadow:'0 0 10px rgba(34,228,255,.7)', boxShadow:'0 0 14px rgba(34,228,255,.3), inset 0 0 10px rgba(34,228,255,.12)' }}>{tableLabel}</span>
        </div>
        <h1 style={{ marginTop:24, fontFamily:D, fontWeight:900, fontSize:34, lineHeight:1.1, color:'#fff', textShadow:'0 0 8px rgba(255,61,138,.9),0 0 26px rgba(255,61,138,.55),0 0 60px rgba(255,61,138,.35)' }}>{profile.name || 'Restoran'}</h1>
        {profile.tagline && <p style={{ marginTop:14, fontSize:12, letterSpacing:4, color:'#8A90B8', fontWeight:500, textTransform:'uppercase' }}>{profile.tagline}</p>}
        {profile.wifi && <p style={{ marginTop:14, color:'#8A90B8', fontSize:11, display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // EXECUTIVE: antrasit zemin, bakır çizgi, özel kulüp zarafeti
  if (T.heroLayout === 'executive') {
    return (
      <div style={{ position:'relative', padding:'30px 26px 40px', background:'radial-gradient(120% 90% at 80% 0%,#1b1d21 0%,#0d0e10 62%)', borderBottom:'1px solid rgba(201,154,95,.22)' }}>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:8, border:'1px solid rgba(201,154,95,.4)', padding:'6px 11px', color:'#e9e4db', whiteSpace:'nowrap' }}>
            <span style={{ width:5, height:5, background:accent, borderRadius:'50%', display:'inline-block' }} />
            <span style={{ fontSize:11, letterSpacing:2, fontWeight:600 }}>{tableLabel.toUpperCase()}</span>
          </span>
        </div>
        <h1 style={{ fontFamily:D, fontWeight:700, fontSize:44, lineHeight:.96, letterSpacing:'-.01em', margin:'24px 0 0', color:'#f4efe6' }}>{profile.name || 'Restoran'}</h1>
        <div style={{ width:44, height:2, background:accent, margin:'18px 0 15px' }} />
        {profile.tagline && <p style={{ margin:0, maxWidth:270, fontSize:14, lineHeight:1.55, color:'#9a948a' }}>{profile.tagline}</p>}
        {profile.wifi && <p style={{ color:'rgba(154,148,138,.7)', fontSize:11, marginTop:14, display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // SCANDI: kirli beyaz zemin, sakin serif tagline
  if (T.heroLayout === 'scandi') {
    return (
      <div style={{ padding:'34px 28px 28px' }}>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <span style={{ border:'1px solid #c8c1af', padding:'5px 12px', fontSize:12, letterSpacing:1.5, fontWeight:600, color:T.text }}>{tableLabel.toUpperCase()}</span>
        </div>
        <h1 style={{ fontFamily:D, fontWeight:600, fontSize:46, lineHeight:.96, letterSpacing:'-.02em', margin:'18px 0 0', color:'#26251f' }}>{profile.name || 'Restoran'}</h1>
        {profile.tagline && <p style={{ fontFamily:T.fontAccent, fontStyle:'italic', fontSize:17, lineHeight:1.4, color:'#6a675e', margin:'14px 0 0', maxWidth:280 }}>{profile.tagline}</p>}
        {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, marginTop:16, display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
      </div>
    )
  }

  // ARCHITECTURAL: beyaz zemin, kobalt çizgi, gerçek masa numarası kutulu
  if (T.heroLayout === 'architectural') {
    const tableNum = tableLabel.replace(/[^0-9]/g, '') || tableLabel
    return (
      <div style={{ borderBottom:'1.5px solid #141414' }}>
        <div style={{ padding:'26px 18px 20px' }}>
          <div style={{ fontFamily:T.fontAccent, fontSize:11, letterSpacing:2, color:accent }}>FIG. 01 — MENÜ</div>
          <h1 style={{ fontFamily:D, fontWeight:800, fontSize:38, lineHeight:.92, letterSpacing:'-.02em', margin:'12px 0 0', textTransform:'uppercase', color:T.text }}>{profile.name || 'Restoran'}</h1>
          <div style={{ height:2, background:accent, margin:'16px 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:10 }}>
            {profile.tagline ? <p style={{ margin:0, maxWidth:210, fontSize:13, lineHeight:1.5, color:T.textMuted }}>{profile.tagline}</p> : <span />}
            <div style={{ border:'1.5px solid #141414', fontFamily:T.fontAccent, textAlign:'center', lineHeight:1, flexShrink:0 }}>
              <div style={{ padding:'6px 12px 3px', fontSize:9, letterSpacing:1.5, color:T.textMuted, borderBottom:'1px solid #e4e4e4' }}>MASA</div>
              <div style={{ padding:'5px 12px 7px', fontSize:20, fontWeight:700 }}>{tableNum}</div>
            </div>
          </div>
          {profile.wifi && <p style={{ color:T.textFaint, fontSize:11, marginTop:14, display:'flex', alignItems:'center', gap:5 }}><Wifi size={11}/> {profile.wifi}</p>}
        </div>
      </div>
    )
  }

  // VİTRİN (varsayılan): fotoğraf hero
  return (
    <div style={{ position:'relative', height:'52vw', maxHeight:270, minHeight:180, overflow:'hidden' }}>
      {profile.cover
        ? <img src={profile.cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scale(1.05)', filter:'brightness(.8)' }} />
        : <div style={{ width:'100%', height:'100%', background:T.heroFallback }} />}
      <div style={{ position:'absolute', inset:0, background: profile.cover ? 'linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.35) 55%, rgba(0,0,0,.05))' : 'linear-gradient(to top, rgba(0,0,0,.5), rgba(0,0,0,.08) 60%)' }} />
      <div style={{ position:'absolute', top:16, right:16 }}>{TableBadge}</div>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'0 20px 18px', display:'flex', alignItems:'flex-end', gap:13 }}>
        <div style={{ width:54, height:54, borderRadius:16, flexShrink:0, overflow:'hidden', border:'2px solid rgba(255,255,255,.3)', background: profile.logo ? 'transparent' : accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:21, fontWeight:900 }}>
          {profile.logo ? <img src={profile.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initial}
        </div>
        <div>
          <h1 style={{ color:'#fff', fontFamily:D, fontWeight:800, fontSize:22, margin:0, lineHeight:1.2, textShadow:'0 2px 12px rgba(0,0,0,.5)' }}>{profile.name || 'Restoran'}</h1>
          {profile.tagline && <p style={{ color:'rgba(255,255,255,.72)', fontSize:12, margin:'3px 0 0', fontWeight:500 }}>{profile.tagline}</p>}
          {profile.wifi && <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:'rgba(255,255,255,.55)', fontSize:11, marginTop:4 }}><Wifi size={11}/> {profile.wifi}</span>}
        </div>
      </div>
    </div>
  )
}

/* ══════════ Bölüm başlığı ══════════ */
function SectionTitle({ T, D, accent, icon, count, children }) {
  if (T.cardLayout === 'editorial') {
    return (
      <div style={{ textAlign:'center', margin:'6px 0 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, justifyContent:'center' }}>
          <div style={{ flex:1, height:1, background:T.divider }} />
          <h2 style={{ fontFamily:D, fontSize:20, fontWeight:600, color:T.text, margin:0, whiteSpace:'nowrap' }}>{children}</h2>
          <div style={{ flex:1, height:1, background:T.divider }} />
        </div>
        {count && <span style={{ color:T.textFaint, fontSize:10, letterSpacing:2, textTransform:'uppercase' }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'gece') {
    return (
      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
        <h2 style={{ fontFamily:D, fontSize:19, fontWeight:400, color:T.text, margin:0, letterSpacing:.5 }}>{children}</h2>
        <div style={{ flex:1, height:1, background:T.divider }} />
        {count && <span style={{ color:accent, fontSize:10, letterSpacing:1.5, textTransform:'uppercase', opacity:.85 }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'zarif') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        {icon}
        <h2 style={{ fontFamily: T.fontAccent || D, fontSize: T.fontAccent ? 26 : 18, fontWeight:700, color:T.text, margin:0 }}>{children}</h2>
        <div style={{ flex:1 }} />
        {count && <span style={{ color:T.textFaint, fontSize:11, fontWeight:700 }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'mono') {
    return (
      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:6 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:accent, alignSelf:'center' }} />
        <h2 style={{ fontFamily:D, fontSize:15, fontWeight:800, color:T.text, margin:0, textTransform:'uppercase', letterSpacing:'.5px' }}>{children}</h2>
        <div style={{ flex:1, height:1, background:T.divider }} />
        {count && <span style={{ color:T.textFaint, fontSize:11, fontFamily:T.fontAccent }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'maison') {
    return (
      <div style={{ textAlign:'center', margin:'8px 0 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, justifyContent:'center' }}>
          <span style={{ flex:1, maxWidth:60, height:1, background:`linear-gradient(to right, transparent, ${accent})`, opacity:.6 }} />
          <h2 style={{ fontFamily:D, fontSize:22, fontWeight:500, fontStyle:'italic', color:T.text, margin:0, whiteSpace:'nowrap' }}>{children}</h2>
          <span style={{ flex:1, maxWidth:60, height:1, background:`linear-gradient(to left, transparent, ${accent})`, opacity:.6 }} />
        </div>
        {count && <span style={{ color:T.textFaint, fontSize:10, letterSpacing:2, textTransform:'uppercase' }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'retro') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <span style={{ fontFamily:D, fontSize:19, color:T.text }}>{children}</span>
        <div style={{ flex:1, height:0, borderTop:`2px dashed ${T.divider}` }} />
        {count && <span style={{ fontSize:11, color:T.textFaint, fontWeight:700 }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'neon') {
    return (
      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:14 }}>
        <span style={{ fontFamily:D, fontWeight:700, fontSize:14, color:T.text, textTransform:'uppercase', letterSpacing:.5 }}>{children}</span>
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg, rgba(34,228,255,.5), transparent)' }} />
        {count && <span style={{ fontSize:10, color:T.textFaint }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'executive') {
    return (
      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:6 }}>
        <h2 style={{ fontFamily:D, fontSize:13, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:accent, margin:0 }}>{children}</h2>
        <div style={{ flex:1, height:1, background:T.divider }} />
        {count && <span style={{ color:T.textFaint, fontSize:11 }}>{count}</span>}
      </div>
    )
  }
  if (T.cardLayout === 'scandi') {
    return (
      <div style={{ marginBottom:2 }}>
        <h2 style={{ fontFamily:D, fontSize:12, fontWeight:600, letterSpacing:2.5, textTransform:'uppercase', color:T.textFaint, margin:0 }}>{children}</h2>
      </div>
    )
  }
  if (T.cardLayout === 'architectural') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f6f6f4', borderTop:`1px solid ${T.divider}`, borderBottom:`1px solid ${T.divider}`, margin:'0 -14px 0', padding:'14px 14px' }}>
        <h2 style={{ fontFamily:D, fontSize:13, fontWeight:700, letterSpacing:1.8, textTransform:'uppercase', color:T.text, margin:0 }}>{children}</h2>
        {count && <span style={{ fontFamily:T.fontAccent, fontSize:11, color:'#9a9a9a' }}>{count}</span>}
      </div>
    )
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
      {icon}
      <h2 style={{ fontFamily:D, fontSize:18, fontWeight:800, color:T.text, margin:0, letterSpacing:'-.3px' }}>{children}</h2>
      <div style={{ flex:1, height:1, background:T.divider }} />
      {count && <span style={{ color:T.textFaint, fontSize:11, fontWeight:600 }}>{count}</span>}
    </div>
  )
}

/* ══════════ Rozetler ══════════ */
function Badges({ p, badge, accent, t, small }) {
  const b = badge(p)
  if (!b.chef && !b.best && !b.combo) return null
  const chip = (bg, icon, label) => (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:bg, color:'#fff',
      fontSize: small?9:10, fontWeight:800, padding: small?'2px 7px':'3px 9px', borderRadius:999 }}>
      {icon}{label}
    </span>
  )
  return (
    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
      {b.combo && chip('#d97706', <Tag size={small?9:10}/>, t('combo'))}
      {b.chef && chip('#7c3aed', <ChefHat size={small?9:10}/>, t('chef'))}
      {b.best && chip('#dc2626', <Flame size={small?9:10}/>, t('bestseller'))}
    </div>
  )
}

/* ══════════ Liste kapsayıcı düzeni — şablona göre grid/flex ══════════ */
function listStyle(T) {
  const twoCol = T.cardLayout === 'zarif' || T.cardLayout === 'bento' || T.cardLayout === 'pop' || T.cardLayout === 'neon'
  if (twoCol) {
    const gap = T.cardLayout === 'bento' ? 10 : 12
    // alignItems:'start' şart — yoksa grid, fotoğrafsız (daha kısa) kartları
    // komşu satırın boyuna zorla uzatır ve altta çirkin boş alan bırakır.
    return { display:'grid', gridTemplateColumns:'1fr 1fr', gap, gridAutoFlow:'dense', alignItems:'start' }
  }
  const gap = T.cardLayout === 'editorial' || T.cardLayout === 'mono' || T.cardLayout === 'retro'
    || T.cardLayout === 'executive' || T.cardLayout === 'scandi' || T.cardLayout === 'architectural' ? 0
    : T.cardLayout === 'noir' ? 24
    : T.cardLayout === 'maison' ? 6
    : T.cardLayout === 'terra' ? 12 : 12
  return { display:'flex', flexDirection:'column', gap }
}

/* ══════════ ÜRÜN KARTLARI — 4 şablon dili ══════════ */
function Card(props) {
  const { T } = props
  if (T.cardLayout === 'editorial') return <EditorialRow {...props} />
  if (T.cardLayout === 'zarif')     return <ZarifCard {...props} />
  if (T.cardLayout === 'gece')      return <GeceRow {...props} />
  if (T.cardLayout === 'aurora')    return <AuroraCard {...props} />
  if (T.cardLayout === 'bento')     return <BentoCard {...props} />
  if (T.cardLayout === 'brut')      return <BrutCard {...props} />
  if (T.cardLayout === 'noir')      return <NoirCard {...props} />
  if (T.cardLayout === 'terra')     return <TerraCard {...props} />
  if (T.cardLayout === 'mono')      return <MonoRow {...props} />
  if (T.cardLayout === 'maison')    return <MaisonRow {...props} />
  if (T.cardLayout === 'pop')       return <PopCard {...props} />
  if (T.cardLayout === 'retro')     return <RetroRow {...props} />
  if (T.cardLayout === 'neon')      return <NeonCard {...props} />
  if (T.cardLayout === 'executive') return <ExecutiveRow {...props} />
  if (T.cardLayout === 'scandi')    return <ScandiRow {...props} />
  if (T.cardLayout === 'architectural') return <ArchitecturalRow {...props} />
  return <VitrinCard {...props} />
}

/* ══════════ AURORA — cam kartlar, ışıltı ══════════ */
function AuroraCard({ p, idx, T, accent, rgb, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*40,240)}ms`,
      display:'flex', alignItems:'center', gap:13, width:'100%', textAlign:'left',
      background:T.surface, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
      border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius, padding:11,
      cursor: out?'not-allowed':'pointer', opacity: out?.5:1, boxShadow:T.cardShadow }}>
      {p.image && (
        <div style={{ width:72, height:72, borderRadius:16, overflow:'hidden', flexShrink:0, position:'relative' }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ marginBottom:4 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
        <p style={{ color:T.text, fontFamily:T.fontDisplay, fontWeight:600, fontSize:15.5, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trName(p)}</p>
        {trDesc(p) && <p style={{ color:T.textFaint, fontSize:12, margin:'3px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trDesc(p)}</p>}
        <MiniTags p={p} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:7, flexShrink:0 }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:14, background:`linear-gradient(135deg,${accent},rgba(${rgb},.6))`, padding:'4px 11px', borderRadius:999, boxShadow:`0 4px 14px rgba(${rgb},.4)` }}>{out ? t('soldout') : money(p.price)}</span>
        {!out && <span style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,.12)', border:`1px solid ${T.surfaceBorder}`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><Plus size={15}/></span>}
      </div>
    </button>
  )
}

/* ══════════ BENTO — değişken boyutlu ızgara kutu ══════════ */
function BentoCard({ p, idx, T, accent, rgb, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  const hasImg = !!p.image
  const big = idx % 5 === 0 && hasImg  // fotoğrafsızsa büyük satır düzeni gerekmez
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*40,240)}ms`, gridColumn: big ? '1 / -1' : 'auto',
      background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius, overflow:'hidden',
      textAlign:'left', padding:0, cursor: out?'not-allowed':'pointer', opacity: out?.55:1, boxShadow:T.cardShadow,
      display:'flex', flexDirection: big ? 'row' : 'column' }}>
      {hasImg && (
        <div style={{ position:'relative', background:T.inputBg,
          width: big ? '46%' : '100%', aspectRatio: big ? 'auto' : '1/0.78', minHeight: big ? 128 : 'auto', flexShrink:0 }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
          <div style={{ position:'absolute', top:8, left:8 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
        </div>
      )}
      <div style={{ padding: big ? '16px 16px' : (hasImg ? '11px 12px 12px' : '14px 13px 13px'), flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
        {!hasImg && <div style={{ marginBottom:6 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>}
        <p style={{ color:T.text, fontWeight:700, fontSize: big?17:13.5, margin:0, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trName(p)}</p>
        {(big || !hasImg) && trDesc(p) && <p style={{ color:T.textFaint, fontSize:13, margin:'6px 0 0', lineHeight:1.4 }}>{trDesc(p)}</p>}
        <div style={{ marginTop: big?12:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:accent, fontWeight:800, fontSize: big?17:14 }}>{out ? t('soldout') : money(p.price)}</span>
          {!out && <span style={{ width:30, height:30, borderRadius:10, background:accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 4px 12px rgba(${rgb},.35)` }}><Plus size={15}/></span>}
        </div>
      </div>
    </button>
  )
}

/* ══════════ BRÜTAL — kalın çerçeve, sert gölge ══════════ */
function BrutCard({ p, idx, T, accent, rgb, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card brut-card" style={{
      animationDelay:`${Math.min(idx*35,210)}ms`,
      display:'flex', alignItems:'stretch', gap:0, width:'100%', textAlign:'left',
      background:T.surface, border:'2.5px solid #111111', borderRadius:T.radius, overflow:'hidden',
      boxShadow: out ? 'none' : T.cardShadow, cursor: out?'not-allowed':'pointer', opacity: out?.6:1, padding:0 }}>
      {p.image && (
        <div style={{ width:82, flexShrink:0, borderRight:'2.5px solid #111', background:T.inputBg }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div style={{ flex:1, minWidth:0, padding:'11px 13px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ marginBottom:5 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
        <p style={{ color:T.text, fontFamily:T.fontDisplay, fontSize:14, margin:0, lineHeight:1.15, textTransform:'uppercase', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trName(p)}</p>
        {trDesc(p) && <p style={{ color:T.textMuted, fontSize:11.5, margin:'4px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trDesc(p)}</p>}
      </div>
      <div style={{ flexShrink:0, borderLeft:'2.5px solid #111', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'0 12px', flex:1, display:'flex', alignItems:'center', justifyContent:'center', background: out ? '#f3f3f3' : accent }}>
          <span style={{ color: out ? '#999' : '#fff', fontFamily:T.fontDisplay, fontSize: out?10:14, whiteSpace:'nowrap' }}>{out ? t('soldout') : money(p.price)}</span>
        </div>
        {!out && <div style={{ padding:'8px 12px', borderTop:'2.5px solid #111', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff' }}><Plus size={16} strokeWidth={3} color="#111"/></div>}
      </div>
    </button>
  )
}

/* ══════════ NOIR — dergi editoryal, büyük foto + ince serif ══════════ */
function NoirCard({ p, idx, T, accent, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*45,270)}ms`,
      display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none',
      padding:0, cursor: out?'not-allowed':'pointer', opacity: out?.5:1 }}>
      {p.image && (
        <div style={{ position:'relative', width:'100%', aspectRatio:'16/10', overflow:'hidden', marginBottom:12, border:`1px solid ${T.surfaceBorder}` }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" style={{ filter:'brightness(.92) saturate(.95)' }} />
          <div style={{ position:'absolute', top:10, left:10 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
        <p style={{ color:T.text, fontFamily:T.fontDisplay, fontWeight:500, fontSize:19, margin:0, letterSpacing:.2, flexShrink:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trName(p)}</p>
        <span style={{ flex:1, borderBottom:`1px solid ${T.divider}`, transform:'translateY(-5px)', minWidth:16 }} />
        <span style={{ color:accent, fontFamily:T.fontDisplay, fontSize:17, fontWeight:500, whiteSpace:'nowrap', letterSpacing:1 }}>{out ? t('soldout') : money(p.price)}</span>
      </div>
      {trDesc(p) && <p style={{ color:T.textMuted, fontSize:12.5, margin:'6px 0 0', lineHeight:1.6, letterSpacing:.2 }}>{trDesc(p)}</p>}
      <MiniTags p={p} />
    </button>
  )
}

/* ══════════ TERRA — organik yatay kart, toprak şeridi ══════════ */
function TerraCard({ p, idx, T, accent, rgb, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  const olive = T.accent2 || accent
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*40,240)}ms`,
      display:'flex', alignItems:'stretch', gap:0, width:'100%', textAlign:'left',
      background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius, overflow:'hidden',
      cursor: out?'not-allowed':'pointer', opacity: out?.55:1, boxShadow:T.cardShadow, padding:0 }}>
      <span style={{ width:5, flexShrink:0, background:`linear-gradient(to bottom, ${accent}, ${olive})` }} />
      {p.image && (
        <div style={{ width:88, flexShrink:0, margin:9, borderRadius:14, overflow:'hidden', background:T.inputBg }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" style={{ minHeight:88 }} />
        </div>
      )}
      <div style={{ flex:1, minWidth:0, padding: p.image ? '11px 13px 11px 4px' : '13px 15px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ marginBottom:4 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
        <p style={{ color:T.text, fontFamily:T.fontDisplay, fontWeight:600, fontSize:20, margin:0, lineHeight:1.12, letterSpacing:.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trName(p)}</p>
        {trDesc(p) && <p style={{ color:T.textMuted, fontSize:12, margin:'3px 0 0', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trDesc(p)}</p>}
        <MiniTags p={p} />
        <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:accent, fontFamily:T.fontDisplay, fontWeight:700, fontSize:19 }}>{out ? t('soldout') : money(p.price)}</span>
          {!out && <span style={{ width:30, height:30, borderRadius:'50%', background:`rgba(${rgb},.12)`, display:'flex', alignItems:'center', justifyContent:'center', color:accent }}><Plus size={15}/></span>}
        </div>
      </div>
    </button>
  )
}

/* ══════════ MONO — numaralı satır, monospace fiyat ══════════ */
function MonoRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  const b = badge(p)
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*30,180)}ms`,
      display:'flex', alignItems:'flex-start', gap:14, width:'100%', textAlign:'left',
      background:'transparent', border:'none', borderBottom:`1px solid ${T.divider}`,
      padding:'16px 2px', cursor: out?'not-allowed':'pointer', opacity: out?.45:1 }}>
      <span style={{ fontFamily:T.fontAccent, fontSize:12, color:accent, fontWeight:700, marginTop:3, minWidth:22 }}>{String(idx+1).padStart(2,'0')}</span>
      {p.image && (
        <div style={{ width:52, height:52, flexShrink:0, overflow:'hidden', background:T.inputBg }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" style={{ filter:'grayscale(.15)' }} />
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
          <span style={{ fontFamily:T.fontDisplay, fontSize:16, fontWeight:700, color:T.text, letterSpacing:'-.2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {trName(p)}
            {b.chef && <ChefHat size={12} style={{ color:accent, marginLeft:6, verticalAlign:'-1px' }} />}
            {b.best && <Flame size={12} style={{ color:accent, marginLeft:4, verticalAlign:'-1px' }} />}
          </span>
          <span style={{ flex:1 }} />
          <span style={{ fontFamily:T.fontAccent, fontSize:14, fontWeight:700, color:T.text, whiteSpace:'nowrap' }}>{out ? '—' : money(p.price)}</span>
        </div>
        {trDesc(p) && <p style={{ color:T.textMuted, fontSize:12.5, margin:'4px 0 0', lineHeight:1.45, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trDesc(p)}</p>}
        <MiniTags p={p} />
      </div>
    </button>
  )
}

/* ══════════ MAISON — ortalı zarif satır, altın çerçeve ══════════ */
function MaisonRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*40,240)}ms`,
      display:'block', width:'100%', textAlign:'center', background:T.surface,
      border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius,
      padding:'16px 16px', margin:'6px 0', cursor: out?'not-allowed':'pointer', opacity: out?.5:1 }}>
      <div style={{ marginBottom:6, display:'flex', justifyContent:'center' }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
        {p.image && (
          <div style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:`1px solid ${T.surfaceBorder}` }}>
            <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
          </div>
        )}
        <p style={{ color:T.text, fontFamily:T.fontDisplay, fontWeight:500, fontStyle:'italic', fontSize:21, margin:0, letterSpacing:.3, lineHeight:1.15 }}>{trName(p)}</p>
      </div>
      {trDesc(p) && <p style={{ color:T.textMuted, fontSize:12.5, margin:'7px auto 0', lineHeight:1.55, maxWidth:300 }}>{trDesc(p)}</p>}
      <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center', margin:'10px auto 0', maxWidth:180 }}>
        <span style={{ flex:1, height:1, background:T.divider }} />
        <span style={{ color:accent, fontFamily:T.fontDisplay, fontSize:18, fontWeight:600, whiteSpace:'nowrap', letterSpacing:1 }}>{out ? t('soldout') : money(p.price)}</span>
        <span style={{ flex:1, height:1, background:T.divider }} />
      </div>
    </button>
  )
}

/* ══════════ POP — cesur 2 sütun kart, dönük fiyat etiketi ══════════ */
function PopCard({ p, idx, T, accent, rgb, t, trName, badge, onOpen }) {
  const out = !p.available
  const yellow = T.accent2 || accent
  const hasImg = !!p.image
  const priceSticker = (small) => (
    <span style={{ background: out ? '#c9c4d0' : yellow, color: out ? '#fff' : '#231133',
      fontFamily:T.fontDisplay, fontWeight:800, fontSize: small?13:14, padding: small?'5px 11px':'6px 12px', borderRadius:999,
      transform:`rotate(${small?-4:-6}deg)`, boxShadow: small?'none':'0 4px 12px rgba(0,0,0,.18)', whiteSpace:'nowrap', flexShrink:0 }}>
      {out ? t('soldout') : money(p.price)}
    </span>
  )
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*45,270)}ms`,
      background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius, overflow:'hidden',
      textAlign:'left', padding:0, cursor: out?'not-allowed':'pointer', opacity: out?.55:1, boxShadow:T.cardShadow,
      position:'relative', display:'flex', flexDirection:'column' }}>
      {hasImg && (
        <div style={{ position:'relative', width:'100%', aspectRatio:'1/0.9', background:`linear-gradient(135deg, rgba(${rgb},.14), rgba(${rgb},.04))` }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
          <div style={{ position:'absolute', top:8, left:8 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
          <div style={{ position:'absolute', bottom:-12, right:10 }}>{priceSticker(false)}</div>
        </div>
      )}
      <div style={{ padding: hasImg ? '16px 13px 13px' : '14px 13px 13px', display:'flex', flexDirection:'column', gap:8 }}>
        {!hasImg && (
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
            <div><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
            {priceSticker(true)}
          </div>
        )}
        <p style={{ color:T.text, fontFamily:T.fontDisplay, fontWeight:700, fontSize:15, margin:0, lineHeight:1.2, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trName(p)}</p>
        {!out && (
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 4px 12px rgba(${rgb},.4)` }}><Plus size={16} strokeWidth={2.5}/></span>
          </div>
        )}
      </div>
    </button>
  )
}

/* ══════════ RETRO — kesik çizgili satır, yuvarlak foto ══════════ */
function RetroRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*35,210)}ms`,
      display:'flex', alignItems:'center', gap:14, width:'100%', textAlign:'left',
      background:'transparent', border:'none', borderBottom:`1.5px dashed ${T.divider}`,
      padding:'14px 2px', cursor: out?'not-allowed':'pointer', opacity: out?.5:1 }}>
      {p.image && (
        <div style={{ width:64, height:64, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:`2px solid ${T.surfaceBorder}` }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ marginBottom:4 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
        <p style={{ fontFamily:T.fontDisplay, fontSize:16, color:T.text, margin:0, lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trName(p)}</p>
        {trDesc(p) && <p style={{ fontSize:12.5, color:T.textMuted, margin:'3px 0 0', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trDesc(p)}</p>}
        <MiniTags p={p} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
        <span style={{ fontFamily:T.fontDisplay, fontSize:16, color:accent }}>{out ? t('soldout') : money(p.price)}</span>
        {!out && (
          <span style={{ width:40, height:40, borderRadius:'50%', border:`2px solid ${T.text}`, background:accent, color:'#FFF6E3', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 3px 0 ${T.text}` }}>
            <Plus size={17} />
          </span>
        )}
      </div>
    </button>
  )
}

/* ══════════ NEON — 2 sütun ızgara, camgöbeği fiyat, pembe buton ══════════ */
function NeonCard({ p, idx, T, accent, rgb, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  const cyan = T.accent2 || accent
  const hasImg = !!p.image
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*45,270)}ms`,
      background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius, overflow:'hidden',
      textAlign:'left', padding:0, cursor: out?'not-allowed':'pointer', opacity: out?.55:1,
      display:'flex', flexDirection:'column' }}>
      {hasImg && (
        <div style={{ position:'relative', width:'100%', aspectRatio:'1/0.85', background:T.inputBg }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
          <div style={{ position:'absolute', top:8, left:8 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
        </div>
      )}
      <div style={{ padding: hasImg ? '10px 12px 12px' : '14px 13px 13px', display:'flex', flexDirection:'column', gap:5, flex:1 }}>
        {!hasImg && <div><Badges p={p} badge={badge} accent={accent} t={t} small /></div>}
        <p style={{ fontFamily:T.fontDisplay, fontWeight:500, fontSize:12, color:T.text, margin:0, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trName(p)}</p>
        {trDesc(p) && <p style={{ fontSize:11, color:T.textMuted, margin:0, lineHeight:1.45, flex:1, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:hasImg?2:3, WebkitBoxOrient:'vertical' }}>{trDesc(p)}</p>}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
          <span style={{ fontWeight:700, fontSize:15, color:cyan, textShadow:`0 0 12px rgba(34,228,255,.4)` }}>{out ? t('soldout') : money(p.price)}</span>
          {!out && (
            <span style={{ width:32, height:32, borderRadius:10, background:accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px rgba(255,61,138,.45)' }}>
              <Plus size={15} />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ══════════ EXECUTIVE — antrasit satır, bakır kare foto/rozet ══════════ */
function ExecutiveRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen, onQuickAdd }) {
  const out = !p.available
  const hasImg = !!p.image
  const b = badge(p)
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*35,210)}ms`,
      display:'flex', gap:16, alignItems:'center', width:'100%', textAlign:'left',
      background:'transparent', border:'none', borderBottom:`1px solid ${T.divider}`,
      padding:'18px 0', cursor: out?'not-allowed':'pointer', opacity: out?.5:1 }}>
      {hasImg && (
        <div style={{ width:66, height:66, flexShrink:0, border:'1px solid rgba(201,154,95,.35)', background:'linear-gradient(150deg,#191b1f,#0f1012)', overflow:'hidden' }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap' }}>
          <span style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:600, color:T.text }}>{trName(p)}</span>
          {b.combo && <span style={{ fontSize:9, letterSpacing:1, fontWeight:700, color:'#fff', background:'#d97706', padding:'2px 6px' }}>{t('combo').toUpperCase()}</span>}
          {b.chef && <span style={{ fontSize:9, letterSpacing:1, fontWeight:700, color:accent, border:`1px solid rgba(201,154,95,.6)`, padding:'2px 6px' }}>{t('chef').toUpperCase()}</span>}
          {b.best && <span style={{ fontSize:9, letterSpacing:1, fontWeight:700, color:'#0d0e10', background:accent, padding:'2px 6px' }}>{t('bestseller').toUpperCase()}</span>}
        </div>
        {trDesc(p) && <p style={{ margin:'5px 0 0', fontSize:13, lineHeight:1.4, color:T.textMuted, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trDesc(p)}</p>}
        <div style={{ marginTop:9, fontFamily:T.fontDisplay, fontSize:15, fontWeight:600, color:T.text }}>{out ? t('soldout') : money(p.price)}</div>
      </div>
      {!out && (
        <span onClick={(e) => { e.stopPropagation(); runWaiterToCart(e, accent, () => onQuickAdd(p)) }}
          style={{ flexShrink:0, width:40, height:40, border:'1px solid rgba(201,154,95,.5)', color:accent, fontSize:22, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <Plus size={18} />
        </span>
      )}
    </button>
  )
}

/* ══════════ SCANDI — tipografi öne çıkan sakin liste, foto yok ══════════ */
function ScandiRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen, onQuickAdd }) {
  const out = !p.available
  const b = badge(p)
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*35,210)}ms`,
      display:'flex', gap:16, alignItems:'flex-start', width:'100%', textAlign:'left',
      background:'transparent', border:'none', borderTop:`1px solid ${T.divider}`,
      padding:'20px 0', cursor: out?'not-allowed':'pointer', opacity: out?.5:1 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontFamily:T.fontDisplay, fontSize:19, fontWeight:600, color:T.text, letterSpacing:'-.01em' }}>{trName(p)}</span>
          {b.combo && <span style={{ fontFamily:T.fontAccent, fontStyle:'italic', fontSize:14, color:'#b45309' }}>{t('combo')}</span>}
          {b.chef && <span style={{ fontFamily:T.fontAccent, fontStyle:'italic', fontSize:14, color:'#a2825a' }}>{t('chef')}</span>}
          {b.best && <span style={{ fontFamily:T.fontAccent, fontStyle:'italic', fontSize:14, color:accent }}>{t('bestseller')}</span>}
        </div>
        {trDesc(p) && <p style={{ fontFamily:T.fontAccent, fontSize:15, lineHeight:1.45, color:T.textMuted, margin:'6px 0 0' }}>{trDesc(p)}</p>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:12, flexShrink:0 }}>
        <span style={{ fontFamily:T.fontAccent, fontSize:18, color:T.text }}>{out ? t('soldout') : money(p.price)}</span>
        {!out && (
          <span onClick={(e) => { e.stopPropagation(); runWaiterToCart(e, accent, () => onQuickAdd(p)) }}
            style={{ width:34, height:34, borderRadius:'50%', border:`1px solid ${T.surfaceBorder}`, color:accent, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <Plus size={17} />
          </span>
        )}
      </div>
    </button>
  )
}

/* ══════════ ARCHITECTURAL — numaralı satır, kılcal ızgara, monospace fiyat ══════════ */
function ArchitecturalRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen, onQuickAdd }) {
  const out = !p.available
  const hasImg = !!p.image
  const b = badge(p)
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*30,180)}ms`,
      display:'flex', alignItems:'stretch', width:'100%', textAlign:'left',
      background:'transparent', border:'none', borderBottom:`1px solid ${T.divider}`,
      cursor: out?'not-allowed':'pointer', opacity: out?.5:1, padding:0 }}>
      <div style={{ width:30, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', borderRight:`1px solid ${T.divider}`, fontFamily:T.fontAccent, fontSize:11, color:'#b4b4b4' }}>
        {String(idx+1).padStart(2,'0')}
      </div>
      {hasImg && (
        <div style={{ width:58, flexShrink:0, borderRight:`1px solid ${T.divider}`, background:'#f6f6f4', overflow:'hidden' }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div style={{ flex:1, minWidth:0, padding:'14px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontFamily:T.fontDisplay, fontSize:16, fontWeight:600, color:T.text }}>{trName(p)}</span>
          {b.combo && <span style={{ fontFamily:T.fontAccent, fontSize:8.5, letterSpacing:.5, fontWeight:700, color:'#fff', background:'#d97706', padding:'2px 5px' }}>{t('combo').toUpperCase()}</span>}
          {b.chef && <span style={{ fontFamily:T.fontAccent, fontSize:8.5, letterSpacing:.5, fontWeight:700, color:accent, border:`1px solid ${accent}`, padding:'1px 5px' }}>{t('chef').toUpperCase()}</span>}
          {b.best && <span style={{ fontFamily:T.fontAccent, fontSize:8.5, letterSpacing:.5, fontWeight:700, color:'#fff', background:T.text, padding:'2px 5px' }}>{t('bestseller').toUpperCase()}</span>}
        </div>
        {trDesc(p) && <p style={{ margin:'5px 0 0', fontSize:12.5, lineHeight:1.4, color:T.textMuted, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trDesc(p)}</p>}
      </div>
      <div style={{ width:88, flexShrink:0, borderLeft:`1px solid ${T.divider}`, display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 12px', fontFamily:T.fontAccent, fontSize:15, fontWeight:700, color:T.text }}>
          {out ? t('soldout') : money(p.price)}
        </div>
        {!out && (
          <div onClick={(e) => { e.stopPropagation(); runWaiterToCart(e, accent, () => onQuickAdd(p)) }}
            style={{ borderTop:`1px solid ${T.divider}`, background:accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', height:34, cursor:'pointer' }}>
            <Plus size={17} />
          </div>
        )}
      </div>
    </button>
  )
}

function VitrinCard({ p, idx, T, accent, rgb, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*40,240)}ms`,
      background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius, overflow:'hidden',
      textAlign:'left', width:'100%', padding:0, cursor: out?'not-allowed':'pointer', opacity: out?.55:1, boxShadow:T.cardShadow }}>
      {p.image && (
        <div style={{ position:'relative', width:'100%', aspectRatio:'16/9', background:T.inputBg }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
          <div style={{ position:'absolute', top:10, left:10 }}><Badges p={p} badge={badge} accent={accent} t={t} /></div>
          {out && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#fff', fontSize:11, fontWeight:900, letterSpacing:.5, background:'rgba(0,0,0,.5)', padding:'4px 12px', borderRadius:999 }}>{t('soldout')}</span></div>}
          {!out && (
            <div style={{ position:'absolute', bottom:10, right:10, width:38, height:38, borderRadius:'50%', background:accent, boxShadow:`0 4px 16px rgba(${rgb},.55)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
              <Plus size={18} strokeWidth={2.5}/>
            </div>
          )}
        </div>
      )}
      <div style={{ padding:'12px 14px 14px' }}>
        {!p.image && <div style={{ marginBottom:6 }}><Badges p={p} badge={badge} accent={accent} t={t} /></div>}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
          <p style={{ color:T.text, fontWeight:800, fontSize:15.5, margin:0, lineHeight:1.3, fontFamily:T.fontDisplay }}>{trName(p)}</p>
          <span style={{ color:accent, fontWeight:900, fontSize:16, whiteSpace:'nowrap' }}>{money(p.price)}</span>
        </div>
        {trDesc(p) && <p style={{ color:T.textFaint, fontSize:12.5, margin:'4px 0 0', lineHeight:1.4 }}>{trDesc(p)}</p>}
        <MiniTags p={p} />
        {!p.image && !out && (
          <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><Plus size={15}/></span>
          </div>
        )}
      </div>
    </button>
  )
}

function EditorialRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  const b = badge(p)
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*35,210)}ms`,
      background:'transparent', border:'none', borderBottom:`1px solid ${T.divider}`,
      width:'100%', textAlign:'left', padding:'14px 4px', cursor: out?'not-allowed':'pointer', opacity: out?.5:1 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
        <span style={{ fontFamily:T.fontDisplay, fontSize:16.5, fontWeight:600, color:T.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {trName(p)}
          {b.chef && <ChefHat size={12} style={{ color:'#7c3aed', marginLeft:6, verticalAlign:'-1px' }} />}
          {b.best && <Flame size={12} style={{ color:'#dc2626', marginLeft:4, verticalAlign:'-1px' }} />}
        </span>
        <span style={{ flex:1, borderBottom:`1.5px dotted ${T.divider}`, transform:'translateY(-4px)', minWidth:20 }} />
        <span style={{ fontFamily:T.fontDisplay, fontSize:16, fontWeight:600, color:accent, whiteSpace:'nowrap' }}>{out ? t('soldout') : money(p.price)}</span>
      </div>
      {trDesc(p) && <p style={{ color:T.textMuted, fontSize:12.5, fontStyle:'italic', margin:'4px 0 0', lineHeight:1.5 }}>{trDesc(p)}</p>}
      <MiniTags p={p} />
    </button>
  )
}

function ZarifCard({ p, idx, T, accent, rgb, t, trName, badge, onOpen }) {
  const out = !p.available
  const hasImg = !!p.image
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*40,240)}ms`,
      background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius, overflow:'hidden',
      textAlign:'left', padding:0, cursor: out?'not-allowed':'pointer', opacity: out?.55:1, boxShadow:T.cardShadow }}>
      {hasImg && (
        <div style={{ position:'relative', width:'100%', aspectRatio:'1/0.82', background:T.inputBg }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
          <div style={{ position:'absolute', top:8, left:8 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
          {out && <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,.65)', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:10, fontWeight:900, color:'#78716c' }}>{t('soldout')}</span></div>}
        </div>
      )}
      <div style={{ padding: hasImg ? '10px 12px 12px' : '14px 13px 13px' }}>
        {!hasImg && <div style={{ marginBottom:6 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>}
        <p style={{ color:T.text, fontWeight:800, fontSize:13.5, margin:0, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{trName(p)}</p>
        <div style={{ marginTop:7, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ background:`rgba(${rgb},.12)`, color:accent, fontWeight:900, fontSize:13, padding:'4px 11px', borderRadius:999 }}>{out ? t('soldout') : money(p.price)}</span>
          {!out && <span style={{ width:28, height:28, borderRadius:'50%', background:accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 3px 10px rgba(${rgb},.4)` }}><Plus size={14}/></span>}
        </div>
      </div>
    </button>
  )
}

function GeceRow({ p, idx, T, accent, t, trName, trDesc, badge, onOpen }) {
  const out = !p.available
  return (
    <button onClick={() => onOpen(p)} disabled={out} className="anim-card" style={{
      animationDelay:`${Math.min(idx*35,210)}ms`,
      display:'flex', alignItems:'center', gap:13, width:'100%', textAlign:'left',
      background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:T.radius,
      padding:12, cursor: out?'not-allowed':'pointer', opacity: out?.5:1 }}>
      {p.image && (
        <div style={{ width:62, height:62, borderRadius:T.radius-2, overflow:'hidden', flexShrink:0, border:`1px solid ${T.surfaceBorder}` }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <p style={{ color:T.text, fontFamily:T.fontDisplay, fontSize:15.5, fontWeight:400, margin:0, letterSpacing:.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trName(p)}</p>
        </div>
        {trDesc(p) && <p style={{ color:T.textFaint, fontSize:12, margin:'3px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trDesc(p)}</p>}
        <div style={{ marginTop:4 }}><Badges p={p} badge={badge} accent={accent} t={t} small /></div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
        <span style={{ color:accent, fontFamily:T.fontDisplay, fontWeight:400, fontSize:16 }}>{out ? '' : money(p.price)}</span>
        {out
          ? <span style={{ color:T.textFaint, fontSize:9, fontWeight:800 }}>{t('soldout')}</span>
          : <span style={{ width:28, height:28, borderRadius:'50%', border:`1px solid ${accent}`, display:'flex', alignItems:'center', justifyContent:'center', color:accent }}><Plus size={14}/></span>}
      </div>
    </button>
  )
}

function MiniTags({ p }) {
  if (!p.tags?.length) return null
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
      {p.tags.map(k => {
        const tag = TAG_MAP[k]; if (!tag) return null
        return <span key={k} style={{ fontSize:9, fontWeight:800, letterSpacing:.2, padding:'2px 7px', borderRadius:999, background:`${tag.color}20`, color:tag.color, border:`1px solid ${tag.color}40` }}>{tag.label.toUpperCase()}</span>
      })}
    </div>
  )
}

/* ══════════ Öne çıkan kartı ══════════ */
function FeaturedCard({ p, T, accent, rgb, t, trName, onOpen }) {
  const hasImg = !!p.image
  const StarBadge = (
    <div style={{ background:accent, borderRadius:8, padding:'2px 7px', display:'inline-flex', alignItems:'center', gap:3 }}>
      <Star size={9} fill="#fff" color="#fff" /><span style={{ color:'#fff', fontSize:9, fontWeight:800 }}>{t('featured').toUpperCase()}</span>
    </div>
  )
  return (
    <button onClick={() => onOpen(p)} style={{
      flexShrink:0, width:150, background:T.surface, border:`1px solid ${T.surfaceBorder}`,
      borderRadius: Math.min(T.radius, 18), overflow:'hidden', textAlign:'left', cursor:'pointer', padding:0, boxShadow:T.cardShadow }}>
      {hasImg && (
        <div style={{ position:'relative', height:100, background:T.inputBg }}>
          <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
          <div style={{ position:'absolute', top:8, left:8 }}>{StarBadge}</div>
        </div>
      )}
      <div style={{ padding: hasImg ? '9px 11px 11px' : '11px 11px' }}>
        {!hasImg && <div style={{ marginBottom:7 }}>{StarBadge}</div>}
        <p style={{ color:T.text, fontWeight:800, fontSize:13, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trName(p)}</p>
        <p style={{ color:accent, fontWeight:900, fontSize:14, margin:'4px 0 0' }}>{money(p.price)}</p>
      </div>
    </button>
  )
}

/* ══════════ Skeleton ══════════ */
function SkeletonList({ T }) {
  const sk = { background: T.dark
    ? 'linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.1) 37%, rgba(255,255,255,.05) 63%)'
    : 'linear-gradient(90deg, rgba(0,0,0,.05) 25%, rgba(0,0,0,.1) 37%, rgba(0,0,0,.05) 63%)',
    backgroundSize:'800px 100%', animation:'shimmer 1.4s infinite linear' }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ ...sk, height:20, width:'40%', borderRadius:8 }} />
      {[0,1,2,3].map(i => <div key={i} style={{ ...sk, height:110, borderRadius:18 }} />)}
    </div>
  )
}

/* ══════════ Dil değiştirici ══════════ */
function LangSwitch({ lang, setLang, T, accent, busy }) {
  const [openL, setOpenL] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpenL(o => !o)} style={{
        display:'flex', alignItems:'center', gap:5, background:T.inputBg, border:`1px solid ${T.inputBorder}`,
        borderRadius:12, padding:'9px 11px', color:T.text, fontSize:12, fontWeight:800, cursor:'pointer' }}>
        <Globe size={13} style={{ color: busy ? accent : T.textMuted }} className={busy ? 'animate-spin' : ''} />
        {lang.toUpperCase()}
      </button>
      {openL && (
        <div style={{ position:'absolute', top:'110%', right:0, zIndex:40, background:T.sheet, border:`1px solid ${T.surfaceBorder}`, borderRadius:14, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.25)', minWidth:130 }}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); setOpenL(false) }} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%',
              padding:'10px 14px', background: lang===l.code ? `${accent}18` : 'transparent',
              border:'none', color:T.text, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {l.name} {lang===l.code && <Check size={13} style={{ color:accent }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════ Bottom sheet ══════════ */
function Sheet({ children, onClose, title, T, D }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)' }} onClick={onClose}/>
      <div style={{ position:'relative', width:'100%', maxWidth:560, background:T.sheet, borderRadius:'24px 24px 0 0', maxHeight:'92vh', display:'flex', flexDirection:'column', border:`1px solid ${T.surfaceBorder}`, boxShadow:'0 -20px 60px rgba(0,0,0,.3)', animation:'slideU .28s cubic-bezier(.33,1,.68,1)' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:99, background:T.divider }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
          <h3 style={{ color:T.text, fontWeight:800, fontSize:17, margin:0, fontFamily:D }}>{title}</h3>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:T.inputBg, border:'none', color:T.textMuted, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><X size={15}/></button>
        </div>
        <div style={{ overflowY:'auto', padding:'0 20px 32px', flex:1 }}>{children}</div>
      </div>
    </div>
  )
}

/* ══════════ Ürün detayı — varyant + ekstra + not ══════════ */
function DetailContent({ product, accent, rgb, T, t, trDesc, quickNotes, onAdd, disabled }) {
  const [qty, setQty]         = useState(1)
  const [note, setNote]       = useState('')
  const [variant, setVariant] = useState(null)
  const [extras, setExtras]   = useState([])

  useEffect(() => {
    setQty(1); setNote(''); setExtras([])
    setVariant(product?.variants?.length ? product.variants[0] : null)
  }, [product?.id])

  const activeNotes = note ? note.split(', ').map(s=>s.trim()).filter(Boolean) : []
  const toggleNote = (n2) => setNote(prev => {
    const parts = prev ? prev.split(', ').map(s=>s.trim()) : []
    return parts.includes(n2) ? parts.filter(x=>x!==n2).join(', ') : [...parts,n2].join(', ')
  })
  const toggleExtra = (ex) => setExtras(prev =>
    prev.find(e => e.name === ex.name) ? prev.filter(e => e.name !== ex.name) : [...prev, ex])

  const base  = variant ? Number(variant.price) : Number(product.price)
  const extra = extras.reduce((s, e) => s + Number(e.price || 0), 0)
  const unit  = base + extra

  function add(e) {
    const label = `${product.name}${variant ? ` (${variant.name})` : ''}${extras.length ? ' + ' + extras.map(e=>e.name).join(', ') : ''}`
    const commit = () => onAdd(product, qty, note.trim(), unit, label)
    if (T.waiterAnim && e?.currentTarget) runWaiterToCart(e, accent, commit)
    else commit()
  }

  const pill = (on) => ({
    fontSize:12, fontWeight:700, padding:'7px 14px', borderRadius:999, cursor:'pointer', transition:'all .15s',
    background: on ? `rgba(${rgb},.16)` : T.inputBg,
    border: on ? `1.5px solid ${accent}` : `1px solid ${T.inputBorder}`,
    color: on ? accent : T.textMuted,
  })

  return (
    <>
      {product.image && (
        <div style={{ height:200, width:'100%', borderRadius:18, overflow:'hidden', marginBottom:16, background:T.inputBg }}>
          <ProductImage src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>
      )}
      {product.tags?.length > 0 && <div style={{ marginBottom:12 }}><MiniTags p={product} /></div>}
      {trDesc(product) && <p style={{ color:T.textMuted, fontSize:13, lineHeight:1.6, marginBottom:14 }}>{trDesc(product)}</p>}

      <NutritionInfo product={product} T={T} t={t} />

      {/* Varyantlar */}
      {product.variants?.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <p style={{ color:T.textMuted, fontWeight:800, fontSize:12, textTransform:'uppercase', letterSpacing:.8, marginBottom:9 }}>{t('variant')}</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {product.variants.map(v => (
              <button key={v.name} onClick={() => setVariant(v)} style={pill(variant?.name === v.name)}>
                {v.name} · {money(v.price)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ekstralar */}
      {product.extras?.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <p style={{ color:T.textMuted, fontWeight:800, fontSize:12, textTransform:'uppercase', letterSpacing:.8, marginBottom:9 }}>{t('extras')}</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {product.extras.map(ex => {
              const on = !!extras.find(e => e.name === ex.name)
              return <button key={ex.name} onClick={() => toggleExtra(ex)} style={pill(on)}>{on?'✓ ':''}{ex.name} +{money(ex.price)}</button>
            })}
          </div>
        </div>
      )}

      {/* Adet */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <span style={{ color:T.textMuted, fontWeight:700, fontSize:13 }}>{t('qty')}</span>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width:38, height:38, borderRadius:'50%', background:T.inputBg, border:`1px solid ${T.inputBorder}`, color:T.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Minus size={15}/></button>
          <span style={{ color:T.text, fontWeight:900, fontSize:22, minWidth:24, textAlign:'center' }}>{qty}</span>
          <button onClick={() => setQty(q => q+1)} style={{ width:38, height:38, borderRadius:'50%', background:accent, border:'none', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Plus size={15}/></button>
        </div>
      </div>

      {/* Hızlı notlar */}
      {quickNotes.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <p style={{ color:T.textMuted, fontWeight:800, fontSize:12, textTransform:'uppercase', letterSpacing:.8, marginBottom:9 }}>{t('note')}</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:10 }}>
            {quickNotes.map(n2 => (
              <button key={n2} onClick={() => toggleNote(n2)} style={pill(activeNotes.includes(n2))}>{n2}</button>
            ))}
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('notePlaceholder')}
            style={{ width:'100%', padding:'12px 14px', borderRadius:12, fontSize:13, background:T.inputBg, border:`1px solid ${T.inputBorder}`, color:T.text, outline:'none' }} />
        </div>
      )}

      <button onClick={add} disabled={disabled} style={{
        width:'100%', padding:'16px', borderRadius:16, border:'none',
        background: disabled ? T.inputBg : `linear-gradient(135deg,${accent},rgba(${rgb},.72))`,
        boxShadow: disabled ? 'none' : `0 8px 24px rgba(${rgb},.4)`,
        color: disabled ? T.textFaint : '#fff', fontWeight:900, fontSize:16,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
        <Plus size={18} strokeWidth={3}/> {disabled ? t('closed') : `${t('add')} · ${money(unit * qty)}`}
      </button>
    </>
  )
}

/* ══════════ Yönetmelik bilgileri ══════════ */
function NutritionInfo({ product, T, t }) {
  const hasAny = product.gram || product.kalori || product.icerik || product.allergens?.length || product.alkol || product.domuz
  if (!hasAny) return null
  return (
    <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:14, background:T.inputBg, border:`1px solid ${T.inputBorder}` }}>
      {(product.gram || product.kalori) && (
        <div style={{ display:'flex', gap:14, marginBottom: product.icerik || product.allergens?.length ? 8 : 0, flexWrap:'wrap' }}>
          {product.gram && <span style={{ color:T.text, fontSize:12.5, fontWeight:700 }}>{product.gram} g</span>}
          {product.kalori && <span style={{ color:T.text, fontSize:12.5, fontWeight:700 }}>{product.kalori} kcal</span>}
        </div>
      )}
      {product.icerik && <p style={{ color:T.textMuted, fontSize:12, lineHeight:1.5, margin: product.allergens?.length ? '0 0 8px' : 0 }}>{t('ingredients')}: {product.icerik}</p>}
      {product.allergens?.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {product.allergens.map(k => {
            const a = ALLERGEN_MAP[k]; if (!a) return null
            return <span key={k} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'rgba(220,38,38,.12)', color:'#dc2626', border:'1px solid rgba(220,38,38,.3)' }}>{a.label}</span>
          })}
        </div>
      )}
      {(product.alkol || product.domuz) && (
        <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
          {product.alkol && <span style={{ fontSize:10, fontWeight:700, color:'#b45309' }}>⚠ {t('alcohol')}</span>}
          {product.domuz && <span style={{ fontSize:10, fontWeight:700, color:'#b45309' }}>⚠ {t('pork')}</span>}
        </div>
      )}
    </div>
  )
}

/* ══════════ Sipariş takibi + değerlendirme ══════════ */
const STATUS_STEPS = ['new', 'kitchen', 'ready', 'served']
function OrderTracker({ orders, T, accent, rgb, t, D, bizId, tableNo, profile }) {
  const stLabel = { new:t('stNew'), kitchen:t('stKitchen'), ready:t('stReady'), served:t('stServed') }
  const [rated, setRated] = useState(() => { try { return JSON.parse(localStorage.getItem(RATED_KEY(bizId)) || '{}') } catch { return {} } })
  const [fbFor, setFbFor] = useState(null) // düşük puan → feedback formu açık order id
  const [fbText, setFbText] = useState('')

  function rate(order, stars) {
    const next = { ...rated, [order.id]: stars }
    setRated(next)
    try { localStorage.setItem(RATED_KEY(bizId), JSON.stringify(next)) } catch {}
    if (stars >= 4 && profile.googleReviewUrl) {
      window.open(profile.googleReviewUrl, '_blank')
    } else if (stars < 4) {
      setFbFor(order.id)
    }
    if (stars >= 4) saveFeedback(bizId, { rating: stars, text: '', tableNo, orderId: order.id })
  }
  function sendFb(order) {
    saveFeedback(bizId, { rating: rated[order.id], text: fbText, tableNo, orderId: order.id })
    setFbFor(null); setFbText('')
  }

  if (!orders.length) return <p style={{ color:T.textFaint, textAlign:'center', padding:'30px 0' }}>—</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {orders.map(o => {
        const stepIdx = Math.max(STATUS_STEPS.indexOf(o.status), o.status==='paid' ? 3 : 0)
        const showRate = (o.status === 'served' || o.status === 'paid')
        return (
          <div key={o.id} style={{ background:T.surface, border:`1px solid ${T.surfaceBorder}`, borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ color:T.textMuted, fontSize:12, fontWeight:700 }}>
                {o.items?.slice(0,2).map(i=>i.name).join(', ')}{o.items?.length>2?` +${o.items.length-2}`:''}
              </span>
              <span style={{ color:T.text, fontWeight:900, fontSize:14 }}>{money(o.total)}</span>
            </div>

            {/* Durum çubuğu */}
            <div style={{ display:'flex', alignItems:'center', gap:0 }}>
              {STATUS_STEPS.map((st, i) => {
                const done = i <= stepIdx
                const current = i === stepIdx && o.status !== 'paid'
                return (
                  <div key={st} style={{ flex: i < STATUS_STEPS.length-1 ? 1 : 0, display:'flex', alignItems:'center' }}>
                    <div style={{
                      width: current ? 26 : 20, height: current ? 26 : 20, borderRadius:'50%', flexShrink:0,
                      background: done ? accent : T.inputBg,
                      border: done ? 'none' : `1px solid ${T.inputBorder}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow: current ? `0 0 0 5px rgba(${rgb},.18)` : 'none', transition:'all .3s' }}>
                      {done && <Check size={current?13:11} strokeWidth={3.5} color="#fff" />}
                    </div>
                    {i < STATUS_STEPS.length-1 && <div style={{ flex:1, height:2.5, background: i < stepIdx ? accent : T.inputBg, transition:'background .3s' }} />}
                  </div>
                )
              })}
            </div>
            <p style={{ color:accent, fontSize:13, fontWeight:800, margin:'10px 0 0' }}>
              {o.status === 'paid' ? t('stServed') : stLabel[o.status] || o.status}
            </p>

            {/* Değerlendirme */}
            {showRate && !rated[o.id] && (
              <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.divider}` }}>
                <p style={{ color:T.textMuted, fontSize:12, fontWeight:700, margin:'0 0 8px' }}>{t('rate')}</p>
                <div style={{ display:'flex', gap:6 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => rate(o, s)} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
                      <Star size={26} style={{ color:'#f59e0b' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showRate && rated[o.id] && fbFor !== o.id && (
              <p style={{ color:T.textMuted, fontSize:12, fontWeight:700, marginTop:12 }}>{t('rateThanks')}</p>
            )}
            {fbFor === o.id && (
              <div style={{ marginTop:12 }}>
                <textarea value={fbText} onChange={e => setFbText(e.target.value)} placeholder={t('rateFeedback')}
                  style={{ width:'100%', minHeight:64, padding:'10px 12px', borderRadius:12, fontSize:13, background:T.inputBg, border:`1px solid ${T.inputBorder}`, color:T.text, outline:'none', resize:'vertical' }} />
                <button onClick={() => sendFb(o)} style={{ marginTop:8, padding:'9px 20px', borderRadius:12, border:'none', background:accent, color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>{t('rateSend')}</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
