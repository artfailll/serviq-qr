const fs = require('fs');
const path = require('path');

const IMAGES = {
  p1: { name: 'Kelle Paça', file: 'File:Kelle paça çorbası - head and leg soup.jpg' },
  p2: { name: 'Tavuk Suyu Çorbası', file: 'File:Chicken soup in Turkey.jpg' },
  p3: { name: 'Ezogelin Çorbası', file: 'File:Turkish soup Ezo Gelin.jpg' },
  p4: { name: 'Süzme Mercimek Çorbası', file: 'File:Mercimek soup Istanbul.jpg' },
  p5: { name: 'Karışık Çorba', file: 'File:Tripe soup and mezes from Turkey.jpg' },
  p6: { name: 'Pilav Üstü Döner', file: 'File:Doner on pilav.jpg' },
  p7: { name: 'Porsiyon Döner', file: 'File:Döner Kebab plate with onions.jpg' },
  p8: { name: 'Yarım Ekmek Döner', file: 'File:Döner Kebab, Berlin, 2010 (01).jpg' },
  p9: { name: '3 Çeyrek Ekmek Döner', file: 'File:Doner kebab, Istanbul, Turkey.JPG' },
  p10: { name: 'Tombik Ekmek Döner', file: 'File:Döner Kebab (10582151414).jpg' },
  p11: { name: 'Tam Ekmek Döner', file: 'File:Bafra ekmek arası 2.JPG' },
  p12: { name: 'Döner Dürüm', file: 'File:Dürüm Döner.jpg' },
  p13: { name: 'Adana Dürüm', file: 'File:Ali Baba Döner-Kebap-Stube Tauberbischofsheim - Dürüm mit Ayran.jpg' },
  p14: { name: 'Urfa Dürüm', file: 'File:Dürum kebab.jpg' },
  p15: { name: 'Tavuk Şiş Dürüm', file: 'File:Dürüm of Ali Baba Tauberbischofsheim.jpg' },
  p16: { name: 'Ciğer Dürüm', file: 'File:Dürüm of Ali Baba Tauberbischofsheim 2.jpg' },
  p17: { name: 'Kuru Fasulye', file: 'File:Etli kuru fasulye.jpg' },
  p18: { name: 'Nohut Yemeği', file: 'File:Nohut yahni.jpg' },
  p19: { name: 'Et Haşlama', file: 'File:Kuzu incik (haslama).jpg' },
  p20: { name: 'Fırın Tavuk', file: 'File:Roasted chicken and potatoes.JPG' },
  p21: { name: 'Patlıcan Musakka', file: 'File:Musakka.jpg' },
  p22: { name: 'Patlıcan Kebap', file: 'File:Patlıcan kebap and company.jpg' },
  p23: { name: 'İzmir Köfte', file: 'File:Izmir köfte.jpg' },
  p24: { name: 'Orman Kebabı', file: 'File:Orman kebabı in Ankara.jpg' },
  p25: { name: 'Taş Kebabı', file: 'File:Tas kebap, pilav and cacik.jpg' },
  p26: { name: 'Arnavut Ciğeri', file: 'File:Albanian liver.jpg' },
  p27: { name: 'Tavuk Haşlama', file: 'File:Tavuk haşlama in Ankara.jpg' },
  p28: { name: 'Adana Kebap (Porsiyon)', file: 'File:Adana kebap 2024.jpg' },
  p29: { name: 'Urfa Kebap (Porsiyon)', file: 'File:Urfa kebap.jpg' },
  p30: { name: 'Tavuk Şiş (Porsiyon)', file: 'File:Sis tavuk.jpg' },
  p31: { name: 'Izgara Kanat', file: 'File:Grilled chicken wings, Turkish style.jpg' },
  p32: { name: 'Izgara Köfte', file: 'File:Turkish koftes.jpg' },
  p33: { name: 'Tavuk Pirzola', file: 'File:Tavuk pirzola.jpg' },
  p34: { name: 'Külbastı', file: 'File:Kulbasti Char-grilled Veal with Mustard Sauce - degustation - Ottoman Cuisine.jpg' },
  p35: { name: 'Biftek', file: 'File:Beef Steak - Shaan Curry and Kebab.jpg' },
  p36: { name: 'Ciğer Şiş', file: 'File:Ciğer Kebabı, Kozan 01.JPG' },
  p37: { name: 'Pirinç Pilavı', file: 'File:Turkish Pilaf Rice - degustation - Ottoman Cuisine (3061206332).jpg' },
  p38: { name: 'Pilav Üstü Kuru', file: 'File:Kuru fasulye-pilav.jpg' },
  p39: { name: 'Bulgur Pilavı', file: 'File:Bulgur pilavı (tel sehriyeli).jpg' },
  p40: { name: 'Bulgur Pilavı Üstü Kuru', file: 'File:Kuru Fasulye pilav.jpg' },
  p41: { name: 'Fırın Sütlaç', file: 'File:Fırın sutlac.jpg' },
  p42: { name: 'Hayrabolu Tatlısı', file: 'File:Kemalpaşa.jpg' },
  p43: { name: 'Çoban Salata', file: "File:Shepherd's salad, Beyoglu (2275153309).jpg" },
  p44: { name: 'Mevsim Salata', file: 'File:Mevsim salata.jpg' },
  p45: { name: 'Cacık', file: 'File:Cacik-1.jpg' },
  p46: { name: 'Kase Yoğurt', file: 'File:Cacık in Turkey.jpg' },
  p47: { name: 'Acılı Ezme', file: 'File:Ezme plate.jpg' },
  p48: { name: 'Coca-Cola (Kutu)', file: 'File:Coca-cola 50cl can - Italia.jpg' },
  p49: { name: 'Coca-Cola (Cam Şişe)', file: 'File:Coca-Cola glass bottle.jpg' },
  p50: { name: 'Fanta (Kutu)', file: 'File:Fanta-Orange-Can-330ml 84177 (7116950883).jpg' },
  p51: { name: 'Fanta (Cam Şişe)', file: 'File:Fanta Orange Glass Bottle.jpg' },
  p52: { name: 'Açık Köpüklü Ayran', file: 'File:Köpüklü ayran (Foamy ayran).jpg' },
  p53: { name: 'Kapalı Ayran', file: 'File:Ayran, Istanbul, Turkey.JPG' },
  p54: { name: 'Gazoz', file: 'File:Uludağ GAZOZ im Glas IMG 8852.jpg' },
  p55: { name: 'Meyve Suyu', file: 'File:Orange juice in a glass.jpg' },
  p56: { name: 'Şalgam Suyu', file: 'File:Salgam suyu.jpg' },
  p57: { name: 'Maden Suyu (Soda)', file: 'File:Glass of cold mineral water.jpg' },
  p58: { name: 'Meyveli Soda', file: 'File:Nimbu Soda Or Lemon Soda.jpg' },
  p59: { name: 'Su', file: 'File:Water bottle (13779).jpg' },
  p60: { name: '1 Litre Coca-Cola', file: 'File:15-09-26-RalfR-WLC-0098 - Coca-Cola glass bottle (Germany).jpg' },
  p61: { name: '1.5 Litre Coca-Cola', file: 'File:15-09-26-RalfR-WLC-0098 - Coca-Cola glass bottle (Germany).jpg' },
  p62: { name: '2.5 Litre Coca-Cola', file: 'File:15-09-26-RalfR-WLC-0098 - Coca-Cola glass bottle (Germany).jpg' },
  p63: { name: '1.5 Litre Fanta', file: 'File:Fanta Orange Glass Bottle.jpg' },
  p64: { name: '2.5 Litre Fanta', file: 'File:Fanta Orange Glass Bottle.jpg' },
  p65: { name: '1 Litre Ayran', file: 'File:Sise ayran.jpg' }
};

const DIRS = [
  path.join(__dirname, '..', 'public', 'img', 'sezgin'),
  'C:\\Users\\yunus emre\\Desktop\\serviq-qr-main\\public\\img\\sezgin'
];

DIRS.forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

async function getFileUrl(fileName) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ServiqApp/1.0 (info@serviq.com.tr)' } });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});
    return pages[0]?.imageinfo?.[0]?.thumburl || pages[0]?.imageinfo?.[0]?.url;
  } catch (err) {
    return null;
  }
}

async function downloadImage(url, destPaths) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ServiqApp/1.0 (info@serviq.com.tr)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 5000) throw new Error(`Image too small (${buffer.length} bytes)`);
  for (const p of destPaths) {
    fs.writeFileSync(p, buffer);
  }
  return buffer.length;
}

async function updateFirebase(productId, imagePath) {
  const url = `https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app/businesses/sezgin-usta-doner/menu/products/${productId}.json`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imagePath })
  });
  if (!res.ok) throw new Error(`Firebase update failed: ${res.status}`);
  return await res.json();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Starting image download and Firebase update for 65 items...');
  const successList = [];
  const failList = [];

  for (const [id, item] of Object.entries(IMAGES)) {
    console.log(`\nProcessing ${id}: ${item.name} (${item.file})`);
    try {
      await sleep(200);
      const url = await getFileUrl(item.file);
      if (!url) throw new Error(`Could not resolve URL for ${item.file}`);

      const destPaths = DIRS.map(d => path.join(d, `${id}.jpg`));
      const bytes = await downloadImage(url, destPaths);
      console.log(`  Downloaded: ${bytes} bytes -> saved to ${destPaths[0]}`);

      const relPath = `/img/sezgin/${id}.jpg`;
      await updateFirebase(id, relPath);
      console.log(`  Firebase updated: ${id}.image = ${relPath}`);

      successList.push({ id, name: item.name, bytes, relPath });
    } catch (err) {
      console.error(`  ERROR on ${id}: ${err.message}`);
      failList.push({ id, name: item.name, error: err.message });
    }
  }

  console.log(`\n================ Summary ================`);
  console.log(`Success: ${successList.length} / 65`);
  console.log(`Failed: ${failList.length} / 65`);
  if (failList.length > 0) {
    console.log('Failures:', failList);
  }
}

main().catch(console.error);
