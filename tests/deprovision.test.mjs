import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { registerRestaurant, unregisterRestaurant, formatRestaurantsTxt } from '../scripts/registry.cjs'
import { main as deprovisionMain } from '../scripts/deprovision.cjs'

test('registry formats restaurant list with IDs, names, links and passwords', () => {
  const dummyList = [
    { id: 'lezzet-doner', name: 'Lezzet Döner', tableCount: 12, password: '9999', createdAt: 1700000000000 },
    { id: 'harika-corba', name: 'Harika Çorba', tableCount: 8, password: '1234', createdAt: 1700000010000 },
  ]
  const txt = formatRestaurantsTxt(dummyList)
  assert.match(txt, /Lezzet Döner/)
  assert.match(txt, /lezzet-doner/)
  assert.match(txt, /9999/)
  assert.match(txt, /Harika Çorba/)
  assert.match(txt, /harika-corba/)
  assert.match(txt, /1234/)
  assert.match(txt, /https:\/\/serviq\.com\.tr\/yonetim\?isletme=lezzet-doner/)
  assert.match(txt, /https:\/\/serviq\.com\.tr\/kasa\?isletme=harika-corba/)
})

test('deprovision rejects invalid or missing IDs', async () => {
  await assert.rejects(deprovisionMain([]), /Silinecek işletme ID belirtilmedi/)
  await assert.rejects(deprovisionMain(['']), /Silinecek işletme ID belirtilmedi/)
  await assert.rejects(deprovisionMain(['bad/id/with/slashes']), /Geçersiz işletme ID/)
})

test('deprovision rejects non-existent restaurants', async () => {
  const originalFetch = globalThis.fetch
  const previousURL = process.env.VITE_FIREBASE_DATABASE_URL
  process.env.VITE_FIREBASE_DATABASE_URL = 'https://database.example.invalid'

  globalThis.fetch = async () => new Response(JSON.stringify(null), { status: 200 })

  try {
    await assert.rejects(deprovisionMain(['non-existent-cafe', '-y']), /Böyle bir restoran bulunamadı/)
  } finally {
    globalThis.fetch = originalFetch
    if (previousURL === undefined) delete process.env.VITE_FIREBASE_DATABASE_URL
    else process.env.VITE_FIREBASE_DATABASE_URL = previousURL
  }
})

test('deprovision sends DELETE request to Firebase and removes restaurant', async () => {
  const originalFetch = globalThis.fetch
  const previousURL = process.env.VITE_FIREBASE_DATABASE_URL
  process.env.VITE_FIREBASE_DATABASE_URL = 'https://database.example.invalid'

  const requests = []
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' })
    if (options.method === 'DELETE') {
      return new Response(JSON.stringify(null), { status: 200 })
    }
    return new Response(JSON.stringify({ menu: { profile: { name: 'Temporary Cafe' } } }), { status: 200 })
  }

  try {
    const success = await deprovisionMain(['temp-cafe', '-y'])
    assert.equal(success, true)
    assert.deepEqual(requests.map(r => r.method), ['GET', 'DELETE'])
    assert.match(requests[1].url, /temp-cafe\.json/)
  } finally {
    globalThis.fetch = originalFetch
    if (previousURL === undefined) delete process.env.VITE_FIREBASE_DATABASE_URL
    else process.env.VITE_FIREBASE_DATABASE_URL = previousURL
  }
})
