// Netlify Function — ürün adı/açıklamasından GPT Image 1 Mini ile
// gerçekçi, iştah açıcı menü fotoğrafı üretir.
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

  const { name, desc, category, quality } = body
  if (!name) {
    return json(400, { error: 'Ürün adı eksik' })
  }

  // Tutarlı stil şablonu — tüm menüde aynı zemin/ışık/açı → profesyonel bütünlük
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
        quality: quality === 'high' ? 'high' : 'medium', // varsayılan orta — kalite/plastik dengesi
        n: 1,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return json(502, { error: 'OpenAI hatası', detail: err })
    }

    const data = await response.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      return json(502, { error: 'Görsel üretilemedi' })
    }

    return json(200, { image: `data:image/png;base64,${b64}` })
  } catch (e) {
    return json(500, { error: e.message })
  }
}
