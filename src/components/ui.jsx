// Küçük, yeniden kullanılabilir arayüz parçaları
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, UtensilsCrossed } from 'lucide-react'
import { IS_DEMO } from '../lib/db'

export function ProductImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 text-brand-500 ${className}`}
        aria-hidden="true"
      >
        <UtensilsCrossed className="h-8 w-8 opacity-70" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}

export function Modal({ open, onClose, title, children, footer, maxW = 'max-w-lg' }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm animate-[fade-up_.2s_ease-out]"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxW} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl
                    max-h-[92vh] flex flex-col animate-[fade-up_.25s_ease-out]`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 shrink-0">
          <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="btn-ghost h-9 w-9 !p-0 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 grow">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-ink-100 shrink-0">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer
        ${checked ? 'bg-brand-500' : 'bg-ink-300'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-ink-100 text-ink-400">
          <Icon className="h-8 w-8" />
        </div>
      )}
      <p className="font-semibold text-ink-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-400 max-w-xs">{hint}</p>}
    </div>
  )
}

export function DemoBadge() {
  if (!IS_DEMO) return null
  return (
    <span className="chip bg-amber-100 text-amber-700 border border-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Demo Mod
    </span>
  )
}
