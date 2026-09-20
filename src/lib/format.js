// Biçimlendirme yardımcıları

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const money = (n) => tl.format(Number(n) || 0)

export function timeAgo(ts) {
  if (!ts) return '—'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s} sn`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} dk`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h} sa ${rm} dk`
}

export function clockMs(ts) {
  if (!ts) return '00:00'
  const s = Math.floor((Date.now() - ts) / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function timeOfDay(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// Herhangi bir timestamp'i (veya şimdiki zamanı) YYYY-MM-DD anahtarına çevirir.
// Arşivleme ve tarih bazlı filtreleme için kullanılır.
export function dateKey(ts) {
  const d = ts ? new Date(ts) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const todayKey = () => dateKey()

export function isToday(ts) {
  if (!ts) return false
  const d = new Date(ts)
  const n = new Date()
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  )
}
