#!/usr/bin/env node
// ─────────────────────────────────────────────────────
//  Sofra QR — Yeni Müşteri Kurulum Scripti
//  Kullanım: node yeni-musteri.js
//
//  1) İşletme bilgilerini girer
//  2) Firebase'e profil + menü yazar
//  3) QR kodlarını üretir
//  4) Masaüstüne ZIP bırakır
// ─────────────────────────────────────────────────────
const readline = require('readline')
const QRCode   = require('qrcode')
const fs       = require('fs')
const path     = require('path')
const https    = require('https')
const os       = require('os')
const { execSync } = require('child_process')

// Firebase REST URL (.env'den okur)
require('dotenv').config({ path: path.join(__dirname, '.env') })
const DB = process.env.VITE_FIREBASE_DATABASE_URL

const SITE = 'https://serviq.com.tr'
const DESKTOP = path.join(os.homedir(), 'Desktop')

// ── Renkler ──
const C = { g: '\x1b[32m', b: '\x1b[34m', y: '\x1b[33m', r: '\x1b[31m', bold: '\x1b[1m', x: '\x1b[0m' }
const ok  = (s) => console.log(`${C.g}✅ ${s}${C.x}`)
const err = (s) => console.log(`${C.r}❌ ${s}${C.x}`)
const inf = (s) => console.log(`${C.b}ℹ  ${s}${C.x}`)
const hdr = (s) => console.log(`\n${C.bold}${C.y}── ${s} ──${C.x}\n`)

// ── Soru sor ──
function ask(rl, q, def) {
  return new Promise(resolve => {
    const hint = def ? ` (varsayılan: ${def})` : ''
    rl.question(`${C.bold}${q}${hint}: ${C.x}`, (a) => {
      resolve(a.trim() || def || '')
    })
  })
}

// ── Türkçe → slug ──
function slugify(str) {
  const map = { ç:'c', ğ:'g', ı:'i', İ:'i', ö:'o', ş:'s', ü:'u', Ç:'c', Ğ:'g', Ö:'o', Ş:'s', Ü:'u' }
  return str.toLowerCase().replace(/[çğıİöşüÇĞÖŞÜ]/g, m => map[m] || m)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Firebase REST ──
function firebasePatch(path, data) {
  return new Promise((resolve, reject) => {
    if (!DB) return reject(new Error('VITE_FIREBASE_DATABASE_URL .env dosyasında yok'))
    const body = JSON.stringify(data)
    const url = new URL(`${DB}/${path}.json`)
    const opts = { hostname: url.hostname, path: url.pathname + url.search, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }
    const req = https.request(opts, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => res.statusCode < 300 ? resolve(JSON.parse(d)) : reject(new Error(`HTTP ${res.statusCode}: ${d}`)))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function firebaseDelete(path) {
  return new Promise((resolve, reject) => {
    if (!DB) return resolve()
    const url = new URL(`${DB}/${path}.json`)
    const opts = { hostname: url.hostname, path: url.pathname + url.search, method: 'DELETE' }
    const req = https.request(opts, (res) => { res.resume(); resolve() })
    req.on('error', reject)
    req.end()
  })
}

// ── Masa sayısını ayarla (Firebase) ──
async function writeTables(bizId, count) {
  const tables = {}
  for (let i = 1; i <= count; i++) {
    tables[`masa${i}`] = { no: i, name: `Masa ${i}` }
  }
  await firebasePatch(`businesses/${bizId}/menu/tables`, tables)
}

// ── QR HTML şablonu ──
function qrHtml(n, svg, bizName) {
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><title>${bizName} · Masa ${n}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#fff7ed;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .card{background:#fff;border-radius:28px;padding:36px 32px 28px;text-align:center;box-shadow:0 12px 48px rgba(249,115,22,.18);max-width:340px;width:100%;border:2px solid #fed7aa}
  .brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:20px}
  .brand-icon{width:44px;height:44px;background:#f97316;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(249,115,22,.4)}
  .brand-icon svg{width:24px;height:24px;fill:#fff}
  .biz-name{font-size:22px;font-weight:900;color:#1e293b}
  .qr-wrap{background:#fff7ed;border-radius:20px;padding:16px;display:inline-block;border:2px dashed #fdba74}
  .qr-wrap svg{width:220px;height:220px;display:block}
  .masa-badge{display:inline-block;background:#f97316;color:#fff;font-size:20px;font-weight:900;padding:8px 28px;border-radius:50px;margin:20px 0 16px;box-shadow:0 4px 16px rgba(249,115,22,.35)}
  .steps{background:#f8fafc;border-radius:16px;padding:14px 16px;text-align:left}
  .step{display:flex;align-items:center;gap:10px;font-size:13px;color:#475569;font-weight:600;padding:4px 0}
  .step-num{width:22px;height:22px;min-width:22px;background:#f97316;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
  .footer{margin-top:14px;font-size:11px;color:#cbd5e1;font-weight:600}
  @media print{body{background:#fff}.card{box-shadow:none;border:2px solid #e2e8f0}}
</style></head><body>
<div class="card">
  <div class="brand">
    <div class="brand-icon"><svg viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg></div>
    <div class="biz-name">${bizName}</div>
  </div>
  <div class="qr-wrap">${svg}</div>
  <div class="masa-badge">MASA ${n}</div>
  <div class="steps">
    <div class="step"><div class="step-num">1</div>Telefonunuzun kamerasını açın</div>
    <div class="step"><div class="step-num">2</div>QR kodu kameraya tutun</div>
    <div class="step"><div class="step-num">3</div>Açılan menüden seçim yapın</div>
    <div class="step"><div class="step-num">4</div>Siparişi onaylayın, garson gelir</div>
  </div>
  <div class="footer">sofraqr.netlify.app · Ödeme kasada yapılır</div>
</div></body></html>`
}

// ── Ana akış ──
async function main() {
  console.clear()
  console.log(`${C.bold}${C.y}
╔══════════════════════════════════════════╗
║   🍽  SOFRA QR · Yeni Müşteri Kurulumu   ║
╚══════════════════════════════════════════╝${C.x}`)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  hdr('İşletme Bilgileri')
  const bizName   = await ask(rl, 'İşletme adı', 'Sofra Restoran')
  const suggested = slugify(bizName)
  const bizId     = await ask(rl, 'İşletme ID (URL\'de görünür)', suggested)
  const tableCount= parseInt(await ask(rl, 'Masa sayısı', '20'))
  const tagline   = await ask(rl, 'Slogan (isteğe bağlı)', '')
  const address   = await ask(rl, 'Adres (isteğe bağlı)', '')
  const wifi      = await ask(rl, 'Wi-Fi şifresi (isteğe bağlı)', '')
  const phone     = await ask(rl, 'Telefon (isteğe bağlı)', '')
  const color     = await ask(rl, 'Marka rengi (hex)', '#f97316')

  rl.close()

  // Özet
  hdr('Özet')
  console.log(`  İşletme   : ${C.bold}${bizName}${C.x}`)
  console.log(`  ID        : ${C.bold}${bizId}${C.x}`)
  console.log(`  Masa sayısı: ${tableCount}`)
  console.log(`  Menü URL  : ${SITE}/menu?isletme=${bizId}&masa=1`)
  console.log(`  Kasa URL  : ${SITE}/kasa?isletme=${bizId}`)
  console.log(`  Yönetim   : ${SITE}/yonetim?isletme=${bizId}`)
  console.log('')

  // 1. Firebase'e profil yaz
  if (DB) {
    process.stdout.write(`${C.b}⏳ Firebase'e profil yazılıyor...${C.x}`)
    try {
      await firebasePatch(`businesses/${bizId}/menu/profile`, {
        name: bizName, tagline, address, phone, wifi,
        brandColor: color, cover: '/img/p5.jpg',
      })
      await firebaseDelete(`businesses/${bizId}/menu/seededAt`)
      await writeTables(bizId, tableCount)
      process.stdout.write(`\r${C.g}✅ Firebase profil + ${tableCount} masa kaydedildi          ${C.x}\n`)
    } catch (e) {
      process.stdout.write(`\r${C.r}❌ Firebase hatası: ${e.message}${C.x}\n`)
    }
  } else {
    inf('.env\'de Firebase URL yok — profil kaydedilmedi (demo mod)')
  }

  // 2. QR dosyalarını üret
  process.stdout.write(`${C.b}⏳ ${tableCount} QR üretiliyor...${C.x}`)
  const tmpDir = path.join(os.tmpdir(), `sofra-qr-${bizId}`)
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

  await Promise.all(
    Array.from({ length: tableCount }, (_, i) => i + 1).map(async (n) => {
      const url = `${SITE}/menu?isletme=${bizId}&masa=${n}`
      const svg = await QRCode.toString(url, { type: 'svg', width: 300, margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' } })
      fs.writeFileSync(path.join(tmpDir, `qr-masa-${n}.html`), qrHtml(n, svg, bizName))
    })
  )
  process.stdout.write(`\r${C.g}✅ ${tableCount} QR üretildi                          ${C.x}\n`)

  // 3. ZIP oluştur
  const zipName = `${bizId}-qr-${tableCount}-masa.zip`
  const zipPath = path.join(DESKTOP, zipName)
  process.stdout.write(`${C.b}⏳ ZIP oluşturuluyor...${C.x}`)
  try {
    // Windows: PowerShell Compress-Archive
    const files = Array.from({ length: tableCount }, (_, i) =>
      path.join(tmpDir, `qr-masa-${i + 1}.html`)
    ).join('","')
    execSync(
      `powershell -Command "Compress-Archive -Path @(\\"${files}\\") -DestinationPath \\"${zipPath}\\" -Force"`,
      { stdio: 'pipe' }
    )
    process.stdout.write(`\r${C.g}✅ ZIP hazır                                   ${C.x}\n`)
  } catch {
    // Fallback: tek tek kopyala
    const fallback = path.join(DESKTOP, `${bizId}-qr`)
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback)
    for (let i = 1; i <= tableCount; i++) {
      fs.copyFileSync(path.join(tmpDir, `qr-masa-${i}.html`), path.join(fallback, `qr-masa-${i}.html`))
    }
    process.stdout.write(`\r${C.g}✅ QR klasörü masaüstünde: ${fallback}${C.x}\n`)
  }

  // Temizlik
  fs.rmSync(tmpDir, { recursive: true, force: true })

  // Sonuç
  hdr('Tamamlandı')
  ok(`Masaüstünde: ${zipName}`)
  console.log('')
  console.log(`${C.bold}Müşteriye verilecek bilgiler:${C.x}`)
  console.log(`  📱 Menü (müşteri)  : ${SITE}/menu?isletme=${bizId}&masa=1`)
  console.log(`  🖥  Kasa ekranı    : ${SITE}/kasa?isletme=${bizId}`)
  console.log(`  ⚙️  Yönetim paneli  : ${SITE}/yonetim?isletme=${bizId}`)
  console.log(`  🗂  QR zip          : Masaüstünde "${zipName}"`)
  console.log('')
  console.log(`${C.y}Not: Yönetim panelinde "İşletme Profili" sekmesinden logo ve kapak fotoğrafı ekleyebilirler.${C.x}`)
  console.log('')
}

main().catch(e => { err(e.message); process.exit(1) })
