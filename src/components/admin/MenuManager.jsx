import { useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Flame, Trash2, ImageOff, Upload, Loader2, ScanLine, Check, X, AlertCircle, Sparkles, Tag, Minus } from 'lucide-react'
import { fileToCompressedDataURL, urlToCompressedDataURL } from '../../lib/image'
import {
  useCategories, useProducts,
  addProduct, updateProduct, removeProduct, toggleProduct,
  addCategory, useBusinessId, useInventory, normalizeRecipe, INVENTORY_UNITS, useProfile, updateProfile, useOrders, useProductStats, computeOrderCounts, computeBestIds, isBreadOrWrap, DEFAULT_BREAD_WRAP_INGREDIENTS,
} from '../../lib/store'
import { subscribe } from '../../lib/db'
import { money } from '../../lib/format'
import { ProductImage, Modal, Toggle } from '../../components/ui'
import { PRODUCT_TAGS, ALLERGENS } from '../../lib/seed'

const empty = {
  name: '', desc: '', price: '', cost: '', image: '', categoryId: '', available: true, featured: false, tags: [],
  gram: '', kalori: '', allergens: [], alkol: false, domuz: false, icerik: '', recipe: [], portionsEnabled: true,
}

const comboEmpty = { name: '', desc: '', price: '', categoryId: '', items: [] }

export default function MenuManager() {
  const bizId      = useBusinessId()
  const categories = useCategories(bizId)
  const products   = useProducts(bizId)
  const inventory  = useInventory(bizId)
  const orders = useOrders(bizId)
  const stats = useProductStats(bizId)
  const productOrderCounts = useMemo(() => computeOrderCounts(orders, stats), [orders, stats])
  const bestIds = useMemo(() => computeBestIds(productOrderCounts, categories, products), [productOrderCounts, categories, products])
  // Stok takibi kapalıysa reçete alanı hiç gösterilmez (İşletme Profili'nden açılır).
  const profile    = useProfile(bizId)
  const stockOn    = profile.stockTracking !== false
  const portionsEnabled = profile.portionsEnabled !== false

  async function togglePortions() {
    await updateProfile(bizId, { portionsEnabled: !portionsEnabled })
  }

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

  // Ekmek / Dürüm malzeme seçenekleri yönetimi
  const [ingModalOpen, setIngModalOpen] = useState(false)
  const [ingList, setIngList] = useState([])
  const [newIngName, setNewIngName] = useState('')
  const [newIngType, setNewIngType] = useState('exclude') // 'exclude' | 'prefer'
  const [savingIng, setSavingIng] = useState(false)

  function openIngModal() {
    setIngList(profile?.breadWrapIngredients?.length ? profile.breadWrapIngredients : DEFAULT_BREAD_WRAP_INGREDIENTS)
    setNewIngName('')
    setIngModalOpen(true)
  }

  function addIng() {
    const trimmed = newIngName.trim()
    if (!trimmed) return
    const item = {
      id: 'ing_' + Date.now(),
      label: trimmed,
      icon: newIngType === 'exclude' ? '🚫' : '✨',
      type: newIngType,
    }
    setIngList([...ingList, item])
    setNewIngName('')
  }

  function removeIng(index) {
    setIngList(ingList.filter((_, i) => i !== index))
  }

  async function saveIngs() {
    setSavingIng(true)
    try {
      await updateProfile(bizId, { breadWrapIngredients: ingList })
      setIngModalOpen(false)
    } catch (err) {
      alert(err.message || 'Kaydedilemedi')
    } finally {
      setSavingIng(false)
    }
  }
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

  // Reçetedeki malzemelerin birim maliyeti × miktar — porsiyon maliyetini
  // elle girmek yerine stok kartlarından hesaplatmak için.
  const recipeCost = useMemo(() => {
    if (!editing?.recipe?.length) return 0
    const cost = editing.recipe.reduce((sum, r) => {
      const item = (inventory || []).find(x => x.id === r.itemId)
      return sum + (Number(item?.cost) || 0) * (Number(r.qty) || 0)
    }, 0)
    return Math.round(cost * 100) / 100
  }, [editing, inventory])

  function openNew() { setEditing({ ...empty, categoryId: categories[0]?.id || '' }); setOpen(true) }
  function openEdit(p) { setEditing({ ...empty, ...p, portionsEnabled: p.portionsEnabled !== false }); setOpen(true) }
  function save() {
    if (!editing.name || !editing.categoryId) return
    // Boş varyant/ekstra/reçete satırlarını temizle
    const clean = {
      ...editing,
      portionsEnabled: editing.portionsEnabled !== false,
      isBreadOrWrap: editing.isBreadOrWrap ?? isBreadOrWrap(editing),
      customIngredientsEnabled: editing.customIngredientsEnabled ?? isBreadOrWrap(editing),
      variants: (editing.variants || []).filter(v => v.name?.trim() && Number(v.price) > 0)
        .map(v => ({ name: v.name.trim(), price: Number(v.price) })),
      extras: (editing.extras || []).filter(e => e.name?.trim())
        .map(e => ({ name: e.name.trim(), price: Number(e.price) || 0 })),
      recipe: normalizeRecipe(editing.recipe),
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
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-ink-500">{products.length} ürün · {categories.length} kategori</p>
          <button
            type="button"
            onClick={togglePortions}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm ${
              portionsEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title={portionsEnabled ? 'Menüde porsiyon seçenekleri açık. Tıklayarak kapatabilirsiniz.' : 'Menüde porsiyon seçenekleri kapalı. Tıklayarak açabilirsiniz.'}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${portionsEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>Porsiyon Seçenekleri: <b>{portionsEnabled ? 'Açık' : 'Kapalı'}</b></span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openIngModal} className="btn-outline flex items-center gap-2 !border-emerald-300 !text-emerald-700 hover:!bg-emerald-50" title="Garsonun dürüm ve ekmek içi seçimlerinde çıkan malzemeleri yönet"><span>🌯</span><span>Dürüm / Ekmek Malzemeleri</span></button>
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
                      {bestIds.includes(p.id) && (
                        <span data-testid="MenuAdminBestBadge" className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 shrink-0 border border-red-200">
                          <Flame className="h-2.5 w-2.5 text-red-600" /> Çok Satan ${productOrderCounts[p.id] ? `(${productOrderCounts[p.id]})` : ''}
                        </span>
                      )}
                      {p.chef && (
                        <span data-testid="MenuAdminChefBadge" className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0 border border-purple-200">
                          👨‍🍳 Şefin Önerisi
                        </span>
                      )}
                      {p.featured && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0 border border-amber-200">
                          ⭐ Öne Çıkan
                        </span>
                      )}
                      {p.variants?.length > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          portionsEnabled && p.portionsEnabled !== false
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {portionsEnabled && p.portionsEnabled !== false
                            ? `${p.variants.length} Porsiyon`
                            : 'Porsiyon Kapalı'}
                        </span>
                      )}
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
              <Field label="Porsiyon maliyeti (₺)">
                <input type="number" min="0" step="0.01" className="inp" value={editing.cost ?? ''} onChange={e => setEditing({ ...editing, cost: e.target.value })} placeholder="Stok/reçete maliyeti" />
              </Field>
            </div>
            <p className="text-xs text-ink-400 -mt-2">Maliyet girerseniz ciro ekranında ürün kârı ve brüt kâr marjı hesaplanır.</p>
            <div className="grid grid-cols-2 gap-3">
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

            {/* Ekmek / Dürüm malzeme seçimi aktif mi */}
            <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-ink-800 block">Ekmek / Dürüm Malzeme Seçimi</span>
                  <span className="text-[11px] text-ink-400 block">Garson bu ürüne dokunduğunda malzeme çıkarma/ekstra seçimi açılsın</span>
                </div>
                <input
                  type="checkbox"
                  checked={editing.isBreadOrWrap ?? isBreadOrWrap(editing)}
                  onChange={e => setEditing({ ...editing, isBreadOrWrap: e.target.checked, customIngredientsEnabled: e.target.checked })}
                  className="h-4 w-4 accent-brand-500 rounded shrink-0 cursor-pointer"
                />
              </label>
            </div>

            {/* Porsiyon/varyant editörü */}
            <Field label="Porsiyonlar / boyutlar (isteğe bağlı)">
              <div className="flex items-center justify-between gap-3 mb-2 -mt-1">
                <p className="text-xs text-ink-400">
                  Küçük/Orta/Büyük gibi. Eklerseniz müşteri seçim yapar, fiyat ona göre hesaplanır.
                </p>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0 bg-white px-2.5 py-1 rounded-lg border border-ink-200 shadow-sm">
                  <input
                    type="checkbox"
                    checked={editing.portionsEnabled !== false}
                    onChange={(e) => setEditing({ ...editing, portionsEnabled: e.target.checked })}
                    className="h-3.5 w-3.5 accent-brand-500 rounded cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-ink-700">
                    {editing.portionsEnabled !== false ? 'Aktif' : 'Kapalı'}
                  </span>
                </label>
              </div>

              {!portionsEnabled && (
                <div className="mb-2 p-2 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  ℹ️ <b>Menü genelinde porsiyonlar kapalı:</b> Porsiyonlar kayıtlı kalır; menüde görünmesi için menü üstündeki "Porsiyon Seçenekleri" düğmesini açabilirsiniz.
                </div>
              )}

              {editing.portionsEnabled === false && (
                <p className="mb-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                  ⚠️ Bu ürün için porsiyonlar kapatıldı. Menüde ana fiyat ({editing.price ? `${editing.price} ₺` : 'ana fiyat'}) geçerli olacaktır.
                </p>
              )}
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

            {/* Reçete — satışta stoktan otomatik düşülecek malzemeler */}
            {stockOn && <Field label="Reçete · otomatik stok düşümü (isteğe bağlı)">
              <p className="text-xs text-ink-400 -mt-1 mb-2">
                Bu üründen 1 adet satıldığında stoktan ne düşsün? Tanımlarsan sipariş girilir girilmez
                stok otomatik azalır, iptal edilirse geri yüklenir.
              </p>
              {inventory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50 p-4 text-center">
                  <p className="text-sm font-semibold text-ink-600">Önce stok kartı eklemelisin</p>
                  <p className="mt-1 text-xs text-ink-400">
                    Yönetim → İşletme OS → Stok &amp; Maliyet sekmesinden malzemelerini tanımla,
                    sonra buradan reçeteye bağla.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(editing.recipe || []).map((r, i) => {
                    const item = inventory.find(x => x.id === r.itemId)
                    const unit = INVENTORY_UNITS.find(u => u.key === item?.unit)?.label || item?.unit || ''
                    return (
                      <div key={i} className="flex gap-2">
                        <select
                          className="inp flex-1"
                          value={r.itemId || ''}
                          onChange={e => setEditing(ed => {
                            const a = [...(ed.recipe || [])]; a[i] = { ...a[i], itemId: e.target.value }
                            return { ...ed, recipe: a }
                          })}
                        >
                          <option value="">Malzeme seç…</option>
                          {inventory.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                        <div className="relative w-32 shrink-0">
                          <input
                            type="number" min="0" step="0.001" className="inp w-full !pr-12"
                            value={r.qty ?? ''} placeholder="Miktar"
                            onChange={e => setEditing(ed => {
                              const a = [...(ed.recipe || [])]; a[i] = { ...a[i], qty: e.target.value }
                              return { ...ed, recipe: a }
                            })}
                          />
                          {unit && (
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400">
                              {unit}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditing(ed => ({ ...ed, recipe: (ed.recipe || []).filter((_, x) => x !== i) }))}
                          className="btn-ghost h-10 w-10 !p-0 rounded-full text-red-500 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setEditing(ed => ({ ...ed, recipe: [...(ed.recipe || []), { itemId: '', qty: '' }] }))}
                    className="btn-outline w-full text-sm"
                  >
                    <Plus className="h-4 w-4" /> Malzeme Ekle
                  </button>
                  {recipeCost > 0 && (
                    <p className="text-xs text-ink-500">
                      Reçete maliyeti: <strong className="text-ink-700">{money(recipeCost)}</strong>
                      {Number(editing.price) > 0 && (
                        <> · brüt kâr <strong className="text-green-600">{money(Number(editing.price) - recipeCost)}</strong>
                          {' '}(%{Math.round((1 - recipeCost / Number(editing.price)) * 100)})</>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(ed => ({ ...ed, cost: recipeCost }))}
                        className="ml-2 font-bold text-brand-600 hover:underline cursor-pointer"
                      >
                        porsiyon maliyetine yaz
                      </button>
                    </p>
                  )}
                </div>
              )}
            </Field>}

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

      {/* ── Ekmek / Dürüm Malzemeleri Yönetim Modalı ── */}
      <Modal open={ingModalOpen} onClose={() => setIngModalOpen(false)} title="Dürüm / Ekmek Malzemeleri" maxW="max-w-lg"
        footer={
          <div className="flex gap-2 w-full">
            <button type="button" onClick={() => setIngModalOpen(false)} className="btn-ghost flex-1">İptal</button>
            <button type="button" onClick={saveIngs} disabled={savingIng} className="btn-primary flex-1">
              {savingIng ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        }>
        <div className="space-y-4">
          <p className="text-xs text-ink-500">
            Garson ekranda Dürüm veya Ekmek arası ürünlere tıkladığında burada tanımlı malzemeler açılır. Garson "soğansız", "bol domates" gibi seçimleri buradan kolayca yapar.
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {ingList.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-ink-50 border border-ink-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon || (item.type === 'exclude' ? '🚫' : '✨')}</span>
                  <span className="text-sm font-bold text-ink-800">{item.label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    item.type === 'prefer' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.type === 'prefer' ? 'Tercih / Pişme' : 'Çıkarılabilir Malzeme'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeIng(idx)}
                  className="btn-ghost h-8 w-8 !p-0 rounded-full text-red-500 hover:bg-red-50"
                  title="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {ingList.length === 0 && (
              <p className="text-center text-xs text-ink-400 py-4">Henüz malzeme eklenmemiş.</p>
            )}
          </div>

          <div className="pt-2 border-t border-ink-100 space-y-2">
            <span className="text-xs font-bold text-ink-700 block">Yeni Malzeme Ekle</span>
            <div className="flex gap-2">
              <input
                type="text"
                className="inp flex-1 text-sm"
                placeholder="Örn: Turşu, Mayonez, Acı Biber"
                value={newIngName}
                onChange={e => setNewIngName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIng() } }}
              />
              <select
                className="inp w-36 text-xs font-semibold"
                value={newIngType}
                onChange={e => setNewIngType(e.target.value)}
              >
                <option value="exclude">🚫 Çıkarılabilir</option>
                <option value="prefer">✨ Tercih / Pişme</option>
              </select>
              <button
                type="button"
                onClick={addIng}
                disabled={!newIngName.trim()}
                className="btn-primary !px-3 shrink-0 text-sm disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> Ekle
              </button>
            </div>
          </div>
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
