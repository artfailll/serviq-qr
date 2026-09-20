# Serviq — yayın ve müşteri teslim kontrolü

Güncelleme: 20 Eylül 2026. Çalışma dalı: `fix/reliable-orders-nfc-20260918`.
Başlangıç: `1fc8af22b16f683f565e2d3f983929fac515da55`; upstream ile karşılaştırıldı.
37 birim/statik kontrol ve gerçek Firebase üzerinde ayrı tarayıcı oturumlarıyla
uçtan uca test geçti. Test URL'si yerel Netlify sunucusuydu; bu tek başına canlı
yayın doğrulaması veya fiziksel cihaz testi değildir. Test işletmeleri silindi.

Yerel test raporu: `outputs/serviq-qa-1789900712588-c382f9/report.json`.
Netlify `VITE_FIREBASE_*` build değişkenleri tanımlandı. Üretim derlemesi geçiyor;
ayar eksikse canlı derleme duruyor. Netlify önizleme alan adı mevcut internet
sağlayıcısının filtresine takıldı; bu nedenle aynı build yerelde sınandı.

## Bu değişiklikler

- Eksik Firebase ayarıyla üretim build'i durur; demo çıktısı ayrı `dist-demo` klasöründedir.
- Sipariş ve çağrı başarıları sunucu yazma onayını bekler. Beklerken çift gönderim engellenir;
  reddedilirse sepet korunur. Açık sayfanın kapatılması için uyarı verilir.
- Masa ID'si isim tahmini yerine işletmenin gerçek masa kaydından alınır.
- Üretimde menüyü açmak artık ürün/masa/profil oluşturmaz veya sıfırlamaz.
- Bağlantı ve veri erişim hataları görünür. Başlangıçta sonsuz yükleme yerine hata ekranı vardır.
- Giriş sunucusu erişilemiyorsa yönetim paneli kendiliğinden açılmaz.
- QR içine tam firma adı yerleştirilir, QR/NFC aynı kodlanmış işletme ve masa URL'sini kullanır.
- NFC yazma, iptal ve etiket adresini okuyarak doğrulama eklendi. Donanım testi yapılmadı.
- Service worker artık farklı işletme/rotaların HTML'ini aynı `/` önbelleğine yazmaz.
- Firebase'in eşzamanlı ilk bağlantı bildiriminin siparişi bekletmesi düzeltildi.
- Ürün sayacı aboneliğinin kendi güncellemesini tekrar tetiklemesi kaldırıldı;
  eşzamanlı sayımlar transaction ile yapılıyor.
- Kasa, garson ve yönetim bağlantıları işletme kimliğini açıkça taşıyor.
- Dönerhane, Ocakbaşı ve Köz: üç farklı düzen ve animasyonlu menü teması.
  Hareket azaltma tercihi ve ekran dışı animasyon duraklatma destekleniyor.
  GitHub Magic UI MIT kaynak uyarlaması için `THIRD_PARTY_NOTICES.md` var.
- Yanına iyi gider önerileri sepetteki yemeğe, mevcut içeceğe ve paket içeriğine göre seçiliyor.
- İşletme Profili → Sadakat programı: harcama/puan oranı, ödül eşiği ve ödül adı.
  İşletme OS → Müşteri & Sadakat: personel onayıyla puan düşümü ve ödül kaydı.
  Ödül otomatik adisyon indirimi/ücretsiz stok hareketi değildir; teslim kaydıdır.
- Gün sonu tek atomik güncellemede yalnızca ödenmiş/iptal edilmiş kayıtları taşır;
  açık/yeni siparişler, çağrılar ve masa yerleşimi korunur.
- Kuruşlu tutarlar artık ekranda tam gösterilir; boş menü sonsuz skeleton göstermez.
- Netlify fonksiyonları için CommonJS paket sınırı eklendi; giriş fonksiyonu doğrulandı.

## Kesinlikle tamamlanmış sayılmayanlar

1. Firebase Authentication + işletme/rol bazlı sunucu kuralları henüz yok.
   Mevcut GitHub kuralları orders, finance ve menü gibi alanlarda yetkisiz erişimi
   yeterince kısıtlamıyor. Panelde şifre olması veritabanı yetkilendirmesi değildir.
   Müşteri fiyatı/tutarı da sunucuda güvenilir menü fiyatlarından doğrulanmalı.
   Bu kuralları olduğu gibi çok müşterili güvenli ERP saymayın; körlemesine yayınlamayın.
2. Stok düşümü/ödeme/gün sonu istemci tarafında kısmi başarısızlık yaşayabilir.
   Stok claim bayrağı sonrası kesinti için sunucu tarafında idempotent işlem ve
   yeniden deneme gerekir. Bu akışların tam muhasebe doğruluğu doğrulanmadı.
3. Fiziksel NFC etiketi ve telefon kameralarıyla QR okuma testi yapılmadı.
4. Gerçek Firebase ile ayrı müşteri/kasa/yönetim/garson tarayıcı oturumları geçti.
   Farklı fiziksel cihaz/ağ testi ve her müşterinin kurulum kabulü ayrıca yapılmalı.
5. Bilgisayardaki eski masaüstü kurulum kısayolu bu çalışma kopyasına güncellenmedi.
6. Netlify `SERVIQ_ADMIN_PINS` henüz tanımlı değil. Yeni güvenli kurulum komutu
   sunucuda şifre doğrulanmadan işletme oluşturmaz. Eski müşteriler için legacy
   giriş korunuyor; bunu güvenli yetkilendirme olarak değerlendirmeyin.
7. `npm audit fix` kırıcı güncelleme yapılmadan uygulandı. Kalan 14 bağımlılık
   uyarısı (12 orta, 2 yüksek) ayrıca sürüm geçişi gerektiriyor; güvenlik işi tamamlanmadı.
8. ArtıPOS entegrasyonu ertelendi; POS API/iş ortaklığı bilgisi bekleniyor.

## Tekrarlanabilir uçtan uca kontrol

`SERVIQ_RUN_INTEGRATION=1 SERVIQ_ENV_FILE=/yerel/.env SERVIQ_TEST_BASE=http://127.0.0.1:8891 node scripts/verify-integration.mjs`

Komut sadece kendisinin oluşturduğu rastgele iki QA işletmesinde işlem yapar ve
sonunda bunları siler. Sipariş/çağrı onayı, kasa/yönetim senkronu, garson, ödeme,
puan/ödül, profil ayarları, QR çözümleme, gün sonu ve çevrimdışı sepet test edilir.
Rapor/screenshot çıktısı `outputs/` altındadır ve Git'e eklenmez.

## Yeni kurulum aracı

`node yeni-musteri.cjs "İşletme Adı" isletme-id 10 "#f97316" "SUNUCUDA_TANIMLI_SIFRE"`

Yeni kayıt önce mevcut işletme çakışmasını kontrol eder, sunucuda tanımlı yönetim
şifresini doğrular ve ETag ile atomik kayıt yapar. Çalışan işletmeyi sıfırlamaz.
Sunucu PIN haritası/uygun kurulum yetkisi yoksa durur; açık veritabanına düz metin
şifre bırakmaz. Atomik kök kayıt için yetkili kurulum kimliği gerekebilir.
`SERVIQ_FIREBASE_TOKEN` yalnızca yerel kurulum aracı içindir, VITE_ olarak tanımlamayın.

Mevcut işletme QR/NFC paketi: `node yeni-musteri.cjs --only-qr isletme-id`
Bu mod yalnızca okur; gerçek masa listesini kullanır, şifre/menü/masa değiştirmez.
Eski komuttaki isteğe bağlı masa sayısı artık dikkate alınmaz.

Varsayılan çıktı `kurulum-paketleri/` altında yeni bir klasördür: firma isimli
QR-YAZDIR.html, NFC-BAGLANTILARI.txt ve teslim kontrol listesi. Şifre pakete yazılmaz.
Başka .env için SERVIQ_ENV_FILE, başka çıktı klasörü için SERVIQ_OUTPUT_DIR kullanılabilir.

## Yayın kapısı

1. Güncel main ile birleştir; mevcut Netlify fonksiyonlarını koru.
2. Netlify build ortamındaki VITE_FIREBASE_* değerlerini doğrula. Demo modu yayımlama.
3. `npm test` ve gerçek ayarlı `npm run build` çalıştır.
4. Ayrı bir test işletmesi aç; gerçek müşteri verisine test siparişi yazma.
5. Ayrı tarayıcı profilleri/ağlardan müşteri, kasa, yönetim ve garsonu aç.
6. Siparişin bir kez ve doğru masa/tutarla tüm ekranlara geldiğini doğrula.
7. Durumu mutfak → hazır → servis → ödeme ilerlet; müşteri durumunu, ciro ve stoğu doğrula.
8. İnternet kesintisi, izin reddi, çift tık, yeniden yükleme ve kapanış senaryolarını dene.
9. Bir işletmenin hesabıyla diğerinin verisine erişilemediğini sunucu kurallarıyla doğrula.
10. Her müşterinin QR/NFC etiketini fiziksel olarak tara; baskıda firma adını kontrol et.
11. Test verilerini yalnızca test işletmesinden temizle; yayın sonrası kısa kabul testi yap.

NFC tarayıcı desteği: https://developer.chrome.com/docs/capabilities/nfc
Tarayıcı desteklemiyorsa masa URL'si NFC yazma uygulamasında URL kaydı olarak yazılır.
