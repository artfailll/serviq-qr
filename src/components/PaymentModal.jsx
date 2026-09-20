import { Banknote, CreditCard, Ticket } from 'lucide-react'
import { useRef, useState } from 'react'
import { Modal } from './ui'
import { PAYMENT_METHODS } from '../lib/store'
import { money } from '../lib/format'

// Hesabı kapatırken hangi yöntemle ödendiğini seçtirir.
// Seçim raporda ciroyu yönteme göre ayırır → takip kolaylaşır.
const ICONS = {
  nakit: Banknote,
  kart: CreditCard,
}

export default function PaymentModal({ open, onClose, onSelect, total, subtitle }) {
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const lock = useRef(false)
  async function select(method) {
    if (lock.current) return
    lock.current=true; setBusy(true); setError('')
    try { await onSelect(method) }
    catch { setError('İşlem tamamen doğrulanamadı. Sipariş durumunu kontrol edin; tekrar fiziksel tahsilat yapmayın.') }
    finally { lock.current=false; setBusy(false) }
  }
  return (
    <Modal open={open} onClose={() => { if (!lock.current) { setError(''); onClose() } }} title="Ödeme Yöntemi">
      {error && <p role="alert" className="text-red-700 mb-3">{error}</p>}
      {busy && <p role="status" className="mb-3">Sunucu onayı bekleniyor…</p>}
      {total != null && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-ink-100 px-4 py-3">
          <span className="text-sm font-semibold text-ink-500">
            {subtitle || 'Tahsil edilecek'}
          </span>
          <span className="font-display text-xl font-extrabold text-ink-900">{money(total)}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {PAYMENT_METHODS.map((m) => {
          const Icon = ICONS[m.key] || Ticket
          return (
            <button
              key={m.key}
              disabled={busy}
              onClick={() => select(m.key)}
              className="flex items-center gap-2.5 rounded-2xl border-2 border-ink-200 bg-white px-3.5 py-3.5
                         text-left font-bold text-ink-800 transition-all duration-150
                         hover:border-brand-400 hover:bg-brand-50 active:scale-[.98]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm leading-tight">{m.label}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-center text-xs text-ink-400">Yöntemi seçince hesap kapanır.</p>
    </Modal>
  )
}
