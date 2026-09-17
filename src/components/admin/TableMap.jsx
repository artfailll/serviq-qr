import { useMemo, useState } from 'react'
import { Clock, Users, ArrowRightLeft, Combine, Unlink, Wallet, Plus, Trash2, QrCode, Printer } from 'lucide-react'
import {
  useTables,
  useOrders,
  useLayout,
  useTicker,
  mergeTables,
  unmergeTable,
  moveOrders,
  markOrderPaid,
  isActiveStatus,
  addTable,
  removeTable,
  useBusinessId,
  useProfile,
  useActiveStaff,
} from '../../lib/store'
import { money, clockMs } from '../../lib/format'
import { Modal } from '../../components/ui'
import PaymentModal from '../../components/PaymentModal'
import QRCode from 'qrcode'

const SITE = 'https://serviq.com.tr'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// QR'ın ortasına işletme adı + masa numarası yerleştirir.
// Bunu yapabilmek için QR'ın "H" hata düzeltme seviyesinde üretilmesi şart:
// H seviyesi kodun ~%30'u kapansa bile okunmasına izin verir, buradaki kutu
// alanın ~%12'si — güvenli aralıkta.
function brandQr(svg, bizName, tableLabel, brandColor) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!m) return svg
  const size = Number(m[1])

  const bw = size * 0.46
  const bh = size * 0.27
  const x = (size - bw) / 2
  const y = (size - bh) / 2

  const name = String(bizName || '').toLocaleUpperCase('tr-TR').slice(0, 20)
  // Yazı kutuya sığsın diye font boyutu karakter sayısına göre küçülür
  const nameFont = Math.min(bh * 0.30, (bw * 0.92) / Math.max(name.length * 0.58, 1))
  const tableFont = bh * 0.40
  const pad = size * 0.012

  const overlay =
    `<g shape-rendering="auto" font-family="'Plus Jakarta Sans',Helvetica,Arial,sans-serif">` +
      `<rect x="${x - pad}" y="${y - pad}" width="${bw + pad * 2}" height="${bh + pad * 2}" ` +
        `rx="${bh * 0.26}" fill="#ffffff"/>` +
      `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${bh * 0.22}" ` +
        `fill="#ffffff" stroke="${brandColor}" stroke-width="${size * 0.011}"/>` +
      `<text x="${size / 2}" y="${y + bh * 0.42}" text-anchor="middle" ` +
        `font-size="${nameFont}" font-weight="800" fill="#1e293b">${esc(name)}</text>` +
      `<text x="${size / 2}" y="${y + bh * 0.85}" text-anchor="middle" ` +
        `font-size="${tableFont}" font-weight="900" fill="${brandColor}">${esc(tableLabel)}</text>` +
    `</g>`

  return svg.replace('</svg>', `${overlay}</svg>`)
}

async function printAllQRs(tables, bizId, profile) {
  const bizName = profile?.name || 'Restoran'
  const brandColor = profile?.brandColor || '#f97316'

  // Her masa için QR SVG üret
  const items = await Promise.all(
    tables.map(async (t) => {
      // encodeURIComponent şart: işletme kimliğinde boşluk veya Türkçe harf
      // olabiliyor ("CAFE SİNAN") — ham hâli bozuk bağlantı üretiyordu.
      const url = `${SITE}/menu?isletme=${encodeURIComponent(bizId)}&masa=${encodeURIComponent(t.no)}`
      const raw = await QRCode.toString(url, {
        type: 'svg', width: 300, margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#1e293b', light: '#ffffff' },
      })
      const label = String(t.name || `Masa ${t.no}`).toLocaleUpperCase('tr-TR')
      return { no: t.no, name: t.name, svg: brandQr(raw, bizName, label, brandColor) }
    })
  )

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(bizName)} · QR Kodlar</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #f8fafc; padding: 24px; }
  h1 { text-align: center; font-size: 22px; font-weight: 900; color: #1e293b; margin-bottom: 6px; }
  .sub { text-align: center; font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card { background: #fff; border-radius: 20px; padding: 16px 16px 14px; text-align: center;
          border: 2px solid ${brandColor}33; break-inside: avoid; }
  .qr svg { width: 200px; height: 200px; display: block; margin: 0 auto; }
  .badge { display: inline-block; background: ${brandColor}; color: #fff; font-size: 14px;
           font-weight: 900; padding: 5px 18px; border-radius: 50px; margin: 10px 0 8px; }
  .hint { font-size: 10px; color: #cbd5e1; font-weight: 600; }
  @media print {
    body { background: #fff; padding: 10px; }
    .grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<h1>${esc(bizName)}</h1>
<p class="sub">Tüm masa QR kodları · serviq.com.tr · ${new Date().toLocaleDateString('tr-TR')}</p>
<button class="no-print" onclick="window.print()" style="display:block;margin:0 auto 20px;background:${brandColor};color:#fff;border:none;padding:10px 28px;border-radius:50px;font-size:14px;font-weight:800;cursor:pointer;">
  🖨 Yazdır / PDF Olarak Kaydet
</button>
<div class="grid">
  ${items.map(it => `
  <div class="card">
    <div class="qr">${it.svg}</div>
    <div class="badge">${esc(String(it.name || ('Masa ' + it.no)).toLocaleUpperCase('tr-TR'))}</div>
    <div class="hint">Kameranızla okutun · sipariş verin</div>
  </div>`).join('')}
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

export default function TableMap() {
  const bizId = useBusinessId()
  const tables = useTables(bizId)
  const orders = useOrders(bizId)
  const layout = useLayout(bizId)
  const profile = useProfile(bizId)
  const { staffId: cashierId } = useActiveStaff(bizId)
  const [generating, setGenerating] = useState(false)
  useTicker(1000)

  const [selected, setSelected] = useState(null) // tableId
  const [mode, setMode] = useState(null) // 'merge' | 'move'
  const [payFor, setPayFor] = useState(null) // ödeme yöntemi seçilecek masa

  const info = useMemo(() => {
    const map = {}
    tables.forEach((t) => {
      map[t.id] = {
        ...t,
        active: [],
        total: 0,
        seatedSince: null,
        waiting: false,
        hasNew: false,
        mergedInto: layout[t.id]?.mergedInto || null,
      }
    })
    orders
      .filter((o) => isActiveStatus(o.status))
      .forEach((o) => {
        const it = map[o.tableId]
        if (!it) return
        it.active.push(o)
        it.total += o.total
        it.seatedSince = it.seatedSince ? Math.min(it.seatedSince, o.createdAt) : o.createdAt
        if (o.status === 'new') it.hasNew = true
      })
    Object.values(map).forEach((t) => {
      t.waiting = t.hasNew
    })
    return map
  }, [tables, orders, layout])

  const selInfo = selected ? info[selected] : null

  function statusOf(t) {
    if (!t) return 'empty'
    if (t.mergedInto) return 'merged'
    if (t.waiting) return 'waiting'
    if (t.active?.length) return 'occupied'
    return 'empty'
  }

  function pickTarget(targetId) {
    if (!selected || targetId === selected) return
    if (mode === 'merge') {
      mergeTables(bizId, selected, targetId)
    } else if (mode === 'move') {
      const target = info[targetId]
      moveOrders(bizId, orders, selected, targetId, target.no)
    }
    setMode(null)
    setSelected(null)
  }

  function closeTable(t, method) {
    // Hesabı kapat: tüm aktif siparişler seçilen yöntemle ödendi →
    // masa boşalır, ciroya yazılır, raporda yönteme göre ayrışır.
    t.active.forEach((o) => markOrderPaid(bizId, o.id, method, { order: o, cashierId }))
    if (t.mergedInto || layout[t.id]) unmergeTable(bizId, t.id)
    setSelected(null)
  }

  function handleAddTable() {
    const maxNo = tables.reduce((m, t) => Math.max(m, t.no || 0), 0)
    addTable(bizId, maxNo + 1)
  }

  function handleRemoveTable(t) {
    if (t.active.length) return
    if (confirm(`${t.name} silinsin mi?`)) {
      removeTable(bizId, t.id)
      setSelected(null)
    }
  }

  const counts = {
    empty: 0,
    occupied: 0,
    waiting: 0,
  }
  Object.values(info).forEach((t) => {
    const s = statusOf(t)
    if (s === 'empty') counts.empty++
    else if (s === 'waiting') counts.waiting++
    else if (s === 'occupied') counts.occupied++
  })

  return (
    <div>
      {/* Açıklama / lejant */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Legend color="bg-ink-300" label="Boş" count={counts.empty} />
        <Legend color="bg-green-500" label="Dolu" count={counts.occupied} />
        <Legend color="bg-brand-500" label="Sipariş Bekliyor" count={counts.waiting} pulse />
        {mode ? (
          <span className="ml-auto chip bg-brand-100 text-brand-700">
            {mode === 'merge' ? 'Birleştirilecek masayı seçin' : 'Taşınacak masayı seçin'}
            <button onClick={() => { setMode(null); setSelected(null) }} className="ml-1 underline cursor-pointer">
              vazgeç
            </button>
          </span>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-ink-400">{tables.length} masa</span>
            <button
              onClick={async () => {
                setGenerating(true)
                await printAllQRs(tables, bizId, profile)
                setGenerating(false)
              }}
              disabled={generating || tables.length === 0}
              className="btn-outline !py-2"
            >
              <QrCode className="h-4 w-4" />
              {generating ? 'Üretiliyor...' : `QR Yazdır (${tables.length})`}
            </button>
            <button onClick={handleAddTable} className="btn-primary !py-2">
              <Plus className="h-4 w-4" /> Masa Ekle
            </button>
          </div>
        )}
      </div>

      {/* Masa kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {tables.map((t) => {
          const ti = info[t.id]
          if (!ti) return null
          const st = statusOf(ti)
          const selecting = mode && selected !== t.id && st !== 'merged'
          return (
            <TableCard
              key={t.id}
              ti={ti}
              status={st}
              dim={mode && selected === t.id}
              selecting={selecting}
              onClick={() => {
                if (mode) pickTarget(t.id)
                else setSelected(t.id)
              }}
            />
          )
        })}
      </div>

      {/* Masa detay modalı */}
      <Modal
        open={!!selInfo && !mode}
        onClose={() => setSelected(null)}
        title={selInfo ? selInfo.name : ''}
        footer={
          selInfo && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('merge')} className="btn-outline" disabled={!!selInfo.mergedInto}>
                <Combine className="h-4 w-4" /> Birleştir
              </button>
              <button onClick={() => setMode('move')} className="btn-outline" disabled={!selInfo.active.length}>
                <ArrowRightLeft className="h-4 w-4" /> Taşı
              </button>
              {selInfo.mergedInto && (
                <button onClick={() => { unmergeTable(bizId, selInfo.id); setSelected(null) }} className="btn-ghost col-span-2">
                  <Unlink className="h-4 w-4" /> Birleştirmeyi Ayır
                </button>
              )}
              {selInfo.active.length > 0 ? (
                <button onClick={() => setPayFor(selInfo)} className="btn-primary col-span-2">
                  <Wallet className="h-4 w-4" /> Hesabı Kapat ({money(selInfo.total)})
                </button>
              ) : (
                <button
                  onClick={() => handleRemoveTable(selInfo)}
                  className="btn-ghost col-span-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Masayı Sil
                </button>
              )}
            </div>
          )
        }
      >
        {selInfo && (
          <div>
            {selInfo.mergedInto && (
              <p className="chip bg-amber-100 text-amber-700 mb-3">
                Bu masa {info[selInfo.mergedInto]?.name || 'başka masa'} ile birleşik
              </p>
            )}
            {selInfo.active.length === 0 ? (
              <p className="text-ink-400 py-6 text-center">Bu masada aktif sipariş yok.</p>
            ) : (
              <div className="space-y-3">
                {selInfo.active.map((o) => (
                  <div key={o.id} className="rounded-xl bg-ink-50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="chip bg-white text-ink-500">
                        <Clock className="h-3 w-3" /> {clockMs(o.createdAt)}
                      </span>
                      <span className="font-bold">{money(o.total)}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{it.qty}× {it.name}</span>
                          <span className="text-ink-400">{money(it.price * it.qty)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 text-lg font-display font-extrabold">
                  <span>Toplam</span>
                  <span>{money(selInfo.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Ödeme yöntemi seçimi — hesap kapatınca */}
      <PaymentModal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        total={payFor?.total}
        subtitle={payFor ? `${payFor.name} · tahsilat` : ''}
        onSelect={(method) => {
          if (payFor) closeTable(payFor, method)
          setPayFor(null)
        }}
      />
    </div>
  )
}

function Legend({ color, label, count, pulse }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-3 w-3 rounded-full ${color} ${pulse ? 'animate-pulse-ring' : ''}`} />
      <span className="text-ink-600 font-medium">{label}</span>
      <span className="text-ink-400">({count})</span>
    </div>
  )
}

function TableCard({ ti, status, onClick, selecting, dim }) {
  const styles = {
    empty: 'bg-white border-ink-200 text-ink-400',
    occupied: 'bg-white border-green-300 ring-1 ring-green-200',
    waiting: 'bg-brand-50 border-brand-400 ring-2 ring-brand-300 animate-pulse-ring',
    merged: 'bg-ink-100 border-ink-200 text-ink-400 border-dashed',
  }
  const dot = {
    empty: 'bg-ink-300',
    occupied: 'bg-green-500',
    waiting: 'bg-brand-500',
    merged: 'bg-ink-300',
  }
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-2xl border-2 p-4 transition-all duration-200 cursor-pointer
        hover:-translate-y-0.5 hover:shadow-soft
        ${styles[status]} ${selecting ? 'ring-2 ring-brand-400 ring-offset-2' : ''} ${dim ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-extrabold text-ink-900">
          {ti.name?.replace('Masa ', 'M') || ti.no}
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${dot[status]}`} />
      </div>

      {status === 'merged' ? (
        <p className="mt-3 text-xs">Birleşik</p>
      ) : ti.active?.length ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-semibold tabular-nums">{clockMs(ti.seatedSince)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <Users className="h-3.5 w-3.5" />
            <span>{ti.active.length} sipariş</span>
          </div>
          <p className="font-display font-extrabold text-brand-600">{money(ti.total)}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs">Boş</p>
      )}

      {ti.waiting && (
        <span className="absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white shadow-glow">
          yeni
        </span>
      )}
    </button>
  )
}
