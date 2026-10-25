param(
  [Parameter(Mandatory=$true)][string]$bizName,
  [Parameter(Mandatory=$true)][string]$bizId,
  [Parameter(Mandatory=$true)][string]$adminPin,
  [Parameter(Mandatory=$false)][string]$tableCount = "10"
)

$ErrorActionPreference = "Stop"

# 1. Firebase veritabanına şifreyi kaydet
$db = "https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app"
try {
  $body = @{ password = $adminPin } | ConvertTo-Json
  Invoke-RestMethod -Uri "$db/businesses/$bizId/config.json" -Method Put -Body $body -ContentType "application/json" | Out-Null
  Write-Host "  [OK] Yonetim sifresi basariyla kaydedildi: $adminPin" -ForegroundColor Green
} catch {
  Write-Host "  [UYARI] Firebase sifre kaydinda hata: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Kurulum paketini bul ve Masaüstüne kopyala
$repoDir = Split-Path -Parent $PSScriptRoot
$paketlerDir = Join-Path $repoDir "kurulum-paketleri"
$allPackages = Get-ChildItem -Path $paketlerDir -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
$latestPackage = $null
foreach ($pkg in $allPackages) {
  $kFile = Join-Path $pkg.FullName "KURULUM-KONTROL.txt"
  if (Test-Path $kFile) {
    $text = Get-Content $kFile -Raw -ErrorAction SilentlyContinue
    if ($text -match [regex]::Escape($bizId) -or $text -match [regex]::Escape($bizName)) {
      $latestPackage = $pkg
      break
    }
  }
}
if (-not $latestPackage) {
  $latestPackage = $allPackages | Select-Object -First 1
}

$desktop = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$cleanBizName = ($bizName -replace '[\\/:*?"<>|]', '-').Trim()
$targetFolder = Join-Path $desktop "$cleanBizName-Kurulum"

if (-not (Test-Path $targetFolder)) {
  New-Item -ItemType Directory -Path $targetFolder | Out-Null
}

if ($latestPackage) {
  Copy-Item -Path (Join-Path $latestPackage.FullName "*") -Destination $targetFolder -Recurse -Force
}

# 3. Müşteriye gönderilecek hazır bilgi metnini oluştur
$mesaj = @"
=====================================================
         SERVIQ QR MENÜ VE SİPARİŞ SİSTEMİ
              MÜŞTERİ BİLGİLENDİRME
=====================================================

Sayın İşletme Yetkilisi,
$bizName için Serviq Dijital QR Menü ve Sipariş Sisteminiz başarıyla kurulmuş ve aktif edilmiştir.

Aşağıda işletmenize ait yönetim bağlantıları ve önemli kullanım bilgileri yer almaktadır:

-----------------------------------------------------
📱 1. YÖNETİM PANELİ (Patron & Yönetici)
-----------------------------------------------------
• Giriş Linki : https://serviq.com.tr/yonetim?isletme=$bizId
• Şifreniz    : $adminPin

Neler Yapabilirsiniz?
✓ Menü, kategori, ürün ve fiyatları anlık güncelleyebilirsiniz.
✓ Ürün görsellerini ve porsiyon seçeneklerini düzenleyebilirsiniz.
✓ Masalarınızı, marka renginizi ve WiFi şifrenizi tanımlayabilirsiniz.
✓ Günlük sipariş ve ciro raporlarınızı takip edebilirsiniz.

-----------------------------------------------------
🖥️ 2. KASA EKRANI (Sipariş & Hesap Takibi)
-----------------------------------------------------
• Ekran Linki : https://serviq.com.tr/kasa?isletme=$bizId
(Bu ekran şifresizdir, kasadaki tablet veya bilgisayarda sürekli açık bırakılmalıdır)

✓ Masalardan QR kod ile verilen siparişler anında sesli uyarıyla bu ekrana düşer.
✓ Siparişleri 'Onaylandı', 'Hazırlanıyor', 'Teslim Edildi' şeklinde yönetebilirsiniz.
✓ Hesap ödeme ve masa kapatma işlemlerini buradan yapabilirsiniz.

-----------------------------------------------------
👨‍🍳 3. GARSON EKRANI (Mobil Takip)
-----------------------------------------------------
• Ekran Linki : https://serviq.com.tr/garson?isletme=$bizId

✓ Garsonlar kendi telefonlarından masaların doluluk durumunu görebilir.
✓ Müşterilerin masadan gönderdiği "Garson Çağır" bildirimleri buraya gelir.

-----------------------------------------------------
🏷️ 4. MASA QR KODLARI & KURULUM
-----------------------------------------------------
• Klasörünüzdeki "QR-YAZDIR.html" dosyasını çift tıklayarak tarayıcınızda açıp yazıcınızdan çıktı alabilirsiniz.
• Toplam $tableCount adet masanız için özel QR kodlar hazırlandı.
• Her masanın QR kodunu ilgili masaya yapıştırmanız yeterlidir.
• Müşterileriniz herhangi bir uygulama indirmeden telefon kameralarıyla QR kodu okutarak sipariş verebilirler.

-----------------------------------------------------
🚀 İLK KULLANIMA BAŞLARKEN (ÖNERİLEN ADIMLAR)
-----------------------------------------------------
1. Yönetim paneline girin: https://serviq.com.tr/yonetim?isletme=$bizId
2. Şifrenizi yazıp giriş yapın: $adminPin
3. "Kategoriler" bölümünden ürün gruplarınızı (Dönerler, İçecekler, Yan Ürünler vb.) ekleyin.
4. Ürünlerinizi ve fiyatlarınızı girin.
5. Kendi telefonunuzdan herhangi bir masanın QR kodunu okutarak test siparişi verin ve Kasa ekranında siparişi görün.

Hayırlı ve bol kazançlı işler dileriz!
Destek ve sorularınız için bize her zaman ulaşabilirsiniz.
"@

[System.IO.File]::WriteAllText((Join-Path $targetFolder "MUSTERIYE-BILGI-MESAJI.txt"), $mesaj, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $desktop "MUSTERIYE-BILGI-MESAJI.txt"), $mesaj, [System.Text.Encoding]::UTF8)

# 4. KURULUM-KONTROL.txt dosyasına şifreyi ekle
$kontrolPath = Join-Path $targetFolder "KURULUM-KONTROL.txt"
if (Test-Path $kontrolPath) {
  $kontrol = @"
$bizName
Yönetim: https://serviq.com.tr/yonetim?isletme=$bizId
Yönetim Şifresi: $adminPin
Kasa: https://serviq.com.tr/kasa?isletme=$bizId
Garson: https://serviq.com.tr/garson?isletme=$bizId

TESLİMDEN ÖNCE:
1. Gerçek menü, fiyat ve masaları girin.
2. Ayrı internet bağlantılı müşteri telefonundan test siparişi verin.
3. Kasa ve yönetimde aynı sipariş/masa/tutarı görün.
4. Servis ve ödeme durumlarını doğrulayın.
5. Bağlantı kesilince sahte başarı görünmediğini doğrulayın.
6. Her QR ve NFC etiketini masaya yapıştırmadan okutun.
7. İşletmeler arası erişim yetkisini test edin.
"@
  [System.IO.File]::WriteAllText($kontrolPath, $kontrol, [System.Text.Encoding]::UTF8)
}

Write-Host "  [OK] Masaustune kurulum klasoru cikarildi: $targetFolder" -ForegroundColor Green
Write-Host "  [OK] Musteri bilgi mesaji olusturuldu: MUSTERIYE-BILGI-MESAJI.txt" -ForegroundColor Green

# Klasörü Windows Explorer ile aç
Start-Process "explorer.exe" -ArgumentList "`"$targetFolder`""