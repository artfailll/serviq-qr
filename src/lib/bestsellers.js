export function computeOrderCounts(orders = [], stats = {}) {
  const counts = {}
  ;(orders || []).forEach(o => {
    if (o.status === 'cancelled') return
    ;(o.items || []).forEach(it => {
      if (it.productId) {
        counts[it.productId] = (counts[it.productId] || 0) + (Number(it.qty) || 1)
      }
    })
  })
  Object.entries(stats || {}).forEach(([id, c]) => {
    counts[id] = Math.max(Number(counts[id]) || 0, Number(c) || 0)
  })
  return counts
}

export function computeBestIds(productOrderCounts = {}, categories = [], products = []) {
  const list = Object.entries(productOrderCounts)
    .filter(([, count]) => Number(count) >= 2)
    .sort((a, b) => Number(b[1]) - Number(a[1]))

  if (!list.length) return []

  const set = new Set()

  // Genel menüde en çok sipariş alan ilk 6 ürün
  list.slice(0, 6).forEach(([id]) => set.add(id))

  // Her kategorinin kendi içinde en çok satan 1. ürünü (en az 2 sipariş)
  categories.forEach(cat => {
    const catProds = products.filter(p => p.categoryId === cat.id && p.available !== false)
    let topProdId = null
    let topCount = 1
    catProds.forEach(p => {
      const c = Number(productOrderCounts[p.id]) || 0
      if (c > topCount) {
        topCount = c
        topProdId = p.id
      }
    })
    if (topProdId) set.add(topProdId)
  })

  return Array.from(set)
}
