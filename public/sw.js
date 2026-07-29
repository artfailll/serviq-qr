// Uygulama kabuğu için ağ öncelikli, çevrimdışı yedekli service worker.
// Pazarlama ve 404 rotalarına dokunmaz; menü/sipariş verisi Firebase'den canlı gelir.
const CACHE = 'serviq-app-v2'
const APP_SHELL = '/index.html'
const APP_ROUTES = new Set(['/menu', '/kasa', '/garson', '/yonetim'])

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([APP_SHELL])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Firebase / API / farklı origin isteklerine dokunma
  if (url.origin !== self.location.origin) return
  // Yalnızca gerçek uygulama gezinmeleri: ağ öncelikli, çevrimdışıysa uygulama kabuğu.
  if (req.mode === 'navigate') {
    if (!APP_ROUTES.has(url.pathname)) return
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(APP_SHELL, r.clone()))
          return r
        })
        .catch(() => caches.match(APP_SHELL))
    )
    return
  }
  // Statik varlıklar: cache öncelikli
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((r) => {
      if (r.ok && (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.webmanifest'))) {
        caches.open(CACHE).then((c) => c.put(req, r.clone()))
      }
      return r
    }))
  )
})
