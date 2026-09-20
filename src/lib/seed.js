// Başlangıç menüsü — DB boşsa bir kez yüklenir.
// Ürünler FOTOĞRAFSIZ başlar: işletme sahibi yönetim panelinden kendi
// gerçek fotoğrafını yükler ya da AI ile ürettirir. Böylece demo/başlangıç
// menüsünde ürünle alakasız stok görsel çıkmaz — kartlar temiz ve tutarlı.
//
// Her kategorinin kendine özel "hızlı not" şablonu vardır (notes):
// içeceğe "az pişmiş" değil "buzsuz/şekersiz" gibi anlamlı seçenekler çıkar.

import { IS_DEMO, readValue, setValue } from './db'

// Başlangıçta görsel yok — sahip kendi fotoğrafını ekleyene kadar kartlar
// şablonun renk/tipografi düzeniyle (fotoğrafsız) gösterilir.
const img = () => ''

export const SEED_CATEGORIES = [
  { id: 'kahve', name: 'Kahveler', order: 1,
    notes: ['Şekersiz', 'Az şekerli', 'Orta şekerli', 'Çok şekerli', 'Ekstra shot', 'Sütlü', 'Soğuk süt', 'Yanında su'] },
  { id: 'sicak', name: 'Sıcak İçecekler', order: 2,
    notes: ['Şekersiz', 'Az şekerli', 'Açık', 'Demli', 'Ekstra sıcak', 'Ballı', 'Limonlu'] },
  { id: 'soguk', name: 'Soğuk İçecekler', order: 3,
    notes: ['Buzsuz', 'Ekstra buz', 'Az şekerli', 'Şekersiz', 'Limon ilave', 'Pipetsiz'] },
  { id: 'nargile', name: 'Nargile', order: 4,
    notes: ['Buzlu başlık', 'Çift aparat', 'Sütlü başlık', 'Az közlü', 'Ekstra köz', 'Soğuk su haznesi'] },
  { id: 'atistirma', name: 'Atıştırmalıklar', order: 5,
    notes: ['Az tuzlu', 'Acısız', 'Ekstra sos', 'Sossuz', 'Baharatsız', 'Bol kızarmış'] },
  { id: 'tost', name: 'Tost & Sandviç', order: 6,
    notes: ['Az kızarmış', 'Çok kızarmış', 'Acısız', 'Sossuz', 'Soğansız', 'Domatessiz', 'Baharatsız'] },
  { id: 'burger', name: 'Burgerler', order: 7,
    notes: ['Soğansız', 'Turşusuz', 'Acısız', 'Ekstra sos', 'Az pişmiş', 'Çok pişmiş', 'Marulsuz', 'Ekstra peynir'] },
  { id: 'pizza', name: 'Pizzalar', order: 8,
    notes: ['İnce hamur', 'Kalın hamur', 'Acısız', 'Soğansız', 'Ekstra peynir', 'Sarımsaksız', 'Mantarsız'] },
  { id: 'makarna', name: 'Makarna & Salata', order: 9,
    notes: ['Acısız', 'Az soslu', 'Ekstra sos', 'Ekstra peynir', 'Baharatsız', 'Soğansız', 'Sos ayrı'] },
  { id: 'tatli', name: 'Tatlılar', order: 10,
    notes: ['Az şekerli', 'Ekstra dondurma', 'Servis ayrı', 'Sıcak servis', 'Fıstıksız', 'Çikolata sosu ekstra'] },
]

export const SEED_PRODUCTS = [
  // Kahveler
  { categoryId: 'kahve', name: 'Espresso', desc: 'Tek shot, yoğun aroma', price: 50, image: img(), available: true, order: 1 },
  { categoryId: 'kahve', name: 'Türk Kahvesi', desc: 'Közde, lokumla', price: 55, image: img(), available: true, order: 2 },
  { categoryId: 'kahve', name: 'Americano', desc: 'Espresso + sıcak su', price: 65, image: img(), available: true, order: 3 },
  { categoryId: 'kahve', name: 'Latte', desc: 'Bol sütlü, kremsi', price: 75, image: img(), available: true, order: 4 },
  { categoryId: 'kahve', name: 'Cappuccino', desc: 'Köpüklü klasik', price: 75, image: img(), available: true, order: 5 },
  { categoryId: 'kahve', name: 'Filtre Kahve', desc: 'Günün çekirdeği', price: 60, image: img(), available: true, order: 6 },
  { categoryId: 'kahve', name: 'Mocha', desc: 'Çikolatalı kahve', price: 85, image: img(), available: true, order: 7 },

  // Sıcak İçecekler
  { categoryId: 'sicak', name: 'Çay', desc: 'Demli, ince belli bardak', price: 20, image: img(), available: true, order: 1 },
  { categoryId: 'sicak', name: 'Bitki Çayı', desc: 'Ihlamur / nane-limon', price: 35, image: img(), available: true, order: 2 },
  { categoryId: 'sicak', name: 'Sahlep', desc: 'Tarçınlı, kış klasiği', price: 55, image: img(), available: true, order: 3 },
  { categoryId: 'sicak', name: 'Sıcak Çikolata', desc: 'Yoğun belçika çikolatası', price: 70, image: img(), available: true, order: 4 },

  // Soğuk İçecekler
  { categoryId: 'soguk', name: 'Ev Limonatası', desc: 'Naneli, buz gibi', price: 60, image: img(), available: true, order: 1 },
  { categoryId: 'soguk', name: 'Frappe', desc: 'Buzlu köpüklü kahve', price: 80, image: img(), available: true, order: 2 },
  { categoryId: 'soguk', name: 'Milkshake', desc: 'Çikolata / çilek / muz', price: 90, image: img(), available: true, order: 3 },
  { categoryId: 'soguk', name: 'Meyveli Smoothie', desc: 'Mevsim meyveleri', price: 95, image: img(), available: true, order: 4 },
  { categoryId: 'soguk', name: 'Ayran', desc: 'Köpüklü, geleneksel', price: 35, image: img(), available: true, order: 5 },
  { categoryId: 'soguk', name: 'Soğuk Kahve', desc: 'Buzlu latte', price: 90, image: img(), available: true, order: 6 },
  { categoryId: 'soguk', name: 'Meşrubat', desc: 'Kola / fanta / soda', price: 45, image: img(), available: true, order: 7 },

  // Nargile
  { categoryId: 'nargile', name: 'Nargile (Klasik)', desc: 'Çift elma, tek aparat', price: 250, image: img(), available: true, order: 1 },
  { categoryId: 'nargile', name: 'Nargile (Aromalı)', desc: 'Nane, karpuz, vişne, mojito', price: 280, image: img(), available: true, order: 2 },
  { categoryId: 'nargile', name: 'Nargile (Premium)', desc: 'Buzlu başlık, özel harman', price: 350, image: img(), available: true, order: 3 },

  // Atıştırmalıklar
  { categoryId: 'atistirma', name: 'Çıtır Patates', desc: 'Baharatlı, soslu', price: 75, image: img(), available: true, order: 1 },
  { categoryId: 'atistirma', name: 'Soğan Halkası', desc: 'Çıtır, ranch sos', price: 80, image: img(), available: true, order: 2 },
  { categoryId: 'atistirma', name: 'Nachos', desc: 'Cheddar, jalapeño, salsa', price: 110, image: img(), available: true, order: 3 },
  { categoryId: 'atistirma', name: 'Sigara Böreği', desc: 'Beyaz peynirli (6 adet)', price: 95, image: img(), available: true, order: 4 },
  { categoryId: 'atistirma', name: 'Çıtır Tavuk', desc: '6 parça, soslu', price: 130, image: img(), available: true, order: 5 },

  // Tost & Sandviç
  { categoryId: 'tost', name: 'Kaşarlı Tost', desc: 'Bol kaşar', price: 70, image: img(), available: true, order: 1 },
  { categoryId: 'tost', name: 'Karışık Tost', desc: 'Sucuk + kaşar', price: 90, image: img(), available: true, order: 2 },
  { categoryId: 'tost', name: 'Club Sandviç', desc: 'Tavuk, marul, patates', price: 140, image: img(), available: true, order: 3 },
  { categoryId: 'tost', name: 'Ton Balıklı Sandviç', desc: 'Mısır, mayonez', price: 120, image: img(), available: true, order: 4 },

  // Burgerler
  { categoryId: 'burger', name: 'Klasik Cheeseburger', desc: '180g köfte, cheddar', price: 210, image: img(), available: true, order: 1 },
  { categoryId: 'burger', name: 'Double Burger', desc: 'Çift köfte, çift peynir', price: 265, image: img(), available: true, order: 2 },
  { categoryId: 'burger', name: 'Tavuk Burger', desc: 'Çıtır tavuk, ranch', price: 195, image: img(), available: true, order: 3 },

  // Pizzalar
  { categoryId: 'pizza', name: 'Margherita', desc: 'Mozzarella, fesleğen', price: 195, image: img(), available: true, order: 1 },
  { categoryId: 'pizza', name: 'Sucuklu', desc: 'Bol sucuk, kaşar', price: 215, image: img(), available: true, order: 2 },
  { categoryId: 'pizza', name: 'Karışık', desc: 'Sucuk, mantar, biber', price: 230, image: img(), available: true, order: 3 },

  // Makarna & Salata
  { categoryId: 'makarna', name: 'Penne Arrabiata', desc: 'Acılı domates sos', price: 160, image: img(), available: true, order: 1 },
  { categoryId: 'makarna', name: 'Spagetti Bolonez', desc: 'Kıymalı klasik', price: 185, image: img(), available: true, order: 2 },
  { categoryId: 'makarna', name: 'Tereyağlı Makarna', desc: 'Kremalı mantar sos', price: 150, image: img(), available: true, order: 3 },
  { categoryId: 'makarna', name: 'Sezar Salata', desc: 'Tavuk, parmesan, kruton', price: 130, image: img(), available: true, order: 4 },
  { categoryId: 'makarna', name: 'Mevsim Salata', desc: 'Taze yeşillik, nar ekşisi', price: 90, image: img(), available: true, order: 5 },

  // Tatlılar
  { categoryId: 'tatli', name: 'San Sebastian', desc: 'Bambaşka bir cheesecake', price: 130, image: img(), available: true, order: 1 },
  { categoryId: 'tatli', name: 'Tiramisu', desc: 'İtalyan klasiği, kakao ile', price: 120, image: img(), available: true, order: 2 },
  { categoryId: 'tatli', name: 'Brownie', desc: 'Sıcak, dondurmalı', price: 110, image: img(), available: true, order: 3 },
  { categoryId: 'tatli', name: 'Belçika Waffle', desc: 'Meyveli, çikolatalı', price: 120, image: img(), available: true, order: 4 },
  { categoryId: 'tatli', name: 'Künefe', desc: 'Sıcak, antep fıstıklı', price: 140, image: img(), available: true, order: 5 },
  { categoryId: 'tatli', name: 'Sufle', desc: 'Akışkan çikolata', price: 115, image: img(), available: true, order: 6 },
  { categoryId: 'tatli', name: 'Dondurma', desc: '3 top, çeşit çeşit', price: 70, image: img(), available: true, order: 7 },
]

// Varsayılan masa sayısı
export const DEFAULT_TABLE_COUNT = 50

// Varsayılan işletme profili — yönetim panelinden özelleştirilebilir
export const DEFAULT_PROFILE = {
  name: 'Lezzet Kafe',
  tagline: 'Lezzet masanıza gelsin',
  cover: '',              // kapak fotoğrafı (boşsa şablonun renk gradyanı gösterilir)
  logo: '',               // logo URL (boşsa baş harf gösterilir)
  brandColor: '#f97316',  // marka rengi (vurgu)
  template: 'vitrin',     // menü şablonu: vitrin|editorial|zarif|gece
  address: '',
  phone: '',
  wifi: '',               // wifi şifresi (isteğe bağlı, menüde gösterilir)
  instagramHandle: '',    // @hesap (isteğe bağlı)
  announcement: '',       // menü üstü duyuru bandı
  hoursEnabled: false,    // çalışma saati kısıtı aktif mi
  hoursOpen: '09:00',
  hoursClose: '23:00',
  googleReviewUrl: '',    // 5 yıldız → Google yönlendirme linki
  printAuto: false,       // yeni sipariş gelince mutfak adisyonunu otomatik yazdır
  printBillOnPay: false,  // hesap kapanınca müşteri fişini otomatik yazdır
}

// Ürün etiketleri (alerjen / içerik) — müşteri menüsünde rozet olarak görünür
export const PRODUCT_TAGS = [
  { key: 'vegan',     label: 'Vegan',     color: '#16a34a' },
  { key: 'vejetaryen',label: 'Vejetaryen',color: '#22c55e' },
  { key: 'aci',       label: 'Acı',       color: '#dc2626' },
  { key: 'glutensiz', label: 'Glutensiz', color: '#d97706' },
  { key: 'laktozsuz', label: 'Laktozsuz', color: '#0891b2' },
  { key: 'sekersiz',  label: 'Şekersiz',  color: '#7c3aed' },
]
export const TAG_MAP = PRODUCT_TAGS.reduce((m, t) => { m[t.key] = t; return m }, {})

// 14 standart AB/Türkiye alerjen listesi — 1 Temmuz 2026 Fiyat Etiketi Yönetmeliği
// kapsamında menülerde belirtilmesi zorunlu alerjenler.
export const ALLERGENS = [
  { key: 'gluten',        label: 'Gluten' },
  { key: 'kabuklu_deniz', label: 'Kabuklu Deniz Ürünleri' },
  { key: 'yumurta',       label: 'Yumurta' },
  { key: 'balik',         label: 'Balık' },
  { key: 'yer_fistigi',   label: 'Yer Fıstığı' },
  { key: 'soya',          label: 'Soya' },
  { key: 'sut',           label: 'Süt' },
  { key: 'kabuklu_yemis', label: 'Kabuklu Yemişler' },
  { key: 'kereviz',       label: 'Kereviz' },
  { key: 'hardal',        label: 'Hardal' },
  { key: 'susam',         label: 'Susam' },
  { key: 'sulfit',        label: 'Sülfitler' },
  { key: 'bakla',         label: 'Acı Bakla (Lupin)' },
  { key: 'yumusakca',     label: 'Yumuşakçalar' },
]
export const ALLERGEN_MAP = ALLERGENS.reduce((m, a) => { m[a.key] = a; return m }, {})

// ───────── MENÜ TEMALARI ─────────
// Müşteri QR okutunca açılan dijital menünün görünüm teması.
// İşletme sahibi yönetim panelinden tek tıkla değiştirir.
// Marka rengi (brandColor) ayrı bir vurgu rengidir — tema arka plan/atmosfer verir.

// Ortak koyu taban — koyu temalar sadece bg/sticky/sheet override eder.
const DARK_BASE = {
  dark: true,
  surface: 'rgba(255,255,255,.05)', surfaceBorder: 'rgba(255,255,255,.07)', surfaceHover: 'rgba(255,255,255,.09)',
  text: '#ffffff', textMuted: 'rgba(255,255,255,.45)', textFaint: 'rgba(255,255,255,.28)',
  inputBg: 'rgba(255,255,255,.06)', inputBorder: 'rgba(255,255,255,.1)', divider: 'rgba(255,255,255,.08)',
  tabBorder: 'rgba(255,255,255,.12)', tabText: 'rgba(255,255,255,.5)',
  cardShadow: 'none', fab: 'rgba(255,255,255,.08)', fabBorder: 'rgba(255,255,255,.12)',
}
// Ortak açık taban.
const LIGHT_BASE = {
  dark: false,
  surface: '#ffffff', surfaceBorder: 'rgba(0,0,0,.06)', surfaceHover: '#faf9f7',
  text: '#171717', textMuted: 'rgba(0,0,0,.5)', textFaint: 'rgba(0,0,0,.35)',
  inputBg: 'rgba(0,0,0,.04)', inputBorder: 'rgba(0,0,0,.1)', divider: 'rgba(0,0,0,.07)',
  tabBorder: 'rgba(0,0,0,.12)', tabText: 'rgba(0,0,0,.5)',
  cardShadow: '0 1px 3px rgba(0,0,0,.06), 0 6px 16px rgba(0,0,0,.04)',
  fab: '#ffffff', fabBorder: 'rgba(0,0,0,.06)',
}

// Her tema: bg (sayfa arka planı, gradient olabilir), bgSolid (fade/sticky için düz renk),
// heroFallback (kapak fotoğrafı yoksa gösterilen CANLI gradient), accent (temanın imza rengi).
export const MENU_THEMES = [
  // ─── KOYU TEMALAR ───
  { id: 'dark', name: 'Gece', tone: 'koyu', ...DARK_BASE,
    bg: 'linear-gradient(180deg,#111114 0%,#0a0a0c 100%)', bgSolid: '#0b0b0d',
    sticky: 'rgba(12,12,14,.9)', sheet: '#161616', accent: '#f97316',
    heroFallback: 'linear-gradient(135deg,#434343 0%,#000000 100%)' },

  { id: 'sunset', name: 'Gün Batımı', tone: 'koyu', ...DARK_BASE,
    bg: 'linear-gradient(180deg,#2a1220 0%,#1a0b16 100%)', bgSolid: '#1a0b16',
    sticky: 'rgba(26,11,22,.9)', sheet: '#241019', accent: '#ff6a88',
    surface: 'rgba(255,180,200,.06)', surfaceBorder: 'rgba(255,150,180,.12)',
    heroFallback: 'linear-gradient(135deg,#ff6b6b 0%,#c44569 50%,#6c5ce7 100%)' },

  { id: 'ocean', name: 'Okyanus', tone: 'koyu', ...DARK_BASE,
    bg: 'linear-gradient(180deg,#0d2236 0%,#081521 100%)', bgSolid: '#081521',
    sticky: 'rgba(8,21,33,.9)', sheet: '#0f2233', accent: '#38d0c7',
    surface: 'rgba(160,210,255,.06)', surfaceBorder: 'rgba(150,210,255,.13)',
    heroFallback: 'linear-gradient(135deg,#0093E9 0%,#80D0C7 100%)' },

  { id: 'neon', name: 'Neon', tone: 'koyu', ...DARK_BASE,
    bg: 'linear-gradient(180deg,#1a1230 0%,#100a20 100%)', bgSolid: '#100a20',
    sticky: 'rgba(16,10,32,.9)', sheet: '#1a1230', accent: '#c400ff',
    surface: 'rgba(220,160,255,.07)', surfaceBorder: 'rgba(210,140,255,.15)',
    heroFallback: 'linear-gradient(135deg,#7f00ff 0%,#e100ff 100%)' },

  { id: 'emerald', name: 'Zümrüt', tone: 'koyu', ...DARK_BASE,
    bg: 'linear-gradient(180deg,#0d2a1f 0%,#08190f 100%)', bgSolid: '#08190f',
    sticky: 'rgba(8,25,15,.9)', sheet: '#0f2a1e', accent: '#2ce69b',
    surface: 'rgba(160,255,210,.06)', surfaceBorder: 'rgba(140,255,200,.13)',
    heroFallback: 'linear-gradient(135deg,#11998e 0%,#38ef7d 100%)' },

  { id: 'wine', name: 'Şarap', tone: 'koyu', ...DARK_BASE,
    bg: 'linear-gradient(180deg,#2a0f18 0%,#180810 100%)', bgSolid: '#180810',
    sticky: 'rgba(24,8,16,.9)', sheet: '#26101a', accent: '#e63960',
    surface: 'rgba(255,170,190,.06)', surfaceBorder: 'rgba(255,140,170,.13)',
    heroFallback: 'linear-gradient(135deg,#870000 0%,#c31432 100%)' },

  // ─── AÇIK TEMALAR ───
  { id: 'light', name: 'Ferah', tone: 'açık', ...LIGHT_BASE,
    bg: 'linear-gradient(180deg,#faf9f7 0%,#f2efe9 100%)', bgSolid: '#f7f5f2',
    sticky: 'rgba(247,245,242,.92)', sheet: '#ffffff', accent: '#f97316',
    heroFallback: 'linear-gradient(135deg,#c9d6ff 0%,#e2e2e2 100%)' },

  { id: 'peach', name: 'Şeftali', tone: 'açık', ...LIGHT_BASE,
    bg: 'linear-gradient(180deg,#fff5ef 0%,#ffe9de 100%)', bgSolid: '#fff2ea',
    sticky: 'rgba(255,242,234,.92)', sheet: '#fffaf6', accent: '#ff6a88',
    surface: '#fffaf6', surfaceBorder: 'rgba(220,120,90,.12)',
    heroFallback: 'linear-gradient(135deg,#ff9a56 0%,#ff6a88 100%)' },

  { id: 'mint', name: 'Nane', tone: 'açık', ...LIGHT_BASE,
    bg: 'linear-gradient(180deg,#f0fbf6 0%,#e2f6ee 100%)', bgSolid: '#eaf8f2',
    sticky: 'rgba(234,248,242,.92)', sheet: '#f7fdfa', accent: '#12b886',
    surface: '#f7fdfa', surfaceBorder: 'rgba(30,160,120,.12)',
    heroFallback: 'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)' },

  { id: 'lavender', name: 'Lavanta', tone: 'açık', ...LIGHT_BASE,
    bg: 'linear-gradient(180deg,#f8f4ff 0%,#efe6ff 100%)', bgSolid: '#f4ecff',
    sticky: 'rgba(244,236,255,.92)', sheet: '#fbf8ff', accent: '#9775fa',
    surface: '#fbf8ff', surfaceBorder: 'rgba(150,110,220,.14)',
    heroFallback: 'linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%)' },
]
export const THEME_MAP = MENU_THEMES.reduce((m, t) => { m[t.id] = t; return m }, {})
// Geriye dönük uyumluluk + güvenli varsayılan
export const getMenuTheme = (id) => THEME_MAP[id] || THEME_MAP.dark

export function buildSeedData() {
  const categories = {}
  SEED_CATEGORIES.forEach((c) => {
    const { id, ...rest } = c
    categories[id] = rest
  })

  const products = {}
  SEED_PRODUCTS.forEach((p, i) => {
    products['p' + (i + 1)] = p
  })

  const tables = {}
  for (let i = 1; i <= DEFAULT_TABLE_COUNT; i++) {
    tables['masa' + i] = { no: i, name: 'Masa ' + i }
  }

  return { categories, products, tables, profile: DEFAULT_PROFILE, seededAt: Date.now() }
}

// Production reads never create or reset a customer's menu. Provisioning is
// explicit; only the local demo is allowed to generate sample data.
export async function ensureSeeded(bizId) {
  const base = `businesses/${bizId}/menu`
  const profile = await readValue(`${base}/profile`)
  if (profile?.name) return true
  if (!IS_DEMO || bizId !== 'demo') return false
  await setValue(base, buildSeedData())
  return true
}

// Varsayılan hızlı notlar (kategori notu yoksa)
export const DEFAULT_NOTES = ['Az tuzlu', 'Acısız', 'Servis ayrı']
