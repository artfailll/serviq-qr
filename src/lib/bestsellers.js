export function isCorbaOrDonerCategory(cat) {
  if (!cat) return false
  const name = String(cat.name || '').toLocaleLowerCase('tr-TR')
  const id = String(cat.id || '').toLocaleLowerCase('tr-TR')
  return (
    name.includes('çorba') ||
    name.includes('corba') ||
    id.includes('çorba') ||
    id.includes('corba') ||
    name.includes('döner') ||
    name.includes('doner') ||
    id.includes('döner') ||
    id.includes('doner')
  )
}

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
  const catList = Array.isArray(categories)
    ? categories
    : categories && typeof categories === 'object'
    ? Object.entries(categories).map(([id, val]) => ({ id, ...(typeof val === 'object' ? val : { name: val }) }))
    : []

  const prodList = Array.isArray(products)
    ? products
    : products && typeof products === 'object'
    ? Object.entries(products).map(([id, val]) => ({ id, ...(typeof val === 'object' ? val : {}) }))
    : []

  if (!prodList.length) return []

  const set = new Set()
  const targetCategories = catList.filter(isCorbaOrDonerCategory)

  if (targetCategories.length > 0) {
    // Sadece Çorba ve Döner kategorilerinde en çok satan 1'er ürün
    targetCategories.forEach(cat => {
      const catProds = prodList.filter(p => p.categoryId === cat.id && p.available !== false)
      let topProdId = null
      let topCount = 0
      catProds.forEach(p => {
        const c = Number(productOrderCounts[p.id]) || 0
        if (c > topCount) {
          topCount = c
          topProdId = p.id
        }
      })
      if (topProdId && topCount >= 1) {
        set.add(topProdId)
      }
    })
  } else {
    // Kategori isimleri eşleşmezse (örn. tek genel kategori varsa)
    // Ürün isimlerinden Çorba ve Döner tespiti yaparak 1'er adet seç
    const pickTopByName = (keyword) => {
      const matched = prodList.filter(p => {
        const n = String(p.name || '').toLocaleLowerCase('tr-TR')
        return n.includes(keyword) && p.available !== false
      })
      let topId = null
      let topC = 0
      matched.forEach(p => {
        const c = Number(productOrderCounts[p.id]) || 0
        if (c > topC) {
          topC = c
          topId = p.id
        }
      })
      if (topId && topC >= 1) set.add(topId)
    }
    pickTopByName('çorba')
    pickTopByName('döner')
  }

  return Array.from(set)
}
