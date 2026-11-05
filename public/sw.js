// Minimal service worker — uygulama kabuğu için ağ öncelikli, çevrimdışı yedekli.
// Menü/sipariş verisi Firebase'den canlı gelir; SW yalnızca kabuğu hızlandırır.
const CACHE = 'serviq-v6'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Yeni sürüm geldiğinde açık olan tüm sekmeleri otomatik yenile
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'NEW_VERSION_AVAILABLE' })
            try { client.navigate(client.url) } catch {}
          }
        })
      })
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Firebase / API / harici istekleri doğrudan geçir
  if (url.origin !== self.location.origin) return

  // Sürüm kontrolü ve service worker dosyalarını ASLA önbellekleme
  if (url.pathname === '/version.json' || url.pathname === '/sw.js') {
    e.respondWith(fetch(req, { cache: 'no-store' }))
    return
  }

  // HTML gezinmeleri: her zaman AĞ ÖNCELİKLİ (canlı sürümü çek)
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then((r) => {
        if (r.ok) {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return r
      }).catch(async () => (await caches.match(req)) || (await caches.match('/')) || new Response('İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
    )
    return
  }

  // Statik varlıklar: cache varsa ver, yoksa ağdan çek
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((r) => {
      if (r.ok && (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.webmanifest'))) {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return r
    }))
  )
})
