// Netlify Function — urun adi/aciklamasindan beslenme/alerjen tahmini onerir.
// Ozel (private) AI endpoint: Yalnizca yetkili admin/personel oturumu tarafindan cagrilabilir.
const ALLERGEN_KEYS = [
  'gluten', 'kabuklu_deniz', 'yumurta', 'balik', 'yer_fistigi', 'soya',
  'sut', 'kabuklu_yemis', 'kereviz', 'hardal', 'susam', 'sulfit', 'bakla', 'yumusakca',
]

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

  // 2. Hiz Sinirlamasi (Rate Limiting) — Dakikada en fazla 12 istek
  const ip = getClientIp(event)
  const limit = checkRateLimit(`nutri:${auth.bizId || ip}`, 12, 60000)
  if (!limit.allowed) {
    return json(429, {
      error: `Cok fazla beslenme onerisi istegi. Lutfen ${limit.retryAfter} saniye bekleyin.`,
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

  // 3. Girdi Temizligi ve Prompt Injection Korumasi
  const name = sanitizeInput(body.name, 80)
  const desc = sanitizeInput(body.desc, 200)
  const category = sanitizeInput(body.category, 50)

  if (!name) {
    return json(400, { error: 'Urun adi eksik veya gecersiz' }, event)
  }

  const prompt = `Bir restoran/kafe menu urunu icin Turkiye'deki standart tarife gore TAHMINI beslenme ve alerjen bilgisi uret.

Urun: "${name}"${desc ? `\nAciklama: ${desc}` : ''}${category ? `\nKategori: ${category}` : ''}

Sadece asagidaki JSON formatinda cevap ver, baska hicbir sey yazma:
{
  "gram": <sayi, tek porsiyon gramaj tahmini>,
  "kalori": <sayi, tek porsiyon kalori tahmini>,
  "allergens": [<su listeden uygun olanlar: ${ALLERGEN_KEYS.join(', ')}>],
  "alkol": <true/false, alkol icerir mi>,
  "domuz": <true/false, domuz eti/turevi icerir mi>,
  "icerik": "<kisa, virgulle ayrilmis ana bilesenler listesi>",
  "vegan": <true/false>,
  "vejetaryen": <true/false>,
  "aci": <true/false>,
  "sekersiz": <true/false, ilave seker yoksa true>
}

Standart Turkiye restoran/kafe tarifine gore en olasi degerleri tahmin et. Emin olmadigin alerjenleri EKLEME, sadece o urunde genellikle kesin bulunanlari ekle.`

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
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      return json(502, { error: 'Beslenme tahmin servisi su an yanit veremiyor.' }, event)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(text)

    // Sadece gecerli alerjen key'lerini gecir
    const allergens = Array.isArray(parsed.allergens)
      ? parsed.allergens.filter(a => ALLERGEN_KEYS.includes(a))
      : []

    return json(200, {
      gram: typeof parsed.gram === 'number' ? parsed.gram : '',
      kalori: typeof parsed.kalori === 'number' ? parsed.kalori : '',
      allergens,
      alkol: !!parsed.alkol,
      domuz: !!parsed.domuz,
      icerik: sanitizeInput(parsed.icerik || '', 300),
      vegan: !!parsed.vegan,
      vejetaryen: !!parsed.vejetaryen,
      aci: !!parsed.aci,
      sekersiz: !!parsed.sekersiz,
    }, event)
  } catch {
    return json(500, { error: 'Beslenme tahmini yapilirken hata meydana geldi.' }, event)
  }
}
