import { useEffect, useState } from 'react'
import { Lock, Eye, EyeOff, UtensilsCrossed, ShieldCheck } from 'lucide-react'
import { useBusinessId, useValue, useStaff, setActiveStaffId, startShift } from '../lib/store'
import { IS_DEMO } from '../lib/db'

// Oturum boyunca girişi hatırla (sekme kapanınca sıfırlanır)
const SESSION_KEY = 'sofra_admin_auth'
const VERIFY_URL = '/.netlify/functions/verify-admin'

const probeCache = new Map()
function probeServer(bizId) {
  if (!probeCache.has(bizId)) {
    probeCache.set(bizId, fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bizId, pin: '' }),
      signal: AbortSignal.timeout(10000),
    }).then((r) => { if (!r.ok) throw new Error('Sunucuya erişilemiyor'); return r.json() }).then((d) => {
      if (typeof d.configured !== 'boolean') throw new Error('Geçersiz doğrulama yanıtı')
      return d.configured
    }).catch(() => { probeCache.delete(bizId); return 'error' }))
  }
  return probeCache.get(bizId)
}

export async function verifyAdminPin(bizId, pin) {
  const r = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bizId, pin }),
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error('Giriş sunucusuna erişilemiyor.')
  return r.json()
}

export function getStaffSession(bizId) {
  if (!bizId) return null
  try {
    const raw = sessionStorage.getItem(`sofra_staff_auth_${bizId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStaffSession(bizId, session) {
  if (!bizId) return
  try {
    if (session) sessionStorage.setItem(`sofra_staff_auth_${bizId}`, JSON.stringify(session))
    else sessionStorage.removeItem(`sofra_staff_auth_${bizId}`)
  } catch {}
}

export function clearStaffSession(bizId) {
  if (!bizId) return
  try {
    sessionStorage.removeItem(`sofra_staff_auth_${bizId}`)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

export function isRoleAllowed(userRole, requiredRole) {
  if (!requiredRole || requiredRole === 'waiter') return true
  if (requiredRole === 'admin') return userRole === 'master'
  if (userRole === 'owner' || userRole === 'manager' || userRole === 'master') return true
  if (requiredRole === 'cashier') return userRole === 'cashier'
  return false
}

// Yönetim oturum durumu
export function useAdminAuthState() {
  const bizId = useBusinessId()
  const [onServer, setOnServer] = useState(null)

  useEffect(() => {
    if (!bizId) return
    let alive = true
    probeServer(bizId).then((v) => { if (alive) setOnServer(v) })
    return () => { alive = false }
  }, [bizId])

  const config = useValue(bizId && onServer === false ? `businesses/${bizId}/config` : null, undefined)

  if (onServer === null) return 'loading'
  if (onServer === 'error') return IS_DEMO ? 'open' : 'locked'

  if (onServer) {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === `${bizId}:ok`) return 'authed'
    } catch {}
    return 'locked'
  }

  if (config === undefined) return 'loading'
  const password = config?.password
  if (!password) return IS_DEMO ? 'open' : 'locked'
  try {
    if (sessionStorage.getItem(SESSION_KEY) === `${bizId}:${password}`) return 'authed'
  } catch {}
  return 'locked'
}

// Rol bazlı oturum durumu: 'waiter' | 'cashier' | 'admin'
export function useRoleAuthState(requiredRole = 'admin') {
  const bizId = useBusinessId()
  const adminState = useAdminAuthState()
  const [staffSession, setSession] = useState(() => getStaffSession(bizId))

  useEffect(() => {
    setSession(getStaffSession(bizId))
  }, [bizId])

  // Master admin oturumu açıksa tüm rollere izin ver
  if (adminState === 'authed') return 'authed'
  if (adminState === 'open') return 'open'

  // Personel PIN'i ile girilmişse rol kontrolü yap
  if (staffSession) {
    if (isRoleAllowed(staffSession.role, requiredRole)) return 'authed'
    return 'locked'
  }

  if (adminState === 'loading') return 'loading'
  return 'locked'
}

export function setAdminAuth(bizId, password) {
  try {
    sessionStorage.setItem(SESSION_KEY, `${bizId}:${password}`)
  } catch {}
}

const ROLE_META = {
  waiter: {
    title: 'Garson Girişi',
    subtitle: 'Sipariş almak için PIN veya şifrenizi girin',
    label: 'Garson PIN / Şifre',
    placeholder: '4 haneli PIN',
    icon: UtensilsCrossed,
  },
  cashier: {
    title: 'Kasa Girişi',
    subtitle: 'Kasa ve adisyon işlemleri için PIN veya şifrenizi girin',
    label: 'Kasiyer PIN / Şifre',
    placeholder: 'PIN veya Şifre',
    icon: ShieldCheck,
  },
  admin: {
    title: 'Yönetim Paneli',
    subtitle: 'Yönetim şifresi veya yönetici PIN’i girin',
    label: 'Yönetici Şifresi / PIN',
    placeholder: '••••••',
    icon: Lock,
  },
}

export default function AdminLogin({ role = 'admin', onSuccess }) {
  const bizId = useBusinessId()
  const [legacy, setLegacy] = useState(false)
  useEffect(() => { probeServer(bizId).then(v => setLegacy(v === false)) }, [bizId])
  const config = useValue(bizId && legacy ? `businesses/${bizId}/config` : null)
  const correctPassword = config?.password
  const bizName = useValue(bizId ? `businesses/${bizId}/menu/profile/name` : null)
  const staffMembers = useStaff(bizId)

  const meta = ROLE_META[role] || ROLE_META.admin
  const MetaIcon = meta.icon

  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [connectionError, setConnectionError] = useState('')

  function reject(msg = 'Hatalı PIN veya şifre, tekrar deneyin.') {
    setError(true)
    setErrorMessage(msg)
    setShake(true)
    setInput('')
    setTimeout(() => setShake(false), 600)
    setTimeout(() => { setError(false); setErrorMessage('') }, 3000)
  }

  async function attempt() {
    if (busy || !input) return
    setBusy(true)
    setConnectionError('')
    const trimmed = input.trim()

    try {
      // 1. Personel PIN eşleşmesi kontrolü (Yönetim ekranı SADECE Yönetim şifresiyle açılır)
      const matchingStaff = role !== 'admin' ? staffMembers.find((m) =>
        m.active !== false && String(m.pin || '').trim() && String(m.pin || '').trim() === trimmed
      ) : null

      if (matchingStaff) {
        if (!isRoleAllowed(matchingStaff.role, role)) {
          const roleTxt = matchingStaff.role === 'waiter' ? 'Garson' : matchingStaff.role === 'cashier' ? 'Kasiyer' : 'Personel'
          reject(`${roleTxt} yetkisi ile bu ekrana giriş yapılamaz.`)
          return
        }

        // Yetkili personel oturumu
        setStaffSession(bizId, {
          staffId: matchingStaff.id,
          name: matchingStaff.name,
          role: matchingStaff.role,
          authedAt: Date.now(),
        })
        setActiveStaffId(bizId, matchingStaff.id)
        startShift(bizId, matchingStaff.id).catch(() => {})

        if (matchingStaff.role === 'owner' || matchingStaff.role === 'manager') {
          setAdminAuth(bizId, 'staff:' + matchingStaff.id)
        }

        onSuccess()
        return
      }

      // 2. Sunucu üzerinden Master Admin PIN doğrulaması
      const res = await verifyAdminPin(bizId, input)
      if (res?.configured) {
        if (res.ok) {
          setAdminAuth(bizId, 'ok')
          setStaffSession(bizId, { role: 'owner', name: 'Yönetici', isMaster: true, authedAt: Date.now() })
          onSuccess()
        } else {
          reject()
        }
        return
      }

      // 3. Eski yöntem (Firebase config/password) Master Admin şifresi
      if (res?.configured === false && correctPassword && input === correctPassword) {
        setAdminAuth(bizId, correctPassword)
        setStaffSession(bizId, { role: 'owner', name: 'Yönetici', isMaster: true, authedAt: Date.now() })
        onSuccess()
      } else {
        reject()
      }
    } catch {
      setConnectionError('Giriş doğrulanamadı. Bağlantıyı kontrol edip tekrar deneyin.')
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
        <div className="card p-8 shadow-xl border border-ink-100">
          {/* Logo ve Başlık */}
          <div className="flex flex-col items-center mb-6">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-glow mb-3">
              <MetaIcon className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-ink-900 text-center">
              {bizName || 'serviq'}
            </h1>
            <p className="text-sm font-bold text-brand-600 mt-1">{meta.title}</p>
            <p className="text-xs text-ink-400 mt-0.5 text-center">{meta.subtitle}</p>
          </div>

          {connectionError && <p role="alert" className="text-red-700 mb-4 text-xs font-semibold">{connectionError}</p>}

          {/* Şifre / PIN alanı */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-1.5">
                <Lock className="h-3.5 w-3.5 inline mr-1.5 text-ink-400" />
                {meta.label}
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(false); setErrorMessage('') }}
                  onKeyDown={(e) => e.key === 'Enter' && attempt()}
                  disabled={busy}
                  autoFocus
                  placeholder={meta.placeholder}
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
                <p className="text-red-500 text-xs mt-1.5 font-semibold">{errorMessage || 'Hatalı PIN veya şifre, tekrar deneyin.'}</p>
              )}
            </div>

            <button
              onClick={attempt}
              disabled={!input || busy}
              className="btn-primary w-full !py-3.5 text-base font-bold shadow-md"
            >
              <Lock className="h-4.5 w-4.5" />
              {busy ? 'Kontrol ediliyor…' : 'Giriş Yap'}
            </button>
          </div>

          {role === 'admin' ? (
            <div className="mt-4 pt-3 border-t border-ink-100 text-center">
              <span className="text-[11px] text-ink-400">
                Yönetim paneli için işletme şifrenizi girin.
              </span>
            </div>
          ) : staffMembers.some(m => m.active !== false && m.pin) ? (
            <div className="mt-4 pt-3 border-t border-ink-100 text-center">
              <span className="text-[11px] text-ink-400">
                Personel PIN kodunuz veya işletme şifrenizle giriş yapabilirsiniz.
              </span>
            </div>
          ) : null}
        </div>

        <p className="text-center text-xs text-ink-400 mt-4">
          PIN veya şifrenizi bilmiyorsanız işletme yöneticisine danışın.
        </p>
      </div>
    </div>
  )
}
