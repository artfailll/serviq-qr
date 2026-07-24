import { useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, ImageOff, Upload, Loader2, ScanLine, Check, X, AlertCircle, Sparkles, Tag, Minus } from 'lucide-react'
import { fileToCompressedDataURL, urlToCompressedDataURL } from '../../lib/image'
import {
  useCategories, useProducts,
  addProduct, updateProduct, removeProduct, toggleProduct,
  addCategory, useBusinessId,
} from '../../lib/store'
import { subscribe } from '../../lib/db'
import { money } from '../../lib/format'
import { ProductImage, Modal, Toggle } from '../../components/ui'
import { PRODUCT_TAGS, ALLERGENS } from '../../lib/seed'

const empty = {
  name: '', desc: '', price: '', image: '', categoryId: '', available: true, featured: false, tags: [],
  gram: '', kalori: '', allergens: [], alkol: false, domuz: false, icerik: '',
}

const comboEmpty = { name: '', desc: '', price: '', categoryId: '', items: [] }

export default function MenuManager() {
  const bizId      = useBusinessId()
  const categories = useCategories(bizId)
  const products   = useProducts(bizId)

  const [editing, setEditing]   = useState(null)
  const [open, setOpen]         = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr]         = useState('')
  const [nutriLoading, setNutriLoading] = useState(false)
  const [nutriErr, setNutriErr]         = useState('')
  const fileRef  = useRef(null)

  // Menü tarama state'leri
  const [scanOpen, setScanOpen]       = useState(false)
  const [scanning, setScanning]       = useState(false)
  const [scanResult, setScanResult]   = useState(null) // { categories:[], items:[] }
  const [scanErr, setScanErr]         = useState('')
  const [selected, setSelected]       = useState({})   // { idx: true/false }
  const [importing, setImporting]     = useState(false)
  const [importDone, setImportDone]   = useState(false)
  const scanFileRef = useRef(null)

  // Kampanya/kombo menü state'leri
  const [comboOpen, setComboOpen]         = useState(false)
  const [comboEditing, setComboEditing]   = useState(null)
  const nonComboProducts = useMemo(() => products.filter(p => !p.comboItems?.length), [products])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr('')
    setUploading(true)
    try {
      const dataUrl = await fileToCompressedDataURL(file)
      setEditing((prev) => ({ ...prev, image: dataUrl }))
    } catch (err) {
      setUploadErr(err.message || 'Görsel yüklenemedi')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function generateAiImage() {
    if (!editing?.name) return
    setGenErr('')
    setGenerating(true)
    try {
      const resp = await fetch('/.netlify/functions/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, desc: editing.desc, category: categories.find(c => c.id === editing.categoryId)?.name }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Görsel üretilemedi')
      const compressed = await urlToCompressedDataURL(data.image)
      setEditing(prev => ({ ...prev, image: compressed }))
    } catch (err) {
      setGenErr(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // AI ile gramaj/kalori/alerjen/içerik ÖNERİSİ — sadece formu doldurur,
  // kaydetmeden önce işletme sahibi kontrol edip düzeltmeli.
  async function suggestNutrition() {
    if (!editing?.name) return
    setNutriErr('')
    setNutriLoading(true)
    try {
      const resp = await fetch('/.netlify/functions/suggest-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, desc: editing.desc, category: categories.find(c => c.id === editing.categoryId)?.name }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Öneri alınamadı')
      setEditing(prev => {
        const tags = new Set(prev.tags || [])
        if (data.vegan) tags.add('vegan');
        if (data.vejetaryen) tags.add('vejetaryen')
        if (data.aci) tags.add('aci')
        if (data.sekersiz) tags.add('sekersiz')
        return {
          ...prev,
          gram: data.gram || prev.gram,
          kalori: data.kalori || prev.kalori,
          allergens: data.allergens?.length ? data.allergens : prev.allergens,
          alkol: data.alkol,
          domuz: data.domuz,
          icerik: data.icerik || prev.icerik,
          tags: [...tags],
        }
      })
    } catch (err) {
      setNutriErr(err.message)
    } finally {
      setNutriLoading(false)
    }
  }

  // ── MENÜ TARAMA ──
  async function handleScanFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanErr('')
    setScanResult(null)
    setImportDone(false)
    setScanning(true)

    try {
      // Görseli base64'e çevir (sıkıştırma olmadan, AI okuyabilsin diye boyutu koru)
      const reader = new FileReader()
      const base64 = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const resp = await fetch('/.netlify/functions/scan-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Sunucu hatası')
      if (!data.items?.length) throw new Error('Menüde ürün bulunamadı. Daha net bir fotoğraf deneyin.')

      setScanResult(data)
      // Hepsini seçili başlat
      const sel = {}
      data.items.forEach((_, i) => (sel[i] = true))
      setSelected(sel)
    } catch (err) {
      setScanErr(err.message)
    } finally {
      setScanning(false)
      if (scanFileRef.current) scanFileRef.current.value = ''
    }
  }

  async function importSelected() {
    if (!scanResult) return
    setImporting(true)

    // Mevcut kategorileri isimle eşleştir
    const catMap = {}
    categories.forEach(c => { catMap[c.name.toLowerCase().trim()] = c.id })

    // Seçili ürünlerin gerektirdiği yeni kategorileri bul
    const selectedItems = scanResult.items.filter((_, i) => selected[i])
    const newCatNames = [...new Set(
      selectedItems
        .map(it => it.category?.trim())
        .filter(c => c && !catMap[c.toLowerCase()])
    )]

    // Yeni kategorileri ekle, Firebase'in yazmasını bekle
    for (const name of newCatNames) {
      addCategory(bizId, { name, order: categories.length + newCatNames.indexOf(name) + 1 })
    }

    if (newCatNames.length > 0) {
      // Firebase'den güncel kategori listesini tek seferlik çek
      await new Promise(res => {
        let unsub = subscribe(`businesses/${bizId}/menu/categories`, val => {
          if (val) {
            Object.entries(val).forEach(([id, v]) => {
              catMap[v.name?.toLowerCase().trim()] = id
            })
          }
          unsub?.()
          res()
        })
      })
    }

    // Ürünleri ekle
    for (const it of selectedItems) {
      const catId = catMap[it.category?.toLowerCase().trim()] || categories[0]?.id
      if (!catId) continue
      addProduct(bizId, {
        name: it.name,
        desc: it.desc || '',
        price: Number(it.price) || 0,
        image: '',
        categoryId: catId,
        available: true,
        order: 99,
      })
    }

    setImporting(false)
    setImportDone(true)
    setTimeout(() => { setScanOpen(false); setScanResult(null); setImportDone(false) }, 2000)
  }

  const grouped = useMemo(() => {
    const g = {}
    categories.forEach((c) => (g[c.id] = []))
    products.forEach((p) => { ;(g[p.categoryId] = g[p.categoryId] || []).push(p) })
    return g
  }, [categories, products])

  function openNew() { setEditing({ ...empty, categoryId: categories[0]?.id || '' }); setOpen(true) }
  function openEdit(p) { setEditing({ ...p }); setOpen(true) }
  function save() {
    if (!editing.name || !editing.categoryId) return
    // Boş varyant/ekstra satırlarını temizle
    const clean = {
      ...editing,
      variants: (editing.variants || []).filter(v => v.name?.trim() && Number(v.price) > 0)
        .map(v => ({ name: v.name.trim(), price: Number(v.price) })),
      extras: (editing.extras || []).filter(e => e.name?.trim())
        .map(e => ({ name: e.name.trim(), price: Number(e.price) || 0 })),
    }
    if (clean.id) {
      const { id, ...patch } = clean
      updateProduct(bizId, id, { ...patch, price: Number(patch.price) || 0 })
    } else {
      addProduct(bizId, clean)
    }
    setOpen(false); setEditing(null)
  }

  // ── Kampanya / kombo menü ──
  function openNewCombo() {
    setComboEditing({ ...comboEmpty, categoryId: categories[0]?.id || '' })
    setComboOpen(true)
  }
  function openEditCombo(p) {
    setComboEditing({
      id: p.id, name: p.name, desc: p.desc || '', price: p.price, categoryId: p.categoryId,
      items: (p.comboItems || []).map(ci => ({ productId: ci.productId, qty: ci.qty || 1 })),
    })
    setComboOpen(true)
  }
  function toggleComboItem(productId) {
    setComboEditing(ed => {
      const items = ed.items || []
      const idx = items.findIndex(i => i.productId === productId)
      if (idx >= 0) return { ...ed, items: items.filter((_, x) => x !== idx) }
      return { ...ed, items: [...items, { productId, qty: 1 }] }
    })
  }
  function setComboItemQty(productId, qty) {
    setComboEditing(ed => ({
      ...ed,
      items: (ed.items || []).map(i => i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i),
    }))
  }
  const comboItemNames = comboEditing?.items?.map(it => {
    const prod = products.find(p => p.id === it.productId)
    return prod ? { name: prod.name, price: prod.price, qty: it.qty } : null
  }).filter(Boolean) || []
  const comboSum = comboItemNames.reduce((s, it) => s + it.price * it.qty, 0)
  const comboContentsText = comboItemNames.map(it => `${it.qty > 1 ? it.qty + 'x ' : ''}${it.name}`).join(', ')

  function saveCombo() {
    if (!comboEditing?.name?.trim() || !comboEditing?.categoryId || !comboItemNames.length) return
    const payload = {
      name: comboEditing.name.trim(),
      desc: comboEditing.desc?.trim() || `İçerir: ${comboContentsText}`,
      price: Number(comboEditing.price) || comboSum,
      categoryId: comboEditing.categoryId,
      available: true,
      image: '',
      comboItems: comboEditing.items.map(it => ({ productId: it.productId, qty: it.qty })),
    }
    if (comboEditing.id) updateProduct(bizId, comboEditing.id, payload)
    else addProduct(bizId, payload)
    setComboOpen(false); setComboEditing(null)
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div>
      {/* Üst bar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <p className="text-sm text-ink-500">{products.length} ürün · {categories.length} kategori</p>
        <div className="flex items-center gap-2">
          {/* MENÜ TARA */}
          <button
            onClick={() => { setScanOpen(true); setScanResult(null); setScanErr(''); setImportDone(false) }}
            className="btn-outline flex items-center gap-2"
          >
            <ScanLine className="h-4 w-4" />
            Menüden Tara
          </button>
          <button
            onClick={openNewCombo}
            disabled={nonComboProducts.length < 2}
            title={nonComboProducts.length < 2 ? 'Kampanya için en az 2 ürün gerekir' : 'Ürünleri birleştirip paket fiyatla satın'}
            className="btn-outline flex items-center gap-2 !border-amber-300 !text-amber-700 hover:!bg-amber-50 disabled:opacity-40"
          >
            <Tag className="h-4 w-4" />
            Kampanya Menüsü
          </button>
          <button onClick={openNew} className="btn-primary">
            <Plus className="h-4 w-4" /> Ürün Ekle
          </button>
        </div>
      </div>

      {/* Ürün listesi */}
      <div className="space-y-6">
        {categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-2 font-display font-bold text-ink-800 flex items-center gap-2">
              {cat.name}
              <span className="chip bg-ink-100 text-ink-400">{(grouped[cat.id] || []).length}</span>
            </h2>
            <div className="card divide-y divide-ink-100 overflow-hidden">
              {(grouped[cat.id] || []).map((p) => {
                const isCombo = !!p.comboItems?.length
                return (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  <ProductImage src={p.image} alt={p.name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
                  <div className="grow min-w-0">
                    <p className="font-semibold text-ink-900 truncate flex items-center gap-1.5">
                      {p.name}
                      {isCombo && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                          <Tag className="h-2.5 w-2.5" /> Kampanya
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400 truncate">{p.desc || '—'}</p>
                  </div>
                  <span className="font-display font-extrabold text-brand-600 shrink-0">{money(p.price)}</span>
                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <div className="flex items-center gap-1.5">
                      <Toggle checked={p.available !== false} onChange={(v) => toggleProduct(bizId, p.id, v)} label={`${p.name} stok`} />
                      <span className={`text-xs font-semibold w-12 ${p.available !== false ? 'text-green-600' : 'text-ink-400'}`}>
                        {p.available !== false ? 'Stokta' : 'Tükendi'}
                      </span>
                    </div>
                    <button onClick={() => isCombo ? openEditCombo(p) : openEdit(p)} className="btn-ghost h-9 w-9 !p-0 rounded-full"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm(`"${p.name}" silinsin mi?`)) removeProduct(bizId, p.id) }}
                      className="btn-ghost h-9 w-9 !p-0 rounded-full text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )})}
              ))}
              {(grouped[cat.id] || []).length === 0 && <p className="p-4 text-sm text-ink-400">Bu kategoride ürün yok.</p>}
            </div>
          </section>
        ))}
      </div>

      {/* ── Ürün Ekle/Düzenle Modalı ── */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing?.id ? 'Ürünü Düzenle' : 'Yeni Ürün'}
        footer={<button onClick={save} className="btn-primary w-full">Kaydet</button>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Ürün adı">
              <input className="inp" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="örn. Izgara Köfte" />
            </Field>
            <Field label="Açıklama">
              <input className="inp" value={editing.desc} onChange={e => setEditing({ ...editing, desc: e.target.value })} placeholder="Kısa açıklama" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fiyat (₺)">
                <input type="number" className="inp" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Kategori">
                <select className="inp" value={editing.categoryId} onChange={e => setEditing({ ...editing, categoryId: e.target.value })}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Ürün görseli">
              <div className="flex items-start gap-3">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-ink-200">
                  {editing.image
                    ? <ProductImage src={editing.image} alt="önizleme" className="h-full w-full object-cover" />
                    : <div className="grid h-full w-full place-items-center bg-ink-50 text-ink-300"><ImageOff className="h-6 w-6" /></div>
                  }
                  {(uploading || generating) && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>}
                </div>
                <div className="grow space-y-2">
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id="urun-gorsel" />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || generating} className="btn-outline flex-1">
                      <Upload className="h-4 w-4" />
                      {uploading ? 'Yükleniyor…' : editing.image ? 'Değiştir' : 'Fotoğraf Yükle'}
                    </button>
                    <button
                      type="button"
                      onClick={generateAiImage}
                      disabled={uploading || generating || !editing.name}
                      title={!editing.name ? 'Önce ürün adı girin' : 'Yapay zeka ile üret'}
                      className="btn-outline flex-1 !border-brand-300 !text-brand-600 hover:!bg-brand-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      {generating ? 'Üretiliyor…' : 'AI ile Üret'}
                    </button>
                  </div>
                  {editing.image && <button type="button" onClick={() => setEditing({ ...editing, image: '' })} className="text-xs font-semibold text-red-500 hover:underline cursor-pointer">Görseli kaldır</button>}
                  <p className="text-xs text-ink-400">Otomatik küçültülüp kaydedilir. AI üretimi ürün adı ve açıklamasına göre gerçekçi görsel oluşturur.</p>
                  {uploadErr && <p className="text-xs text-red-500">{uploadErr}</p>}
                  {genErr && <p className="text-xs text-red-500">{genErr}</p>}
                </div>
              </div>
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <Toggle checked={editing.available !== false} onChange={v => setEditing({ ...editing, available: v })} label="Stok durumu" />
              <span className="text-sm font-medium text-ink-600">{editing.available !== false ? 'Stokta' : 'Tükendi'}</span>
            </div>

            <div className="flex items-center gap-3">
              <Toggle checked={!!editing.featured} onChange={v => setEditing({ ...editing, featured: v })} label="Öne çıkar" />
              <span className="text-sm font-medium text-ink-600">
                {editing.featured ? '⭐ Menüde "Öne Çıkanlar"da gösterilir' : 'Öne çıkar (vitrin)'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Toggle checked={!!editing.chef} onChange={v => setEditing({ ...editing, chef: v })} label="Şefin önerisi" />
              <span className="text-sm font-medium text-ink-600">
                {editing.chef ? '👨‍🍳 "Şefin Önerisi" rozeti gösterilir' : 'Şefin önerisi rozeti'}
              </span>
            </div>

            {/* Porsiyon/varyant editörü */}
            <Field label="Porsiyonlar / boyutlar (isteğe bağlı)">
              <p className="text-xs text-ink-400 -mt-1 mb-2">Küçük/Orta/Büyük gibi. Eklersen müşteri seçim yapar, fiyat ona göre hesaplanır.</p>
              <div className="space-y-2">
                {(editing.variants || []).map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="inp flex-1" value={v.name} placeholder="Porsiyon (örn. Büyük)"
                      onChange={e => setEditing(ed => { const a=[...(ed.variants||[])]; a[i]={...a[i],name:e.target.value}; return {...ed,variants:a} })} />
                    <input type="number" className="inp w-24" value={v.price} placeholder="₺"
                      onChange={e => setEditing(ed => { const a=[...(ed.variants||[])]; a[i]={...a[i],price:Number(e.target.value)||0}; return {...ed,variants:a} })} />
                    <button type="button" onClick={() => setEditing(ed => ({ ...ed, variants: ed.variants.filter((_,x)=>x!==i) }))} className="btn-ghost h-10 w-10 !p-0 rounded-full text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setEditing(ed => ({ ...ed, variants: [...(ed.variants||[]), { name:'', price:'' }] }))} className="btn-outline w-full text-sm">
                  <Plus className="h-4 w-4" /> Porsiyon Ekle
                </button>
              </div>
            </Field>

            {/* Ekstra malzeme editörü */}
            <Field label="Ekstralar (isteğe bağlı)">
              <p className="text-xs text-ink-400 -mt-1 mb-2">Ekstra peynir, sos vb. Müşteri seçince fiyat üstüne eklenir.</p>
              <div className="space-y-2">
                {(editing.extras || []).map((ex, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="inp flex-1" value={ex.name} placeholder="Ekstra (örn. Ekstra peynir)"
                      onChange={e => setEditing(ed => { const a=[...(ed.extras||[])]; a[i]={...a[i],name:e.target.value}; return {...ed,extras:a} })} />
                    <input type="number" className="inp w-24" value={ex.price} placeholder="+₺"
                      onChange={e => setEditing(ed => { const a=[...(ed.extras||[])]; a[i]={...a[i],price:Number(e.target.value)||0}; return {...ed,extras:a} })} />
                    <button type="button" onClick={() => setEditing(ed => ({ ...ed, extras: ed.extras.filter((_,x)=>x!==i) }))} className="btn-ghost h-10 w-10 !p-0 rounded-full text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setEditing(ed => ({ ...ed, extras: [...(ed.extras||[]), { name:'', price:'' }] }))} className="btn-outline w-full text-sm">
                  <Plus className="h-4 w-4" /> Ekstra Ekle
                </button>
              </div>
            </Field>

            <Field label="Diyet tercihleri (vitrin etiketleri)">
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TAGS.map(tag => {
                  const on = (editing.tags || []).includes(tag.key)
                  return (
                    <button
                      key={tag.key}
                      type="button"
                      onClick={() => setEditing(e => {
                        const tags = e.tags || []
                        return { ...e, tags: on ? tags.filter(t => t !== tag.key) : [...tags, tag.key] }
                      })}
                      className="text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer"
                      style={on
                        ? { background: `${tag.color}1a`, color: tag.color, borderColor: tag.color }
                        : { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' }}
                    >
                      {on && '✓ '}{tag.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            {/* ── Yönetmelik Bilgileri (1 Temmuz 2026) ── */}
            <div className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display font-bold text-ink-800 text-sm">Yönetmelik Bilgileri</h4>
                  <p className="text-xs text-ink-400 mt-0.5">Gramaj, kalori, alerjen — 1 Temmuz 2026 menü yönetmeliği</p>
                </div>
                <button
                  type="button"
                  onClick={suggestNutrition}
                  disabled={nutriLoading || !editing.name}
                  title={!editing.name ? 'Önce ürün adı girin' : 'Yapay zeka ile tahmini doldur'}
                  className="btn-outline !border-brand-300 !text-brand-600 hover:!bg-brand-50 shrink-0 text-xs !py-2"
                >
                  {nutriLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {nutriLoading ? 'Öneriliyor…' : 'AI ile Doldur'}
                </button>
              </div>
              {nutriErr && <p className="text-xs text-red-500">{nutriErr}</p>}
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ AI önerisi tahminidir. Kaydetmeden önce gerçek tarifinize göre kontrol edip düzeltin — sorumluluk size aittir.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gramaj (g)">
                  <input type="number" className="inp" value={editing.gram} onChange={e => setEditing({ ...editing, gram: e.target.value })} placeholder="örn. 250" />
                </Field>
                <Field label="Kalori (kcal)">
                  <input type="number" className="inp" value={editing.kalori} onChange={e => setEditing({ ...editing, kalori: e.target.value })} placeholder="örn. 320" />
                </Field>
              </div>

              <Field label="Ana bileşenler / içerik">
                <textarea
                  className="inp min-h-[70px]"
                  value={editing.icerik}
                  onChange={e => setEditing({ ...editing, icerik: e.target.value })}
                  placeholder="örn. kahve çekirdeği, su, şeker"
                />
              </Field>

              <Field label="Alerjenler (varsa işaretleyin)">
                <div className="flex flex-wrap gap-2">
                  {ALLERGENS.map(a => {
                    const on = (editing.allergens || []).includes(a.key)
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => setEditing(e => {
                          const list = e.allergens || []
                          return { ...e, allergens: on ? list.filter(x => x !== a.key) : [...list, a.key] }
                        })}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all cursor-pointer"
                        style={on
                          ? { background: '#fef2f2', color: '#dc2626', borderColor: '#dc2626' }
                          : { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' }}
                      >
                        {on && '✓ '}{a.label}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <div className="flex items-center gap-2.5">
                  <Toggle checked={!!editing.alkol} onChange={v => setEditing({ ...editing, alkol: v })} label="Alkol içerir" />
                  <span className="text-sm font-medium text-ink-600">Alkol içerir</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Toggle checked={!!editing.domuz} onChange={v => setEditing({ ...editing, domuz: v })} label="Domuz türevi içerir" />
                  <span className="text-sm font-medium text-ink-600">Domuz türevi içerir</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Kampanya Menüsü Ekle/Düzenle Modalı ── */}
      <Modal open={comboOpen} onClose={() => setComboOpen(false)} title={comboEditing?.id ? 'Kampanyayı Düzenle' : 'Yeni Kampanya Menüsü'}
        footer={
          <button onClick={saveCombo} disabled={!comboEditing?.name?.trim() || !comboItemNames.length} className="btn-primary w-full disabled:opacity-40">
            Kaydet
          </button>
        }>
        {comboEditing && (
          <div className="space-y-4">
            <p className="text-xs text-ink-400 -mt-1">
              Birden fazla ürünü tek paket fiyatla satın (örn. "Öğle Menüsü" = Burger + Patates + Kola). Müşteri menüsünde 🏷️ Kampanya rozetiyle görünür, mutfak fişinde içerik otomatik yazılır.
            </p>
            <Field label="Kampanya adı">
              <input className="inp" value={comboEditing.name} onChange={e => setComboEditing({ ...comboEditing, name: e.target.value })} placeholder="örn. Öğle Menüsü" />
            </Field>
            <Field label="Kategori">
              <select className="inp" value={comboEditing.categoryId} onChange={e => setComboEditing({ ...comboEditing, categoryId: e.target.value })}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label={`İçindekiler (${comboItemNames.length} ürün seçili)`}>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 rounded-xl border border-ink-100 p-2">
                {nonComboProducts.length === 0 && <p className="text-sm text-ink-400 p-2">Önce normal ürün ekleyin.</p>}
                {nonComboProducts.map(prod => {
                  const item = (comboEditing.items || []).find(i => i.productId === prod.id)
                  const on = !!item
                  return (
                    <div key={prod.id} className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors ${on ? 'bg-amber-50 border border-amber-200' : 'bg-ink-50 border border-transparent'}`}>
                      <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                        <input type="checkbox" checked={on} onChange={() => toggleComboItem(prod.id)} className="sr-only" />
                        <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-amber-500 border-amber-500' : 'border-ink-300 bg-white'}`}>
                          {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-semibold text-ink-800 truncate">{prod.name}</span>
                        <span className="text-xs text-ink-400 shrink-0">{money(prod.price)}</span>
                      </label>
                      {on && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => setComboItemQty(prod.id, item.qty - 1)} className="h-7 w-7 rounded-full bg-white border border-ink-200 flex items-center justify-center hover:bg-ink-100">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                          <button type="button" onClick={() => setComboItemQty(prod.id, item.qty + 1)} className="h-7 w-7 rounded-full bg-white border border-ink-200 flex items-center justify-center hover:bg-ink-100">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Field>

            {comboItemNames.length > 0 && (
              <div className="rounded-xl bg-ink-50 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between text-ink-500">
                  <span>Ürünlerin toplamı</span>
                  <span className="font-semibold">{money(comboSum)}</span>
                </div>
                <p className="text-xs text-ink-400">İçerir: {comboContentsText}</p>
              </div>
            )}

            <Field label="Kampanya fiyatı (₺)">
              <input type="number" className="inp" value={comboEditing.price} onChange={e => setComboEditing({ ...comboEditing, price: e.target.value })}
                placeholder={comboSum ? String(comboSum) : '0'} />
              <p className="text-xs text-ink-400 mt-1">Boş bırakırsan ürünlerin toplamı ({money(comboSum)}) kullanılır. İndirimli paket fiyatı için buraya düşük bir tutar gir.</p>
            </Field>

            <Field label="Açıklama (isteğe bağlı)">
              <input className="inp" value={comboEditing.desc} onChange={e => setComboEditing({ ...comboEditing, desc: e.target.value })}
                placeholder={comboContentsText ? `Varsayılan: İçerir: ${comboContentsText}` : 'İçerik özeti'} />
            </Field>
          </div>
        )}
      </Modal>

      {/* ── Menüden Tara Modalı ── */}
      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Menüden Tara" maxW="max-w-2xl">
        <div className="space-y-5">

          {/* Adım 1: Fotoğraf yükle */}
          {!scanResult && !scanning && (
            <div>
              <p className="text-sm text-ink-500 mb-4">
                Kağıt menünüzün fotoğrafını yükleyin. Yapay zeka ürünleri, fiyatları ve kategorileri otomatik okur.
              </p>
              <input ref={scanFileRef} type="file" accept="image/*" capture="environment" onChange={handleScanFile} className="hidden" id="scan-file" />
              <label htmlFor="scan-file"
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 p-10 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-soft text-brand-500">
                  <ScanLine className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-ink-800">Fotoğraf seç veya çek</p>
                  <p className="text-xs text-ink-400 mt-1">JPG, PNG, HEIC · Menü net görünmeli</p>
                </div>
              </label>
              {scanErr && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {scanErr}
                </div>
              )}
            </div>
          )}

          {/* Yükleniyor */}
          {scanning && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="h-14 w-14 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
              <div className="text-center">
                <p className="font-bold text-ink-800">Menü okunuyor...</p>
                <p className="text-sm text-ink-400 mt-1">Yapay zeka ürünleri ve fiyatları tespit ediyor</p>
              </div>
            </div>
          )}

          {/* Sonuç — önizleme */}
          {scanResult && !importDone && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-ink-800">
                  {scanResult.items.length} ürün bulundu
                  <span className="text-ink-400 font-normal ml-2 text-sm">· {selectedCount} seçili</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { const s={}; scanResult.items.forEach((_,i)=>(s[i]=true)); setSelected(s) }}
                    className="text-xs font-semibold text-brand-600 hover:underline cursor-pointer">Tümünü seç</button>
                  <span className="text-ink-200">·</span>
                  <button onClick={() => setSelected({})} className="text-xs font-semibold text-ink-400 hover:underline cursor-pointer">Temizle</button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {scanResult.items.map((it, i) => (
                  <label key={i} className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors
                    ${selected[i] ? 'bg-brand-50 border border-brand-200' : 'bg-ink-50 border border-transparent hover:bg-ink-100'}`}>
                    <input type="checkbox" checked={!!selected[i]} onChange={e => setSelected(s => ({ ...s, [i]: e.target.checked }))} className="sr-only" />
                    <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                      ${selected[i] ? 'bg-brand-500 border-brand-500' : 'border-ink-300 bg-white'}`}>
                      {selected[i] && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 text-sm truncate">{it.name}</p>
                      {it.desc && <p className="text-xs text-ink-400 truncate">{it.desc}</p>}
                      <p className="text-xs text-ink-400 mt-0.5">{it.category}</p>
                    </div>
                    <span className="font-extrabold text-brand-600 shrink-0 text-sm">{money(it.price)}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => { setScanResult(null); setScanErr('') }} className="btn-ghost flex-1">
                  <X className="h-4 w-4" /> Yeniden Çek
                </button>
                <button onClick={importSelected} disabled={!selectedCount || importing} className="btn-primary flex-1">
                  {importing
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Ekleniyor...</>
                    : <><Plus className="h-4 w-4" /> {selectedCount} Ürünü Ekle</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Tamamlandı */}
          {importDone && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" strokeWidth={3} />
              </div>
              <p className="font-bold text-ink-900 text-lg">Ürünler eklendi!</p>
              <p className="text-sm text-ink-400">Menü yönetiminden fiyat ve görselleri güncelleyebilirsiniz.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</span>
      {children}
    </label>
  )
}

