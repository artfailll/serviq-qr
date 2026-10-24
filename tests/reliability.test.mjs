import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { brandedTableQR, tableUrl } from '../src/lib/tableQr.js'
import provision from '../scripts/provision.cjs'

// Exercise the real store/db code against a controllable Firebase boundary.
// No live customer/database writes, no credentials, no network access.
globalThis.BroadcastChannel = undefined
const fake = globalThis.__firebaseTest = { writes: [], updates: [], data: {}, connected: true, synchronous: false, commit: async () => {} }
const compiled = await build({
  stdin: { contents: "export { createOrder, createCall, resetDay } from './src/lib/store.js'; export { ensureSeeded } from './src/lib/seed.js'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'controlled-firebase', setup(b) {
    b.onResolve({ filter: /^\.\.\/firebase$/ }, () => ({ path: 'config', namespace: 'fake' }))
    b.onResolve({ filter: /^firebase\/database$/ }, () => ({ path: 'database', namespace: 'fake' }))
    b.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({ contents: path === 'config' ? 'export const FIREBASE_ENABLED=true; export const db={};' : `
      const state = globalThis.__firebaseTest;
      export const ref = (_, path) => ({ path });
      export const push = r => ({ path: r.path + '/order-key', key: 'order-key' });
      export const set = async (r,v) => { state.writes.push({path:r.path,value:v}); await state.commit(r,v); };
      export const update = async (r,v) => { state.updates.push({path:r.path,value:v}); };
      export const remove = async () => {};
      export const get = async r => ({ val: () => r.path.endsWith('/stockTracking') ? false : state.data[r.path] ?? null });
      export const onValue = (r, cb) => { let live=true; const emit=()=>{ if(live) cb({val:()=>r.path==='.info/connected'?state.connected:state.data[r.path]??null}) }; state.synchronous?emit():queueMicrotask(emit); return ()=>{live=false}; };
      export const runTransaction = async () => ({committed:false,snapshot:{val:()=>null}});
      export const serverTimestamp = () => 123;
    ` }))
  } }],
})
const { createOrder, createCall, ensureSeeded, resetDay } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const order = { tableId: 'custom-table-key', tableNo: 5, items: [{ productId: 'tea', name: 'Çay', price: 12.25, qty: 2 }] }
const tick = () => new Promise(resolve => setImmediate(resolve))

test('order resolves only after server acknowledgement and keeps actual table ID', async () => {
  fake.writes = []
  let acknowledge
  fake.commit = () => new Promise(resolve => { acknowledge = resolve })
  let done = false
  const pending = createOrder('cafe-a', order).then(id => { done = true; return id })
  await tick()
  assert.equal(done, false)
  assert.equal(fake.writes.length, 1)
  assert.equal(fake.writes[0].path, 'businesses/cafe-a/orders/order-key')
  assert.equal(fake.writes[0].value.tableId, 'custom-table-key')
  assert.equal(fake.writes[0].value.total, 24.5)
  acknowledge()
  assert.equal(await pending, 'order-key')
})
test('rejected server write rejects order, not a false success', async () => {
  fake.commit = async () => { throw new Error('PERMISSION_DENIED') }
  await assert.rejects(createOrder('cafe-a', order), /PERMISSION_DENIED/)
})
test('cached synchronous Firebase connection callback does not leave order pending', async () => {
  fake.synchronous = true
  fake.commit = async () => {}
  try { assert.equal(await createOrder('cafe-a', order), 'order-key') }
  finally { fake.synchronous = false }
})
test('invalid table or malformed price cannot submit', async () => {
  await assert.rejects(createOrder('cafe-a', { ...order, tableId: null }), /Masa/)
  await assert.rejects(createOrder('cafe-a', { ...order, items: [{ ...order.items[0], price: NaN }] }), /Sepet/)
})
test('waiter/bill call also awaits acknowledgement', async () => {
  let acknowledge
  fake.commit = () => new Promise(resolve => { acknowledge = resolve })
  let done = false
  const pending = createCall('cafe-b', { tableId: 'table-1', tableNo: 1, type: 'waiter' }).then(() => { done = true })
  await tick()
  assert.equal(done, false)
  assert.equal(fake.writes.at(-1).path, 'businesses/cafe-b/calls/order-key')
  acknowledge()
  await pending
})
test('unknown or empty production tenant never creates demo data', async () => {
  fake.writes = []
  assert.equal(await ensureSeeded('unknown-tenant'), false)
  fake.data['businesses/cafe-a/menu/profile'] = { name: 'Mevcut işletme' }
  assert.equal(await ensureSeeded('cafe-a'), true)
  assert.deepEqual(fake.writes, [])
})
test('day close atomically archives only settled orders without removing open/new orders or layout', async () => {
  fake.updates=[]
  fake.data['businesses/cafe-a/orders']={paid:{status:'paid',total:20,createdAt:1000},open:{status:'new',total:30,createdAt:1000},cancelled:{status:'cancelled',total:10,createdAt:1000}}
  assert.equal(await resetDay('cafe-a'),2)
  assert.equal(fake.updates.length,1)
  const patch=fake.updates[0].value
  assert.equal(patch['orders/paid'],null)
  assert.equal(patch['orders/cancelled'],null)
  assert.equal(Object.keys(patch).length,4)
  assert(!Object.keys(patch).some(key=>['orders','orders/open','calls','layout'].includes(key)))
  assert(Object.keys(patch).some(key=>key.startsWith('archive/')&&key.endsWith('/paid')))
})
test('QR/NFC URLs roundtrip Turkish names and isolate businesses', () => {
  const url = new URL(tableUrl('CAFE SİNAN', 7))
  assert.equal(url.searchParams.get('isletme'), 'CAFE SİNAN')
  assert.equal(url.searchParams.get('masa'), '7')
  assert.notEqual(tableUrl('cafe-a', 7), tableUrl('cafe-b', 7))
  assert.throws(() => tableUrl('cafe', 0))
})
test('branded QR contains full escaped company name and SVG viewBox', async () => {
  const svg = await brandedTableQR('cafe-a', 3, 'Çınar & Dostlar')
  assert.match(svg, /Çınar &amp;/)
  assert.match(svg, /Dostlar/)
  assert.match(svg, /viewBox="0 0 \d+ \d+"/)
  const plain = await brandedTableQR('cafe-a', 3, '<Logo>')
  assert.match(plain, /&lt;Logo&gt;/)
})
test('installer QR-only mode cannot become create; input bounded', () => {
  assert.equal(provision.parseArgs(['--only-qr', 'CAFE SİNAN', '20']).onlyQR, true)
  assert.throws(() => provision.parseArgs(['Cafe', 'other/tenant', '10']))
  assert.throws(() => provision.parseArgs(['Cafe', 'cafe', '0']))
  assert.throws(() => provision.parseArgs(['Cafe', 'cafe', '10000']))
  assert.throws(() => provision.parseArgs(['Cafe', 'cafe', '10', 'red']))
})

test('Windows launcher does not require a management PIN', () => {
  const setup = provision.parseArgs(['Cafe', 'cafe', '10', '#112233'])
  assert.deepEqual(setup, { onlyQR: false, name: 'Cafe', id: 'cafe', count: 10, color: '#112233' })
})

test('installer refuses an existing tenant without writing or changing its password', async () => {
  const originalFetch = globalThis.fetch
  const previousURL = process.env.VITE_FIREBASE_DATABASE_URL
  process.env.VITE_FIREBASE_DATABASE_URL = 'https://database.example.invalid'
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method || 'GET' })
    return new Response(JSON.stringify({ menu: { profile: { name: 'Already installed' } } }), { status: 200, headers: { etag: 'existing' } })
  }
  try {
    await assert.rejects(provision.main(['Cafe', 'existing-cafe', '10', '#112233']), /zaten var/)
    assert.deepEqual(requests.map(r => r.method), ['GET'])
  } finally {
    globalThis.fetch = originalFetch
    if (previousURL === undefined) delete process.env.VITE_FIREBASE_DATABASE_URL
    else process.env.VITE_FIREBASE_DATABASE_URL = previousURL
  }
})

test('QR-only missing tenant does not create or mutate anything', async () => {
  const originalFetch = globalThis.fetch
  const previousURL = process.env.VITE_FIREBASE_DATABASE_URL
  process.env.VITE_FIREBASE_DATABASE_URL = 'https://database.example.invalid'
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method || 'GET' })
    return new Response('null', { status: 200 })
  }
  try {
    await assert.rejects(provision.main(['--only-qr', 'missing-cafe']), /bulunamadı/)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'GET')
    assert.match(requests[0].url, /missing-cafe\/menu.json/)
  } finally {
    globalThis.fetch = originalFetch
    if (previousURL === undefined) delete process.env.VITE_FIREBASE_DATABASE_URL
    else process.env.VITE_FIREBASE_DATABASE_URL = previousURL
  }
})
