import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { initAutoUpdate } from './lib/autoUpdate'

// Tüm açık ekranlar için otomatik sürüm yenileme yöneticisi
initAutoUpdate()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// PWA — service worker kaydı (uygulama gibi yüklenebilir)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Arka planda veya sekme odağa geldiğinde düzenli olarak SW güncellemesi sorgula
      setInterval(() => reg.update().catch(() => {}), 30 * 1000)
      window.addEventListener('focus', () => reg.update().catch(() => {}))
    }).catch(() => {})
  })
}
