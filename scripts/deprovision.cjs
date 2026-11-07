#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')

const ROOT = path.resolve(__dirname, '..')
require('dotenv').config({ path: process.env.SERVIQ_ENV_FILE || path.join(ROOT, '.env'), quiet: true })

const { unregisterRestaurant, findDesktopDir } = require('./registry.cjs')

async function askConfirmation(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close()
      resolve((ans || '').trim().toLowerCase())
    })
  })
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Sunucu işlemi reddetti (HTTP ${response.status}).`)
  return response
}

async function main(args = process.argv.slice(2)) {
  const skipPrompt = args.includes('-y') || args.includes('--yes')
  const cleanArgs = args.filter(a => a !== '-y' && a !== '--yes')
  const rawId = cleanArgs[0]

  if (!rawId || !rawId.trim()) {
    throw new Error('Silinecek işletme ID belirtilmedi. Kullanım: node scripts/deprovision.cjs <isletme-id>')
  }

  const id = rawId.trim()
  if (id.length > 100 || /[.#$\[\]/\u0000-\u001f\u007f]/u.test(id)) {
    throw new Error('Geçersiz işletme ID biçimi.')
  }

  const db = process.env.VITE_FIREBASE_DATABASE_URL
  if (!db || new URL(db).protocol !== 'https:') {
    throw new Error('HTTPS Firebase adresi gerekli. .env dosyasını kontrol edin.')
  }

  const endpoint = new URL(`${db.replace(/\/$/, '')}/businesses/${encodeURIComponent(id)}.json`)
  if (process.env.SERVIQ_FIREBASE_TOKEN) {
    endpoint.searchParams.set('auth', process.env.SERVIQ_FIREBASE_TOKEN)
  }

  // 1. İşletmenin varlığını ve adını kontrol et
  const checkRes = await request(endpoint)
  const existing = await checkRes.json()

  if (!existing || (!existing.menu && !existing.profile)) {
    throw new Error(`Böyle bir restoran bulunamadı: "${id}". Silme işlemi yapılmadı.`)
  }

  const bizName = existing.menu?.profile?.name || existing.profile?.name || id

  // 2. Kullanıcı onayı (eğer -y verilmediyse)
  if (!skipPrompt && process.stdin.isTTY) {
    console.log('\n============================================================')
    console.log('             RESTORAN KALDIRMA ONAYI')
    console.log('============================================================')
    console.log(`Restoran Adı : ${bizName}`)
    console.log(`İşletme ID   : ${id}`)
    console.log('------------------------------------------------------------')
    console.log('UYARI: Bu işlem geri alınamaz! Bu işletmeye ait tüm menü,')
    console.log('masalar, siparişler ve ayarlar kalıcı olarak silinecektir.')
    console.log('============================================================\n')

    const answer = await askConfirmation(`"${bizName}" (${id}) restoranını silmek istediğinize emin misiniz? (E/H): `)
    if (answer !== 'e' && answer !== 'evet' && answer !== 'y' && answer !== 'yes') {
      console.log('\nİşlem iptal edildi. Hiçbir veri silinmedi.')
      return false
    }
  }

  // 3. Firebase'den işletmeyi tamamen sil
  const delRes = await request(endpoint, { method: 'DELETE' })
  if (!delRes.ok) {
    throw new Error(`Firebase verisi silinemedi (HTTP ${delRes.status}).`)
  }

  // 4. Registry ve Masaüstü listesini güncelle
  try {
    unregisterRestaurant(id)
  } catch (err) {
    console.warn('Liste güncellenirken uyarı:', err.message)
  }

  // 5. Masaüstündeki bireysel giriş bilgileri dosyasını temizle (varsa)
  try {
    const desktop = findDesktopDir()
    if (desktop) {
      const safeName = (bizName || id).trim().replace(/[/\\?%*:|"<>]/g, '_')
      const targetTxt = path.join(desktop, `${safeName} - GIRIS BILGILERI.txt`)
      if (fs.existsSync(targetTxt)) {
        fs.unlinkSync(targetTxt)
      }
      const targetTxtById = path.join(desktop, `${id} - GIRIS BILGILERI.txt`)
      if (fs.existsSync(targetTxtById)) {
        fs.unlinkSync(targetTxtById)
      }
    }
  } catch {}

  console.log('\n============================================================')
  console.log(`       RESTORAN BAŞARIYLA SİLİNDİ: ${bizName} (${id})`)
  console.log('============================================================')
  console.log('Masaüstündeki "KURULU-RESTORANLAR.txt" listesi güncellendi.\n')
  return true
}

module.exports = { main }

if (require.main === module) {
  main().catch(err => {
    console.error(`\nHATA: ${err.message}\n`)
    process.exitCode = 1
  })
}
