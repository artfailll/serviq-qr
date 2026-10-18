import test from 'node:test'
import assert from 'node:assert/strict'
import { extractFirebaseConfigFromScripts, jsReferences, renderEnv } from '../scripts/bootstrap-firebase.cjs'

test('discovers the existing live Firebase web configuration from a bundled JS object', () => {
  const bundle = `const cfg={apiKey:"AIza-test-public-key",authDomain:"serviq.firebaseapp.com",databaseURL:"https://serviq-default-rtdb.europe-west1.firebasedatabase.app",projectId:"serviq",storageBucket:"serviq.firebasestorage.app",messagingSenderId:"123456",appId:"1:123456:web:abcdef"};`
  const config = extractFirebaseConfigFromScripts([bundle])
  assert.deepEqual(config, {
    apiKey: 'AIza-test-public-key',
    authDomain: 'serviq.firebaseapp.com',
    databaseURL: 'https://serviq-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'serviq',
    storageBucket: 'serviq.firebasestorage.app',
    messagingSenderId: '123456',
    appId: '1:123456:web:abcdef',
  })
})

test('does not accept a bundle without a complete Firebase database configuration', () => {
  assert.equal(extractFirebaseConfigFromScripts(['const apiKey="x";']), null)
  assert.equal(extractFirebaseConfigFromScripts(['const cfg={databaseURL:"https://db.example",projectId:"serviq"}']), null)
})

test('only follows JavaScript assets hosted on the live Serviq origin over HTTPS', () => {
  const refs = jsReferences(
    '<script src="/assets/app.js"></script><script src="https://evil.example/x.js"></script><script src="http://serviq.com.tr/insecure.js"></script>',
    'https://serviq.com.tr/'
  )
  assert.deepEqual(refs, ['https://serviq.com.tr/assets/app.js'])
})

test('writes all Firebase values to a local dotenv file without printing them', () => {
  const output = renderEnv({ apiKey: 'public-key', databaseURL: 'https://serviq-default-rtdb.europe-west1.firebasedatabase.app', projectId: 'serviq' })
  assert.match(output, /^VITE_FIREBASE_API_KEY=public-key$/m)
  assert.match(output, /^VITE_FIREBASE_DATABASE_URL=https:\/\/serviq-default-rtdb\.europe-west1\.firebasedatabase\.app$/m)
  assert.match(output, /^VITE_FIREBASE_PROJECT_ID=serviq$/m)
  assert.match(output, /^VITE_FIREBASE_AUTH_DOMAIN=$/m)
})
