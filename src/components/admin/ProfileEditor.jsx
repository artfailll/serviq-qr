import { useState, useRef } from 'react'
import { Save, Upload, Loader2, Palette, Globe, Wifi, Phone, MapPin, Instagram, Clock, Megaphone, Star, LayoutTemplate, Printer, Boxes, ChefHat, QrCode } from 'lucide-react'
import { useProfile, updateProfile, useBusinessId } from '../../lib/store'
import { fileToCompressedDataURL } from '../../lib/image'
import { ProductImage } from '../../components/ui'
import { TEMPLATE_LIST } from '../../lib/templates'
import { LoyaltySettings } from './LoyaltyPanel'
import { getLoyaltyRules } from '../../lib/loyalty'

const BRAND_COLORS = [
  '#f97316','#ef4444','#8b5cf6','#06b6d4','#22c55e',
  '#f59e0b','#ec4899','#64748b','#1e293b','#0ea5e9',
]

export default function ProfileEditor() {
  const bizId = useBusinessId()
  const profile = useProfile(bizId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingField, setUploadingField] = useState(null)
  const coverRef = useRef(null)
  const logoRef = useRef(null)

  const data = form || profile

  async function handleImg(e, field, ref) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingField(field)
    try {
      const url = await fileToCompressedDataURL(file, { maxSize: field === 'logo' ? 256 : 1280, quality: 0.8 })
      setForm((prev) => ({ ...(prev || profile), [field]: url }))
    } finally {
      setUploadingField(null)
      if (ref.current) ref.current.value = ''
    }
  }

  async function save() {
    if (saving) return
    if (data.loyalty?.enabled && !getLoyaltyRules(data).enabled) { setSaveError('Sadakat oranı, ödül puanı ve ödül adı geçerli olmalı.'); return }
    setSaveError('')
    setSaving(true)
    try {
    await updateProfile(bizId, data)
    setSaved(true)
    setForm(null)
    setTimeout(() => setSaved(false), 2500)
    } catch { setSaveError('Profil kaydedilemedi. Değişiklikleriniz korunuyor; bağlantıyı kontrol edin.') }
    finally { setSaving(false) }
  }

  function set(key, val) { setForm((prev) => ({ ...(prev || profile), [key]: val })) }

  return (
    <div className="max-w-2xl">
      {/* Önizleme */}
      <div className="card overflow-hidden mb-6">
        <div className="relative h-36 bg-gradient-to-r from-orange-100 to-amber-50">
          {data.cover && <img src={data.cover} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <div
              className="h-14 w-14 rounded-xl border-2 border-white/40 flex items-center justify-center text-white text-xl font-black overflow-hidden"
              style={{ background: data.logo ? 'transparent' : (data.brandColor || '#f97316') }}
            >
              {data.logo ? <img src={data.logo} alt="" className="w-full h-full object-cover" /> : (data.name||'S')[0]}
            </div>
            <div className="text-white">
              <p className="font-extrabold text-base leading-tight drop-shadow">{data.name || 'Restoran Adı'}</p>
              <p className="text-xs text-white/70">{data.tagline || 'Slogan buraya'}</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-ink-400">Müşteri ekranında böyle görünür</div>
      </div>

      <div className="space-y-5">
        {/* Temel bilgiler */}
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2"><Globe className="h-4 w-4 text-brand-500" /> Temel Bilgiler</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink-700 mb-1.5 block">İşletme Adı</span>
              <input className="inp" value={data.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Örn. Kafe Silivri" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-700 mb-1.5 block">Slogan</span>
              <input className="inp" value={data.tagline || ''} onChange={(e) => set('tagline', e.target.value)} placeholder="Lezzetin adresi" />
            </label>
          </div>
        </div>

        {/* Görseller */}
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2"><Upload className="h-4 w-4 text-brand-500" /> Görseller</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Kapak */}
            <div>
              <p className="text-sm font-semibold text-ink-700 mb-2">Kapak Fotoğrafı</p>
              <div className="relative h-28 rounded-xl overflow-hidden bg-ink-100 mb-2">
                {data.cover ? <img src={data.cover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs">Henüz yok</div>}
                {uploadingField === 'cover' && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>}
              </div>
              <input ref={coverRef} type="file" accept="image/*" onChange={(e) => handleImg(e, 'cover', coverRef)} className="hidden" />
              <button onClick={() => coverRef.current?.click()} className="btn-outline w-full text-sm" disabled={!!uploadingField}>
                <Upload className="h-3.5 w-3.5" /> Kapak Yükle
              </button>
            </div>
            {/* Logo */}
            <div>
              <p className="text-sm font-semibold text-ink-700 mb-2">Logo</p>
              <div className="relative h-28 rounded-xl overflow-hidden bg-ink-100 mb-2 flex items-center justify-center">
                {data.logo ? <img src={data.logo} alt="" className="h-20 w-20 object-cover rounded-xl" /> : <div className="text-ink-300 text-xs">Henüz yok</div>}
                {uploadingField === 'logo' && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={(e) => handleImg(e, 'logo', logoRef)} className="hidden" />
              <button onClick={() => logoRef.current?.click()} className="btn-outline w-full text-sm" disabled={!!uploadingField}>
                <Upload className="h-3.5 w-3.5" /> Logo Yükle
              </button>
            </div>
          </div>
        </div>

        {/* Marka rengi */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2 mb-3"><Palette className="h-4 w-4 text-brand-500" /> Marka Rengi</h3>
          <div className="flex flex-wrap gap-2.5 mb-3">
            {BRAND_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => set('brandColor', c)}
                className="h-9 w-9 rounded-full border-4 transition-transform hover:scale-110 cursor-pointer"
                style={{ background: c, borderColor: data.brandColor === c ? c : 'transparent', outline: data.brandColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-ink-600">Özel renk:</label>
            <input type="color" value={data.brandColor || '#f97316'} onChange={(e) => set('brandColor', e.target.value)} className="h-9 w-16 rounded-lg border border-ink-200 cursor-pointer p-0.5" />
            <span className="text-sm text-ink-400">{data.brandColor || '#f97316'}</span>
          </div>
        </div>

        {/* Menü şablonu — 4 gerçek tasarım dili */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2 mb-1">
            <LayoutTemplate className="h-4 w-4 text-brand-500" /> Menü Şablonu
          </h3>
          <p className="text-sm text-ink-400 mb-4">Müşterinin QR ile açtığı menünün tasarımı. Her şablon kendi font, düzen ve karakterinde. Seç, "Profili Kaydet"e bas.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TEMPLATE_LIST.map(tpl => {
              const active = (data.template || 'vitrin') === tpl.id
              const brand = data.brandColor && data.brandColor.toLowerCase() !== '#f97316' ? data.brandColor : tpl.accent
              return (
                <button
                  key={tpl.id}
                  onClick={() => set('template', tpl.id)}
                  className="rounded-2xl overflow-hidden border-2 transition-all cursor-pointer relative text-left"
                  style={{ borderColor: active ? brand : 'transparent', outline: active ? 'none' : '1px solid #e2e8f0' }}
                  title={tpl.name}
                >
                  {/* Şablon önizlemesi */}
                  <div style={{ background: tpl.bg, padding: '10px 10px 12px' }}>
                    {/* hero şeridi */}
                    <div style={{ height: 26, borderRadius: Math.min(tpl.radius, 10), background: tpl.heroFallback || tpl.surface, border: `1px solid ${tpl.surfaceBorder}`, marginBottom: 8, display:'flex', alignItems:'center', paddingLeft:8 }}>
                      <span style={{ fontFamily: tpl.fontDisplay, fontSize: 10, fontWeight: 700, color: tpl.heroFallback ? '#fff' : tpl.text }}>Aa</span>
                    </div>
                    {/* iki mini kart */}
                    {tpl.cardLayout === 'editorial' ? (
                      <div>
                        {[0,1].map(i => (
                          <div key={i} style={{ display:'flex', alignItems:'baseline', gap:4, padding:'3px 0', borderBottom:`1px solid ${tpl.divider}` }}>
                            <span style={{ fontFamily:tpl.fontDisplay, fontSize:8, color:tpl.text }}>Ürün</span>
                            <span style={{ flex:1, borderBottom:`1px dotted ${tpl.divider}` }} />
                            <span style={{ fontSize:8, color:brand, fontWeight:700 }}>₺</span>
                          </div>
                        ))}
                      </div>
                    ) : tpl.cardLayout === 'zarif' ? (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                        {[0,1].map(i => <div key={i} style={{ height:26, borderRadius:tpl.radius/2, background:tpl.surface, border:`1px solid ${tpl.surfaceBorder}` }} />)}
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                        {[0,1].map(i => <div key={i} style={{ height:18, borderRadius:Math.min(tpl.radius,8), background:tpl.surface, border:`1px solid ${tpl.surfaceBorder}` }} />)}
                      </div>
                    )}
                  </div>
                  <div className="py-2 px-2 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-ink-800 block leading-none">{tpl.name}</span>
                      {active && <span className="h-4 w-4 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0" style={{ background: brand }}>✓</span>}
                    </div>
                    <span className="text-[9px] text-ink-400 block mt-1">{tpl.ideal}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* İletişim */}
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-bold text-ink-800 mb-1">İletişim & Bilgiler (menüde gösterilir)</h3>
          <label className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ink-400 shrink-0" />
            <input className="inp" value={data.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Adres" />
          </label>
          <label className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-ink-400 shrink-0" />
            <input className="inp" value={data.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="Telefon" />
          </label>
          <label className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-ink-400 shrink-0" />
            <input className="inp" value={data.wifi || ''} onChange={(e) => set('wifi', e.target.value)} placeholder="Wi-Fi şifresi (isteğe bağlı)" />
          </label>
          <label className="flex items-center gap-2">
            <Instagram className="h-4 w-4 text-ink-400 shrink-0" />
            <input className="inp" value={data.instagramHandle || ''} onChange={(e) => set('instagramHandle', e.target.value)} placeholder="Instagram kullanıcı adı (@'siz)" />
          </label>
        </div>

        {/* Duyuru bandı */}
        <div className="card p-5 space-y-2">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-brand-500" /> Duyuru Bandı
          </h3>
          <p className="text-sm text-ink-400">Menünün üstünde çıkan tek satırlık kampanya/duyuru. Boş bırakırsan gösterilmez.</p>
          <input className="inp" value={data.announcement || ''} onChange={(e) => set('announcement', e.target.value)} placeholder="örn. Bugün künefe %20 indirimli!" maxLength={90} />
        </div>

        {/* Çalışma saatleri */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-500" /> Çalışma Saatleri
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!data.hoursEnabled} onChange={(e) => set('hoursEnabled', e.target.checked)} className="h-4 w-4 accent-brand-500" />
              <span className="text-sm font-medium text-ink-600">Aktif</span>
            </label>
          </div>
          <p className="text-sm text-ink-400 mb-3">Kapalı saatlerde menü görünür ama sipariş kilitlenir ("Şu an kapalıyız").</p>
          <div className={`grid grid-cols-2 gap-3 ${data.hoursEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 mb-1 block">Açılış</span>
              <input type="time" className="inp" value={data.hoursOpen || '09:00'} onChange={(e) => set('hoursOpen', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 mb-1 block">Kapanış</span>
              <input type="time" className="inp" value={data.hoursClose || '23:00'} onChange={(e) => set('hoursClose', e.target.value)} />
            </label>
          </div>
        </div>

        {/* Google yorum */}
        <div className="card p-5 space-y-2">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
            <Star className="h-4 w-4 text-brand-500" /> Google Yorum Yönlendirme
          </h3>
          <p className="text-sm text-ink-400">Sipariş sonrası 5 yıldız verenler Google'a yönlendirilir, düşük puan içeride kalır. Google işletme profilinizin "yorum yaz" linkini yapıştırın.</p>
          <input className="inp" value={data.googleReviewUrl || ''} onChange={(e) => set('googleReviewUrl', e.target.value)} placeholder="https://g.page/r/... (Google yorum linki)" />
        </div>

        {/* Yazıcı / Fiş */}
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
            <Printer className="h-4 w-4 text-brand-500" /> Fiş / Adisyon Yazıcısı
          </h3>
          <p className="text-sm text-ink-400">
            Kasa ekranında her siparişin yanında <b>🖨 adisyon</b> (mutfak) ve servis edilenlerde <b>Fiş</b> (müşteri hesabı) butonu vardır. 80mm termal yazıcıya da normal yazıcıya da basar.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 cursor-pointer">
            <span className="text-sm font-medium text-ink-700">Yeni sipariş gelince mutfak adisyonunu <b>otomatik</b> yazdır</span>
            <input type="checkbox" checked={!!data.printAuto} onChange={(e) => set('printAuto', e.target.checked)} className="h-4 w-4 accent-brand-500 shrink-0" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 cursor-pointer">
            <span className="text-sm font-medium text-ink-700">Hesap kapanınca müşteri fişini <b>otomatik</b> yazdır</span>
            <input type="checkbox" checked={!!data.printBillOnPay} onChange={(e) => set('printBillOnPay', e.target.checked)} className="h-4 w-4 accent-brand-500 shrink-0" />
          </label>
          <p className="text-xs text-ink-400 leading-relaxed">
            💡 <b>Sessiz (diyalogsuz) otomatik baskı için:</b> kasa bilgisayarında Chrome'u "kiosk printing" ile açın — masaüstü kısayoluna sağ tık → Hedef sonuna <code className="bg-ink-100 px-1 rounded">--kiosk-printing</code> ekleyin. Aksi halde her baskıda yazdırma penceresi açılır.
          </p>
        </div>

        {/* Stok takibi — istemeyen işletme tek tıkla kapatır */}
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-brand-500" /> Stok Takibi
          </h3>
          <p className="text-sm text-ink-400">
            Açıkken malzemelerinizi tanımlayıp ürünlere reçete bağlayabilirsiniz; sipariş girildiğinde
            stok otomatik düşer. Uğraşmak istemiyorsanız kapatın — stok ekranları ve reçete alanı gizlenir,
            siparişler normal şekilde işlemeye devam eder.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 cursor-pointer">
            <span className="text-sm font-medium text-ink-700">
              Stok takibi ve otomatik düşüm <b>{data.stockTracking === false ? 'kapalı' : 'açık'}</b>
            </span>
            <input
              type="checkbox"
              checked={data.stockTracking !== false}
              onChange={(e) => set('stockTracking', e.target.checked)}
              className="h-4 w-4 accent-brand-500 shrink-0"
            />
          </label>
          {data.stockTracking === false && (
            <p className="text-xs text-amber-600 leading-relaxed">
              ⚠️ Kapalıyken siparişler stoktan düşmez. Girdiğiniz stok kartları ve reçeteler silinmez —
              tekrar açtığınızda kaldığı yerden devam eder.
            </p>
          )}
        </div>

        {/* Mutfak & Hazırlık Modu */}
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-brand-500" /> Mutfak & Hazırlık Modu
          </h3>
          <p className="text-sm text-ink-400">
            Açıkken masadan gelen siparişler 'Mutfakta' aşamasına gider ve mutfak adisyonu basılabilir.
            Kapalıyken mutfak adımı gizlenir; sipariş doğrudan hazır/servis aşamasına geçer.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 cursor-pointer">
            <span className="text-sm font-medium text-ink-700">
              Mutfak Takibi: <b>{data.kitchenEnabled === false ? 'Kapalı' : 'Açık'}</b>
            </span>
            <input
              type="checkbox"
              checked={data.kitchenEnabled !== false}
              onChange={(e) => set('kitchenEnabled', e.target.checked)}
              className="h-4 w-4 accent-brand-500 shrink-0"
            />
          </label>
        </div>

        {/* Müşteri QR Siparişi (Sadece Menü Modu) */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-brand-500" /> Müşteri QR Siparişi
            </h3>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${data.orderingEnabled !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {data.orderingEnabled !== false ? 'Sipariş Açık' : 'Sadece Menü'}
            </span>
          </div>
          <p className="text-sm text-ink-400">
            <b>Açık:</b> Müşteriler masadaki QR kodu okutarak sepete ürün ekleyebilir, sipariş verebilir, garson çağırabilir ve hesap isteyebilir.<br/>
            <b>Kapalı (Sadece Menü):</b> Müşteriler yalnızca ürünleri ve fiyatları görüntüler (katalog modu). Sepet, sipariş verme, garson çağırma ve hesap isteme düğmeleri tamamen gizlenir.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 cursor-pointer">
            <span className="text-sm font-medium text-ink-700">
              Müşteri masadan sipariş verebilsin: <b>{data.orderingEnabled !== false ? 'Açık' : 'Kapalı (Sadece Menü)'}</b>
            </span>
            <input
              type="checkbox"
              checked={data.orderingEnabled !== false}
              onChange={(e) => set('orderingEnabled', e.target.checked)}
              className="h-4 w-4 accent-brand-500 shrink-0"
            />
          </label>
          {data.orderingEnabled === false && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <span>ℹ️</span>
              <span><b>Sadece Menü Modu Devrede:</b> Müşterileriniz QR menüyü inceleyebilir ancak sipariş veremez veya çağrı yapamaz. Bu ayarı sadece Yönetim değiştirebilir.</span>
            </div>
          )}
        </div>

        <LoyaltySettings value={data.loyalty} onChange={value => set('loyalty',value)} />
        {saveError && <p role="alert" className="text-red-700 text-sm">{saveError}</p>}
        <button
          onClick={save}
          disabled={saving || !form}
          className="btn-primary w-full !py-3.5"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saved ? 'Kaydedildi!' : 'Profili Kaydet'}
        </button>
      </div>
    </div>
  )
}
