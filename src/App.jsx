import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, useSearchParams } from 'react-router-dom'
import { ensureSeeded } from './lib/seed'
import { getBusinessId, NO_BUSINESS_ERROR } from './lib/business'
import { BusinessContext } from './lib/store'
import { UtensilsCrossed } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import StaffAlerts from './components/StaffAlerts'

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
  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 p-6">
      <div className="card p-8 max-w-sm text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-500 mx-auto mb-4">
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-extrabold text-ink-900">İşletme bulunamadı</h2>
        <p className="mt-2 text-sm text-ink-500">{NO_BUSINESS_ERROR}</p>
      </div>
    </div>
  )
}

// Ana uygulama — businessId'yi context'e koyar
function AppWithBusiness({ bizId }) {
  const [ready, setReady] = useState(false)
  const [unknown, setUnknown] = useState(false)

  useEffect(() => {
    let alive = true
    ensureSeeded(bizId).then((ok) => {
      if (!alive) return
      setUnknown(!ok)
      setReady(true)
    })
    return () => { alive = false }
  }, [bizId])

  if (!ready) return <Loader />
  // Böyle bir işletme açılmamış — sahte menü üretmek yerine hata göster
  if (unknown) return <NoBusiness />

  return (
    <BusinessContext.Provider value={bizId}>
      <ErrorBoundary>
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

  return <AppWithBusiness bizId={bizId} />
}
