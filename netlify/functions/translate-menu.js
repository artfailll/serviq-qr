// Netlify Function — menü içeriğini (ürün adları + açıklamalar + kategoriler)
// hedef dile çevirir. Sonuç Firebase'de önbelleklenir (client tarafında),
// böylece her müşteri için tekrar tekrar çeviri maliyeti oluşmaz.
const { preflight, json } = require('./_cors')
const LANG_NAMES = { en: 'English', ar: 'Arabic', ru: 'Russian' }

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return json(500, { error: 'API key eksik' })

  let body
  try { body = JSON.parse(event.body) } catch { return json(400, { error: 'Geçersiz istek' }) }

  const { lang, items, categories } = body
  const target = LANG_NAMES[lang]
  if (!target || !Array.isArray(items)) return json(400, { error: 'Eksik parametre' })

  // Girdiyi kompakt tut — sadece id + metin
  const payload = {
    categories: (categories || []).map(c => ({ id: c.id, name: c.name })),
    items: items.map(i => ({ id: i.id, name: i.name, desc: i.desc || '' })),
  }

  const prompt = `Translate this restaurant menu from Turkish to ${target}.
Keep it natural and appetizing — this is a customer-facing menu.
Do NOT translate proper brand names or well-known dish names that are normally kept (e.g. "Latte", "Cheeseburger"); translate descriptions fully.
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
      const err = await resp.text()
      return json(502, { error: 'OpenAI hatası', detail: err })
    }
    const data = await resp.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    return json(200, { items: parsed.items || {}, categories: parsed.categories || {} })
  } catch (e) {
    return json(500, { error: e.message })
  }
}
