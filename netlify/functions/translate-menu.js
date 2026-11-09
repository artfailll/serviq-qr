// Netlify Function — menu icerigini guvenli sekilde hedef dile cevirir.
// Ozel ve korumali API: Orjin denetimi, rate limiting ve girdi dogrulamasi icerir.
const { preflight, json, isOriginAllowed } = require('./_cors')
const { checkRateLimit, sanitizeInput, getClientIp } = require('./_auth')

const LANG_NAMES = {
  en: 'English',
  ar: 'Arabic',
  ru: 'Russian',
  de: 'German',
  fr: 'French',
}

// Kisa sureli bellek ici onbellek (tekrar eden isteklerde token harcamaz)
const translationCache = new Map()

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' }, event)

  // 1. Orjin Guvenlik Kontrolu
  const origin = event?.headers?.origin || event?.headers?.Origin || ''
  if (origin && !isOriginAllowed(origin)) {
    return json(403, { error: 'Bu alandan erisim yetkisi bulunmuyor.' }, event)
  }

  // 2. Acil durum kapatma anahtari
  if (process.env.SERVIQ_AI_DISABLED === 'true') {
    return json(503, { error: 'Ceviri servisi su an kapalidir.' }, event)
  }

  // 3. Hiz Sinirlamasi — Dakikada en fazla 10 cevirme istegi
  const ip = getClientIp(event)
  const limit = checkRateLimit(`tr:${ip}`, 10, 60000)
  if (!limit.allowed) {
    return json(429, {
      error: `Cok fazla ceviri istegi. Lutfen ${limit.retryAfter} saniye bekleyin.`,
    }, event)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return json(500, { error: 'Ceviri servisi yapilandirilmamis.' }, event)

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Gecersiz istek govdesi' }, event)
  }

  const { lang, items, categories } = body
  const target = LANG_NAMES[lang]
  if (!target || !Array.isArray(items)) {
    return json(400, { error: 'Eksik veya gecersiz parametre' }, event)
  }

  // 4. Boyut ve Girdi Sinirlamalari (Kotuye kullanim engelleme)
  const safeItems = items.slice(0, 150).map((i) => ({
    id: String(i.id || '').slice(0, 50),
    name: sanitizeInput(i.name || '', 100),
    desc: sanitizeInput(i.desc || '', 300),
  }))

  const safeCats = (Array.isArray(categories) ? categories : []).slice(0, 30).map((c) => ({
    id: String(c.id || '').slice(0, 50),
    name: sanitizeInput(c.name || '', 60),
  }))

  // Onbellek anahtari kontrolu
  const cacheKey = `${lang}:${safeItems.length}:${safeItems[0]?.name || ''}:${safeItems[safeItems.length - 1]?.name || ''}`
  const cached = translationCache.get(cacheKey)
  if (cached && Date.now() - cached.time < 1000 * 60 * 30) {
    return json(200, cached.data, event)
  }

  const payload = {
    categories: safeCats,
    items: safeItems,
  }

  const prompt = `Translate this restaurant menu from Turkish to ${target}.
Keep it natural and appetizing — this is a customer-facing menu.
Do NOT translate proper brand names or well-known dish names that are normally kept (e.g. "Latte", "Cheeseburger", "Doner"); translate descriptions fully.
Return ONLY valid JSON in exactly this shape, same ids:
{"categories":{"<id>":"<translated name>"},"items":{"<id>":{"name":"<translated>","desc":"<translated>"}}}

Source:
${JSON.stringify(payload)}`

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4000,
      }),
    })

    if (!resp.ok) {
      return json(502, { error: 'Ceviri servisi gecici olarak yanit vermedi.' }, event)
    }

    const data = await resp.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    const result = { items: parsed.items || {}, categories: parsed.categories || {} }

    // Onbellege ekle
    translationCache.set(cacheKey, { time: Date.now(), data: result })

    return json(200, result, event)
  } catch {
    return json(500, { error: 'Ceviri sirasinda bir hata olustu.' }, event)
  }
}
