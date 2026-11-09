// Ortak CORS + JSON yardimcisi.
// AI ve yetkilendirme uclari ozeldir (private) — acik * CORS kaldirilmistir.
// Yalnizca guvenli servis alan adlarina (serviq.com.tr, deploy preview, localhost) izin verilir.

function isOriginAllowed(origin) {
  if (!origin) return true // Same-origin veya dogrudan istek
  try {
    const u = new URL(origin)
    const host = u.hostname.toLowerCase()
    if (host === 'serviq.com.tr' || host.endsWith('.serviq.com.tr')) return true
    if (host === 'serviqr.netlify.app' || host.endsWith('.netlify.app')) return true
    if (host === 'localhost' || host === '127.0.0.1') return true
  } catch {
    return false
  }
  return false
}

function getCorsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || ''
  const allowed = isOriginAllowed(origin)
  const allowOrigin = allowed ? (origin || 'https://serviq.com.tr') : 'https://serviq.com.tr'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-serviq-biz, x-serviq-token, x-serviq-pin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }
}

// Tarayici preflight (OPTIONS) istegini kisa devre yapar.
// Izin verilmeyen dis origin'leri 403 ile reddeder.
const preflight = (event) => {
  if (event.httpMethod !== 'OPTIONS') return null
  const origin = event?.headers?.origin || event?.headers?.Origin || ''
  if (origin && !isOriginAllowed(origin)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'CORS policy: Bu orjinden erisim engellendi.' }),
    }
  }
  return { statusCode: 204, headers: getCorsHeaders(event) }
}

// JSON yaniti guvenli CORS + content-type basliklariyla sarmalar.
const json = (statusCode, obj, event) => ({
  statusCode,
  headers: { ...getCorsHeaders(event), 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
})

module.exports = { isOriginAllowed, getCorsHeaders, preflight, json }
