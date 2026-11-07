// Tablet veya telefon kontrolü (iOS, Android, iPad vb. kendi sanal klavyesine sahiptir)
export function isMobileOrTabletDevice(nav = (typeof navigator !== 'undefined' ? navigator : null), win = (typeof window !== 'undefined' ? window : null)) {
  if (!nav) return false

  if (nav.userAgentData && nav.userAgentData.mobile) {
    return true
  }

  const ua = nav.userAgent || ''
  if (/Android/i.test(ua)) return true
  if (/iPhone|iPod|iPad/i.test(ua)) return true
  if (/Macintosh/i.test(ua) && typeof nav.maxTouchPoints === 'number' && nav.maxTouchPoints > 1 && !(win && 'MSStream' in win)) {
    return true
  }
  if (/Windows Phone|IEMobile|Mobile/i.test(ua)) return true
  return false
}

// Sadece dokunmatik BİLGİSAYARLAR (Windows Touch POS, Elo vb. All-in-One dokunmatik PC'ler)
export function isTouchComputer(nav = (typeof navigator !== 'undefined' ? navigator : null), win = (typeof window !== 'undefined' ? window : null)) {
  if (!nav) return false
  // Tablet veya telefonlarda ASLA açılmaz
  if (isMobileOrTabletDevice(nav, win)) return false

  return Boolean(
    (nav.maxTouchPoints && nav.maxTouchPoints > 0) ||
    (nav.msMaxTouchPoints && nav.msMaxTouchPoints > 0) ||
    (win && 'ontouchstart' in win)
  )
}
