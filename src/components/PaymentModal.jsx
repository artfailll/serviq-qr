import { Banknote, CreditCard, Ticket } from 'lucide-react'
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
  return (
    <Modal open={open} onClose={onClose} title="Ödeme Yöntemi">
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
              onClick={() => onSelect(m.key)}
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
