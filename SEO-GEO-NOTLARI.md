# serviq Silivri + İstanbul SEO/GEO notları

Son teknik güncelleme: **29 Temmuz 2026**

Bu çalışma Silivri'yi birincil yerel konu, İstanbul'u ikincil hizmet alanı olarak konumlandırır. Hiçbir teknik düzenleme Google'da birinci sıra veya bir yapay zekâ yanıtında alıntılanma garantisi vermez. Amaç; sayfaların taranabilir, anlaşılır, kanonik, hızlı ve gerçek bilgiye dayalı olmasını sağlamaktır.

## Yayına hazır sayfa mimarisi

| Kanonik URL | Arama amacı |
|---|---|
| `/` | Marka ve ürün özeti |
| `/silivri-qr-menu` | Birincil yerel ürün/hizmet sayfası |
| `/istanbul-qr-menu` | İstanbul'daki yoğun servis ve operasyon ihtiyacı |
| `/qr-menu-nedir` | Bilgilendirici QR menü rehberi |
| `/ozellikler` | Ürün ve ekran özellikleri |
| `/iletisim` | Demo ve iletişim |

Eski `.dc.html` adresleri 301 ile temiz URL'lere taşınır. Bilinmeyen adresler artık SPA kabuğu yerine gerçek `404` döndürür. `/kasa`, `/garson` ve `/yonetim` personel ekranları ile yazdırılabilir masa QR sayfaları `X-Robots-Tag` üzerinden indeks dışıdır. Müşteri menüsü `/menu` engellenmemiştir.

## Birleştirme ve yayın sonrası zorunlu adımlar

1. Google Search Console'da `serviq.com.tr` alan adı mülkünü doğrula.
2. `https://serviq.com.tr/sitemap.xml` adresini Search Console'a gönder.
3. Ana sayfa, Silivri, İstanbul, rehber, özellikler ve iletişim sayfalarını URL Denetleme ile test et.
4. Aynı sitemap'i Bing Webmaster Tools'a gönder.
5. Netlify/CDN günlüklerinde Googlebot, Bingbot ve `OAI-SearchBot` isteklerinin engellenmediğini doğrula.
6. Gerçek kullanıcı verisi oluşunca Core Web Vitals sonuçlarını sayfa bazında izle.
7. Search Console'da Silivri ve İstanbul sorgularını ayrı filtrelerle; iletişim ve demo tıklamalarını analitik dönüşüm olarak ölç.

Resmî kaynaklar:

- [Google sitemap oluşturma ve gönderme](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google JavaScript SEO temelleri](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google faydalı içerik rehberi](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [IndexNow dokümantasyonu](https://www.indexnow.org/documentation)

## Google Business Profile kararı

serviq yalnızca online sunulan bir SaaS ise Google Business Profile açılmamalıdır. Ekip müşterilerle çalışma saatlerinde gerçekten yüz yüze temas kuruyor veya yerinde kurulum/destek veriyorsa tek bir hizmet alanı işletmesi profili değerlendirilebilir.

- Sanal ofis veya sahte Silivri adresi kullanılmaz.
- Müşteri kabul edilmeyen ev/ofis adresi yayımlanmaz.
- İşletme adına “Silivri QR Menü İstanbul” gibi fazladan anahtar kelime eklenmez.
- Gerçek fiziksel adres doğrulanmadan `LocalBusiness`, `PostalAddress` veya koordinat şeması eklenmez.

Resmî kaynaklar:

- [Google Business Profile uygunluğu](https://support.google.com/business/answer/13763036)
- [İşletmeyi temsil etme kuralları](https://support.google.com/business/answer/3038177)
- [Hizmet alanı işletmeleri](https://support.google.com/business/answer/9157481)
- [Yerel sıralama faktörleri](https://support.google.com/business/answer/7091)

## İçerik ilkeleri

- Silivri sayfası bölge adı değiştirilerek çoğaltılmaz.
- Büyükçekmece, Çatalca, Avcılar gibi ilçeler için gerçek ve farklı kanıt bulunmadan kopya sayfa açılmaz.
- Yalnızca görünür sayfada doğrulanabilen bilgiler JSON-LD'ye yazılır.
- Fiyat, adres, müşteri sayısı, puan, koordinat veya üstünlük iddiası uydurulmaz.
- Yeni müşteri örnekleri yalnızca izin ve doğrulanabilir ayrıntıyla eklenir.
- Sayfa güncelleme tarihi yalnızca içerik gerçekten değiştiğinde yenilenir.

Google, farklı şehir adlarıyla aynı hedefe yönlendiren kopya sayfaları doorway/scaled-content riski olarak tanımlar: [Google spam politikaları](https://developers.google.com/search/docs/essentials/spam-policies).

## GEO ve yapay zekâ görünürlüğü

Google AI özellikleri için özel bir “GEO şeması” gerekmez. Temel gereksinimler yine indekslenebilirlik, yararlı içerik, doğru bağlantılar ve snippet gösterimine izin verilmesidir. `llms.txt`, destekleyici bir makine-okunur özet olarak sunulur; Google sıralama faktörü veya alıntılanma garantisi değildir.

- Kısa cevap blokları görünür HTML içindedir.
- FAQ metni ile yapılandırılmış veri aynı içeriği anlatır.
- `Organization`, `SoftwareApplication`, `Service`, `Article`, `WebPage` ve `BreadcrumbList` nesneleri doğrulanabilir bilgiyle sınırlıdır.
- `OAI-SearchBot` robots.txt tarafından engellenmez.
- Bing AI Performance kullanılabiliyorsa alıntılanan sayfalar ve grounding sorguları izlenir.

Resmî kaynaklar:

- [Google aramadaki AI özellikleri](https://developers.google.com/search/docs/appearance/ai-features)
- [ChatGPT Search ve OAI-SearchBot](https://help.openai.com/en/articles/9237897-chatgpt-search)
- [Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)

## Ayrı güvenlik işi gerektiren bulgu

Mevcut uygulama, URL'de yeni bir `?isletme=` değeri görüldüğünde Firebase'de otomatik örnek veri oluşturabiliyor ve başlangıç veritabanı kuralları genel yazmaya izin veriyor. Bu SEO dosya düzenlemelerinden bağımsız, üretim güvenliğini etkileyen bir konudur. İşletme oluşturmayı doğrulanmış yönetici akışına taşımak ve Firebase kurallarını yetkilendirmek için ayrı, kontrollü bir çalışma yapılmalıdır.
