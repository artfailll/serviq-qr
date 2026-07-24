// Ortak CORS + JSON yardımcıları. AI uçları (menü tarama, çeviri, görsel,
// beslenme) JSON API'si; her origin'den çağrılabilsin diye CORS ekliyoruz.
// Prod'da müşteri aynı origin'den çağırır (zararsız), ama bu sayede farklı
// alt alan/önizleme/entegrasyonlardan da erişilebilir ve hatalar okunabilir.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Tarayıcı preflight (OPTIONS) isteğini kısa devre yapar.
const preflight = (event) =>
  event.httpMethod === 'OPTIONS' ? { statusCode: 204, headers: CORS } : null

// JSON yanıtı CORS + content-type başlıklarıyla sarmalar.
const json = (statusCode, obj) => ({
  statusCode,
  headers: { ...CORS, 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
})

module.exports = { CORS, preflight, json }
