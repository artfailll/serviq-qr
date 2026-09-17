import { useEffect, useState } from 'react'
import { Lock, Eye, EyeOff, UtensilsCrossed } from 'lucide-react'
import { useBusinessId, useValue } from '../lib/store'

// Oturum boyunca girişi hatırla (sekme kapanınca sıfırlanır)
const SESSION_KEY = 'sofra_admin_auth'
const VERIFY_URL = '/.netlify/functions/verify-admin'

// ─────────────────────────────────────────────────────────────
// Şifre doğrulaması artık sunucuda (netlify/functions/verify-admin.js).
// Eskiden şifre Firebase'de config/password altında duruyordu ve herkes
// okuyabiliyordu — işletme kimliği QR'ın içinde olduğu için masaya oturan
// biri paneli ele geçirebiliyordu.
//
// Bu işletmenin şifresi henüz sunucuya taşınmadıysa fonksiyon
// { configured: false } döner ve eski yönteme geri düşeriz; böylece geçiş
// sırasında hiçbir müşteri kilitli kalmaz.
// ─────────────────────────────────────────────────────────────
const probeCache = new Map()
function probeServer(bizId) {
  if (!probeCache.has(bizId)) {
    probeCache.set(bizId, fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bizId, pin: '' }),
    }).then((r) => r.json()).then((d) => !!d.configured).catch(() => false))
  }
  return probeCache.get(bizId)
}

export async function verifyAdminPin(bizId, pin) {
  const r = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bizId, pin }),
  })
  return r.json()
}

// Yönetim oturum durumu — net 4 hâl:
//   'loading' : durum henüz bilinmiyor (panel AÇILMAMALI — yarış hatası buradan çıkıyordu)
//   'open'    : şifre kurulmamış → serbest giriş
//   'authed'  : doğru şifreyle giriş yapılmış
//   'locked'  : şifre var, giriş gerekiyor
export function useAdminAuthState() {
  const bizId = useBusinessId()
  const [onServer, setOnServer] = useState(null) // null = yoklanıyor

  useEffect(() => {
    if (!bizId) return
    let alive = true
    probeServer(bizId).then((v) => { if (alive) setOnServer(v) })
    return () => { alive = false }
  }, [bizId])

  // initial = undefined → "yükleniyor"u "şifre yok"tan ayırt edebilmek için
  const config = useValue(bizId ? `businesses/${bizId}/config` : null, undefined)

  if (onServer === null) return 'loading'

  if (onServer) {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === `${bizId}:ok`) return 'authed'
    } catch {}
    return 'locked'
  }

  // ── Eski yol (şifre henüz taşınmamış işletmeler) ──
  if (config === undefined) return 'loading'
  const password = config?.password
  if (!password) return 'open'
  try {
    if (sessionStorage.getItem(SESSION_KEY) === `${bizId}:${password}`) return 'authed'
  } catch {}
  return 'locked'
}

export function setAdminAuth(bizId, password) {
  try {
    sessionStorage.setItem(SESSION_KEY, `${bizId}:${password}`)
  } catch {}
}

export default function AdminLogin({ onSuccess }) {
  const bizId = useBusinessId()
  const config = useValue(bizId ? `businesses/${bizId}/config` : null)
  const correctPassword = config?.password
  const bizName = useValue(bizId ? `businesses/${bizId}/menu/profile/name` : null)

  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)

  function reject() {
    setError(true)
    setShake(true)
    setInput('')
    setTimeout(() => setShake(false), 600)
    setTimeout(() => setError(false), 2000)
  }

  async function attempt() {
    if (busy || !input) return
    setBusy(true)
    try {
      // Önce sunucu doğrulaması; bu işletme taşınmamışsa eski yola düş
      const res = await verifyAdminPin(bizId, input).catch(() => null)
      if (res?.configured) {
        if (res.ok) { setAdminAuth(bizId, 'ok'); onSuccess() } else { reject() }
        return
      }
      if (correctPassword && input === correctPassword) {
        setAdminAuth(bizId, correctPassword)
        onSuccess()
      } else {
        reject()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 grid place-items-center p-4">
      {/* Arka plan dekoru */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-brand-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className={`relative w-full max-w-sm transition-transform ${shake ? 'animate-[shake_.4s_ease-in-out]' : ''}`}>
        {/* Kart */}
        <div className="card p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-glow mb-3">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-ink-900">
              {bizName || 'serviq'}
            </h1>
            <p className="text-sm text-ink-400 mt-1">Yönetim Paneli</p>
          </div>

          {/* Şifre alanı */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-1.5">
                <Lock className="h-3.5 w-3.5 inline mr-1.5 text-ink-400" />
                Yönetim Şifresi
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(false) }}
                  onKeyDown={(e) => e.key === 'Enter' && attempt()}
                  disabled={busy}
                  autoFocus
                  placeholder="••••••"
                  className={`inp pr-11 text-lg tracking-widest font-bold transition-colors
                    ${error ? 'border-red-400 bg-red-50 focus:ring-red-300' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                >
                  {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {error && (
                <p className="text-red-500 text-sm mt-1.5 font-semibold">Hatalı şifre, tekrar deneyin.</p>
              )}
            </div>

            <button
              onClick={attempt}
              disabled={!input || busy}
              className="btn-primary w-full !py-3.5 text-base"
            >
              <Lock className="h-4.5 w-4.5" />
              {busy ? 'Kontrol ediliyor…' : 'Giriş Yap'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-ink-400 mt-4">
          Şifrenizi mi unuttunuz? serviq destek: WhatsApp
        </p>
      </div>
    </div>
  )
}
