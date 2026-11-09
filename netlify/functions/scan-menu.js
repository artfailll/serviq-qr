// Netlify Function — Menu fotografini GPT-4o Vision ile guvenli sekilde tarar.
// Ozel (private) AI endpoint: Yalnizca yetkili admin/personel oturumu tarafindan cagrilabilir.
const { preflight, json } = require('./_cors')
const { requireAdminAuth, checkRateLimit, getClientIp } = require('./_auth')

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/jpg',
])

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

  // 2. Hiz Sinirlamasi (Rate Limiting) — Dakikada en fazla 5 tarama
  const ip = getClientIp(event)
  const limit = checkRateLimit(`scan:${auth.bizId || ip}`, 5, 60000)
  if (!limit.allowed) {
    return json(429, {
      error: `Cok fazla menu tarama istegi. Lutfen ${limit.retryAfter} saniye bekleyin.`,
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

  const { imageBase64, mimeType = 'image/jpeg' } = body
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return json(400, { error: 'Gorsel verisi eksik' }, event)
  }

  // 3. Dosya Boyutu ve Guvenlik Kontrolu (En fazla ~9 MB base64)
  if (imageBase64.length > 12000000) {
    return json(413, { error: 'Gorsel boyutu cok yuksek. Lutfen daha kucuk bir gorsel secin.' }, event)
  }

  const safeMime = ALLOWED_MIME.has(String(mimeType).toLowerCase()) ? mimeType : 'image/jpeg'

  const prompt = `Bu bir restoran/kafe menusunun fotografidir.
Menudeki TUM urunleri tespit et ve asagidaki JSON formatinda dondur.
Fiyatlari sayi olarak yaz (TL isareti olmadan).
Kategori isimlerini Turkce yaz (or: Kahveler, Soguk Icecekler, Burgerler, Pizzalar, Tatlilar, Ana Yemekler, Baslangiclar, Salatalar, Corbalar, Donerler).
Urun adi veya fiyat okunamiyorsa o urunu atla.

JSON formati (baska hicbir sey yazma, sadece JSON):
{
  "categories": ["Kategori1", "Kategori2"],
  "items": [
    { "name": "Urun Adi", "price": 50, "category": "Kategori1", "desc": "Kisa aciklama varsa" }
  ]
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${safeMime};base64,${imageBase64}`, detail: 'high' } },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      return json(502, { error: 'Menu tarama servisi su an yanit veremiyor.' }, event)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''

    // JSON blogunu cikar
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return json(422, { error: 'Menudeki urunler net olarak okunamadi. Lutfen daha aydinlik ve duz bir fotograf yukleyin.' }, event)
    }

    const parsed = JSON.parse(jsonMatch[0])
    return json(200, parsed, event)
  } catch {
    return json(500, { error: 'Menu taranirken bir hata meydana geldi.' }, event)
  }
}
