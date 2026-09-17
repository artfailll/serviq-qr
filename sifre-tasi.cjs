#!/usr/bin/env node
// Yönetim şifrelerini Firebase'den alıp Netlify ortam değişkenine taşır.
//
// NEDEN: Şifreler şu an businesses/{id}/config/password altında ve veritabanı
// kuralları bu düğümü herkese açık okutuyor. İşletme kimliği her masadaki
// QR'ın içinde olduğu için, masaya oturan biri şifreyi çekip yönetim paneline
// girebiliyor.
//
// KULLANIM:
//   node sifre-tasi.cjs            → ne yapacağını gösterir (hiçbir şey yazmaz)
//   node sifre-tasi.cjs --uygula   → Netlify'a yazar
//
// Şifreler ekrana BASILMAZ. Sadece hangi işletmenin taşındığı görünür.
//
// SIRALAMA — önemli:
//   1. Bu betiği --uygula ile çalıştır
//   2. Yeni sürümü canlıya al (deploy)
//   3. Panele girip çalıştığını doğrula
//   4. EN SON database.rules.json'u Firebase Console'dan yayınla
//   Ters sırada yaparsan taşınmamış işletmeler panele giremez.

const { execFileSync } = require('child_process')

const DB = 'https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app'

// İşletme kimlikleri — yeni müşteri ekledikçe buraya da ekle
const ISLETMELER = [
  'alindroid-cafe',
  'bey-sos',
  'cihan-cafe1',
  'emre-cafe',
  'silivri-cafe',
  'yusuf-cafe',
  'CAFE SİNAN',
  'CAFE-SİNAN1',
  'demo cafe',
]

const uygula = process.argv.includes('--uygula')

async function main() {
  const map = {}
  const rapor = []

  for (const biz of ISLETMELER) {
    const url = `${DB}/businesses/${encodeURIComponent(biz)}/config/password.json`
    let pin = null
    try {
      const res = await fetch(url)
      pin = await res.json()
    } catch (e) {
      rapor.push([biz, 'HATA: ' + e.message])
      continue
    }
    if (pin === null || pin === undefined || pin === '') {
      rapor.push([biz, 'şifre yok — atlandı'])
      continue
    }
    map[biz] = String(pin)
    rapor.push([biz, `şifre bulundu (${String(pin).length} hane)`])
  }

  console.log('\n  İşletme şifre taşıma\n  ' + '─'.repeat(46))
  for (const [b, d] of rapor) console.log(`  ${b.padEnd(20)} ${d}`)
  console.log('  ' + '─'.repeat(46))
  console.log(`  Taşınacak: ${Object.keys(map).length} işletme\n`)

  if (!Object.keys(map).length) {
    console.log('  Taşınacak şifre yok, çıkılıyor.\n')
    return
  }

  if (!uygula) {
    console.log('  Deneme modu — hiçbir şey yazılmadı.')
    console.log('  Uygulamak için:  node sifre-tasi.cjs --uygula\n')
    return
  }

  console.log('  Netlify ortam değişkeni yazılıyor…')
  execFileSync('netlify', [
    'env:set', 'SERVIQ_ADMIN_PINS', JSON.stringify(map),
    '--context', 'production',
  ], { stdio: ['ignore', 'ignore', 'inherit'] })
  console.log('  ✓ SERVIQ_ADMIN_PINS yazıldı.\n')

  console.log('  SONRAKİ ADIMLAR')
  console.log('  1. Yeni sürümü deploy et')
  console.log('  2. Bir işletmenin paneline girip şifreyi dene')
  console.log('  3. Çalışıyorsa database.rules.json\'u Firebase Console\'dan yayınla')
  console.log('  4. Sonra config düğümlerini Firebase\'den silebilirsin\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
