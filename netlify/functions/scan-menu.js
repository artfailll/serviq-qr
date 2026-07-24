// Netlify Function — Menü fotoğrafını GPT-4o Vision ile okur,
// ürün/fiyat/kategori çıkarır, JSON olarak döner.
const { preflight, json } = require('./_cors')

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return json(500, { error: 'API key eksik' })
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return json(400, { error: 'Geçersiz istek' })
  }

  const { imageBase64, mimeType = 'image/jpeg' } = body
  if (!imageBase64) {
    return json(400, { error: 'Görsel eksik' })
  }

  const prompt = `Bu bir restoran/kafe menüsünün fotoğrafıdır.
Menüdeki TÜM ürünleri tespit et ve aşağıdaki JSON formatında döndür.
Fiyatları sayı olarak yaz (TL işareti olmadan).
Kategori isimlerini Türkçe yaz (ör: Kahveler, Soğuk İçecekler, Burgerler, Pizzalar, Tatlılar, Ana Yemekler, Başlangıçlar, Salatalar, Nargile, Atıştırmalıklar).
Ürün adı veya fiyat okunamıyorsa o ürünü atla.

JSON formatı (başka hiçbir şey yazma, sadece JSON):
{
  "categories": ["Kategori1", "Kategori2"],
  "items": [
    { "name": "Ürün Adı", "price": 50, "category": "Kategori1", "desc": "Kısa açıklama varsa" }
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
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return json(502, { error: 'OpenAI hatası', detail: err })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''

    // JSON bloğunu çıkar
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return json(422, { error: 'Menü okunamadı', raw: text })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return json(200, parsed)
  } catch (e) {
    return json(500, { error: e.message })
  }
}
