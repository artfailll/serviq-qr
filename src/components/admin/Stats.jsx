import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  CircleDollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  FileText,
  Printer,
  Trophy,
  RotateCcw,
  Wallet,
  Calendar,
  Loader2,
} from 'lucide-react'
import { useOrders, useArchiveAll, resetDay, useBusinessId, useCategories, useProducts, PAYMENT_METHODS } from '../../lib/store'
import { money, timeOfDay, dateKey } from '../../lib/format'
import { EmptyState, Modal } from '../../components/ui'

const PIE_COLORS = ['#f97316', '#fb923c', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6']

// Dönem seçenekleri — 'today' canlı orders'tan, diğerleri arşivden okur.
const RANGES = [
  { key: 'today', label: 'Bugün' },
  { key: 'yesterday', label: 'Dün' },
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
]

function rangeBounds(rangeKey) {
  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (rangeKey === 'today') {
    return { start: startOfDay(now), end: Date.now() }
  }
  if (rangeKey === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    return { start: startOfDay(y), end: startOfDay(now) - 1 }
  }
  if (rangeKey === 'week') {
    const w = new Date(now); w.setDate(w.getDate() - 6)
    return { start: startOfDay(w), end: Date.now() }
  }
  if (rangeKey === 'month') {
    const m = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: m.getTime(), end: Date.now() }
  }
  return { start: startOfDay(now), end: Date.now() }
}

export default function Stats() {
  const bizId = useBusinessId()
  const liveOrders = useOrders(bizId)     // henüz arşivlenmemiş (bugünkü + kapatılmamış geçmiş)
  const archiveAll = useArchiveAll(bizId) // { "2026-06-30": {orderId:{...}}, ... }
  const categories = useCategories(bizId)
  const products = useProducts(bizId)
  const [zOpen, setZOpen] = useState(false)
  const [range, setRange] = useState('today')
  const [resetting, setResetting] = useState(false)

  // Canlı + arşiv verisini birleştir (aynı sipariş asla iki yerde birden olmaz —
  // resetDay önce arşive yazar, sonra canlıdan siler).
  const allOrders = useMemo(() => {
    const archived = Object.values(archiveAll).flatMap((dayObj) => Object.values(dayObj || {}))
    return [...archived, ...liveOrders]
  }, [archiveAll, liveOrders])

  const { start, end } = useMemo(() => rangeBounds(range), [range])
  const periodOrders = useMemo(
    () => allOrders.filter((o) => o.createdAt >= start && o.createdAt <= end && o.status !== 'cancelled'),
    [allOrders, start, end]
  )
  const donePeriod = periodOrders.filter((o) => o.status === 'paid')

  const revenue = donePeriod.reduce((s, o) => s + o.total, 0)
  const orderCount = periodOrders.length
  const itemsSold = periodOrders.reduce((s, o) => s + (o.count || o.items.reduce((a, i) => a + i.qty, 0)), 0)
  const avg = donePeriod.length ? revenue / donePeriod.length : 0

  // En çok satanlar
  const bestSellers = useMemo(() => {
    const tally = {}
    periodOrders.forEach((o) =>
      o.items.forEach((it) => {
        tally[it.name] = tally[it.name] || { name: it.name, qty: 0, revenue: 0 }
        tally[it.name].qty += it.qty
        tally[it.name].revenue += it.price * it.qty
      }),
    )
    return Object.values(tally).sort((a, b) => b.qty - a.qty)
  }, [periodOrders])

  // Bugün/dün: saatlik kırılım. Hafta/ay: günlük kırılım.
  const isSingleDay = range === 'today' || range === 'yesterday'
  const trend = useMemo(() => {
    const buckets = {}
    donePeriod.forEach((o) => {
      const key = isSingleDay ? new Date(o.createdAt).getHours() : dateKey(o.createdAt)
      buckets[key] = (buckets[key] || 0) + o.total
    })
    if (isSingleDay) {
      const hours = Object.keys(buckets).map(Number)
      if (!hours.length) return []
      const min = Math.min(...hours)
      const max = Math.max(...hours)
      const arr = []
      for (let h = min; h <= max; h++) arr.push({ label: `${String(h).padStart(2, '0')}:00`, ciro: buckets[h] || 0 })
      return arr
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([d, ciro]) => ({ label: d.slice(5).replace('-', '/'), ciro }))
  }, [donePeriod, isSingleDay])

  // Ödeme yöntemine göre ciro
  const byPayment = useMemo(() => {
    const tally = {}
    donePeriod.forEach((o) => {
      const key = o.paymentMethod || 'nakit'
      tally[key] = tally[key] || { count: 0, total: 0 }
      tally[key].count += 1
      tally[key].total += o.total
    })
    return PAYMENT_METHODS
      .map((m) => ({ key: m.key, label: m.label, ...(tally[m.key] || { count: 0, total: 0 }) }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [donePeriod])

  // Kategori dağılımı (adet)
  const byCategory = useMemo(() => {
    const prodCat = {}
    products.forEach((p) => (prodCat[p.name] = p.categoryId))
    const catName = {}
    categories.forEach((c) => (catName[c.id] = c.name))
    const tally = {}
    periodOrders.forEach((o) =>
      o.items.forEach((it) => {
        const cid = prodCat[it.name] || 'diger'
        const name = catName[cid] || 'Diğer'
        tally[name] = (tally[name] || 0) + it.qty
      }),
    )
    return Object.entries(tally).map(([name, value]) => ({ name, value }))
  }, [periodOrders, products, categories])

  const hasData = periodOrders.length > 0
  const rangeLabel = RANGES.find((r) => r.key === range)?.label || 'Bugün'

  async function handleReset() {
    if (!confirm('Bugünün siparişleri arşive taşınacak, kasa ve masalar sıfırlanacak.\n\nGeçmiş ciro verileriniz kaybolmaz, dönem seçiciden erişebilirsiniz.\n\nGünü kapatmak istediğinize emin misiniz?')) return
    setResetting(true)
    await resetDay(bizId)
    setResetting(false)
  }

  return (
    <div>
      {/* Dönem seçici */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto">
        <Calendar className="h-4 w-4 text-ink-400 shrink-0" />
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer
              ${range === r.key ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard icon={CircleDollarSign} label={`${rangeLabel} Ciro`} value={money(revenue)} tone="brand" sub={`${donePeriod.length} tamamlanan`} />
        <KpiCard icon={ShoppingCart} label="Sipariş Sayısı" value={orderCount} tone="sky" sub={rangeLabel.toLowerCase()} />
        <KpiCard icon={Package} label="Satılan Ürün" value={itemsSold} tone="amber" sub="adet" />
        <KpiCard icon={TrendingUp} label="Ort. Sipariş" value={money(avg)} tone="green" sub="sepet tutarı" />
      </div>

      {!hasData ? (
        <div className="card">
          <EmptyState icon={TrendingUp} title={`${rangeLabel} için veri yok`} hint="Siparişler geldikçe grafikler burada canlanacak." />
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            {/* En çok satanlar */}
            <div className="card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-brand-500" /> En Çok Satanlar
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={bestSellers.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#fff7ed' }} contentStyle={tooltipStyle} formatter={(v) => [`${v} adet`, 'Satış']} />
                  <Bar dataKey="qty" fill="#f97316" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Kategori dağılımı */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-ink-800 mb-4">Kategori Dağılımı</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} adet`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {byCategory.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-ink-600">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Saatlik/Günlük ciro */}
          <div className="card p-5 mb-6">
            <h3 className="font-display font-bold text-ink-800 mb-4">{isSingleDay ? 'Saatlik Ciro' : 'Günlük Ciro'}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trend} margin={{ left: 0, right: 10 }}>
                <defs>
                  <linearGradient id="ciroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}₺`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [money(v), 'Ciro']} />
                <Area type="monotone" dataKey="ciro" stroke="#ea580c" strokeWidth={2.5} fill="url(#ciroFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Ödeme yöntemine göre ciro */}
          <div className="card p-5 mb-6">
            <h3 className="font-display font-bold text-ink-800 mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand-500" /> Ödeme Yöntemine Göre Ciro
            </h3>
            {byPayment.length === 0 ? (
              <p className="text-sm text-ink-400 py-2">Bu dönemde kapatılmış hesap yok.</p>
            ) : (
              <div className="space-y-3">
                {byPayment.map((m) => {
                  const pct = revenue > 0 ? Math.round((m.total / revenue) * 100) : 0
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-ink-700">
                          {m.label} <span className="text-ink-400 font-normal">· {m.count} hesap</span>
                        </span>
                        <span className="font-display font-extrabold text-ink-900">
                          {money(m.total)} <span className="text-ink-400 text-xs font-normal">%{pct}</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Z Raporu — sadece bugün için anlamlı */}
      {range === 'today' && (
        <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="grow">
            <h3 className="font-display font-bold text-ink-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-ink-500" /> Gün Sonu Z Raporu
            </h3>
            <p className="text-sm text-ink-500 mt-1">Önce Z raporunu al, ardından günü kapat. Veriler silinmez, arşive taşınır — geçmiş dönem seçicisinden görüntülenebilir.</p>
          </div>
          <button onClick={() => setZOpen(true)} className="btn-outline">
            <FileText className="h-4 w-4" /> Z Raporu Al
          </button>
          <button onClick={handleReset} disabled={resetting} className="btn bg-red-600 text-white hover:bg-red-700">
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {resetting ? 'Arşivleniyor…' : 'Günü Kapat & Arşivle'}
          </button>
        </div>
      )}

      <ZReport
        open={zOpen}
        onClose={() => setZOpen(false)}
        revenue={revenue}
        doneCount={donePeriod.length}
        orderCount={orderCount}
        itemsSold={itemsSold}
        avg={avg}
        bestSellers={bestSellers}
        byPayment={byPayment}
      />
    </div>
  )
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 24px -6px rgba(15,23,42,0.12)',
  fontSize: 13,
}

function KpiCard({ icon: Icon, label, value, tone, sub }) {
  const tones = {
    brand: 'from-brand-500 to-amber-500',
    sky: 'from-sky-500 to-cyan-500',
    amber: 'from-amber-500 to-yellow-500',
    green: 'from-green-500 to-emerald-500',
  }
  return (
    <div className="card p-4 relative overflow-hidden">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${tones[tone]} opacity-10`} />
      <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${tones[tone]} text-white shadow`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm text-ink-400">{label}</p>
      <p className="font-display text-2xl font-extrabold text-ink-900">{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ZReport({ open, onClose, revenue, doneCount, orderCount, itemsSold, avg, bestSellers, byPayment = [] }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gün Sonu Z Raporu"
      footer={
        <button onClick={() => window.print()} className="btn-primary w-full">
          <Printer className="h-4 w-4" /> Yazdır
        </button>
      }
    >
      <div id="z-report" className="space-y-4">
        <div className="text-center border-b border-dashed border-ink-200 pb-3">
          <p className="font-display text-xl font-extrabold">serviq</p>
          <p className="text-sm text-ink-500">Z Raporu · {dateKey()}</p>
          <p className="text-xs text-ink-400">{timeOfDay(Date.now())} itibarıyla</p>
        </div>
        <Row label="Toplam Sipariş" value={orderCount} />
        <Row label="Tamamlanan Sipariş" value={doneCount} />
        <Row label="Satılan Ürün Adedi" value={itemsSold} />
        <Row label="Ortalama Sepet" value={money(avg)} />
        <div className="border-t border-dashed border-ink-200 pt-3">
          <p className="text-sm font-semibold text-ink-600 mb-2">En Çok Satanlar</p>
          <div className="space-y-1.5">
            {bestSellers.slice(0, 5).map((b, i) => (
              <div key={b.name} className="flex justify-between text-sm">
                <span className="text-ink-600">{i + 1}. {b.name} <span className="text-ink-400">×{b.qty}</span></span>
                <span className="font-semibold">{money(b.revenue)}</span>
              </div>
            ))}
            {bestSellers.length === 0 && <p className="text-sm text-ink-400">Veri yok</p>}
          </div>
        </div>
        <div className="border-t border-dashed border-ink-200 pt-3">
          <p className="text-sm font-semibold text-ink-600 mb-2">Ödeme Yöntemine Göre</p>
          <div className="space-y-1.5">
            {byPayment.map((m) => (
              <div key={m.key} className="flex justify-between text-sm">
                <span className="text-ink-600">{m.label} <span className="text-ink-400">×{m.count}</span></span>
                <span className="font-semibold">{money(m.total)}</span>
              </div>
            ))}
            {byPayment.length === 0 && <p className="text-sm text-ink-400">Kapatılmış hesap yok</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-brand-50 p-4 flex items-center justify-between">
          <span className="font-display font-bold text-brand-700">TOPLAM CİRO</span>
          <span className="font-display text-2xl font-extrabold text-brand-700">{money(revenue)}</span>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-ink-600">{label}</span>
      <span className="font-display font-extrabold text-ink-900">{value}</span>
    </div>
  )
}
