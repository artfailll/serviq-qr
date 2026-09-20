import { useRef, useState } from 'react'
import { getLoyaltyRules } from '../../lib/loyalty'
import { useProfile, useCustomers, useActiveStaff, redeemLoyaltyReward } from '../../lib/store'
import { money } from '../../lib/format'

export function LoyaltySettings({ value, onChange }) {
  const data = { enabled:false, earnEveryTL:10, rewardPoints:50, rewardName:'', ...value }
  const set = (key, value) => onChange({ ...data, [key]:value })
  return <section className="card p-5 space-y-4">
    <h3 className="font-bold">Sadakat programı</h3>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data.enabled} onChange={e => set('enabled',e.target.checked)}/>Müşteriler puan kazanabilsin</label>
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">1 puan için harcama (TL)<input aria-label="1 puan için harcama" className="inp mt-1" type="number" min="1" max="100000" step=".01" value={data.earnEveryTL} onChange={e => set('earnEveryTL',e.target.value)}/></label>
      <label className="text-sm">Ödül için gereken puan<input aria-label="Ödül puanı" className="inp mt-1" type="number" min="1" max="1000000" step="1" value={data.rewardPoints} onChange={e => set('rewardPoints',e.target.value)}/></label>
    </div>
    <label className="text-sm block">Verilecek ödül<input aria-label="Sadakat ödülü" className="inp mt-1" maxLength="100" placeholder="Örn. Bir küçük ayran" value={data.rewardName} onChange={e => set('rewardName',e.target.value)}/></label>
    <p className="text-xs text-ink-500 leading-relaxed">Puan yalnızca ödenen hesaptan kazanılır. Ödül teslimi Müşteri & Sadakat ekranında personel tarafından onaylanır; adisyona otomatik indirim veya stok hareketi uygulanmaz. Programı kapatmak mevcut puanları silmez.</p>
  </section>
}

export default function LoyaltyPanel({ bizId }) {
  const profile = useProfile(bizId)
  const customers = useCustomers(bizId)
  const { staffId } = useActiveStaff(bizId)
  const rules = getLoyaltyRules(profile)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [message, setMessage] = useState('')
  const customer = customers.find(c => c.id === selected)
  async function redeem() {
    if (lock.current || !customer) return
    if (!window.confirm(`${customer.name || customer.phone}: ${rules.rewardName} teslim edildi mi? ${rules.rewardPoints} puan düşülecek. Müşterinin telefonunu kendisiyle doğrulayın.`)) return
    lock.current = true; setBusy(true); setMessage('')
    try {
      await redeemLoyaltyReward(bizId,customer.id,crypto.randomUUID(),staffId)
      setMessage('Ödül teslimi kaydedildi ve puan düşüldü.')
    } catch(e) { setMessage(e.message || 'Ödül kaydedilemedi.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="card p-5 space-y-3">
    <h3 className="font-bold">Ödül teslimi ve puan hareketleri</h3>
    <p className="text-sm text-ink-500">{rules.enabled ? `${money(rules.earnEveryTL)} = 1 puan · ${rules.rewardPoints} puan = ${rules.rewardName}` : 'Program kapalı veya eksik. İşletme Profili → Sadakat programından oranı ve ödülü belirleyin.'}</p>
    <select className="inp" aria-label="Ödül için müşteri" disabled={busy} value={selected} onChange={e => { setSelected(e.target.value); setMessage('') }}><option value="">Müşteri seçin</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name || 'İsimsiz'} · {c.phone || 'Telefon yok'} · {c.points || 0} puan</option>)}</select>
    <button className="btn-primary" disabled={busy || !rules.enabled || !customer || Number(customer.points)<rules.rewardPoints} onClick={redeem}>{busy ? 'Sunucu onayı bekleniyor…' : 'Ödülü teslim et ve puanı düş'}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
    {customer && <div className="text-sm space-y-2"><p className="font-semibold">Bakiye: {customer.points || 0} puan</p>{Object.entries(customer.redemptions || {}).sort((a,b)=>b[1].at-a[1].at).slice(0,8).map(([id,r])=><p key={id} className="border-t pt-2">−{r.points} puan · {r.reward} · {new Date(r.at).toLocaleString('tr-TR')}</p>)}<p className="text-xs text-ink-500">{Object.keys(customer.credits || {}).length} siparişten puan kaydı · {Object.keys(customer.redemptions || {}).length} ödül teslimi</p></div>}
  </section>
}
