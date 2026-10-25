import { useMemo, useState } from 'react'
import {
  Boxes, UsersRound, HeartHandshake, Building2, Sparkles, Plus, Search,
  ArrowDownToLine, ArrowUpFromLine, Clock3, Trash2, CheckCircle2,
  AlertTriangle, TrendingUp, WalletCards, BrainCircuit,
} from 'lucide-react'
import {
  useBusinessId, useInventory, useInventoryMovements, useStaff, useShifts, useCustomers, useBranches,
  useOrders, useArchiveAll, useProducts, INVENTORY_UNITS, STAFF_ROLES,
  addInventoryItem, removeInventoryItem, adjustStockManual,
  addStaffMember, removeStaffMember, startShift, endShift,
  upsertCustomer, addBranch, removeBranch, customerKey, useProfile,
} from '../../lib/store'
import { money, dateKey, timeOfDay } from '../../lib/format'
import { EmptyState, Modal } from '../ui'
import LoyaltyPanel from './LoyaltyPanel'

const TABS = [
  { key: 'stock', label: 'Stok & Maliyet', icon: Boxes },
  { key: 'team', label: 'Ekip & Vardiya', icon: UsersRound },
  { key: 'crm', label: 'Müşteri & Sadakat', icon: HeartHandshake },
  { key: 'branches', label: 'Şubeler', icon: Building2 },
  { key: 'insights', label: 'Akıllı İçgörüler', icon: Sparkles },
]

const DATE_RANGES = [
  { key: 'today', label: 'Bugün' }, { key: 'yesterday', label: 'Dün' },
  { key: 'week', label: 'Son 7 gün' }, { key: 'month', label: 'Bu ay' }, { key: 'custom', label: 'Özel tarih' },
]
function localStart(day) { const [y, m, d] = String(day).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime() }
function localEnd(day) { return localStart(day) + 86400000 - 1 }
function periodBounds(key, from, to) {
  const today = dateKey(); const start = localStart(today); const now = new Date()
  if (key === 'custom') { const a = from || today; const b = to && to >= a ? to : a; return { start: localStart(a), end: localEnd(b), label: `${a} — ${b}` } }
  if (key === 'yesterday') { const d = new Date(start); d.setDate(d.getDate() - 1); const day = dateKey(d); return { start: localStart(day), end: localEnd(day), label: day } }
  if (key === 'week') return { start: start - 6 * 86400000, end: Date.now(), label: 'Son 7 gün' }
  if (key === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: Date.now(), label: 'Bu ay' }
  return { start, end: Date.now(), label: today }
}

export default function OperationsHub() {
  const [tab, setTab] = useState('stock'); const [range, setRange] = useState('today'); const [customFrom, setCustomFrom] = useState(dateKey()); const [customTo, setCustomTo] = useState(dateKey())
  const bizId = useBusinessId()
  const profile = useProfile(bizId)
  // Stok takibi kapalıysa stok sekmesi hiç görünmez (İşletme Profili'nden açılır).
  const stockOn = profile.stockTracking !== false
  const tabs = stockOn ? TABS : TABS.filter((t) => t.key !== 'stock')
  const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs[0].key
  const bounds = useMemo(() => periodBounds(range, customFrom, customTo), [range, customFrom, customTo])
  return <div className="space-y-5 animate-[fade-up_.35s_ease-out]">
    <div className="relative overflow-hidden rounded-3xl bg-ink-900 p-6 sm:p-8 text-white shadow-xl">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-brand-200"><BrainCircuit className="h-3.5 w-3.5" /> İşletme OS · ileri seviye</div><h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">İşletmenizi tek merkezden yönetin.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Stoktan personele, sadakatten akıllı içgörülere kadar operasyonun görünmeyen tarafını ölçülebilir hale getirin.</p></div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><Boxes className="mx-auto mb-1 h-4 w-4 text-brand-300" /><span>Stok</span></div><div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><UsersRound className="mx-auto mb-1 h-4 w-4 text-sky-300" /><span>Ekip</span></div><div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><Sparkles className="mx-auto mb-1 h-4 w-4 text-amber-300" /><span>İçgörü</span></div></div>
      </div>
    </div>
    <DateFilter range={range} setRange={setRange} customFrom={customFrom} customTo={customTo} setCustomFrom={setCustomFrom} setCustomTo={setCustomTo} label={bounds.label} />
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-ink-100 bg-white p-1.5 shadow-soft">{tabs.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => setTab(item.key)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-all ${activeTab === item.key ? 'bg-brand-500 text-white shadow-glow' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`}><Icon className="h-4 w-4" />{item.label}</button> })}</div>
    {activeTab === 'stock' && <StockPanel bizId={bizId} bounds={bounds} />}
    {activeTab === 'team' && <TeamPanel bizId={bizId} bounds={bounds} />}
    {activeTab === 'crm' && <CustomerPanel bizId={bizId} bounds={bounds} />}
    {activeTab === 'branches' && <BranchPanel bizId={bizId} />}
    {activeTab === 'insights' && <InsightsPanel bizId={bizId} bounds={bounds} stockOn={stockOn} />}
  </div>
}

function DateFilter({ range, setRange, customFrom, customTo, setCustomFrom, setCustomTo, label }) { return <div className="card flex flex-col lg:flex-row lg:items-center gap-3 p-3"><div className="flex items-center gap-2 text-sm font-bold text-ink-600"><Clock3 className="h-4 w-4 text-brand-500" /> Rapor tarihi</div><div className="flex flex-wrap gap-1.5">{DATE_RANGES.map((item) => <button key={item.key} onClick={() => setRange(item.key)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${range === item.key ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'}`}>{item.label}</button>)}</div>{range === 'custom' && <div className="flex items-center gap-2"><input type="date" className="input !w-auto !py-1.5" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /><span className="text-ink-400">—</span><input type="date" className="input !w-auto !py-1.5" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>}<span className="lg:ml-auto text-xs font-semibold text-ink-400">{label}</span></div> }

function useHistoricalOrders(bizId) {
  const live = useOrders(bizId); const archive = useArchiveAll(bizId)
  return useMemo(() => { const map = new Map(); const old = Object.values(archive).flatMap((day) => Object.entries(day || {}).map(([id, order]) => ({ ...order, id: order.id || id }))); [...old, ...live].forEach((order) => map.set(order.id, order)); return [...map.values()] }, [live, archive])
}

function StockPanel({ bizId, bounds }) {
  const items = useInventory(bizId); const movements = useInventoryMovements(bizId); const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', unit: 'adet', stock: '', minStock: '', cost: '', category: '', supplier: '' })
  const filtered = items.filter((x) => `${x.name} ${x.category} ${x.supplier}`.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR')))
  const low = items.filter((x) => Number(x.stock) <= Number(x.minStock) && Number(x.minStock) > 0)
  function save(e) { e.preventDefault(); addInventoryItem(bizId, form); setForm({ name: '', unit: 'adet', stock: '', minStock: '', cost: '', category: '', supplier: '' }); setOpen(false) }
  const periodMovements = movements.filter((x) => x.createdAt >= bounds.start && x.createdAt <= bounds.end)
  const autoMovements = periodMovements.filter((x) => x.auto)
  function adjust(item, delta) { adjustStockManual(bizId, item.id, delta) }
  return <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric icon={Boxes} label="Stok kalemi" value={items.length} tone="brand" /><Metric icon={AlertTriangle} label="Kritik stok" value={low.length} tone={low.length ? 'red' : 'green'} /><Metric icon={WalletCards} label="Stok değeri" value={money(items.reduce((s, x) => s + (Number(x.stock) || 0) * (Number(x.cost) || 0), 0))} tone="amber" /><Metric icon={TrendingUp} label="Otomatik düşüm" value={`${autoMovements.length} / ${periodMovements.length}`} tone="sky" /></div>
    <div className="card overflow-hidden"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-ink-100 p-4"><div><h3 className="font-display font-bold text-ink-800">Stok ve maliyet kartları</h3><p className="text-xs text-ink-400 mt-1">Malzemeyi ekle, sonra Menü Yönetimi → ürün → <strong className="text-ink-600">Reçete</strong> alanından bağla. Sipariş girilir girilmez stok otomatik düşer.</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" /><input className="inp !w-44 !py-2 !pl-8" placeholder="Stok ara" value={q} onChange={(e) => setQ(e.target.value)} /></div><button className="btn-primary !py-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yeni stok</button></div></div>{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-ink-100 text-left text-xs text-ink-400"><th className="p-4">Malzeme</th><th className="p-4">Kategori / tedarikçi</th><th className="p-4 text-right">Stok</th><th className="p-4 text-right">Birim maliyet</th><th className="p-4 text-right">Değer</th><th className="p-4 text-right">İşlem</th></tr></thead><tbody>{filtered.map((item) => { const isLow = Number(item.stock) <= Number(item.minStock) && Number(item.minStock) > 0; return <tr key={item.id} className="border-b border-ink-50 hover:bg-ink-50/60"><td className="p-4"><div className="font-semibold text-ink-800">{item.name}</div><span className="text-xs text-ink-400">Min. {item.minStock || 0} {item.unit}</span></td><td className="p-4 text-ink-500">{item.category || 'Genel'}<br /><span className="text-xs text-ink-400">{item.supplier || 'Tedarikçi yok'}</span></td><td className={`p-4 text-right font-bold ${isLow ? 'text-red-600' : 'text-ink-800'}`}>{item.stock || 0} {item.unit}{isLow && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}</td><td className="p-4 text-right text-ink-600">{money(item.cost)}</td><td className="p-4 text-right font-bold">{money((Number(item.stock) || 0) * (Number(item.cost) || 0))}</td><td className="p-4"><div className="flex justify-end gap-1"><button className="btn-ghost !h-8 !w-8 !p-0" title="Stok azalt" onClick={() => adjust(item, -1)}><ArrowDownToLine className="h-4 w-4" /></button><button className="btn-ghost !h-8 !w-8 !p-0" title="Stok artır" onClick={() => adjust(item, 1)}><ArrowUpFromLine className="h-4 w-4" /></button><button className="btn-ghost !h-8 !w-8 !p-0 text-red-500" title="Sil" onClick={() => removeInventoryItem(bizId, item.id)}><Trash2 className="h-4 w-4" /></button></div></td></tr> })}</tbody></table></div> : <EmptyState icon={Boxes} title="Henüz stok kartı yok" hint="İlk malzemenizi ekleyerek gerçek maliyet takibini başlatın." />}</div>
    {periodMovements.length > 0 && <div className="card p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-display font-bold text-ink-800">Stok hareketleri</h3><p className="mt-1 text-xs text-ink-400">Seçili tarih aralığındaki giriş ve çıkışlar · <span className="font-semibold text-brand-600">{autoMovements.length} tanesi siparişten otomatik</span></p></div></div><div className="mt-4 grid md:grid-cols-2 gap-2">{periodMovements.slice(0, 12).map((move) => { const item = items.find((x) => x.id === move.itemId); return <div key={move.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 text-sm"><span className="min-w-0 text-ink-600"><span className="font-semibold">{item?.name || 'Silinmiş stok'}</span>{move.auto && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">OTOMATİK</span>}<span className="block truncate text-xs text-ink-400">{move.reason || 'Stok hareketi'} · {dateKey(move.createdAt)} {timeOfDay(move.createdAt)}</span></span><span className={`shrink-0 font-bold ${move.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{move.delta > 0 ? '+' : ''}{move.delta} {item?.unit || ''}</span></div> })}</div></div>}
    <Modal open={open} onClose={() => setOpen(false)} title="Yeni stok kartı" footer={<button form="stock-form" className="btn-primary w-full">Stok kartını kaydet</button>}><form id="stock-form" onSubmit={save} className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="Malzeme adı"><input className="inp mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Örn. Kaşar peyniri" /></Field><Field label="Birim"><select className="inp mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{INVENTORY_UNITS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></Field><Field label="Mevcut stok"><input type="number" min="0" className="inp mt-1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field><Field label="Kritik seviye"><input type="number" min="0" className="inp mt-1" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></Field><Field label="Birim maliyet (₺)"><input type="number" min="0" step="0.01" className="inp mt-1" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field><Field label="Kategori"><input className="inp mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Süt ürünleri" /></Field></div><Field label="Tedarikçi"><input className="inp mt-1" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></Field></form></Modal>
  </div>
}

function TeamPanel({ bizId, bounds }) {
  const members = useStaff(bizId); const shifts = useShifts(bizId); const [open, setOpen] = useState(false); const [form, setForm] = useState({ name: '', role: 'waiter', phone: '', pin: '' });
  function save(e) { e.preventDefault(); addStaffMember(bizId, form); setForm({ name: '', role: 'waiter', phone: '', pin: '' }); setOpen(false) }
  const roleName = (key) => STAFF_ROLES.find((x) => x.key === key)?.label || key
  // Açık vardiya tarih filtresinden bağımsız görünmeli — şu an çalışan kişi
  // "dün" seçilince kaybolmamalı.
  const openShifts = shifts.filter((x) => x.status === 'open')
  // Dönem içinde tahsil edilen siparişler personele göre ayrışır: kasiyer
  // yoksa siparişi giren garsona yazılır.
  const orders = useHistoricalOrders(bizId)
  const perStaff = useMemo(() => {
    const map = {}
    orders.forEach((o) => {
      const at = o.paidAt || o.createdAt || 0
      if (o.status !== 'paid' || at < bounds.start || at > bounds.end) return
      const who = o.cashierId || o.staffId
      if (!who) return
      const cur = map[who] || { orders: 0, revenue: 0 }
      cur.orders += 1; cur.revenue += Number(o.total) || 0
      map[who] = cur
    })
    return map
  }, [orders, bounds])
  const attributed = Object.values(perStaff).reduce((s, x) => s + x.revenue, 0)
  return <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric icon={UsersRound} label="Ekip" value={members.length} tone="sky" /><Metric icon={Clock3} label="Açık vardiya" value={openShifts.length} tone="green" /><Metric icon={CheckCircle2} label="Aktif personel" value={members.filter((x) => x.active !== false).length} tone="brand" /><Metric icon={WalletCards} label="Personele yazılan ciro" value={money(attributed)} tone="purple" /></div><div className="card p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-display font-bold text-ink-800">Ekip ve vardiya kontrolü</h3><p className="text-xs text-ink-400 mt-1">Kim çalışıyor, hangi rolde, vardiyası açık mı tek bakışta görün.</p></div><button className="btn-primary !py-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Personel ekle</button></div>{members.length ? <div className="grid md:grid-cols-2 gap-3">{members.map((m) => { const activeShift = openShifts.find((s) => s.staffId === m.id); return <div key={m.id} className="rounded-2xl border border-ink-100 p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 font-bold">{m.name?.slice(0, 1).toUpperCase()}</div><div><p className="font-bold text-ink-800">{m.name}</p><p className="text-xs text-ink-400">{roleName(m.role)}{m.pin ? ` · PIN: ${m.pin}` : ''}{m.phone ? ` · ${m.phone}` : ''}</p></div></div><button className="btn-ghost !h-8 !w-8 !p-0 text-red-500" onClick={() => removeStaffMember(bizId, m.id)}><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-ink-50 p-2.5 text-center"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Dönem cirosu</p><p className="font-display font-extrabold text-ink-800">{money(perStaff[m.id]?.revenue || 0)}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Sipariş</p><p className="font-display font-extrabold text-ink-800">{perStaff[m.id]?.orders || 0}</p></div></div><div className="mt-3 flex items-center justify-between"><span className={`chip ${activeShift ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-500'}`}>{activeShift ? `● Vardiyada · ${timeOfDay(activeShift.startedAt)}` : 'Vardiya kapalı'}</span>{activeShift ? <button className="text-xs font-bold text-red-600" onClick={() => endShift(bizId, activeShift.id)}>Vardiyayı kapat</button> : <button className="text-xs font-bold text-brand-600" onClick={() => startShift(bizId, m.id)}>Vardiya başlat</button>}</div></div> })}</div> : <EmptyState icon={UsersRound} title="Ekip kaydı yok" hint="Personel ekleyerek vardiya ve rol yönetimini başlatın." />}</div><Modal open={open} onClose={() => setOpen(false)} title="Personel ekle" footer={<button form="staff-form" className="btn-primary w-full">Personeli kaydet</button>}><form id="staff-form" onSubmit={save} className="space-y-3"><Field label="Ad soyad"><input required className="inp mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Rol"><select className="inp mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{STAFF_ROLES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></Field><Field label="Giriş PIN (4 haneli)"><input className="inp mt-1" maxLength={8} placeholder="örn: 1234" value={form.pin || ''} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></Field><Field label="Telefon"><input className="inp mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></form></Modal></div>
}

function CustomerPanel({ bizId, bounds }) {
  const savedCustomers = useCustomers(bizId); const orders = useHistoricalOrders(bizId); const [open, setOpen] = useState(false); const [form, setForm] = useState({ name: '', phone: '', points: 0 });
  // Kart ömür boyu toplamı tutar (hesap kapanınca otomatik işlenir).
  // Buradaki hesap yalnızca seçili tarih aralığındaki hareketi gösterir —
  // aynı siparişi iki kez saymamak için karta eklenmez.
  const periodStats = useMemo(() => {
    const map = {}
    orders.forEach((o) => {
      const at = o.paidAt || o.createdAt || 0
      if (o.status !== 'paid' || at < bounds.start || at > bounds.end) return
      const key = customerKey(o.customer)
      if (!key || !o.customer?.consent) return
      const cur = map[key] || { visits: 0, spend: 0 }
      cur.visits += 1; cur.spend += Number(o.total) || 0
      map[key] = cur
    })
    return map
  }, [orders, bounds])
  const customers = useMemo(() => savedCustomers
    .map((c) => ({ ...c, periodVisits: periodStats[c.id]?.visits || 0, periodSpend: periodStats[c.id]?.spend || 0 }))
    .sort((a, b) => (b.periodSpend - a.periodSpend) || ((b.spend || 0) - (a.spend || 0))), [savedCustomers, periodStats])
  const periodSpend = Object.values(periodStats).reduce((s, x) => s + x.spend, 0)
  const top = customers.find((c) => (c.spend || 0) > 0) || customers[0]
  function save(e) { e.preventDefault(); upsertCustomer(bizId, form); setForm({ name: '', phone: '', points: 0 }); setOpen(false) }
  return <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric icon={HeartHandshake} label="Müşteri kartı" value={customers.length} tone="brand" /><Metric icon={TrendingUp} label="Dönem harcaması" value={money(periodSpend)} tone="green" /><Metric icon={Sparkles} label="Toplam puan" value={customers.reduce((s, x) => s + (Number(x.points) || 0), 0)} tone="amber" /><Metric icon={UsersRound} label="En sadık" value={top?.name || '—'} tone="purple" /></div><div className="card p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-display font-bold text-ink-800">Müşteri ve sadakat defteri</h3><p className="text-xs text-ink-400 mt-1">Hesap ödendiğinde ziyaret ve harcama kaydedilir. Puan oranı ve ödül İşletme Profili bölümünden belirlenir.</p></div><button className="btn-primary !py-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Müşteri ekle</button></div>{customers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-ink-100 text-left text-xs text-ink-400"><th className="p-3">Müşteri</th><th className="p-3">Telefon</th><th className="p-3 text-right">Dönem</th><th className="p-3 text-right">Toplam ziyaret</th><th className="p-3 text-right">Puan</th><th className="p-3 text-right">Toplam harcama</th></tr></thead><tbody>{customers.map((c) => <tr key={c.id} className="border-b border-ink-50"><td className="p-3 font-semibold">{c.name || 'İsimsiz'}</td><td className="p-3 text-ink-500">{c.phone || '—'}</td><td className="p-3 text-right">{c.periodVisits ? <span className="font-semibold text-green-600">{c.periodVisits} · {money(c.periodSpend)}</span> : <span className="text-ink-300">—</span>}</td><td className="p-3 text-right">{c.visits || 0}</td><td className="p-3 text-right font-bold text-brand-600">{c.points || 0}</td><td className="p-3 text-right font-bold">{money(c.spend)}</td></tr>)}</tbody></table></div> : <EmptyState icon={HeartHandshake} title="Müşteri kartı yok" hint="Müşteri sipariş sırasında ad/telefon bırakınca kart otomatik oluşur. Elle de ekleyebilirsiniz." />}</div><LoyaltyPanel bizId={bizId} /><Modal open={open} onClose={() => setOpen(false)} title="Müşteri kartı" footer={<button form="customer-form" className="btn-primary w-full">Kartı kaydet</button>}><form id="customer-form" onSubmit={save} className="space-y-3"><Field label="Ad soyad"><input required className="inp mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Telefon"><input className="inp mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefon girilirse kart siparişle otomatik eşleşir" /></Field><Field label="Başlangıç puanı"><input type="number" min="0" className="inp mt-1" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></Field></form></Modal></div>
}

function BranchPanel({ bizId }) {
  const branches = useBranches(bizId); const [open, setOpen] = useState(false); const [form, setForm] = useState({ name: '', address: '' });
  function save(e) { e.preventDefault(); addBranch(bizId, form); setForm({ name: '', address: '' }); setOpen(false) }
  return <div className="space-y-4"><div className="card p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-display font-bold text-ink-800">Şube merkezi</h3><p className="text-xs text-ink-400 mt-1">Şube altyapısı hazır; ileride tek menüden tüm noktaları yönetebilirsiniz.</p></div><button className="btn-primary !py-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Şube ekle</button></div>{branches.length ? <div className="grid md:grid-cols-2 gap-3">{branches.map((b) => <div key={b.id} className="flex items-center justify-between rounded-2xl border border-ink-100 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600"><Building2 className="h-5 w-5" /></div><div><p className="font-bold text-ink-800">{b.name}</p><p className="text-xs text-ink-400">{b.address || 'Adres eklenmedi'}</p></div></div><button className="btn-ghost !h-8 !w-8 !p-0 text-red-500" onClick={() => removeBranch(bizId, b.id)}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <EmptyState icon={Building2} title="Tek işletme modu" hint="Şube ekleyerek raporları ve operasyonu lokasyon bazına ayırabilirsiniz." />}</div><Modal open={open} onClose={() => setOpen(false)} title="Şube ekle" footer={<button form="branch-form" className="btn-primary w-full">Şubeyi kaydet</button>}><form id="branch-form" onSubmit={save} className="space-y-3"><Field label="Şube adı"><input required className="inp mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Örn. Merkez" /></Field><Field label="Adres"><textarea className="inp mt-1 min-h-24" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field></form></Modal></div>
}

function InsightsPanel({ bizId, bounds, stockOn = true }) {
  const orders = useHistoricalOrders(bizId); const products = useProducts(bizId); const inventory = useInventory(bizId); const [pulse, setPulse] = useState(false)
  const periodOrders = orders.filter((x) => x.createdAt >= bounds.start && x.createdAt <= bounds.end)
  const paid = periodOrders.filter((x) => x.status === 'paid'); const revenue = paid.reduce((s, x) => s + (Number(x.total) || 0), 0)
  const top = useMemo(() => { const map = {}; paid.forEach((o) => (o.items || []).forEach((i) => { map[i.name] = (map[i.name] || 0) + (Number(i.qty) || 0) })); return Object.entries(map).sort((a, b) => b[1] - a[1])[0] }, [paid])
  const peak = useMemo(() => { const map = {}; paid.forEach((x) => { const h = new Date(x.createdAt || 0).getHours(); map[h] = (map[h] || 0) + 1 }); return Object.entries(map).sort((a, b) => b[1] - a[1])[0] }, [paid])
  const low = stockOn ? inventory.filter((x) => Number(x.minStock) > 0 && Number(x.stock) <= Number(x.minStock)) : []
  const margin = products.length ? Math.round(products.filter((x) => Number(x.price) > 0).reduce((s, x) => s + Math.max(0, (Number(x.price) - (Number(x.cost) || 0)) / Number(x.price), 0), 0) / products.filter((x) => Number(x.price) > 0).length * 100) : 0
  const suggestions = [top ? `${top[0]} öne çıkıyor: ${top[1]} adet satış almış. Menüde ilk sıraya ve kampanyalara taşı.` : 'İlk siparişlerden sonra en çok satan ürün önerisi oluşur.', peak ? `Yoğun saat ${String(peak[0]).padStart(2, '0')}:00 civarı. Bu aralık için vardiya planını güçlendir.` : 'Yoğun saat önerisi için daha fazla tahsil edilmiş sipariş gerekiyor.', !stockOn ? 'Stok takibi kapalı. Malzeme ve maliyet takibi için İşletme Profili → Stok Takibi\'nden açabilirsin.' : low.length ? `${low.length} stok kritik seviyede. Yeni sipariş vermeden önce satın alma listesi oluştur.` : 'Kritik stok görünmüyor; min. stok seviyelerini doldurmayı unutma.']
  return <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric icon={Sparkles} label="Akıllı özet" value={paid.length ? `${paid.length} satış` : 'Hazır'} tone="brand" /><Metric icon={WalletCards} label="Dönem cirosu" value={money(revenue)} tone="green" /><Metric icon={TrendingUp} label="Ortalama marj" value={`%${margin}`} tone="purple" /><Metric icon={AlertTriangle} label="Kritik aksiyon" value={low.length} tone={low.length ? 'red' : 'amber'} /></div><div className="grid lg:grid-cols-5 gap-4"><div className={`card lg:col-span-3 overflow-hidden transition-all ${pulse ? 'ring-2 ring-brand-300' : ''}`}><div className="bg-gradient-to-br from-brand-600 via-orange-500 to-amber-400 p-6 text-white"><div className="flex items-center justify-between"><div><div className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Akıllı işletme koçu</div><h3 className="font-display text-2xl font-extrabold">Bugün neye odaklanmalı?</h3></div><button className="rounded-full bg-white/15 p-3 transition hover:rotate-12 hover:bg-white/25" onClick={() => { setPulse(true); setTimeout(() => setPulse(false), 700) }}><BrainCircuit className="h-6 w-6" /></button></div><p className="mt-3 max-w-lg text-sm leading-6 text-white/80">Serviq, mevcut satış, stok ve ürün maliyeti verinizi tarayıp öncelikli aksiyonları çıkarır.</p></div><div className="space-y-3 p-5">{suggestions.map((text, i) => <div key={i} className="flex gap-3 rounded-2xl bg-ink-50 p-3"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">{i + 1}</div><p className="text-sm leading-5 text-ink-600">{text}</p></div>)}</div></div><div className="card p-5 lg:col-span-2"><h3 className="font-display font-bold text-ink-800">Hızlı teşhis</h3><p className="mt-1 text-xs text-ink-400">Operasyonel karar desteği</p><div className="mt-5 space-y-4"><Diagnosis label="En çok satan" value={top ? `${top[0]} · ${top[1]} adet` : 'Veri bekleniyor'} good={!!top} /><Diagnosis label="Yoğun saat" value={peak ? `${String(peak[0]).padStart(2, '0')}:00 · ${peak[1]} sipariş` : 'Veri bekleniyor'} good={!!peak} /><Diagnosis label="Stok alarmı" value={!stockOn ? 'Takip kapalı' : low.length ? `${low.length} kalem kritik` : 'Alarm yok'} good={!stockOn || !low.length} /><Diagnosis label="Maliyet kapsamı" value={`%${margin} ortalama fiyat farkı`} good={margin > 35} /></div></div></div></div>
}

function Metric({ icon: Icon, label, value, tone = 'brand' }) { const colors = { brand: 'bg-brand-50 text-brand-600', red: 'bg-red-50 text-red-600', green: 'bg-green-50 text-green-600', sky: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600', purple: 'bg-violet-50 text-violet-600' }; return <div className="card flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-xs text-ink-400">{label}</p><p className="truncate font-display text-lg font-extrabold text-ink-900">{value}</p></div></div> }
function Diagnosis({ label, value, good }) { return <div className="flex items-center justify-between gap-3 border-b border-ink-100 pb-3 last:border-0 last:pb-0"><span className="text-sm text-ink-500">{label}</span><span className={`text-right text-sm font-bold ${good ? 'text-green-600' : 'text-amber-600'}`}>{good ? '✓ ' : '• '}{value}</span></div> }
function Field({ label, children }) { return <label className="block text-sm font-semibold text-ink-600">{label}{children}</label> }
