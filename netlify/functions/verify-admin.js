// Netlify Function — yönetim paneli şifre doğrulaması.
//
// NEDEN: Şifre eskiden Firebase'de businesses/{id}/config/password altında
// duruyordu ve veritabanı kuralları o düğümü herkese açık okutuyordu. İşletme
// kimliği her masadaki QR'ın içinde olduğu için, masaya oturan herhangi biri
// tek istekle şifreyi çekip yönetim paneline girebiliyordu.
//
// ÇÖZÜM: Şifre artık veritabanında değil, Netlify ortam değişkeninde.
// Tarayıcıya hiçbir zaman gönderilmez; yalnızca girilen şifre burada
// karşılaştırılır. Ortam değişkeni tarayıcıdan okunamaz.
//
// Kurulum:
//   netlify env:set SERVIQ_ADMIN_PINS '{"isletme-kimligi":"1234", ...}'
//
// Ortam değişkeni tanımlı değilse { configured: false } döner; istemci o
// durumda eski davranışa geri düşer, böylece geçiş sırasında kimse kilitli
// kalmaz.
const { preflight, json } = require('./_cors')
const crypto = require('crypto')

// Kaba kuvvet denemesini yavaşlatır: 4 haneli şifre 10.000 olasılık, sabit
// gecikme olmadan saniyeler içinde denenebilir.
const DELAY_MS = 400
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Uzunluk sızdırmayan karşılaştırma
function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  if (ba.length !== bb.length) {
    // Yine de sabit süre harca
    crypto.timingSafeEqual(ba, ba)
    return false
  }
  return crypto.timingSafeEqual(ba, bb)
}

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Geçersiz istek' }) }

  const bizId = String(body.bizId || '').slice(0, 120)
  const pin = String(body.pin || '').slice(0, 64)
  if (!bizId) return json(400, { error: 'İşletme kimliği eksik' })

  const raw = process.env.SERVIQ_ADMIN_PINS
  if (!raw) return json(200, { configured: false })

  let map
  try { map = JSON.parse(raw) } catch { return json(200, { configured: false }) }

  const expected = map[bizId]
  // Bu işletme için henüz şifre taşınmamış → istemci eski yönteme düşsün
  if (expected === undefined || expected === null || expected === '') {
    return json(200, { configured: false })
  }

  // Boş şifre = yoklama (istemci "bu işletme sunucu moduna geçmiş mi" diye
  // sorar). Panel açılışını yavaşlatmamak için gecikme uygulanmaz.
  if (pin === '') return json(200, { configured: true, ok: false })

  await sleep(DELAY_MS)
  return json(200, { configured: true, ok: safeEqual(pin, expected) })
}
