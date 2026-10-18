# 🍽️ serviq — QR Restoran Sipariş Sistemi

Her masaya özel QR kod ile çalışan, **gerçek zamanlı** restoran sipariş sistemi.
Müşteri telefonundan sipariş verir, kasa ekranı başka cihazda saniyesinde görür.
Online ödeme yoktur — sistem yalnızca siparişi mutfağa/kasaya iletir.

**Canlı:** https://serviq.com.tr
**Stack:** React + Vite + Tailwind CSS + Firebase Realtime Database + Recharts + Framer Motion + Lucide

---

## 🚀 YENİ BİLGİSAYARDA KURULUM

```bash
git clone https://github.com/artfailll/serviq-qr.git
cd serviq-qr
npm install
```

### 1) `.env` dosyasını oluştur (ZORUNLU — repoda yoktur, gizlidir)

`.env.example` dosyasını `.env` olarak kopyala ve Firebase bilgilerini doldur.
Değerleri **Firebase Console → Proje Ayarları → Web uygulaması** bölümünden al
(proje adı: `sofra-restoran`, Realtime DB konumu: `europe-west1`).

> `.env` boş bırakılırsa uygulama otomatik **demo mod**da çalışır
> (localStorage + BroadcastChannel; cihazlar arası senkron olmaz).

### 2) Geliştirme sunucusu

```bash
npm run dev
```

### 3) Canlıya alma (deploy)

```bash
npm run build
npx --yes netlify-cli deploy --prod --dir=dist
```

⚠️ **ASLA** Netlify'a tek dosya (index.html vb.) elle yükleme — tüm site çöker.
Her zaman `npm run build` sonrası **tüm `dist` klasörünü** yayınla.
İlk deploy'da Netlify hesabına giriş istenebilir (`npx netlify-cli login`);
site bağlantısı `.netlify/state.json` içindeki siteId ile otomatik gelir.

### 4) AI özellikleri (menü tarama, foto üretimi, çeviri)

Netlify Functions üzerinde çalışır ve `OPENAI_API_KEY` ortam değişkeni ister.
Bu anahtar **Netlify panelinde** tanımlıdır (Site settings → Environment variables),
yerel `npm run dev` ortamında AI özellikleri çalışmaz — bu normaldir.

### Ekranlar

| Adres | Açıklama |
|---|---|
| `/menu?isletme=<id>&masa=<no>` | Müşteri menüsü (QR bu adrese gider) |
| `/kasa?isletme=<id>` | Kasa ekranı (şifre korumalı) |
| `/garson?isletme=<id>` | Garson sipariş ekranı (şifre korumalı) |
| `/yonetim?isletme=<id>` | Yönetim paneli (şifre korumalı) |

Yeni müşteri kurulumu: `node yeni-musteri.cjs "İşletme Adı" isletme-id 20`

Windows'ta masaüstünden kurulum başlatmak için `YENI-RESTORAN-KUR.bat` dosyasını çalıştırın. İlk çalıştırmada GitHub deposunu indirir ve `.env` ayarlarını hazırlatır; sonraki çalıştırmalarda restoran adı, işletme ID'si, masa sayısı, renk ve sunucuda tanımlı yönetim PIN'ini ister. Gereksinimler: Git for Windows ve Node.js LTS. BAT dosyası mevcut depo dosyalarını otomatik güncellemez.

---

## ✨ Özellikler

### 📱 Müşteri Ekranı (`/menu?masa=5`)
- QR'dan masa otomatik tanınır (URL'deki `?masa=5` parametresi)
- Kategorili menü; ürün görseli, fiyat, açıklama
- Sepete ekleme, adet seçimi, **ürün notu** (acısız, soğansız vb. hızlı etiketler)
- Stokta olmayan ürün **"Tükendi"** görünür, sipariş edilemez
- Sabit köşe butonları: **Garson Çağır** ve **Hesap İste** → kasaya anlık bildirim
- Sipariş onayı → kasaya/mutfağa düşer

### 🧾 Kasa Ekranı (`/kasa`)
- Gelen siparişler **anlık** düşer + **ses uyarısı** ("Sesi Aç" ile etkinleştirilir)
- Sipariş durumu akışı: **Yeni → Mutfakta → Hazır → Tamamlandı** (kolonlar halinde)
- Garson/hesap çağrıları üstte **ayrı renkte** (turuncu/mavi) gösterilir
- Canlı istatistikler: bekleyen, hazırlanan, bugün teslim, günlük ciro

### 📊 Yönetim Paneli (`/yonetim`)
- **Masa haritası:** her masa renk kodlu kart (boş / dolu / sipariş bekliyor)
- Her masanın **oturma süresi** (canlı sayaç) ve aktif sipariş tutarı
- Sipariş bekleyen masada görsel vurgu ("yeni" rozeti, parlama)
- **Masa birleştirme** ve **masa taşıma**
- **Menü yönetimi:** ürün ekle/sil, fiyat değiştir, **Tükendi/Stokta** anahtarı
- **İstatistikler:** en çok satanlar, kategori dağılımı, saatlik ciro grafikleri
- **Gün sonu Z raporu** (yazdırılabilir)

---

## 🚀 Hızlı Başlangıç

```bash
npm install
npm run dev
```

Tarayıcıda açın: **http://localhost:5173**

Açılış sayfasından üç ekrana da geçebilirsiniz. Test için:
- Müşteri: `http://localhost:5173/menu?masa=5`
- Kasa: `http://localhost:5173/kasa`
- Yönetim: `http://localhost:5173/yonetim`

> 💡 **Demo Mod:** Firebase ayarlamadan da çalışır. Veriler tarayıcıda saklanır ve
> **aynı tarayıcının sekmeleri arasında anlık senkronlanır**. Hemen denemek için:
> bir sekmede `/menu?masa=5` açıp sipariş verin, başka sekmede `/kasa` açık olsun —
> sipariş anında düşer.

---

## 🔥 Firebase Kurulumu (gerçek cihazlar arası senkron)

Demo mod yalnızca aynı tarayıcı içinde çalışır. **Farklı telefon/tablet/PC arasında**
senkron için ücretsiz bir Firebase projesi bağlayın:

1. [console.firebase.google.com](https://console.firebase.google.com) → **Proje ekle**
2. Sol menü → **Build → Realtime Database → Veritabanı oluştur**
   (konum seçin, "test modunda başlat" diyebilirsiniz)
3. **Realtime Database → Kurallar** sekmesine `database.rules.json` içeriğini yapıştırın
   (başlangıç için herkese açık okuma/yazma; üretimde kısıtlamanız önerilir)
4. Proje Ayarları (⚙️) → **Uygulamalarınız → Web (`</>`)** ile bir web uygulaması ekleyin
5. Verilen `firebaseConfig` değerlerini proje kök dizininde `.env` dosyasına girin:

```bash
cp .env.example .env
```

```ini
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=projeniz.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://projeniz-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=projeniz
VITE_FIREBASE_STORAGE_BUCKET=projeniz.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

6. `npm run dev` ile yeniden başlatın. Artık tüm cihazlar gerçek zamanlı senkron.

> Kod değişmez — `.env` doluysa Firebase, boşsa demo mod otomatik devreye girer.

---

## 🌐 Netlify'a Deploy

1. Projeyi GitHub'a yükleyin.
2. Netlify → **Add new site → Import from Git** → repoyu seçin.
3. Ayarlar `netlify.toml` ile otomatik gelir (build: `npm run build`, publish: `dist`).
4. **Site settings → Environment variables** bölümüne `.env` içindeki `VITE_FIREBASE_*`
   değişkenlerini ekleyin (Firebase kullanıyorsanız).
5. Deploy edin. SPA yönlendirmesi `netlify.toml` ile hazırdır.

> CLI ile: `npm i -g netlify-cli && netlify deploy --prod`

---

## 🔳 QR Kodları Oluşturma

Her masa için şu formatta bir QR üretin (herhangi bir ücretsiz QR aracıyla):

```
https://SITE-ADRESINIZ.netlify.app/menu?masa=1
https://SITE-ADRESINIZ.netlify.app/menu?masa=2
...
```

`?masa=` numarasını değiştirerek her masaya özel kod basabilirsiniz.

---

## 📁 Proje Yapısı

```
src/
├── firebase.js            # Firebase başlatma + demo mod tespiti
├── lib/
│   ├── db.js              # Veri katmanı (Firebase ⇄ demo adaptörü, tek API)
│   ├── store.js           # Gerçek zamanlı React hook'ları + tüm yazma aksiyonları
│   ├── seed.js            # Başlangıç menüsü (ilk açılışta yüklenir)
│   ├── format.js          # Para / zaman biçimlendirme
│   └── sound.js           # Web Audio bildirim sesleri
├── components/
│   ├── ui.jsx             # Modal, Toggle, görsel yer tutucu vb.
│   └── admin/
│       ├── TableMap.jsx   # Masa haritası, birleştir & taşı
│       ├── MenuManager.jsx# Menü yönetimi (CRUD + stok)
│       └── Stats.jsx      # Grafikler + Z raporu
└── pages/
    ├── Home.jsx           # Açılış / rol seçimi
    ├── Customer.jsx       # Müşteri menü & sipariş ekranı
    ├── Cashier.jsx        # Kasa (canlı sipariş takibi)
    └── Admin.jsx          # Yönetim paneli kabuğu
```

---

## 🗄️ Veritabanı Yapısı (Realtime Database)

```
menu/
  categories/{id}  → { name, order }
  products/{id}    → { name, desc, price, image, categoryId, available, order }
  tables/{id}      → { no, name }
orders/{id}        → { tableId, tableNo, items[], total, count, note, status, createdAt, updatedAt }
calls/{id}         → { tableId, tableNo, type: 'waiter'|'bill', status, createdAt }
layout/{tableId}   → { mergedInto }   # masa birleştirme
```

---

## 🔒 Üretim İçin Güvenlik Notu

Başlangıç kuralları (`database.rules.json`) herkese açıktır; küçük bir restoranın iç
kullanımı için pratiktir. Halka açık ölçekte:
- Firebase Authentication ekleyin (kasa/yönetim için anonim veya e-posta girişi)
- `menu` ve `orders` durum güncellemelerini yalnızca yetkili kullanıcılara açın
- Müşteriye yalnızca `orders`/`calls` **ekleme** izni verin

Keyifli kullanımlar! 🧡
