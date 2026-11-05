import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUILD_VERSION = Date.now().toString()

function autoVersionPlugin(version) {
  return {
    name: 'auto-version-plugin',
    transformIndexHtml(html) {
      return html.replace(/%BUILD_TIME%/g, version)
    },
    buildStart() {
      const payload = JSON.stringify({ version, buildTime: new Date().toISOString() })
      try {
        fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), payload, 'utf8')
      } catch {}
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, buildTime: new Date().toISOString() }),
      })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  if (command === 'build' && mode !== 'demo') {
    const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_DATABASE_URL', 'VITE_FIREBASE_PROJECT_ID'].filter(k => !env[k]?.trim())
    if (missing.length) throw new Error(`Yayın durduruldu: Firebase ayarları eksik (${missing.join(', ')}). Yerel demo canlıya yayımlanamaz.`)
    const url = new URL(env.VITE_FIREBASE_DATABASE_URL)
    if (url.protocol !== 'https:') throw new Error('Firebase adresi HTTPS olmalıdır.')
  }
  return {
    plugins: [react(), autoVersionPlugin(BUILD_VERSION)],
    define: {
      'window.__APP_VERSION__': JSON.stringify(BUILD_VERSION),
    },
    build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
    server: {
      host: true,
      port: 5173,
    },
  }
})
