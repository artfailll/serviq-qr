import test from 'node:test'
import assert from 'node:assert/strict'
import { computeOrderCounts, computeBestIds, isCorbaOrDonerCategory } from '../src/lib/bestsellers.js'

test('computeOrderCounts aggregates order items and merges stats', () => {
  const orders = [
    { status: 'new', items: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }] },
    { status: 'paid', items: [{ productId: 'p1', qty: 3 }, { productId: 'p3', qty: 4 }] },
    { status: 'cancelled', items: [{ productId: 'p1', qty: 99 }] }, // cancelled ignored
  ]
  const stats = { p1: 10, p4: 7 }
  const counts = computeOrderCounts(orders, stats)
  assert.equal(counts.p1, 10)
  assert.equal(counts.p2, 1)
  assert.equal(counts.p3, 4)
  assert.equal(counts.p4, 7)
})

test('isCorbaOrDonerCategory matches only soup and doner categories', () => {
  assert.ok(isCorbaOrDonerCategory({ name: 'Çorbalar' }))
  assert.ok(isCorbaOrDonerCategory({ name: 'Döner Çeşitleri' }))
  assert.ok(isCorbaOrDonerCategory({ name: 'Yaprak Döner' }))
  assert.ok(isCorbaOrDonerCategory({ id: 'cat_corbalar' }))
  assert.ok(isCorbaOrDonerCategory({ id: 'cat_doner' }))
  assert.ok(!isCorbaOrDonerCategory({ name: 'Tatlılar' }))
  assert.ok(!isCorbaOrDonerCategory({ name: 'İçecekler' }))
  assert.ok(!isCorbaOrDonerCategory({ name: 'Sulu Yemekler' }))
  assert.ok(!isCorbaOrDonerCategory({ name: 'Salatalar' }))
})

test('computeBestIds only selects 1 top seller in Corbalar and 1 top seller in Donerler', () => {
  const counts = {
    corba1: 62, // winner in corba
    corba2: 16, // second in corba -> should NOT get badge
    corba3: 14,
    doner1: 7,  // winner in doner
    doner2: 4,  // second in doner -> should NOT get badge
    tatli1: 50, // high orders, but in Tatlilar -> should NOT get badge
    icecek1: 90 // high orders, but in Icecekler -> should NOT get badge
  }
  const categories = [
    { id: 'cat_corbalar', name: 'Çorbalar' },
    { id: 'cat_doner', name: 'Döner Çeşitleri' },
    { id: 'cat_tatli', name: 'Tatlılar' },
    { id: 'cat_icecek', name: 'İçecekler' },
  ]
  const products = [
    { id: 'corba1', categoryId: 'cat_corbalar', available: true },
    { id: 'corba2', categoryId: 'cat_corbalar', available: true },
    { id: 'corba3', categoryId: 'cat_corbalar', available: true },
    { id: 'doner1', categoryId: 'cat_doner', available: true },
    { id: 'doner2', categoryId: 'cat_doner', available: true },
    { id: 'tatli1', categoryId: 'cat_tatli', available: true },
    { id: 'icecek1', categoryId: 'cat_icecek', available: true },
  ]

  const best = computeBestIds(counts, categories, products)

  // Exactly 2 items: 1 soup winner, 1 doner winner
  assert.equal(best.length, 2)
  assert.ok(best.includes('corba1'), 'corba1 is the sole bestseller in Çorbalar')
  assert.ok(!best.includes('corba2'), 'corba2 is not the top soup')
  assert.ok(best.includes('doner1'), 'doner1 is the sole bestseller in Döner')
  assert.ok(!best.includes('doner2'), 'doner2 is not the top doner')
  assert.ok(!best.includes('tatli1'), 'tatli1 is excluded because category is not çorba or döner')
  assert.ok(!best.includes('icecek1'), 'icecek1 is excluded because category is not çorba or döner')
})
