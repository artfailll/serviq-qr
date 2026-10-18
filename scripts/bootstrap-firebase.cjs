#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SITE_URL = 'https://serviq.com.tr/'
const MAX_ASSETS = 60

function valueFor(source, key) {
  const escaped = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp('(?:["\\']' + escaped + '["\\']|' + escaped + ')\\s*:\\s*["\\']([^"\\']+)["\\']'))
  return match?.[1] || ''
}

function extractFirebaseConfigFromScripts(sources) {
  for (const source of sources) {
    const databasePattern = /(?:["']?databaseURL["']?)\s*:\s*["'](https:\/\/[^"']+)["']/g
    let match
    while ((match = databasePattern.exec(source))) {
      const start = Math.max(0, match.index - 1800)
      const end = Math.min(source.length, match.index + 1800)
      const candidate = source.slice(start, end)
      const config = {
        apiKey: valueFor(candidate, 'apiKey'),
        authDomain: valueFor(candidate, 'authDomain'),
        databaseURL: match[1],
        projectId: valueFor(candidate, 'projectId'),
        storageBucket: valueFor(candidate, 'storageBucket'),
        messagingSenderId: valueFor(candidate, 'messagingSenderId'),
        appId: valueFor(candidate, 'appId'),
      }
      if (config.apiKey && config.projectId && /^https:\/\/[^/]+/i.test(config.databaseURL)) return config
    }
  }
  return null
}

function jsReferences(text, baseUrl) {
  const urls = new Set()
  const pattern = /["']([^"']+\.js(?:\?[^"']*)?)["']/gi
  let match
  while ((match = pattern.exec(text))) {
    try {
      const url = new URL(match[1], baseUrl)
      if (url.protocol === 'https:' && url.origin === new URL(SITE_URL).origin && url.pathname.endsWith('.js')) {
        urls.add(url.href)
      }
    } catch {}
  }
  return [...urls]
}

async function getText(url) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const finalUrl = new URL(response.url || url)
  if (finalUrl.protocol !== 'https:' || !['serviq.com.tr', 'www.serviq.com.tr'].includes(finalUrl.hostname)) {
    throw new Error('Canli site beklenmeyen bir adrese yonlendirildi.')
  }
  return { text: await response.text(), url: finalUrl.href }
}

function renderEnv(config) {
  const keys = {
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
    VITE_FIREBASE_DATABASE_URL: config.databaseURL,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
    VITE_FIREBASE_APP_ID: config.appId,
  }
  return Object.entries(keys)
    .map(([key, value]) => key + '=' + JSON.stringify(value || ''))
    .join('\n') + '\n'
}

async function discoverFirebaseConfig() {
  const first = await getText(SITE_URL)
  const queue = jsReferences(first.text, first.url)
  const visited = new Set()
  const sources = []
  while (queue.length && visited.size < MAX_ASSETS) {
    const url = queue.shift()
    if (visited.has(url)) continue
    visited.add(url)
    try {
      const asset = await getText(url)
      sources.push(asset.text)
      for (const reference of jsReferences(asset.text, asset.url)) {
        if (!visited.has(reference) && !queue.includes(reference) && queue.length + visited.size < MAX_ASSETS) queue.push(reference)
      }
    } catch {
      // A single optional chunk may be unavailable; inspect the remaining assets.
    }
  }
  const config = extractFirebaseConfigFromScripts(sources)
  if (!config) throw new Error('Canli sitede kullanilan Firebase web ayarlari bulunamadi.')
  return config
}

async function main() {
  const config = await discoverFirebaseConfig()
  const envPath = path.join(ROOT, '.env')
  fs.writeFileSync(envPath, renderEnv(config), { encoding: 'utf8', mode: 0o600 })
  console.log('Serviq canli Firebase ayarlari otomatik hazirlandi.')
}

if (require.main === module) {
  main().catch(error => {
    console.error('Firebase ayari otomatik alinamadi: ' + error.message)
    process.exitCode = 1
  })
}

module.exports = { extractFirebaseConfigFromScripts, jsReferences, renderEnv, discoverFirebaseConfig }
