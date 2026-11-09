// Netlify Function — urun adi/aciklamasindan guvenli gorsel uretir.
// Ozel (private) AI endpoint: Yalnizca yetkili admin/personel oturumu tarafindan cagrilabilir.
const { preflight, json } = require('./_cors')
const { requireAdminAuth, checkRateLimit, sanitizeInput, getClientIp } = require('./_auth')

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, event)
  }

  // 1. Yetki Dogrulamasi (Private Endpoint Korumasi)
  const auth = requireAdminAuth(event)
  if (!auth.ok) {
    return json(auth.status, { error: auth.error }, event)
  }

  // 2. Hiz Sinirlamasi (Rate Limiting) — Dakikada en fazla 6 gorsel
  const ip = getClientIp(event)
  const limit = checkRateLimit(`img:${auth.bizId || ip}`, 6, 60000)
  if (!limit.allowed) {
    return json(429, {
      error: `Cok fazla gorsel uretim istegi. Lutfen ${limit.retryAfter} saniye bekleyin.`,
    }, event)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return json(500, { error: 'AI servisi su an aktif degil.' }, event)
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Gecersiz istek govdesi' }, event)
  }

  // 3. Girdi Temizligi ve Prompt Injection Engelleme
  const name = sanitizeInput(body.name, 80)
  const desc = sanitizeInput(body.desc, 200)
  const category = sanitizeInput(body.category, 50)
  const quality = body.quality === 'high' ? 'high' : 'medium'

  if (!name) {
    return json(400, { error: 'Urun adi eksik veya gecersiz' }, event)
  }

  // Sabit, guvenli stil sablonu
  const prompt = `Premium restaurant menu food photography of "${name}"${desc ? ` — ${desc}` : ''}${category ? ` (${category})` : ''}.
STYLE (keep identical across every dish for a consistent menu):
- Fresh, appetizing, photorealistic — like a top food magazine, NOT illustration, NOT 3D render, NOT cartoon.
- Overhead-to-45° angle, single hero serving centered, on a clean matte ceramic plate or proper glass/cup.
- Warm soft natural window light from the left, gentle shadows, shallow depth of field.
- Neutral warm background: light oak wood or soft linen, slightly blurred.
- Rich natural colors, steam/freshness where relevant, professional food styling.
- Absolutely NO text, NO watermark, NO hands, NO people, NO logos, NO cutlery clutter.`

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1-mini',
        prompt,
        size: '1024x1024',
        quality,
        n: 1,
      }),
    })

    if (!response.ok) {
      return json(502, { error: 'Gorsel servisi gecici olarak yanit vermedi.' }, event)
    }

    const data = await response.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      return json(502, { error: 'Gorsel olusturulamadi.' }, event)
    }

    return json(200, { image: `data:image/png;base64,${b64}` }, event)
  } catch {
    return json(500, { error: 'Sunucu hatasi olustu.' }, event)
  }
}
