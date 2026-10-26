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
    try {
      iframe.contentWindow.addEventListener('afterprint', () => {
        setTimeout(() => { try { iframe.remove() } catch {} }, 1000)
      })
    } catch {}
    setTimeout(() => { try { iframe.remove() } catch {} }, 60000)
  }
  // İçerik (fontlar) yüklensin diye kısa bekle
  if (iframe.contentWindow.document.readyState === 'complete') setTimeout(go, 250)
  else iframe.onload = () => setTimeout(go, 250)
}

const SHELL = (title, body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html,body { margin:0; padding:0; }
  body {
    width: 80mm;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-weight: 700;
    color: #000;
    background: #fff;
    padding: 3mm 2mm 5mm;
    line-height: 1.25;
  }
  .c { text-align: center; }
  .b { font-weight: 900; }
  .lg { font-size: 16px; font-weight: 800; }
  .xl { font-size: 21px; font-weight: 900; letter-spacing: -0.5px; }
  .huge { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
  .row { display: flex; justify-content: space-between; gap: 6px; font-weight: 800; }
  .muted { color: #000; font-weight: 700; }
  .hr { border: 0; border-top: 2px dashed #000; margin: 6px 0; }
  .hr2 { border: 0; border-top: 3px solid #000; margin: 6px 0; }
  .item { margin: 6px 0; font-size: 15px; font-weight: 800; }
  .note { padding-left: 14px; font-size: 13px; font-weight: 900; }
  .qty { display: inline-block; min-width: 24px; font-weight: 900; font-size: 16px; }
  @media print { body { padding: 2mm 1mm; } }
</style></head><body>${body}
<script>window.onload=function(){setTimeout(function(){try{window.focus()}catch(e){}},50)}</script>
</body></html>`

// ── MUTFAK ADİSYONU — fiyatsız, iri, mutfak için ──
export function kitchenSlipHTML(order, profile) {
  const items = (order.items || []).map((it) => `
    <div class="item lg">
      <span class="qty">${esc(it.qty)}x</span> <span class="b">${esc(it.name)}</span>
      ${it.note ? `<div class="note b">&gt;&gt; ${esc(it.note)}</div>` : ''}
    </div>`).join('')
  const body = `
    <div class="c b xl">*** ${profile?.kitchenEnabled === false ? 'SİPARİŞ FİŞİ' : 'MUTFAK FİŞİ'} ***</div>
    <div class="c huge b" style="margin:2px 0">MASA ${esc(order.tableNo ?? '?')}</div>
    <div class="c b muted">${esc(timeOfDay(order.createdAt) || timeOfDay(Date.now()))}</div>
    <hr class="hr2"/>
    ${items}
    <hr class="hr2"/>
    <div class="c b muted">Sipariş #${esc((order.id || '').slice(-4).toUpperCase())}</div>`
  return SHELL(`Adisyon · Masa ${order.tableNo ?? ''}`, body)
}

// ── HESAP FİŞİ — fiyatlı, müşteriye verilen adisyon ──
export function billHTML(order, profile, method) {
  const items = (order.items || []).map((it) => `
    <div class="item">
      <div class="row">
        <span><span class="qty">${esc(it.qty)}x</span> <span class="b">${esc(it.name)}</span></span>
        <span class="b">${money(it.price * it.qty)}</span>
      </div>
      ${it.note ? `<div class="note b">&gt;&gt; ${esc(it.note)}</div>` : ''}
    </div>`).join('')
  const now = new Date()
  const tarih = now.toLocaleDateString('tr-TR') + ' ' + timeOfDay(now.getTime())
  const body = `
    <div class="c xl b">${esc(profile?.name || 'Restoran')}</div>
    ${profile?.phone ? `<div class="c b muted" style="margin-top:2px">${esc(profile.phone)}</div>` : ''}
    ${profile?.address ? `<div class="c b muted" style="font-size:12px;margin-top:2px">${esc(profile.address)}</div>` : ''}
    <hr class="hr2"/>
    <div class="row xl b"><span>MASA ${esc(order.tableNo ?? '?')}</span><span>${esc(tarih)}</span></div>
    <hr class="hr2"/>
    ${items}
    <hr class="hr2"/>
    <div class="row huge b"><span>TOPLAM</span><span>${money(order.total)}</span></div>
    <hr class="hr2"/>
    ${method ? `<div class="c xl b" style="margin:4px 0">Ödeme: ${esc(method)}</div>` : `<div class="c b muted">Ödeme kasada yapılır</div>`}
    <div class="c b" style="margin-top:10px;font-size:14px">Afiyet olsun! Teşekkürler</div>
    <div class="c b muted" style="margin-top:4px;font-size:12px">serviq.com.tr</div>`
  return SHELL(`Hesap · Masa ${order.tableNo ?? ''}`, body)
}

export const printKitchenSlip = (order, profile) => printHTML(kitchenSlipHTML(order, profile))
export const printBill = (order, profile, method) => printHTML(billHTML(order, profile, method))
