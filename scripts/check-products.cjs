async function main() {
  const res = await fetch("https://sofra-restoran-default-rtdb.europe-west1.firebasedatabase.app/businesses/sezgin-usta-doner/menu/products.json");
  const prods = await res.json();
  const list = Object.entries(prods || {}).map(([id, p]) => ({
    id,
    name: p.name,
    category: p.categoryId,
    hasImage: !!p.image,
    imageSnippet: p.image ? p.image.slice(0, 40) : ""
  }));
  console.log(`Total products: ${list.length}`);
  console.log(`With image: ${list.filter(x => x.hasImage).length}`);
  console.log(`Without image: ${list.filter(x => !x.hasImage).length}`);
  console.log("\nProducts list:");
  list.forEach(p => console.log(`${p.id.padEnd(5)} | ${p.category.padEnd(16)} | ${(p.hasImage ? '✓ IMG' : 'NO IMG').padEnd(8)} | ${p.name}`));
}
main().catch(console.error);
