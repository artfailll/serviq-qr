// Guvenlik ve Kimlik Dogrulama Yardimcisi (Netlify Functions)
// AI uclarini disariya kapali (private), yetkili ve guvenli hale getirir.
const crypto = require('crypto')

function getSecret() {
  return (
    process.env.SERVIQ_TOKEN_SECRET ||
    process.env.SERVIQ_ADMIN_PINS ||
    process.env.OPENAI_API_KEY ||
    'serviq-secure-private-salt-2026'
  )
}

// 24 saat gecerli HMAC-SHA256 imzali guvenli oturum token'i uretir
function createSignedToken(bizId) {
  const secret = getSecret()
  const payload = {
    bizId: String(bizId || ''),
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(8).toString('hex'),
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

// Token imzasini ve gecerlilik suresini sabit sureli karsilastirmayla dogrular
function verifySignedToken(token, expectedBizId) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Token bulunamadi' }
  }
  const parts = token.split('.')
  if (parts.length !== 2) {
    return { ok: false, error: 'Gecersiz token formati' }
  }
  const [data, sig] = parts

  try {
    const secret = getSecret()
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url')

    const bufSig = Buffer.from(sig, 'utf8')
    const bufExpected = Buffer.from(expectedSig, 'utf8')
    if (bufSig.length !== bufExpected.length || !crypto.timingSafeEqual(bufSig, bufExpected)) {
      return { ok: false, error: 'Gecersiz token imzasi' }
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (payload.exp && Date.now() > payload.exp) {
      return { ok: false, error: 'Token suresi dolmus' }
    }

    if (expectedBizId && payload.bizId && payload.bizId !== expectedBizId) {
      return { ok: false, error: 'Isletme kimligi uyusmuyor' }
    }

    return { ok: true, bizId: payload.bizId }
  } catch {
    return { ok: false, error: 'Bozuk token' }
  }
}

// Client IP adresini alir
function getClientIp(event) {
  return (
    event?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    event?.headers?.['client-ip'] ||
    event?.headers?.['x-real-ip'] ||
    '127.0.0.1'
  )
}

// In-memory kayan pencere hiz sinirlayici (Rate Limiting)
const rateMap = new Map()
function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now()
  const item = rateMap.get(key) || { count: 0, resetAt: now + windowMs }

  if (now > item.resetAt) {
    item.count = 1
    item.resetAt = now + windowMs
    rateMap.set(key, item)
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (item.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((item.resetAt - now) / 1000),
    }
  }

  item.count++
  rateMap.set(key, item)
  return { allowed: true, remaining: maxRequests - item.count }
}

// Prompt Injection ve XSS saldirilarina karsi girdileri temizler ve sinirlar
function sanitizeInput(text, maxLength = 250) {
  if (typeof text !== 'string') return ''
  return text
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Gorunmeyen kontrol karakterleri
    .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, '[temizlendi]')
    .replace(/system\s*:\s*/gi, '')
    .replace(/assistant\s*:\s*/gi, '')
    .replace(/<\/?(script|prompt|instruction)[^>]*>/gi, '')
    .trim()
}

// AI endpoint'leri icin yetki kontrolu (Admin veya Personel)
function requireAdminAuth(event) {
  // 1. Acil durum kapatma anahtari
  if (process.env.SERVIQ_AI_DISABLED === 'true') {
    return {
      ok: false,
      status: 503,
      error: 'AI servisleri guvenlik nedeniyle gecici olarak kapatilmistir.',
    }
  }

  // 2. Token kontrolu
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  let token = ''
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  } else if (event.headers?.['x-serviq-token']) {
    token = String(event.headers['x-serviq-token']).trim()
  }

  const bizId =
    event.headers?.['x-serviq-biz'] ||
    event.queryStringParameters?.isletme ||
    ''

  if (token) {
    const verified = verifySignedToken(token, bizId)
    if (verified.ok) {
      return { ok: true, bizId: verified.bizId }
    }
  }

  // 3. Fallback: Eger token henuz olusmadiysa x-serviq-pin ile dogrulama
  const rawPins = process.env.SERVIQ_ADMIN_PINS
  const sentPin = event.headers?.['x-serviq-pin']
  if (rawPins && bizId && sentPin) {
    try {
      const map = JSON.parse(rawPins)
      const expectedPin = map[bizId]
      if (expectedPin && String(sentPin).trim() === String(expectedPin).trim()) {
        return { ok: true, bizId, generatedToken: createSignedToken(bizId) }
      }
    } catch {}
  }

  // Demo modu icin izin
  if (process.env.SERVIQ_DEMO_AI === 'true') {
    return { ok: true, bizId: bizId || 'demo' }
  }

  return {
    ok: false,
    status: 401,
    error: 'Yetkisiz erisim. Bu AI servisi ozeldir (private). Lutfen yonetim panelinden giris yapin.',
  }
}

module.exports = {
  getSecret,
  createSignedToken,
  verifySignedToken,
  getClientIp,
  checkRateLimit,
  sanitizeInput,
  requireAdminAuth,
}
