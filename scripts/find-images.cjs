async function main() {
  const keys = ['alindroid-cafe', 'bey-sos', 'cihan-cafe1', 'emre-cafe', 'silivri-cafe', 'CAFE SİNAN', 'demo cafe'];

  for (const b of keys) {
    const pr = await fetch(`https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app/businesses/${encodeURIComponent(b)}/menu/products.json`);
    const pData = await pr.json();
    if (pData) {
      const withImg = Object.values(pData).filter(x => x && x.image);
      console.log(`${b}: ${Object.keys(pData).length} prods, ${withImg.length} with images`);
      if (withImg.length > 0) {
        withImg.slice(0, 3).forEach(x => console.log(`   [${x.name}]: ${x.image.slice(0, 80)}`));
      }
    }
  }
}
main().catch(console.error);
