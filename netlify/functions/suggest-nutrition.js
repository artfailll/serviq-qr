// Netlify Function — ürün adı/açıklamasından GPT-4o-mini ile
// yönetmelik uyumluluğu için tahmini gramaj/kalori/alerjen/içerik önerir.
// ÖNEMLİ: Bu bir TAHMİNDİR — işletme sahibi gerçek tarifine göre
// kontrol edip onaylamadan hiçbir zaman doğrudan kaydedilmez.
const ALLERGEN_KEYS = [
  'gluten', 'kabuklu_deniz', 'yumurta', 'balik', 'yer_fistigi', 'soya',
  'sut', 'kabuklu_yemis', 'kereviz', 'hardal', 'susam', 'sulfit', 'bakla', 'yumusakca',
]

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

  const { name, desc, category } = body
  if (!name) {
    return json(400, { error: 'Ürün adı eksik' })
  }

  const prompt = `Bir restoran/kafe menü ürünü için Türkiye'deki standart tarife göre TAHMİNİ beslenme ve alerjen bilgisi üret.

Ürün: "${name}"${desc ? `\nAçıklama: ${desc}` : ''}${category ? `\nKategori: ${category}` : ''}

Sadece aşağıdaki JSON formatında cevap ver, başka hiçbir şey yazma:
{
  "gram": <sayı, tek porsiyon gramaj tahmini>,
  "kalori": <sayı, tek porsiyon kalori tahmini>,
  "allergens": [<şu listeden uygun olanlar: ${ALLERGEN_KEYS.join(', ')}>],
  "alkol": <true/false, alkol içerir mi>,
  "domuz": <true/false, domuz eti/türevi içerir mi>,
  "icerik": "<kısa, virgülle ayrılmış ana bileşenler listesi>",
  "vegan": <true/false>,
  "vejetaryen": <true/false>,
  "aci": <true/false>,
  "sekersiz": <true/false, ilave şeker yoksa true>
}

Standart Türkiye restoran/kafe tarifine göre en olası değerleri tahmin et. Emin olmadığın alerjenleri EKLEME, sadece o üründe genellikle kesin bulunanları ekle.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return json(502, { error: 'OpenAI hatası', detail: err })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(text)

    // Sadece geçerli alerjen key'lerini geçir
    const allergens = Array.isArray(parsed.allergens)
      ? parsed.allergens.filter(a => ALLERGEN_KEYS.includes(a))
      : []

    return json(200, {
      gram: parsed.gram || '',
      kalori: parsed.kalori || '',
      allergens,
      alkol: !!parsed.alkol,
      domuz: !!parsed.domuz,
      icerik: parsed.icerik || '',
      vegan: !!parsed.vegan,
      vejetaryen: !!parsed.vejetaryen,
      aci: !!parsed.aci,
      sekersiz: !!parsed.sekersiz,
    })
  } catch (e) {
    return json(500, { error: e.message })
  }
}
