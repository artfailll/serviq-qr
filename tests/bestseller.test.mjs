import test from 'node:test'
import assert from 'node:assert/strict'
import { computeOrderCounts, computeBestIds } from '../src/lib/bestsellers.js'

test('computeOrderCounts aggregates order items and merges stats', () => {
  const orders = [
    { status: 'new', items: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }] },
    { status: 'paid', items: [{ productId: 'p1', qty: 3 }, { productId: 'p3', qty: 4 }] },
    { status: 'cancelled', items: [{ productId: 'p1', qty: 99 }] }, // cancelled ignored
  ]
  const stats = { p1: 10, p4: 7 }
  const counts = computeOrderCounts(orders, stats)
  // p1 had 5 from orders, stats has 10 -> takes max(5, 10) = 10
  assert.equal(counts.p1, 10)
  assert.equal(counts.p2, 1)
  assert.equal(counts.p3, 4)
  assert.equal(counts.p4, 7)
})

test('computeBestIds selects overall top products and category winners with min 2 orders', () => {
  const counts = {
    corba1: 20,
    corba2: 15,
    doner1: 10,
    doner2: 2,
    tatli1: 4,
    icecek1: 8,
    azSatan: 1, // only 1 order -> should NOT qualify
  }
  const categories = [
    { id: 'cat_corba', name: 'Çorbalar' },
    { id: 'cat_doner', name: 'Dönerler' },
    { id: 'cat_tatli', name: 'Tatlılar' },
  ]
  const products = [
    { id: 'corba1', categoryId: 'cat_corba', available: true },
    { id: 'corba2', categoryId: 'cat_corba', available: true },
    { id: 'doner1', categoryId: 'cat_doner', available: true },
    { id: 'doner2', categoryId: 'cat_doner', available: true },
    { id: 'tatli1', categoryId: 'cat_tatli', available: true },
    { id: 'azSatan', categoryId: 'cat_doner', available: true },
  ]

  const best = computeBestIds(counts, categories, products)

  assert.ok(best.includes('corba1'), 'corba1 is overall top')
  assert.ok(best.includes('corba2'), 'corba2 is overall top')
  assert.ok(best.includes('doner1'), 'doner1 is category winner and top seller')
  assert.ok(best.includes('tatli1'), 'tatli1 is category winner')
  assert.ok(!best.includes('azSatan'), 'azSatan has only 1 order so should not be bestseller')
})
