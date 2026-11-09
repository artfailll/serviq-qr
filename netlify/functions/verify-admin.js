// Netlify Function — yonetim paneli sifre dogrulamasi ve guvenli token uretimi.
const { preflight, json } = require('./_cors')
const { createSignedToken } = require('./_auth')
const crypto = require('crypto')

// Kaba kuvvet denemesini yavaslatir
const DELAY_MS = 400
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Uzunluk sizdirmayan karsilastirma
function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba)
    return false
  }
  return crypto.timingSafeEqual(ba, bb)
}

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' }, event)

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Gecersiz istek' }, event) }

  const bizId = String(body.bizId || '').slice(0, 120)
  const pin = String(body.pin || '').slice(0, 64)
  if (!bizId) return json(400, { error: 'Isletme kimligi eksik' }, event)

  const raw = process.env.SERVIQ_ADMIN_PINS
  if (!raw) return json(200, { configured: false }, event)

  let map
  try { map = JSON.parse(raw) } catch { return json(200, { configured: false }, event) }

  const expected = map[bizId]
  if (expected === undefined || expected === null || expected === '') {
    return json(200, { configured: false }, event)
  }

  // Bos sifre = yoklama
  if (pin === '') return json(200, { configured: true, ok: false }, event)

  await sleep(DELAY_MS)
  const ok = safeEqual(pin, expected)
  const token = ok ? createSignedToken(bizId) : null

  return json(200, { configured: true, ok, token }, event)
}
