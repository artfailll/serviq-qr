import QRCode from 'qrcode'

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function tableUrl(bizId, tableNo) {
  if (!bizId || !Number.isInteger(Number(tableNo)) || Number(tableNo) < 1) throw new Error('İşletme ve masa bilgisi gerekli.')
  const url = new URL('https://serviq.com.tr/menu')
  url.searchParams.set('isletme', bizId)
  url.searchParams.set('masa', String(tableNo))
  return url.href
}

export async function brandedTableQR(bizId, tableNo, name) {
  const url = tableUrl(bizId, tableNo)
  const options = { errorCorrectionLevel: 'H', margin: 4, width: 600, color: { dark: '#111827', light: '#ffffff' } }
  const svg = await QRCode.toString(url, { ...options, type: 'svg' })
  const size = QRCode.create(url, options).modules.size + 8
  // Small central wordmark (< 3% of total symbol area); keep quiet zone intact.
  const width = size * .30, height = size * .085
  const label = String(name || 'Serviq').trim()
  const words = label.split(/\s+/)
  const middle = Math.ceil(words.length / 2)
  const lines = words.length > 1 ? [words.slice(0, middle).join(' '), words.slice(middle).join(' ')] : [label]
  const fontSize = Math.min(1.65, (width - 1) / (Math.max(...lines.map(l => l.length)) * .6))
  const text = lines.map((line, i) => `<text x="${size / 2}" y="${size / 2 + (i - (lines.length - 1) / 2) * 1.65}" dominant-baseline="central" text-anchor="middle" fill="#111827" font-family="Arial,sans-serif" font-weight="700" font-size="${fontSize}">${escapeHtml(line)}</text>`).join('')
  return svg.replace('</svg>', `<rect x="${(size-width)/2}" y="${(size-height)/2}" width="${width}" height="${height}" rx=".7" fill="white"/>${text}</svg>`)
}
