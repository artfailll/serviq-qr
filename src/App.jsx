import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, useSearchParams } from 'react-router-dom'
import { ensureSeeded } from './lib/seed'
import { getBusinessId, NO_BUSINESS_ERROR } from './lib/business'
import { BusinessContext } from './lib/store'
import { UtensilsCrossed } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import StaffAlerts from './components/StaffAlerts'
import ConnectionStatus from './components/ConnectionStatus'

const Home     = lazy(() => import('./pages/Home'))
const Customer = lazy(() => import('./pages/Customer'))
const Cashier  = lazy(() => import('./pages/Cashier'))
const Admin    = lazy(() => import('./pages/Admin'))
const Waiter   = lazy(() => import('./pages/Waiter'))

function Loader() {
  return (
    <div className="min-h-screen grid place-items-center bg-ink-50">
      <div className="h-10 w-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
    </div>
  )
}

function NoBusiness() {
  const [input, setInput] = useState('')
  const currentPath = window.location.pathname === '/' || window.location.pathname === '' ? '/kasa' : window.location.pathname

  function submit(val) {
    const raw = (val || input || '').trim().toLowerCase()
    if (!raw) return
    try { localStorage.setItem('sofra_business_id', raw) } catch {}
    const search = new URLSearchParams(window.location.search)
    search.set('isletme', raw)
    window.location.href = `${currentPath}?${search.toString()}`
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 p-4">
      <div className="card p-8 max-w-md w-full text-center shadow-lg">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-brand-600 mx-auto mb-4">
          <UtensilsCrossed className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-ink-900">İşletme Girişi</h2>
        <p className="mt-2 text-sm text-ink-500">
          Bu cihazda henüz işletme seçilmemiş. Lütfen bağlanmak istediğiniz işletmeyi seçin veya adını yazın:
        </p>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => submit('sezgin-usta-doner')}
            className="w-full btn bg-brand-50 hover:bg-brand-100 text-brand-700 border-2 border-brand-200 !py-3.5 !rounded-xl font-bold flex items-center justify-center gap-2 text-base transition-all"
          >
            <span>🍖</span>
            <span>Sezgin Usta Döner Ve Kebap Evi</span>
          </button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-ink-200" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-ink-400">veya kimlik yazın</span></div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="örn: sezgin-usta-doner"
            className="inp text-center text-base !py-3 font-semibold"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary w-full !py-3.5 text-base font-bold disabled:opacity-50"
          >
            Giriş Yap
          </button>
        </form>

        <p className="mt-4 text-xs text-ink-400">
          İpucu: Bir kez giriş yaptığınızda bu cihaz işletmenizi otomatik hatırlar.
        </p>
      </div>
    </div>
  )
}

// Ana uygulama — businessId'yi context'e koyar
function AppWithBusiness({ bizId }) {
  const [ready, setReady] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setReady(false)
    setError(false)
    const timer = setTimeout(() => { if (alive) setError(true) }, 15000)
    ensureSeeded(bizId).then((ok) => {
      if (!alive) return
      clearTimeout(timer)
      setError(false)
      setUnknown(!ok)
      setReady(true)
    }).catch(() => { if (alive) { clearTimeout(timer); setError(true) } })
    return () => { alive = false; clearTimeout(timer) }
  }, [bizId])

  if (error) return <div className="min-h-screen grid place-items-center p-6"><div role="alert" className="card p-8 text-center"><h2>İşletmeye bağlanılamadı</h2><p>İnternet bağlantısını kontrol edin. Sipariş gönderilmedi.</p><button className="btn-primary mt-4" onClick={() => window.location.reload()}>Tekrar dene</button></div></div>
  if (!ready) return <Loader />
  // Böyle bir işletme açılmamış — sahte menü üretmek yerine hata göster
  if (unknown) return <NoBusiness />

  return (
    <BusinessContext.Provider value={bizId}>
      <ErrorBoundary>
        <ConnectionStatus />
        <StaffAlerts />
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/"         element={<Home />} />
            <Route path="/menu"     element={<Customer />} />
            <Route path="/kasa"     element={<Cashier />} />
            <Route path="/garson"   element={<Waiter />} />
            <Route path="/yonetim"  element={<Admin />} />
            <Route path="*"         element={<Home />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BusinessContext.Provider>
  )
}

export default function App() {
  const bizId = getBusinessId()

  // Ana sayfa businessId gerektirmez
  const isHome = window.location.pathname === '/' ||
                 window.location.pathname === ''

  if (!bizId && !isHome) return <NoBusiness />
  if (isHome) {
    return (
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NoBusiness />} />
        </Routes>
      </Suspense>
    )
  }

  return <AppWithBusiness key={bizId} bizId={bizId} />
}
