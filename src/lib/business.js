// İşletme kimliği yönetimi
// URL: /menu?isletme=cafe-xyz&masa=5
// Kasa ve yönetim: /kasa?isletme=cafe-xyz  ya da localStorage'dan hatırla
//
// Her veri yolu /businesses/{businessId}/... altına düşer.
// Böylece 1000 işletme aynı Firebase projesini paylaşır, veriler karışmaz.

const LS_KEY = 'sofra_business_id'
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 120 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)

export function normalizeBizId(val) {
  if (!val || typeof val !== 'string') return ''
  return val
    .trim()
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// URL'den veya localStorage'dan businessId al
export function getBusinessId() {
  const params = new URLSearchParams(window.location.search)
  const rawFromUrl = params.get('isletme')
  const fromUrl = rawFromUrl ? (normalizeBizId(rawFromUrl) || rawFromUrl) : null

  if (params.has('isletme')) {
    if (!validId(fromUrl)) return null
    // Bir sonraki ziyaret için kaydet (kasa/yönetim için)
    try { localStorage.setItem(LS_KEY, fromUrl) } catch {}
    return fromUrl
  }
  // Customer QR links must carry their own tenant, never inherit another cafe.
  if (window.location.pathname === '/menu') return null
  try {
    const id = localStorage.getItem(LS_KEY)
    const norm = id ? (normalizeBizId(id) || id) : null
    return validId(norm) ? norm : null
  } catch {}
  return null
}

// İşletme kök yolu — tüm veri buraya yazılır
export function bizRoot(businessId) {
  if (!validId(businessId)) throw new Error('Geçersiz işletme kimliği')
  return `businesses/${businessId}`
}

// Geçersiz businessId durumunda gösterilecek hata
export const NO_BUSINESS_ERROR = 'İşletme bulunamadı. URL\'de ?isletme=... parametresi eksik.'