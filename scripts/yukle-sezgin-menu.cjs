const https = require('https');

const DB_URL = 'https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app';
const BIZ_ID = 'sezgin-usta-doner';

const categories = {
  cat_corbalar: {
    name: 'Çorbalar',
    order: 1,
    notes: ['Sarımsaklı', 'Sarımsaksız', 'Sirkeli', 'Sirkesiz', 'Acı Soslu', 'Tuzsuz', 'Ekstra Ekmek']
  },
  cat_doner: {
    name: 'Döner Çeşitleri',
    order: 2,
    notes: ['Soğansız', 'Bol Yeşillik', 'Domatessiz', 'Soslu', 'Sossuz', 'Acılı', 'Acısız', 'Biberli']
  },
  cat_durumler: {
    name: 'Dürümler',
    order: 3,
    notes: ['Soğansız', 'Acılı', 'Acısız', 'Bol Yeşillik', 'Çift Lavaş', 'Domatessiz']
  },
  cat_sulu: {
    name: 'Sulu Yemekler',
    order: 4,
    notes: ['Az Sulu', 'Bol Sulu', 'Acısız', 'Ekstra Ekmek']
  },
  cat_izgaralar: {
    name: 'Izgaralar & Kebaplar',
    order: 5,
    notes: ['İyi Pişmiş', 'Orta Pişmiş', 'Acılı', 'Acısız', 'Soğansız', 'Garnitürsüz', 'Lavaşlı']
  },
  cat_pilavlar: {
    name: 'Pilav Çeşitleri',
    order: 6,
    notes: ['Karabiberli', 'Az Porsiyon', 'Bol Porsiyon']
  },
  cat_tatlilar: {
    name: 'Tatlılar',
    order: 7,
    notes: ['Fındıklı', 'Tarçınlı', 'Tarçınsız', 'Soğuk Servis']
  },
  cat_salatalar: {
    name: 'Salata & Mezeler',
    order: 8,
    notes: ['Zeytinyağlı', 'Limonlu', 'Sirkeli', 'Tuzsuz', 'Soğansız']
  },
  cat_icecekler: {
    name: 'İçecekler',
    order: 9,
    notes: ['Soğuk', 'Buzlu', 'Buzsuz', 'Pipetli', 'Pipetsiz']
  }
};

const productsList = [
  // --- Çorbalar ---
  {
    name: 'Kelle Paça',
    desc: 'Geleneksel lezzet, sarımsak ve sirke sosu ile',
    price: 250,
    categoryId: 'cat_corbalar',
    available: true,
    order: 1,
    variants: [
      { name: 'Tam Porsiyon', price: 250 },
      { name: 'Az Porsiyon', price: 150 }
    ]
  },
  {
    name: 'Tavuk Suyu Çorbası',
    desc: 'Tavuk parçacıklı, şifa dolu sıcak çorba',
    price: 150,
    categoryId: 'cat_corbalar',
    available: true,
    order: 2,
    variants: [
      { name: 'Tam Porsiyon', price: 150 },
      { name: 'Az Porsiyon', price: 80 }
    ]
  },
  {
    name: 'Ezogelin Çorbası',
    desc: 'Geleneksel ezogelin',
    price: 100,
    categoryId: 'cat_corbalar',
    available: true,
    order: 3,
    variants: [
      { name: 'Tam Porsiyon', price: 100 },
      { name: 'Az Porsiyon', price: 60 }
    ]
  },
  {
    name: 'Süzme Mercimek Çorbası',
    desc: 'Klasik tereyağlı süzme mercimek',
    price: 100,
    categoryId: 'cat_corbalar',
    available: true,
    order: 4,
    variants: [
      { name: 'Tam Porsiyon', price: 100 },
      { name: 'Az Porsiyon', price: 60 }
    ]
  },
  {
    name: 'Karışık Çorba',
    desc: 'Özel karışık çorba',
    price: 150,
    categoryId: 'cat_corbalar',
    available: true,
    order: 5
  },

  // --- Döner Çeşitleri ---
  {
    name: 'Pilav Üstü Döner',
    desc: 'Tereyağlı pirinç pilavı üzerinde yaprak döner',
    price: 450,
    categoryId: 'cat_doner',
    featured: true,
    available: true,
    order: 1,
    variants: [
      { name: 'Tam Porsiyon', price: 450 },
      { name: 'Az Porsiyon', price: 270 },
      { name: '1.5 Porsiyon', price: 650 }
    ]
  },
  {
    name: 'Porsiyon Döner',
    desc: 'Garnitür ve tırnak pide eşliğinde',
    price: 400,
    categoryId: 'cat_doner',
    featured: true,
    available: true,
    order: 2,
    variants: [
      { name: 'Tam Porsiyon', price: 400 },
      { name: 'Az Porsiyon', price: 250 },
      { name: '1.5 Porsiyon', price: 600 }
    ]
  },
  {
    name: 'Yarım Ekmek Döner',
    desc: 'Taze çıtır ekmek arasında yaprak döner',
    price: 200,
    categoryId: 'cat_doner',
    available: true,
    order: 3
  },
  {
    name: '3 Çeyrek Ekmek Döner',
    desc: 'Doyurucu porsiyon ekmek arası döner',
    price: 350,
    categoryId: 'cat_doner',
    available: true,
    order: 4
  },
  {
    name: 'Tombik Ekmek Döner',
    desc: 'Özel tombik pide arasında yaprak döner',
    price: 200,
    categoryId: 'cat_doner',
    available: true,
    order: 5
  },
  {
    name: 'Tam Ekmek Döner',
    desc: 'Tam somun ekmek arası yaprak döner',
    price: 400,
    categoryId: 'cat_doner',
    available: true,
    order: 6
  },

  // --- Dürümler ---
  {
    name: 'Döner Dürüm',
    desc: 'Lavaş arasında taze yaprak döner ve yeşillik',
    price: 300,
    categoryId: 'cat_durumler',
    featured: true,
    available: true,
    order: 1
  },
  {
    name: 'Adana Dürüm',
    desc: 'Zırh kıyması, acılı kebap dürüm',
    price: 300,
    categoryId: 'cat_durumler',
    available: true,
    order: 2,
    variants: [
      { name: '1 Porsiyon', price: 300 },
      { name: '1.5 Porsiyon', price: 400 }
    ]
  },
  {
    name: 'Urfa Dürüm',
    desc: 'Acısız zırh kıyması kebap dürüm',
    price: 300,
    categoryId: 'cat_durumler',
    available: true,
    order: 3,
    variants: [
      { name: '1 Porsiyon', price: 300 },
      { name: '1.5 Porsiyon', price: 400 }
    ]
  },
  {
    name: 'Tavuk Şiş Dürüm',
    desc: 'Özel marine edilmiş ızgara tavuk şiş dürüm',
    price: 270,
    categoryId: 'cat_durumler',
    available: true,
    order: 4
  },
  {
    name: 'Ciğer Dürüm',
    desc: 'Közlenmiş biber ve soğan ile kuzu ciğer dürüm',
    price: 450,
    categoryId: 'cat_durumler',
    available: true,
    order: 5
  },

  // --- Sulu Yemekler ---
  {
    name: 'Kuru Fasulye',
    desc: 'Geleneksel lezzet (Günlük çıkar)',
    price: 150,
    categoryId: 'cat_sulu',
    available: true,
    order: 1,
    variants: [
      { name: 'Tam Porsiyon', price: 150 },
      { name: 'Az Porsiyon', price: 90 }
    ]
  },
  {
    name: 'Nohut Yemeği',
    desc: 'Et suyuyla pişmiş nohut (Günlük çıkar)',
    price: 150,
    categoryId: 'cat_sulu',
    available: true,
    order: 2
  },
  {
    name: 'Et Haşlama',
    desc: 'Sebzeli dana incik haşlama',
    price: 400,
    categoryId: 'cat_sulu',
    available: true,
    order: 3,
    variants: [
      { name: 'Tam Porsiyon', price: 400 },
      { name: 'Az Porsiyon', price: 260 }
    ]
  },
  {
    name: 'Fırın Tavuk',
    desc: 'Fırında nar gibi kızarmış tavuk',
    price: 300,
    categoryId: 'cat_sulu',
    available: true,
    order: 4
  },
  {
    name: 'Patlıcan Musakka',
    desc: 'Kıymalı fırın patlıcan musakka',
    price: 350,
    categoryId: 'cat_sulu',
    available: true,
    order: 5,
    variants: [
      { name: 'Tam Porsiyon', price: 350 },
      { name: 'Az Porsiyon', price: 250 }
    ]
  },
  {
    name: 'Patlıcan Kebap',
    desc: 'Köz patlıcan ve köfte uyumu',
    price: 350,
    categoryId: 'cat_sulu',
    available: true,
    order: 6,
    variants: [
      { name: 'Tam Porsiyon', price: 350 },
      { name: 'Az Porsiyon', price: 250 }
    ]
  },
  {
    name: 'İzmir Köfte',
    desc: 'Domates ve patatesli fırın köfte',
    price: 370,
    categoryId: 'cat_sulu',
    available: true,
    order: 7,
    variants: [
      { name: 'Tam Porsiyon', price: 370 },
      { name: 'Az Porsiyon', price: 250 }
    ]
  },
  {
    name: 'Orman Kebabı',
    desc: 'Bezelye, patates ve etli orman kebabı',
    price: 350,
    categoryId: 'cat_sulu',
    available: true,
    order: 8,
    variants: [
      { name: 'Tam Porsiyon', price: 350 },
      { name: 'Az Porsiyon', price: 250 }
    ]
  },
  {
    name: 'Taş Kebabı',
    desc: 'Lokum kıvamında dana etli taş kebabı',
    price: 400,
    categoryId: 'cat_sulu',
    available: true,
    order: 9,
    variants: [
      { name: 'Tam Porsiyon', price: 400 },
      { name: 'Az Porsiyon', price: 250 }
    ]
  },
  {
    name: 'Arnavut Ciğeri',
    desc: 'Sumaklı soğan ve patates ile küp ciğer',
    price: 400,
    categoryId: 'cat_sulu',
    available: true,
    order: 10,
    variants: [
      { name: 'Tam Porsiyon', price: 400 },
      { name: 'Az Porsiyon', price: 300 }
    ]
  },
  {
    name: 'Tavuk Haşlama',
    desc: 'Sebzeli, şifa kaynağı tavuk haşlama',
    price: 300,
    categoryId: 'cat_sulu',
    available: true,
    order: 11,
    variants: [
      { name: 'Tam Porsiyon', price: 300 },
      { name: 'Az Porsiyon', price: 220 }
    ]
  },

  // --- Izgaralar & Kebaplar ---
  {
    name: 'Adana Kebap (Porsiyon)',
    desc: 'Zırh kıyması acılı kebap, pilav, köz biber ve domates ile',
    price: 400,
    categoryId: 'cat_izgaralar',
    featured: true,
    available: true,
    order: 1,
    variants: [
      { name: 'Tam Porsiyon', price: 400 },
      { name: '1.5 Porsiyon', price: 550 }
    ]
  },
  {
    name: 'Urfa Kebap (Porsiyon)',
    desc: 'Zırh kıyması acısız kebap, pilav ve garnitür ile',
    price: 400,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 2,
    variants: [
      { name: 'Tam Porsiyon', price: 400 },
      { name: '1.5 Porsiyon', price: 550 }
    ]
  },
  {
    name: 'Tavuk Şiş (Porsiyon)',
    desc: 'Marine tavuk göğsü, pilav ve köz sebzelerle',
    price: 370,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 3,
    variants: [
      { name: 'Tam Porsiyon', price: 370 },
      { name: '1.5 Porsiyon', price: 550 }
    ]
  },
  {
    name: 'Izgara Kanat',
    desc: 'Özel baharat soslu ızgara kanat',
    price: 370,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 4,
    variants: [
      { name: 'Tam Porsiyon', price: 370 },
      { name: '1.5 Porsiyon', price: 550 },
      { name: 'Yarım Kilo Kanat', price: 400 },
      { name: '1 Kilo Kanat', price: 650 }
    ]
  },
  {
    name: 'Izgara Köfte',
    desc: 'Anne köftesi lezzetinde ızgara köfte',
    price: 400,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 5,
    variants: [
      { name: 'Tam Porsiyon', price: 400 },
      { name: '1.5 Porsiyon', price: 600 }
    ]
  },
  {
    name: 'Tavuk Pirzola',
    desc: 'Izgara marine tavuk pirzola',
    price: 370,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 6,
    variants: [
      { name: 'Tam Porsiyon', price: 370 },
      { name: '1.5 Porsiyon', price: 550 }
    ]
  },
  {
    name: 'Külbastı',
    desc: 'Yumuşacık marine kuzu külbastı',
    price: 500,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 7,
    variants: [
      { name: 'Tam Porsiyon', price: 500 },
      { name: '1.5 Porsiyon', price: 650 }
    ]
  },
  {
    name: 'Biftek',
    desc: 'Izgara dana biftek',
    price: 500,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 8,
    variants: [
      { name: 'Tam Porsiyon', price: 500 },
      { name: '1.5 Porsiyon', price: 650 }
    ]
  },
  {
    name: 'Ciğer Şiş',
    desc: 'Közlenmiş biber ve sumaklı soğan ile ciğer şiş',
    price: 450,
    categoryId: 'cat_izgaralar',
    available: true,
    order: 9
  },

  // --- Pilav Çeşitleri ---
  {
    name: 'Pirinç Pilavı',
    desc: 'Tereyağlı tane tane pirinç pilavı',
    price: 100,
    categoryId: 'cat_pilavlar',
    available: true,
    order: 1,
    variants: [
      { name: 'Tam Porsiyon', price: 100 },
      { name: 'Az Porsiyon', price: 80 }
    ]
  },
  {
    name: 'Pilav Üstü Kuru',
    desc: 'Tereyağlı pirinç pilavı üstü lezzetli kuru fasulye',
    price: 120,
    categoryId: 'cat_pilavlar',
    available: true,
    order: 2
  },
  {
    name: 'Bulgur Pilavı',
    desc: 'Domatesli köy bulgur pilavı',
    price: 100,
    categoryId: 'cat_pilavlar',
    available: true,
    order: 3,
    variants: [
      { name: 'Tam Porsiyon', price: 100 },
      { name: 'Az Porsiyon', price: 80 }
    ]
  },
  {
    name: 'Bulgur Pilavı Üstü Kuru',
    desc: 'Bulgur pilavı üstü kuru fasulye',
    price: 120,
    categoryId: 'cat_pilavlar',
    available: true,
    order: 4
  },

  // --- Tatlılar ---
  {
    name: 'Fırın Sütlaç',
    desc: 'Üzeri nar gibi kızarmış geleneksel fırın sütlaç',
    price: 120,
    categoryId: 'cat_tatlilar',
    available: true,
    order: 1
  },
  {
    name: 'Hayrabolu Tatlısı',
    desc: 'Trakya yöresi meşhur Hayrabolu tatlısı',
    price: 100,
    categoryId: 'cat_tatlilar',
    available: true,
    order: 2
  },

  // --- Salata & Mezeler ---
  {
    name: 'Çoban Salata',
    desc: 'Domates, salatalık, biber ve soğanlı taze çoban salata',
    price: 100,
    categoryId: 'cat_salatalar',
    available: true,
    order: 1
  },
  {
    name: 'Mevsim Salata',
    desc: 'Taze mevsim yeşillikleri ve havuç ile',
    price: 100,
    categoryId: 'cat_salatalar',
    available: true,
    order: 2
  },
  {
    name: 'Cacık',
    desc: 'Naneli, zeytinyağlı taze cacık',
    price: 70,
    categoryId: 'cat_salatalar',
    available: true,
    order: 3
  },
  {
    name: 'Kase Yoğurt',
    desc: 'Köy yoğurdu',
    price: 70,
    categoryId: 'cat_salatalar',
    available: true,
    order: 4
  },
  {
    name: 'Acılı Ezme',
    desc: 'Taze sebzeler ve nar ekşisiyle hazırlanan ikram ezme',
    price: 0,
    categoryId: 'cat_salatalar',
    available: true,
    order: 5
  },

  // --- İçecekler ---
  {
    name: 'Coca-Cola (Kutu)',
    desc: '330 ml kutu kola',
    price: 70,
    categoryId: 'cat_icecekler',
    available: true,
    order: 1
  },
  {
    name: 'Coca-Cola (Cam Şişe)',
    desc: '200 ml cam şişe kola',
    price: 40,
    categoryId: 'cat_icecekler',
    available: true,
    order: 2
  },
  {
    name: 'Fanta (Kutu)',
    desc: '330 ml kutu fanta',
    price: 70,
    categoryId: 'cat_icecekler',
    available: true,
    order: 3
  },
  {
    name: 'Fanta (Cam Şişe)',
    desc: '200 ml cam şişe fanta',
    price: 40,
    categoryId: 'cat_icecekler',
    available: true,
    order: 4
  },
  {
    name: 'Açık Köpüklü Ayran',
    desc: 'Geleneksel yayık köpüklü ayran',
    price: 50,
    categoryId: 'cat_icecekler',
    available: true,
    order: 5
  },
  {
    name: 'Kapalı Ayran',
    desc: 'Taze kapalı ayran',
    price: 50,
    categoryId: 'cat_icecekler',
    available: true,
    order: 6,
    variants: [
      { name: 'Büyük (285 ml)', price: 50 },
      { name: 'Küçük (175 ml)', price: 40 }
    ]
  },
  {
    name: 'Gazoz',
    desc: 'Cam şişe geleneksel gazoz',
    price: 40,
    categoryId: 'cat_icecekler',
    available: true,
    order: 7
  },
  {
    name: 'Meyve Suyu',
    desc: 'Kutu meyve suyu çeşitleri',
    price: 70,
    categoryId: 'cat_icecekler',
    available: true,
    order: 8
  },
  {
    name: 'Şalgam Suyu',
    desc: 'Acılı / Acısız şişe şalgam',
    price: 50,
    categoryId: 'cat_icecekler',
    available: true,
    order: 9
  },
  {
    name: 'Maden Suyu (Soda)',
    desc: 'Cam şişe sade maden suyu',
    price: 20,
    categoryId: 'cat_icecekler',
    available: true,
    order: 10
  },
  {
    name: 'Meyveli Soda',
    desc: 'Limonlu / elmalı maden suyu',
    price: 20,
    categoryId: 'cat_icecekler',
    available: true,
    order: 11
  },
  {
    name: 'Su',
    desc: '500 ml pet şişe su',
    price: 20,
    categoryId: 'cat_icecekler',
    available: true,
    order: 12
  },
  {
    name: '1 Litre Coca-Cola',
    desc: '1 Litre pet şişe',
    price: 90,
    categoryId: 'cat_icecekler',
    available: true,
    order: 13
  },
  {
    name: '1.5 Litre Coca-Cola',
    desc: '1.5 Litre pet şişe',
    price: 80,
    categoryId: 'cat_icecekler',
    available: true,
    order: 14
  },
  {
    name: '2.5 Litre Coca-Cola',
    desc: '2.5 Litre aile boyu kola',
    price: 150,
    categoryId: 'cat_icecekler',
    available: true,
    order: 15
  },
  {
    name: '1.5 Litre Fanta',
    desc: '1.5 Litre pet şişe',
    price: 80,
    categoryId: 'cat_icecekler',
    available: true,
    order: 16
  },
  {
    name: '2.5 Litre Fanta',
    desc: '2.5 Litre pet şişe',
    price: 150,
    categoryId: 'cat_icecekler',
    available: true,
    order: 17
  },
  {
    name: '1 Litre Ayran',
    desc: '1 Litre şişe ayran',
    price: 70,
    categoryId: 'cat_icecekler',
    available: true,
    order: 18
  }
];

// Convert products to an object keyed by p1, p2, ...
const products = {};
productsList.forEach((p, idx) => {
  products['p' + (idx + 1)] = p;
});

async function upload() {
  console.log(`Kategoriler yükleniyor: ${Object.keys(categories).length} adet`);
  await put(`${DB_URL}/businesses/${BIZ_ID}/menu/categories.json`, categories);
  console.log(`Ürünler yükleniyor: ${Object.keys(products).length} adet`);
  await put(`${DB_URL}/businesses/${BIZ_ID}/menu/products.json`, products);
  console.log('TÜM MENÜ BAŞARIYLA YÜKLENDİ!');
}

function put(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(respBody);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${respBody}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

upload().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});