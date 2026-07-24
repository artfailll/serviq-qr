// İşletme kimliği yönetimi
// URL: /menu?isletme=cafe-xyz&masa=5
// Kasa ve yönetim: /kasa?isletme=cafe-xyz  ya da localStorage'dan hatırla
//
// Her veri yolu /businesses/{businessId}/... altına düşer.
// Böylece 1000 işletme aynı Firebase projesini paylaşır, veriler karışmaz.

const LS_KEY = 'sofra_business_id'

// URL'den veya localStorage'dan businessId al
export function getBusinessId() {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('isletme')
  if (fromUrl) {
    // Bir sonraki ziyaret için kaydet (kasa/yönetim için)
    try { localStorage.setItem(LS_KEY, fromUrl) } catch {}
    return fromUrl
  }
  try { return localStorage.getItem(LS_KEY) } catch {}
  return null
}

// İşletme kök yolu — tüm veri buraya yazılır
export function bizRoot(businessId) {
  return `businesses/${businessId}`
}

// Geçersiz businessId durumunda gösterilecek hata
export const NO_BUSINESS_ERROR = 'İşletme bulunamadı. URL\'de ?isletme=... parametresi eksik.'
