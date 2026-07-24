// Fiş / Adisyon yazdırma — 80mm termal yazıcıya da normal yazıcıya da uyar.
// Tarayıcının yazdırma diyaloğunu kullanır (window.print). Chrome "kiosk
// printing" modunda diyalog çıkmadan sessizce basar; normalde diyalog açılır.
import { money, timeOfDay } from './format'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Gizli iframe içinde yazdır — sayfadan ayrı, temiz.
export function printHTML(html) {
  const old = document.getElementById('receipt-frame')
  if (old) old.remove()
  const iframe = document.createElement('iframe')
  iframe.id = 'receipt-frame'
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()
  const go = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print() } catch {}
    setTimeout(() => iframe.remove(), 1500)
  }
  // İçerik (fontlar) yüklensin diye kısa bekle
  if (iframe.contentWindow.document.readyState === 'complete') setTimeout(go, 250)
  else iframe.onload = () => setTimeout(go, 250)
}

const SHELL = (title, body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; }
  body { width: 80mm; font-family: 'Courier New', monospace; color:#000; background:#fff; padding: 4mm 3mm 6mm; }
  .c { text-align:center; }
  .b { font-weight:700; }
  .lg { font-size: 15px; }
  .xl { font-size: 20px; font-weight:800; }
  .huge { font-size: 26px; font-weight:800; }
  .row { display:flex; justify-content:space-between; gap:6px; }
  .muted { color:#000; opacity:.75; }
  .hr { border:0; border-top:1px dashed #000; margin:6px 0; }
  .hr2 { border:0; border-top:2px solid #000; margin:6px 0; }
  .item { margin:5px 0; }
  .note { padding-left:14px; font-style:italic; }
  .qty { display:inline-block; min-width:26px; font-weight:800; }
  @media print { body { padding: 2mm; } }
</style></head><body>${body}
<script>window.onload=function(){setTimeout(function(){try{window.focus()}catch(e){}},50)}</script>
</body></html>`

// ── MUTFAK ADİSYONU — fiyatsız, iri, mutfak için ──
export function kitchenSlipHTML(order, profile) {
  const items = (order.items || []).map((it) => `
    <div class="item lg">
      <span class="qty">${esc(it.qty)}x</span> <span class="b">${esc(it.name)}</span>
      ${it.note ? `<div class="note">&gt;&gt; ${esc(it.note)}</div>` : ''}
    </div>`).join('')
  const body = `
    <div class="c b lg">*** MUTFAK ***</div>
    <div class="c huge">MASA ${esc(order.tableNo ?? '?')}</div>
    <div class="c muted">${esc(timeOfDay(order.createdAt) || timeOfDay(Date.now()))}</div>
    <hr class="hr2"/>
    ${items}
    <hr class="hr2"/>
    <div class="c muted">Sipariş #${esc((order.id || '').slice(-4).toUpperCase())}</div>`
  return SHELL(`Mutfak · Masa ${order.tableNo ?? ''}`, body)
}

// ── HESAP FİŞİ — fiyatlı, müşteriye verilen adisyon ──
export function billHTML(order, profile, method) {
  const items = (order.items || []).map((it) => `
    <div class="item">
      <div class="row"><span><span class="qty">${esc(it.qty)}x</span> ${esc(it.name)}</span><span class="b">${money(it.price * it.qty)}</span></div>
      ${it.note ? `<div class="note muted">${esc(it.note)}</div>` : ''}
    </div>`).join('')
  const now = new Date()
  const tarih = now.toLocaleDateString('tr-TR') + ' ' + timeOfDay(now.getTime())
  const body = `
    <div class="c xl">${esc(profile?.name || 'Restoran')}</div>
    ${profile?.phone ? `<div class="c muted">${esc(profile.phone)}</div>` : ''}
    ${profile?.address ? `<div class="c muted" style="font-size:11px">${esc(profile.address)}</div>` : ''}
    <hr class="hr"/>
    <div class="row"><span class="b">Masa ${esc(order.tableNo ?? '?')}</span><span class="muted">${esc(tarih)}</span></div>
    <hr class="hr"/>
    ${items}
    <hr class="hr2"/>
    <div class="row xl"><span>TOPLAM</span><span>${money(order.total)}</span></div>
    <hr class="hr"/>
    ${method ? `<div class="c b">Ödeme: ${esc(method)}</div>` : `<div class="c muted">Ödeme kasada yapılır</div>`}
    <div class="c muted" style="margin-top:8px">Afiyet olsun! Teşekkürler</div>
    <div class="c muted" style="margin-top:2px;font-size:11px">serviq</div>`
  return SHELL(`Hesap · Masa ${order.tableNo ?? ''}`, body)
}

export const printKitchenSlip = (order, profile) => printHTML(kitchenSlipHTML(order, profile))
export const printBill = (order, profile, method) => printHTML(billHTML(order, profile, method))
