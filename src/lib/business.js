// İşletme kimliği yönetimi
// URL: /menu?isletme=cafe-xyz&masa=5
// Kasa ve yönetim: /kasa?isletme=cafe-xyz  ya da localStorage'dan hatırla
//
// Her veri yolu /businesses/{businessId}/... altına düşer.
// Böylece 1000 işletme aynı Firebase projesini paylaşır, veriler karışmaz.

const LS_KEY = 'sofra_business_id'
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 120 && !/[.#$\[\]\/\u0000-\u001f\u007f]/u.test(value)

// URL'den veya localStorage'dan businessId al
export function getBusinessId() {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('isletme')
  if (params.has('isletme')) {
    if (!validId(fromUrl)) return null
    // Bir sonraki ziyaret için kaydet (kasa/yönetim için)
    try { localStorage.setItem(LS_KEY, fromUrl) } catch {}
    return fromUrl
  }
  // Customer QR links must carry their own tenant, never inherit another cafe.
  if (window.location.pathname === '/menu') return null
  try { const id = localStorage.getItem(LS_KEY); return validId(id) ? id : null } catch {}
  return null
}

// İşletme kök yolu — tüm veri buraya yazılır
export function bizRoot(businessId) {
  if (!validId(businessId)) throw new Error('Geçersiz işletme kimliği')
  return `businesses/${businessId}`
}

// Geçersiz businessId durumunda gösterilecek hata
export const NO_BUSINESS_ERROR = 'İşletme bulunamadı. URL\'de ?isletme=... parametresi eksik.'
