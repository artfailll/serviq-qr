// Kasa/Yönetim ekranlarının hangisinde olursanız olun (hatta sekme
// arka plandayken de) yeni sipariş/çağrı bildirimini kaçırmamanızı
// sağlar. App kökünde, route değişse de sökülmeden tek sefer monte edilir.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BellRing, ListChecks, X } from 'lucide-react'
import { useOrders, useCalls, useBusinessId } from '../lib/store'
import { playNewOrder, playCall, useSoundPref } from '../lib/sound'

const STAFF_PATHS = ['/kasa', '/yonetim']
const TOAST_MS = 7000

export default function StaffAlerts() {
  const location = useLocation()
  const isStaff = STAFF_PATHS.some((p) => location.pathname.startsWith(p))
  const bizId = useBusinessId()
  const orders = useOrders(bizId)
  const calls = useCalls(bizId)
  const soundOn = useSoundPref()
  const [toasts, setToasts] = useState([])
  const seenOrders = useRef(null)
  const seenCalls = useRef(null)

  useEffect(() => {
    if (isStaff && typeof window !== 'undefined' && 'Notification' in window && window.Notification?.permission === 'default') {
      window.Notification.requestPermission().catch(() => {})
    }
  }, [isStaff])

  function fire(kind, text) {
    if (soundOn) (kind === 'call' ? playCall() : playNewOrder())
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS)
    if (navigator.vibrate) navigator.vibrate(kind === 'call' ? [120, 60, 120, 60, 120] : [200])
    // Sekme arka plandaysa (başka sekme/pencerede) OS bildirimi göster —
    // uygulama içi toast yalnızca sekme görünürken fark edilir.
    if (typeof document !== 'undefined' && document.hidden && typeof window !== 'undefined' && 'Notification' in window && window.Notification?.permission === 'granted') {
      try {
        const n = new window.Notification('serviq', { body: text, tag: id, requireInteraction: false })
        n.onclick = () => { window.focus(); n.close() }
        setTimeout(() => n.close(), 15000)
      } catch {}
    }
  }

  useEffect(() => {
    if (!isStaff) return
    const ids = new Set(orders.map((o) => o.id))
    if (seenOrders.current === null) { seenOrders.current = ids; return }
    const newOnes = orders.filter((o) => !seenOrders.current.has(o.id))
    seenOrders.current = ids
    newOnes.forEach((o) => fire('order', `Yeni sipariş · Masa ${o.tableNo ?? '?'}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, isStaff])

  useEffect(() => {
    if (!isStaff) return
    const ids = new Set(calls.map((c) => c.id))
    if (seenCalls.current === null) { seenCalls.current = ids; return }
    const newOnes = calls.filter((c) => !seenCalls.current.has(c.id))
    seenCalls.current = ids
    newOnes.forEach((c) =>
      fire('call', c.type === 'waiter' ? `Garson çağrısı · Masa ${c.tableNo ?? '?'}` : `Hesap isteniyor · Masa ${c.tableNo ?? '?'}`)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls, isStaff])

  if (!isStaff || toasts.length === 0) return null

  return (
    <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
      {toasts.map((tst) => (
        <div key={tst.id} className="animate-fade-up" style={{
          display: 'flex', alignItems: 'center', gap: 10, background: '#111827', color: '#fff',
          borderRadius: 14, padding: '12px 14px', boxShadow: '0 10px 30px rgba(0,0,0,.35)',
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: tst.kind === 'call' ? '#f59e0b' : '#22c55e',
            display: 'grid', placeItems: 'center',
          }}>
            {tst.kind === 'call' ? <BellRing size={16} /> : <ListChecks size={16} />}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{tst.text}</span>
          <button
            onClick={() => setToasts((t) => t.filter((x) => x.id !== tst.id))}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
