import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  if (command === 'build' && mode !== 'demo') {
    const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_DATABASE_URL', 'VITE_FIREBASE_PROJECT_ID'].filter(k => !env[k]?.trim())
    if (missing.length) throw new Error(`Yayın durduruldu: Firebase ayarları eksik (${missing.join(', ')}). Yerel demo canlıya yayımlanamaz.`)
    const url = new URL(env.VITE_FIREBASE_DATABASE_URL)
    if (url.protocol !== 'https:') throw new Error('Firebase adresi HTTPS olmalıdır.')
  }
  return {
  plugins: [react()],
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
  server: {
    host: true,
    port: 5173,
  },
  }
})
