import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  BellRing,
  ReceiptText,
  Volume2,
  VolumeX,
  Check,
  ChefHat,
  Clock,
  ListChecks,
  ArrowRight,
  ArrowLeft,
  UtensilsCrossed,
  LayoutDashboard,
  Wallet,
  AlertTriangle,
  Printer,
  Ban,
  LogOut,
} from 'lucide-react'
import {
  useOrders,
  useCalls,
  useProfile,
  updateProfile,
  setOrderStatus,
  markOrderPaid,
  resolveCall,
  useTicker,
  useBusinessId,
  useActiveStaff,
  cancelOrder,
  PAYMENT_LABELS,
} from '../lib/store'
// StaffPicker kaldirildi
import AdminLogin, { useRoleAuthState, clearStaffSession, getStaffSession } from './AdminLogin'
import { money, clockMs, timeOfDay } from '../lib/format'
import { EmptyState, DemoBadge } from '../components/ui'
import PaymentModal from '../components/PaymentModal'
import { playNewOrder, primeAudio, useSoundPref, setSoundPref } from '../lib/sound'
import { printKitchenSlip, printBill } from '../lib/receipt'

const COLUMNS = [
  { key: 'new', label: 'Yeni', accent: 'border-brand-400', dot: 'bg-brand-500' },
  { key: 'kitchen', label: 'Mutfakta', accent: 'border-amber-400', dot: 'bg-amber-500' },
  { key: 'ready', label: 'Hazır', accent: 'border-green-400', dot: 'bg-green-500' },
  { key: 'served', label: 'Servis Edildi · Ödeme Bekliyor', accent: 'border-sky-400', dot: 'bg-sky-500' },
]

const NEXT = { new: 'kitchen', kitchen: 'ready', ready: 'served' }
const PREV = { kitchen: 'new', ready: 'kitchen', served: 'ready' }
const NEXT_LABEL = { new: 'Mutfağa Al', kitchen: 'Hazır', ready: 'Servis Et' }

// Bu kadar dakikadan uzun süredir bekleyen (servis edilmemiş) sipariş = gecikmiş
const OVERDUE_MIN = 10

export default function Cashier() {
  const bizId = useBusinessId()
  const status = useRoleAuthState('cashier')
  const [justAuthed, setJustAuthed] = useState(false)
  if (status === 'loading') return <div className="min-h-screen grid place-items-center" role="status">Kasa erişimi doğrulanıyor…</div>
  if (status !== 'open' && status !== 'authed' && !justAuthed) return <AdminLogin role="cashier" onSuccess={() => setJustAuthed(true)} />
  return <CashierBoard onLogout={() => { clearStaffSession(bizId); setJustAuthed(false); window.location.reload() }} />
}

function CashierBoard({ onLogout }) {
  const bizId = useBusinessId()
  const staffSession = getStaffSession(bizId)
  const canAccessAdmin = !staffSession || staffSession.isMaster || ['owner', 'manager'].includes(staffSession?.role)
  const orders = useOrders(bizId)
  const calls = useCalls(bizId)
  const profile = useProfile(bizId)
  const soundOn = useSoundPref()
  const { staffId: cashierId } = useActiveStaff(bizId)
  useTicker(1000)

  // Otomatik adisyon: yeni sipariş gelince mutfak fişini yazdır (ayar açıksa).
  // Sessiz basmak için Chrome'u "kiosk printing" modunda açmak gerekir.
  // Otomatik adisyon: yeni sipariş gelince mutfak fişini yazdır (ayar açıksa veya garsondan geldiyse).
  // Sessiz basmak için Chrome'u "kiosk printing" modunda açmak gerekir.
  const seenPrint = useRef(null)
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id))
    if (seenPrint.current === null) { seenPrint.current = ids; return }
    const autoForWaiter = profile?.printOnWaiterOrder !== false
    orders.filter((o) => !seenPrint.current.has(o.id) && o.status === 'new' && (profile?.printAuto || (autoForWaiter && o.staffId)))
      .forEach((o) => printKitchenSlip(o, profile))
    seenPrint.current = ids
  }, [orders, profile])

  // Garson veya kasa tarafından belirli bir sipariş/hesap için yazdırma talep edildiğinde otomatik bas
  const printedReqs = useRef(new Set())
  useEffect(() => {
    orders.forEach((o) => {
      if (o.printRequestedAt) {
        const key = `${o.id}_${o.printRequestedAt}`
        if (!printedReqs.current.has(key)) {
          printedReqs.current.add(key)
          if (o.printType === 'kitchen') {
            printKitchenSlip(o, profile)
          } else {
            printBill(o, profile)
          }
        }
      }
    })
  }, [orders, profile])

  const hasKitchen = profile.kitchenEnabled !== false
  const active = orders.filter((o) => o.status !== 'paid' && o.status !== 'cancelled')
  const pendingCount = orders.filter((o) => o.status === 'new').length
  const cookingCount = orders.filter((o) => o.status === 'kitchen').length
  const readyCount = orders.filter((o) => o.status === 'ready').length
  const activeColumns = hasKitchen ? COLUMNS : [
    { key: 'new', label: 'Yeni', accent: 'border-brand-400', dot: 'bg-brand-500' },
    { key: 'served', label: 'Servis Edildi · Ödeme Bekliyor', accent: 'border-sky-400', dot: 'bg-sky-500' },
  ]
  const awaitingPay = orders.filter((o) => o.status === 'served' || (!hasKitchen && (o.status === 'ready' || o.status === 'kitchen'))).length

  function enableSound() {
    primeAudio()
    setSoundPref(true)
    playNewOrder()
  }

  return (
    <div className="min-h-screen bg-ink-100">
      <header className="sticky top-0 z-30 bg-white border-b border-ink-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
              <UtensilsCrossed className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="font-display font-extrabold leading-tight">Kasa Ekranı</p>
              <p className="text-xs text-ink-400 leading-tight">Canlı sipariş takibi</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DemoBadge />
            <Link to={`/garson?isletme=${encodeURIComponent(bizId)}`} className="btn-outline !py-2 hidden sm:inline-flex">
              <UtensilsCrossed className="h-4 w-4" />
              Garson
            </Link>
            {canAccessAdmin && (
              <Link to={`/yonetim?isletme=${encodeURIComponent(bizId)}`} className="btn-outline !py-2 hidden sm:inline-flex">
                <LayoutDashboard className="h-4 w-4" />
                Yönetim
              </Link>
            )}
            {onLogout && (
              <button onClick={onLogout} className="btn-ghost !p-2 text-ink-500 hover:text-ink-800" title="Kasiyer Değiştir / Çıkış">
                <LogOut className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => updateProfile(bizId, { kitchenEnabled: !hasKitchen })}
              className={`btn !py-2 flex items-center gap-1.5 transition-all text-xs font-bold border ${
                hasKitchen
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-sm'
                  : 'bg-ink-100 text-ink-600 border-ink-200 hover:bg-ink-200'
              }`}
              title={hasKitchen ? 'Mutfak süreci açık (kapatmak için tıklayın)' : 'Mutfak süreci kapalı (açmak için tıklayın)'}
            >
              <ChefHat className={`h-4 w-4 ${hasKitchen ? 'text-amber-600' : 'text-ink-400'}`} />
              <span>Mutfak: <b>{hasKitchen ? 'Açık' : 'Kapalı'}</b></span>
            </button>
            {soundOn ? (
              <button onClick={() => setSoundPref(false)} className="btn-ghost !py-2" title="Sesi kapat">
                <Volume2 className="h-4 w-4 text-green-600" />
                <span className="hidden sm:inline">Ses Açık</span>
              </button>
            ) : (
              <button onClick={enableSound} className="btn-primary !py-2" title="Ses uyarısını aç">
                <VolumeX className="h-4 w-4" />
                <span className="hidden sm:inline">Sesi Aç</span>
              </button>
            )}
          </div>
        </div>

        <div className={`mx-auto max-w-7xl px-4 pb-3 grid gap-2.5 ${hasKitchen ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <Stat icon={ListChecks} label="Bekleyen Sipariş" value={pendingCount} tone="brand" />
          {hasKitchen && (
            <Stat icon={ChefHat} label="Hazırlanan" value={cookingCount} tone="amber" />
          )}
          <Stat icon={Wallet} label="Ödeme Bekleyen" value={awaitingPay} tone="sky" />
        </div>
      </header>

      {calls.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-3 space-y-2">
          {calls.map((c) => (
            <CallBanner key={c.id} call={c} bizId={bizId} />
          ))}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-4">
        {active.length === 0 && calls.length === 0 && (
          <div className="card mt-6">
            <EmptyState
              icon={ListChecks}
              title="Aktif sipariş yok"
              hint="Müşteriler sipariş verdikçe buraya anlık düşecek."
            />
          </div>
        )}

        <div className={`grid gap-4 ${hasKitchen ? 'lg:grid-cols-4 sm:grid-cols-2' : 'lg:grid-cols-2 sm:grid-cols-2'}`}>
          {activeColumns.map((col) => {
            const items = active.filter((o) => hasKitchen ? o.status === col.key : (col.key === 'new' ? o.status === 'new' : (o.status === 'served' || o.status === 'ready' || o.status === 'kitchen')))
            return (
              <section key={col.key} className="flex flex-col">
                <div className="flex items-center gap-2 px-1 pb-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                  <h2 className="font-display font-bold text-ink-800 text-sm">{col.label}</h2>
                  <span className="chip bg-white text-ink-500 ml-auto">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((o) => (
                    <OrderCard key={o.id} order={o} accent={col.accent} bizId={bizId} profile={profile} cashierId={cashierId} hasKitchen={hasKitchen} />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">
                      Boş
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: 'text-brand-600 bg-brand-100',
    amber: 'text-amber-600 bg-amber-100',
    sky: 'text-sky-600 bg-sky-100',
    ink: 'text-ink-700 bg-ink-200',
    green: 'text-green-600 bg-green-100',
  }
  return (
    <div className="card !rounded-xl p-3 flex items-center gap-3">
      <span className={`grid h-10 w-10 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-400 leading-tight">{label}</p>
        <p className="font-display text-lg font-extrabold leading-tight truncate">{value}</p>
      </div>
    </div>
  )
}

function CallBanner({ call, bizId }) {
  const waiter = call.type === 'waiter'
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-soft animate-pulse-ring
        ${waiter ? 'bg-brand-500' : 'bg-sky-500'}`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20">
        {waiter ? <BellRing className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}
      </span>
      <div className="grow">
        <p className="font-bold leading-tight">
          {waiter ? 'Garson çağrısı' : 'Hesap isteniyor'} · Masa {call.tableNo ?? '?'}
        </p>
        <p className="text-xs text-white/80">{timeOfDay(call.createdAt)} · {clockMs(call.createdAt)} önce</p>
      </div>
      <button
        onClick={() => resolveCall(bizId, call.id)}
        className="btn bg-white/20 hover:bg-white/30 text-white !py-2"
      >
        <Check className="h-4 w-4" />
        Tamam
      </button>
    </div>
  )
}

function OrderCard({ order, accent, bizId, profile, cashierId, hasKitchen }) {
  const mins = (Date.now() - (order.createdAt || 0)) / 60000
  const isServed = order.status === 'served' || (!hasKitchen && (order.status === 'ready' || order.status === 'kitchen'))
  const overdue = !isServed && mins >= OVERDUE_MIN
  const [payOpen, setPayOpen] = useState(false)

  const nextTarget = hasKitchen ? NEXT[order.status] : (order.status === 'new' ? 'served' : null)
  const prevTarget = hasKitchen ? PREV[order.status] : (isServed ? 'new' : null)
  const nextBtnLabel = hasKitchen ? NEXT_LABEL[order.status] : (order.status === 'new' ? 'Servis Edildi' : '')

  return (
    <article
      className={`card border-l-4 ${overdue ? 'border-red-500 ring-2 ring-red-200' : accent} p-4 animate-fade-up`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-extrabold">Masa {order.tableNo ?? '?'}</span>
        <span
          className={`chip ${overdue ? 'bg-red-100 text-red-600' : 'bg-ink-100 text-ink-500'}`}
        >
          {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {clockMs(order.createdAt)}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {order.items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="grid h-5 min-w-5 place-items-center rounded bg-ink-900 px-1 text-[11px] font-bold text-white">
              {it.qty}
            </span>
            <div className="grow">
              <span className="font-medium text-ink-800">{it.name}</span>
              {it.note && <span className="block text-xs text-brand-600">↳ {it.note}</span>}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
        <span className="font-display font-extrabold text-ink-900">{money(order.total)}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm(`Masa ${order.tableNo ?? '?'} siparişi iptal edilsin mi?\nReçeteli ürünlerin stoğu geri yüklenir.`)) {
                cancelOrder(bizId, order.id, order)
              }
            }}
            className="btn-ghost !py-1.5 !px-2.5 text-ink-400 hover:text-red-600"
            title="Siparişi iptal et (stok geri yüklenir)"
          >
            <Ban className="h-4 w-4" />
          </button>
          {prevTarget && (
            <button
              onClick={() => setOrderStatus(bizId, order.id, prevTarget)}
              className="btn-ghost !py-1.5 !px-2.5"
              title="Geri al"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => printBill(order, profile)}
            className="btn-outline !py-2 !px-3 font-bold flex items-center gap-1.5 text-ink-800"
            title="Hesap / Adisyon fişi yazdır"
          >
            <ReceiptText className="h-4 w-4 text-brand-600" />
            Fiş
          </button>
          <button
            onClick={() => printKitchenSlip(order, profile)}
            className="btn-ghost !py-2 !px-2.5 text-ink-500 hover:text-ink-800"
            title="Sipariş / Mutfak fişi yazdır"
          >
            <Printer className="h-4 w-4" />
          </button>
          {isServed ? (
            <button
              onClick={() => setPayOpen(true)}
              className="btn !py-2 bg-green-600 text-white hover:bg-green-700"
            >
              <Wallet className="h-4 w-4" />
              Hesabı Kapat
            </button>
          ) : (
            nextTarget && (
              <button
                onClick={() => setOrderStatus(bizId, order.id, nextTarget)}
                className="btn-primary !py-2"
              >
                {nextBtnLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
            )
          )}
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={order.total}
        subtitle={`Masa ${order.tableNo ?? '?'} · tahsilat`}
        onSelect={async (method) => {
          await markOrderPaid(bizId, order.id, method, { order, cashierId })
          setPayOpen(false)
          // Ödeme sonrası fiş otomatik bassın (ayar açıksa)
          if (profile?.printBillOnPay) printBill(order, profile, PAYMENT_LABELS[method] || method)
        }}
      />
    </article>
  )
}
