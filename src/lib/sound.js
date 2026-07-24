// Web Audio ile kısa bildirim sesi (dosya gerektirmez).
// Tarayıcılar ilk kullanıcı etkileşiminden önce ses çalmaya izin
// vermez; bu yüzden kasa ekranında bir kez "Sesi Aç" denir.
import { useEffect, useState } from 'react'

let ctx = null
let heartbeat = null

const PREF_KEY = 'sofra_sound_pref'
const listeners = new Set()

export function getSoundPref() {
  try { return localStorage.getItem(PREF_KEY) === '1' } catch { return false }
}

export function setSoundPref(on) {
  try { localStorage.setItem(PREF_KEY, on ? '1' : '0') } catch {}
  if (on) primeAudio(); else stopHeartbeat()
  listeners.forEach((fn) => fn(on))
}

// Kasa ve Yönetim ekranları arasında ses tercihini canlı senkronlar.
export function useSoundPref() {
  const [on, setOn] = useState(getSoundPref)
  useEffect(() => {
    listeners.add(setOn)
    return () => listeners.delete(setOn)
  }, [])
  return on
}

export function primeAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) ctx = new AC()
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  startHeartbeat()
  return Boolean(ctx)
}

// Chrome/Edge gibi tarayıcılar ~30 sn ses çalınmayan bir AudioContext'i
// otomatik askıya alır ("autosuspend") — kullanıcıya "sesin kendiliğinden
// kapanması" olarak görünen asıl sebep budur. Duyulmayacak kadar kısık bir
// "nabız" sesi ile context'i sürekli canlı/çalışır tutuyoruz.
function startHeartbeat() {
  if (heartbeat || !ctx) return
  heartbeat = setInterval(() => {
    if (!ctx) return
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.00001
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.05)
  }, 15000)
}

function stopHeartbeat() {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
}

// Sekme arka plana geçip geri dönünce ya da pencere odağı geri gelince
// context'i hemen uyandır — sıradaki bildirim sesi gecikmeden çalsın.
if (typeof document !== 'undefined') {
  const wake = () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}) }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake() })
  window.addEventListener('focus', wake)
}

function beep(freq, start, dur, gainVal = 0.5, type = 'triangle') {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(gainVal, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + dur)
}

// Yeni sipariş: yüksek ve uzun — "ding-dong" deseni 3 kez tekrar (~2.4 sn)
export function playNewOrder() {
  if (!primeAudio() || !ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const o = t + i * 0.8
    beep(880, o, 0.3, 0.55)
    beep(1175, o + 0.28, 0.45, 0.6)
  }
}

// Çağrı (garson/hesap): ısrarlı, yüksek alarm — 4 kez tekrar (~2.4 sn)
export function playCall() {
  if (!primeAudio() || !ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 4; i++) {
    const o = t + i * 0.6
    beep(784, o, 0.18, 0.55, 'square')
    beep(1047, o + 0.22, 0.3, 0.6, 'square')
  }
}
