// Yonetim ve AI uclari icin istemci yetkilendirme yardimcisi.
const TOKEN_KEY_PREFIX = 'serviq_admin_token_'
const SESSION_KEY = 'sofra_admin_auth'

export function getAdminToken(bizId) {
  if (!bizId) return ''
  try {
    return sessionStorage.getItem(`${TOKEN_KEY_PREFIX}${bizId}`) || ''
  } catch {
    return ''
  }
}

export function setAdminToken(bizId, token) {
  if (!bizId) return
  try {
    if (token) {
      sessionStorage.setItem(`${TOKEN_KEY_PREFIX}${bizId}`, token)
      sessionStorage.setItem('serviq_active_token', token)
    } else {
      sessionStorage.removeItem(`${TOKEN_KEY_PREFIX}${bizId}`)
    }
  } catch {}
}

export function getAiAuthHeaders(bizId) {
  const headers = {
    'Content-Type': 'application/json',
  }
  if (bizId) {
    headers['x-serviq-biz'] = bizId
  }

  const token = getAdminToken(bizId)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    // Geriye donuk uyumluluk: Oturum sifresi varsa x-serviq-pin olarak gonder
    try {
      const auth = sessionStorage.getItem(SESSION_KEY) || ''
      if (auth.startsWith(`${bizId}:`) && auth !== `${bizId}:ok`) {
        const pin = auth.slice(bizId.length + 1)
        if (pin) headers['x-serviq-pin'] = pin
      }
    } catch {}
  }

  return headers
}
