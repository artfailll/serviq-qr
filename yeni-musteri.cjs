#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  Sofra QR — Yeni Müşteri Kurulum Scripti
//
//  Kullanım:
//    node yeni-musteri.cjs "Restoran Adı" restoran-id masa-sayisi
//
//  Örnek:
//    node yeni-musteri.cjs "Burger İstanbul" burger-istanbul 15
//
//  İsteğe bağlı 4. argüman — marka rengi (hex):
//    node yeni-musteri.cjs "Burger İstanbul" burger-istanbul 15 "#ef4444"
// ─────────────────────────────────────────────────────────────

const QRCode = require('qrcode')
const fs     = require('fs')
const path   = require('path')
const https  = require('https')
const os     = require('os')
const { execSync } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '.env') })

const DB         = process.env.VITE_FIREBASE_DATABASE_URL
const SITE       = 'https://serviq.com.tr'
const DESKTOP    = path.join(os.homedir(), 'Desktop')
const MUSTERI_DIR = path.join(DESKTOP, 'sofra-musteriler')
if (!fs.existsSync(MUSTERI_DIR)) fs.mkdirSync(MUSTERI_DIR)

const G = '\x1b[32m', B = '\x1b[34m', Y = '\x1b[33m', R = '\x1b[31m',
      BOLD = '\x1b[1m', X = '\x1b[0m'

function log(emoji, msg, color = '') { console.log(`${color}${emoji}  ${msg}${X}`) }

// ── Argümanları oku ──
const [,, bizName, bizId, tableCntArg, colorArg, passwordArg] = process.argv

if (!bizName || !bizId) {
  console.log(`\n${BOLD}${Y}Kullanım:${X}`)
  console.log(`  node yeni-musteri.cjs "Restoran Adı" restoran-id masa-sayisi [renk]\n`)
  console.log(`${BOLD}Örnekler:${X}`)
  console.log(`  node yeni-musteri.cjs "Kafe Silivri" kafe-silivri 20`)
  console.log(`  node yeni-musteri.cjs "Burger Kadıköy" burger-kadikoy 12 "#ef4444"\n`)
  process.exit(0)
}

const tableCount = parseInt(tableCntArg) || 20
const brandColor = colorArg || '#f97316'
// Şifre: 5. argüman veya otomatik üret
const adminPassword = passwordArg || Math.random().toString(36).slice(2, 8).toUpperCase()

// ── Firebase REST ──
function firebaseSet(fbPath, data) {
  return new Promise((resolve, reject) => {
    if (!DB) { console.log(`${Y}⚠  Firebase URL yok — profil kaydedilmedi${X}`); return resolve() }
    const body = JSON.stringify(data)
    const url  = new URL(`${DB}/${fbPath}.json`)
    const opts = {
      hostname: url.hostname, path: url.pathname,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }
    const req = https.request(opts, (res) => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error(`HTTP ${res.statusCode}`))))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function firebaseDel(fbPath) {
  return new Promise((resolve) => {
    if (!DB) return resolve()
    const url = new URL(`${DB}/${fbPath}.json`)
    const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'DELETE' }, (res) => { res.resume(); resolve() })
    req.on('error', () => resolve())
    req.end()
  })
}

// ── QR HTML ──
function makeHtml(n, svg) {
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="robots" content="noindex,nofollow,noarchive"><title>${bizName} · Masa ${n}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#fff7ed;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .card{background:#fff;border-radius:28px;padding:36px 32px 28px;text-align:center;box-shadow:0 12px 48px rgba(249,115,22,.18);max-width:340px;width:100%;border:2px solid #fed7aa}
  .brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:20px}
  .icon{width:44px;height:44px;background:${brandColor};border-radius:12px;display:flex;align-items:center;justify-content:center}
  .icon svg{width:24px;height:24px;fill:#fff}
  .biz{font-size:20px;font-weight:900;color:#1e293b}
  .qr-wrap{background:#fff7ed;border-radius:20px;padding:16px;display:inline-block;border:2px dashed #fdba74}
  .qr-wrap svg{width:220px;height:220px;display:block}
  .badge{display:inline-block;background:${brandColor};color:#fff;font-size:20px;font-weight:900;padding:8px 28px;border-radius:50px;margin:20px 0 16px}
  .steps{background:#f8fafc;border-radius:16px;padding:14px 16px;text-align:left}
  .step{display:flex;align-items:center;gap:10px;font-size:13px;color:#475569;font-weight:600;padding:4px 0}
  .num{width:22px;height:22px;min-width:22px;background:${brandColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
  .footer{margin-top:14px;font-size:11px;color:#cbd5e1;font-weight:600}
  @media print{body{background:#fff}.card{box-shadow:none;border:2px solid #e2e8f0}}
</style></head><body>
<div class="card">
  <div class="brand">
    <div class="icon"><svg viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg></div>
    <div class="biz">${bizName}</div>
  </div>
  <div class="qr-wrap">${svg}</div>
  <div class="badge">MASA ${n}</div>
  <div class="steps">
    <div class="step"><div class="num">1</div>Telefonunuzun kamerasını açın</div>
    <div class="step"><div class="num">2</div>QR kodu kameraya tutun</div>
    <div class="step"><div class="num">3</div>Açılan menüden seçim yapın</div>
    <div class="step"><div class="num">4</div>Siparişi onaylayın, garson gelir</div>
  </div>
  <div class="footer">serviq.com.tr · Ödeme kasada yapılır</div>
</div></body></html>`
}

async function main() {
  console.log(`\n${BOLD}${Y}╔══════════════════════════════════════╗`)
  console.log(`║  🍽  serviq · Yeni Müşteri Kurulumu    ║`)
  console.log(`╚══════════════════════════════════════╝${X}\n`)

  log('📋', `İşletme  : ${BOLD}${bizName}${X}`)
  log('🔑', `ID       : ${BOLD}${bizId}${X}`)
  log('🪑', `Masa     : ${BOLD}${tableCount}${X}`)
  log('🎨', `Renk     : ${BOLD}${brandColor}${X}`)
  log('🔒', `Şifre    : ${BOLD}${adminPassword}${X}`)
  console.log()

  // 1) Firebase profil
  process.stdout.write(`${B}⏳ Firebase profil yazılıyor...${X}`)
  try {
    await firebaseSet(`businesses/${bizId}/menu/profile`, {
      name: bizName, brandColor, cover: '', tagline: '', address: '', phone: '', wifi: '',
    })
    // Masaları yaz
    const tables = {}
    for (let i = 1; i <= tableCount; i++) tables[`masa${i}`] = { no: i, name: `Masa ${i}` }
    await firebaseSet(`businesses/${bizId}/menu/tables`, tables)
    // seededAt sil ki menü yeniden tohumlansin
    await firebaseDel(`businesses/${bizId}/menu/seededAt`)
    // Yönetim şifresi
    await firebaseSet(`businesses/${bizId}/config`, { password: adminPassword })
    process.stdout.write(`\r${G}✅ Firebase: profil + ${tableCount} masa + şifre kaydedildi  ${X}\n`)
  } catch (e) {
    process.stdout.write(`\r${R}❌ Firebase hatası: ${e.message}${X}\n`)
  }

  // 2) QR dosyaları
  process.stdout.write(`${B}⏳ ${tableCount} QR üretiliyor...${X}`)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sofra-qr-'))
  await Promise.all(
    Array.from({ length: tableCount }, (_, i) => i + 1).map(async (n) => {
      const url = `${SITE}/menu?isletme=${bizId}&masa=${n}`
      const svg = await QRCode.toString(url, { type: 'svg', width: 300, margin: 2, color: { dark: '#1e293b', light: '#fff' } })
      fs.writeFileSync(path.join(tmpDir, `qr-masa-${n}.html`), makeHtml(n, svg))
    })
  )
  process.stdout.write(`\r${G}✅ ${tableCount} QR üretildi                          ${X}\n`)

  // 3) ZIP
  const zipName = `${bizId}-${tableCount}-masa-qr.zip`
  const zipPath = path.join(DESKTOP, zipName)
  process.stdout.write(`${B}⏳ ZIP oluşturuluyor...${X}`)
  try {
    // PowerShell: klasörden tüm HTML'leri al ve zip'le
    execSync(
      `powershell -NoProfile -Command "` +
      `$f = Get-ChildItem -Path '${tmpDir.replace(/\\/g,"/")}' -Filter '*.html' | Select-Object -ExpandProperty FullName; ` +
      `Compress-Archive -Path $f -DestinationPath '${zipPath.replace(/\\/g,"/")}' -Force"`,
      { stdio: 'pipe' }
    )
    process.stdout.write(`\r${G}✅ ZIP hazır: ${zipName}                   ${X}\n`)
  } catch {
    // Fallback: klasör
    const outDir = path.join(DESKTOP, `${bizId}-qr-kodlar`)
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
    fs.readdirSync(tmpDir).forEach(f => fs.copyFileSync(path.join(tmpDir, f), path.join(outDir, f)))
    process.stdout.write(`\r${G}✅ QR klasörü: ${outDir}${X}\n`)
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })

  // Sonuç
  console.log(`\n${BOLD}${Y}── Müşteriye verilecek bilgiler ──${X}\n`)
  console.log(`  📱 Müşteri menü  : ${SITE}/menu?isletme=${bizId}&masa=1`)
  console.log(`  🖥  Kasa ekranı  : ${SITE}/kasa?isletme=${bizId}`)
  console.log(`  ⚙️  Yönetim      : ${SITE}/yonetim?isletme=${bizId}`)
  console.log(`  🔒 Yönetim şifre : ${BOLD}${adminPassword}${X}`)
  console.log(`  📦 QR zip        : Masaüstünde "${zipName}"`)
  console.log(`\n${G}✅ Kurulum tamamlandı!${X}\n`)

  // ── Müşteriye gönderilecek mesaj ──
  const tarih = new Date().toLocaleDateString('tr-TR')
  const saat  = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  const waMesaj = `Merhaba! ${bizName} için serviq sisteminiz hazır 🎉

📱 Müşteri menüsü otomatik çalışıyor — QR kodlarını masalara koymanız yeterli.

🖥 Kasa ekranı (tablet/bilgisayarda açık kalsın):
${SITE}/kasa?isletme=${bizId}

⚙️ Yönetim paneli (menü düzenleme, istatistik):
${SITE}/yonetim?isletme=${bizId}
Şifre: ${adminPassword}

📦 QR kodlar için ZIP dosyasını ayrıca göndereceğim.
Her HTML dosyasını Chrome'da açıp Ctrl+P ile yazdırabilirsiniz.

Herhangi bir sorun olursa beni arayın, hemen yardımcı olurum! 🙏`

  // Dosyaya kaydet
  const musteriDosya = path.join(MUSTERI_DIR, `${bizId}.txt`)
  const dosyaIcerigi = `================================================
  ${bizName.toUpperCase()}
  Kurulum: ${tarih} ${saat}
================================================

ID        : ${bizId}
Masa      : ${tableCount}
Renk      : ${brandColor}
Sifre     : ${adminPassword}

LINKLER:
  Musteri : ${SITE}/menu?isletme=${bizId}&masa=1
  Kasa    : ${SITE}/kasa?isletme=${bizId}
  Yonetim : ${SITE}/yonetim?isletme=${bizId}

WHATSAPP MESAJI:
------------------------------------------------
${waMesaj}
------------------------------------------------
`
  // BOM ekle — Windows Notepad Türkçe/emoji'yi doğru gösterir
  fs.writeFileSync(musteriDosya, '﻿' + dosyaIcerigi, 'utf8')

  // Ana listeye ekle
  const listeYolu = path.join(MUSTERI_DIR, '_liste.txt')
  const listeGirisi = `${tarih} | ${bizId.padEnd(25)} | ${String(tableCount).padEnd(4)} masa | ${bizName}\n`
  // Liste yoksa BOM ile başlat
  if (!fs.existsSync(listeYolu)) fs.writeFileSync(listeYolu, '﻿', 'utf8')
  fs.appendFileSync(listeYolu, listeGirisi, 'utf8')

  // Terminale göster
  console.log(`\n${Y}${'─'.repeat(52)}${X}`)
  console.log(`${BOLD}📲 WHATSAPP MESAJI — kopyala, müşteriye gönder:${X}`)
  console.log(`${Y}${'─'.repeat(52)}${X}`)
  console.log(waMesaj)
  console.log(`${Y}${'─'.repeat(52)}${X}`)
  console.log(`\n${G}📁 Bilgiler kaydedildi: sofra-musteriler/${bizId}.txt${X}`)
  console.log(`${G}📋 Müşteri listesi   : sofra-musteriler/_liste.txt${X}\n`)
}

main().catch(e => { console.error(`${R}❌ ${e.message}${X}`); process.exit(1) })
