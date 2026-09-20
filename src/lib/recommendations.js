// Deterministic menu pairing: actual available products only, no invented offers.
const normalize = value => String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')
export function foodGroup(product, category = '') {
  const name = normalize(product.name)
  const combined = `${name} ${normalize(category)}`
  // Specific product names take precedence over broad category names.
  // Combo titles may include a drink: "Döner + ayran" is still a main.
  if (product.comboItems?.length || /\+|menu|paket/.test(name)) {
    if (/doner|durum|iskender/.test(name)) return 'doner'
    if (/kebap|kebab|adana|urfa|beyti|lahmacun|pide/.test(name)) return 'kebab'
    if (/izgara|kofte|pirzola|bonfile|antrikot|kanat|steak/.test(name)) return 'grill'
    if (/burger|pizza|sandvic|tost/.test(name)) return 'fastFood'
  }
  if (/ayran|salgam|kefir/.test(name)) return 'yogurtDrink'
  if (/cay|kahve|espresso|latte|cappuccino|americano|mocha|turk kahvesi/.test(name)) return 'hotDrink'
  if (/baklava|kunefe|sutlac|kadayif|tatli|dondurma|cheesecake|tiramisu|pasta|profiterol/.test(combined)) return 'dessert'
  if (/su\b|kola|gazoz|limonata|soda|meyve suyu|icecek/.test(combined)) return 'coldDrink'
  if (/doner|durum|iskender/.test(combined)) return 'doner'
  if (/kebap|kebab|adana|urfa|beyti|lahmacun|pide/.test(combined)) return 'kebab'
  if (/izgara|kofte|pirzola|biftek|bonfile|antrikot|tavuk sis|kanat|steak/.test(combined)) return 'grill'
  if (/salata|meze|ezme|haydari|cacik|humus|tursu/.test(combined)) return 'salad'
  if (/patates|pilav|bulgur|sogan halkasi/.test(combined)) return 'side'
  if (/burger|pizza|sandvic|tost/.test(combined)) return 'fastFood'
  if (/corba/.test(combined)) return 'soup'
  return 'other'
}
const PAIRS = {
  doner: ['yogurtDrink', 'side', 'coldDrink', 'salad', 'dessert'],
  kebab: ['yogurtDrink', 'salad', 'coldDrink', 'dessert', 'side'],
  grill: ['salad', 'side', 'coldDrink', 'yogurtDrink', 'dessert'],
  fastFood: ['coldDrink', 'side', 'yogurtDrink', 'dessert'],
  dessert: ['hotDrink', 'coldDrink'],
  hotDrink: ['dessert'],
  soup: ['salad', 'coldDrink'],
}

export function recommendPairings(cart, products, categories, limit = 3) {
  if (!cart?.length || limit < 1) return []
  const byId = new Map(products.map(p => [p.id, p]))
  const categoryNames = new Map(categories.map(c => [c.id, c.name]))
  const group = p => foodGroup(p, categoryNames.get(p.categoryId))
  const included = new Set(cart.map(item => item.productId))
  // A combo already contains these products; don't sell the same side twice.
  for (const item of cart) for (const part of byId.get(item.productId)?.comboItems || []) included.add(part.productId)
  const inCart = [...included].map(id => byId.get(id)).filter(Boolean)
  const occupied = new Set(inCart.map(group))
  const hasDrink = [...occupied].some(g => ['yogurtDrink', 'coldDrink', 'hotDrink'].includes(g))
  const mainGroups = [...occupied].filter(g => ['doner', 'kebab', 'grill', 'fastFood'].includes(g))
  const anchors = mainGroups.length ? mainGroups : [...occupied]
  const ranked = products.filter(p => p.available && !included.has(p.id) && Number.isFinite(Number(p.price)) && Number(p.price) >= 0).map(p => {
    const kind = group(p)
    if (occupied.has(kind) || (hasDrink && ['yogurtDrink', 'coldDrink', 'hotDrink'].includes(kind))) return null
    const explicit = inCart.some(source => source.pairingIds?.includes(p.id))
    const rank = Math.max(0, ...anchors.map(anchor => {
      const index = (PAIRS[anchor] || []).indexOf(kind)
      return index < 0 ? 0 : 100 - index * 15
    }))
    return explicit || rank ? { product: p, kind, score: explicit ? 200 : rank } : null
  }).filter(Boolean).sort((a,b) => b.score-a.score || (Number(a.product.order)||99)-(Number(b.product.order)||99) || a.product.id.localeCompare(b.product.id))
  const selected = []
  const groups = new Set()
  for (const candidate of ranked) {
    const kind = ['yogurtDrink', 'coldDrink'].includes(candidate.kind) ? 'drink' : candidate.kind
    if (groups.has(kind)) continue
    groups.add(kind)
    selected.push(candidate.product)
    if (selected.length >= limit) break
  }
  return selected
}
