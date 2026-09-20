// Minimal service worker — uygulama kabuğu için ağ öncelikli, çevrimdışı yedekli.
// Menü/sipariş verisi Firebase'den canlı gelir; SW yalnızca kabuğu hızlandırır.
const CACHE = 'serviq-safe-routes-v3'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])))
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
  // HTML gezinmeleri: ağ öncelikli, çevrimdışıysa cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => {
        if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy))) }
        return r
      }).catch(async () => (await caches.match(req)) || new Response('İnternet bağlantısı yok. Sipariş göndermek için bağlantınızı kontrol edip tekrar deneyin.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
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
