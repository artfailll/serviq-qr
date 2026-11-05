// Otomatik sürüm kontrolü ve güncelleme yöneticisi
// Açık kalan tüm ekranlarda (kasa, garson, mutfak, müşteri)
// yeni bir sürüm yayımlandığında sayfayı otomatik olarak günceller.

const CHECK_INTERVAL_MS = 25 * 1000 // 25 saniyede bir kontrol et
let isUpdating = false
let initialVersion = null

export function initAutoUpdate() {
  if (typeof window === 'undefined') return () => {}

  // 1. Vite modül yükleme hatası (yeni sürüm yüklenip eski chunk silindiğinde) anında yenile
  window.addEventListener('vite:preloadError', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault()
    forceReload()
  })

  window.addEventListener('error', (event) => {
    const msg = String(event?.message || '')
    if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
      forceReload()
    }
  })

  // 2. Service Worker devraldığında veya yeni sürüm mesajı geldiğinde anında yenile
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      forceReload()
    })
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NEW_VERSION_AVAILABLE') {
        forceReload()
      }
    })
  }

  // 3. İlk sürüm kontrolü
  checkVersion()
  const timer = setInterval(checkVersion, CHECK_INTERVAL_MS)

  // 4. Kullanıcı sekmeye her döndüğünde veya ekran açıldığında anında kontrol et
  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      checkVersion()
    }
  }
  const onFocus = () => checkVersion()

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
  }

  return () => {
    clearInterval(timer)
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }
}

export async function checkVersion() {
  if (isUpdating) return
  try {
    // Service worker güncellemesini de tetikle
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}))
    }

    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    })
    if (!res.ok) return
    const data = await res.json()
    const serverVer = String(data?.version || '').trim()
    if (!serverVer) return

    // İstemcinin derleme sürümü
    const clientVer = String(window.__APP_VERSION__ || initialVersion || '').trim()

    if (!clientVer) {
      initialVersion = serverVer
      return
    }

    if (serverVer !== clientVer) {
      console.log(`[serviq] Yeni sürüm tespit edildi: ${serverVer} (mevcut: ${clientVer}). Otomatik güncelleniyor...`)
      forceReload()
    }
  } catch {}
}

export function forceReload() {
  if (isUpdating) return
  isUpdating = true

  // Sonsuz döngü koruması: 10 saniye içinde en fazla 1 kez
  try {
    const lastReload = Number(sessionStorage.getItem('serviq_last_reload') || 0)
    if (Date.now() - lastReload < 10000) return
    sessionStorage.setItem('serviq_last_reload', String(Date.now()))
  } catch {}

  // CacheStorage önbelleğini temizle
  if (typeof window !== 'undefined' && 'caches' in window) {
    window.caches.keys().then((names) => Promise.all(names.map((n) => window.caches.delete(n)))).catch(() => {})
  }

  // Kullanıcıya üst bilgi bildirimi göster
  if (typeof document !== 'undefined') {
    try {
      const banner = document.createElement('div')
      banner.style.cssText =
        'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:999999;background:#16a34a;color:#fff;padding:10px 22px;border-radius:9999px;font-weight:800;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,0.35);display:flex;align-items:center;gap:8px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;'
      banner.innerHTML = '<span>⚡</span><span>Yeni sürüm yüklendi, sistem güncelleniyor...</span>'
      document.body.appendChild(banner)
    } catch {}
  }

  setTimeout(() => {
    if (typeof window !== 'undefined') {
      window.location.reload(true)
    }
  }, 800)
}
