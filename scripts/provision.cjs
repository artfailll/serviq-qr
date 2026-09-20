#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const ROOT = path.resolve(__dirname, '..')
require('dotenv').config({ path: process.env.SERVIQ_ENV_FILE || path.join(ROOT, '.env'), quiet: true })

function parseArgs(args) {
  const onlyQR = args[0] === '--only-qr'
  const [name, id, count = '10', color = '#f97316', password] = onlyQR ? ['', args[1]] : args
  if (!id || id.length > 100 || /[.#$\[\]\/\u0000-\u001f\u007f]/u.test(id)) throw new Error('Geçersiz işletme ID.')
  if (!onlyQR && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Yeni işletme ID: küçük harf, rakam ve tire kullanın.')
  if (!onlyQR && (!name?.trim() || name.length > 100)) throw new Error('İşletme adı 1–100 karakter olmalı.')
  if (!onlyQR && (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 500)) throw new Error('Masa sayısı 1–500 arasında olmalı.')
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Renk #112233 biçiminde olmalı.')
  return { onlyQR, name, id, count: Number(count), color, password }
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Sunucu işlemi reddetti (HTTP ${response.status}).`)
  return response
}
async function main(args = process.argv.slice(2)) {
  const o = parseArgs(args)
  const db = process.env.VITE_FIREBASE_DATABASE_URL
  if (!db || new URL(db).protocol !== 'https:') throw new Error('HTTPS Firebase adresi gerekli. SERVIQ_ENV_FILE veya .env ayarını kontrol edin.')
  const endpoint = new URL(`${db.replace(/\/$/, '')}/businesses/${encodeURIComponent(o.id)}.json`)
  if (process.env.SERVIQ_FIREBASE_TOKEN) endpoint.searchParams.set('auth', process.env.SERVIQ_FIREBASE_TOKEN)
  let menu
  if (o.onlyQR) {
    const menuURL = new URL(endpoint)
    menuURL.pathname = menuURL.pathname.replace(/\.json$/, '/menu.json')
    menu = await (await request(menuURL)).json()
    if (!menu?.profile?.name) throw new Error('İşletme bulunamadı; QR-only yeni işletme oluşturmaz.')
  } else {
    const current = await request(endpoint, { headers: { 'X-Firebase-ETag': 'true' } })
    if (await current.json() !== null) throw new Error('İşletme zaten var. Veri/şifre değiştirilmedi. QR için --only-qr kullanın.')
    const etag = current.headers.get('etag')
    if (!etag) throw new Error('Güvenli kurulum için ETag alınamadı.')
    if (!o.password || o.password.length < 8) throw new Error('Önce SERVIQ_ADMIN_PINS içine en az 8 karakterli şifre tanımlayın; aynı şifreyi 5. argüman olarak verin.')
    const verified = await (await request('https://serviq.com.tr/.netlify/functions/verify-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId: o.id, pin: o.password }),
    })).json()
    if (!verified.configured || !verified.ok) throw new Error('Sunucudaki şifre doğrulanamadı. İşletme oluşturulmadı.')
    const tables = Object.fromEntries(Array.from({ length: o.count }, (_, i) => [`masa${i+1}`, { no: i+1, name: `Masa ${i+1}` }]))
    menu = { profile: { name: o.name.trim(), brandColor: o.color }, tables, seededAt: Date.now() }
    // Atomic create: prevent collisions and never reset an existing menu/password.
    await request(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify({ menu }) })
    console.log('İşletme kaydedildi. Gerçek menü ve fiyatlar yönetimden girilmeli; örnek ürün eklenmedi.')
  }
  const { tableUrl } = await import(pathToFileURL(path.join(ROOT, 'src/lib/tableQr.js')))
  const { createQrPrintDocument, getQrPrintTheme } = await import(pathToFileURL(path.join(ROOT, 'src/lib/qrPrintTemplates.js')))
  const tables = Object.values(menu.tables || {}).sort((a,b) => a.no - b.no)
  if (!tables.length) throw new Error('Tanımlı masa yok; yönetimden masa ekleyin.')
  let printDocument = await createQrPrintDocument({bizId:o.id,tables,profile:menu.profile})
  // The installer HTML is opened via file://; embed its selected font so it
  // also prints correctly offline, without cross-origin font permissions.
  const printTheme = getQrPrintTheme(menu.profile.qrPrintTheme)
  const font = fs.readFileSync(path.join(ROOT, 'public/fonts/qr', `${printTheme.file}.ttf`)).toString('base64')
  printDocument = printDocument.replace(`https://serviq.com.tr/fonts/qr/${printTheme.file}.ttf`, `data:font/ttf;base64,${font}`)
  const root = process.env.SERVIQ_OUTPUT_DIR || path.join(ROOT, 'kurulum-paketleri')
  fs.mkdirSync(root, { recursive: true })
  const out = fs.mkdtempSync(path.join(root, `${o.onlyQR ? 'qr' : 'kurulum'}-`))
  fs.writeFileSync(path.join(out, 'QR-YAZDIR.html'), printDocument)
  fs.writeFileSync(path.join(out, 'NFC-BAGLANTILARI.txt'), `${menu.profile.name}\nEtiket kaydı: URL (NDEF URI). QR ile aynı masa adresi.\n\n` + tables.map(t => `${t.name || `Masa ${t.no}`}\n${tableUrl(o.id, t.no)}\n`).join('\n'))
  fs.writeFileSync(path.join(out, 'KURULUM-KONTROL.txt'), `${menu.profile.name}\nYönetim: https://serviq.com.tr/yonetim?isletme=${encodeURIComponent(o.id)}\nKasa: https://serviq.com.tr/kasa?isletme=${encodeURIComponent(o.id)}\nGarson: https://serviq.com.tr/garson?isletme=${encodeURIComponent(o.id)}\n\nTESLİMDEN ÖNCE:\n1. Gerçek menü, fiyat ve masaları girin.\n2. Ayrı internet bağlantılı müşteri telefonundan test siparişi verin.\n3. Kasa ve yönetimde aynı sipariş/masa/tutarı görün.\n4. Mutfak, servis, ödeme durumlarını doğrulayın.\n5. Bağlantı kesilince sahte başarı görünmediğini doğrulayın.\n6. Her QR ve NFC etiketini masaya yapıştırmadan okutun.\n7. İşletmeler arası erişim yetkisini test edin.\nŞifreler bu pakete yazılmamıştır.\n`)
  console.log(`QR/NFC dosyaları hazır: ${out}`)
  return out
}
module.exports = { parseArgs, main }
if (require.main === module) main().catch(error => { console.error(`Kurulum durduruldu: ${error.message}`); process.exitCode = 1 })
