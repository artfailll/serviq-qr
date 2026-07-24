// İmza etkileşim: sepete "+" basınca çizgisel bir garson figürü tepsiyle
// ürün kartından sepet çubuğuna koşar, ulaşınca içine çekilerek kaybolur.
// Web Animations API kullanır — sayfa React ağacının dışında, sabit
// konumlu (position:fixed) bağımsız bir katmanda çalışır.

function figureSVG(color, w) {
  const S = `stroke:${color};stroke-width:${w};stroke-linecap:round;stroke-linejoin:round;fill:none`
  const leg = (delay) => `
    <g style="transform-box:view-box;transform-origin:28px 47px;animation:wrun-whip .6s linear infinite;animation-delay:${delay}s">
      <line x1="28" y1="47" x2="28" y2="63" style="${S}"/>
      <g style="transform-box:view-box;transform-origin:28px 63px;animation:wrun-knee .6s linear infinite;animation-delay:${delay}s">
        <line x1="28" y1="63" x2="28" y2="79" style="${S}"/>
        <line x1="28" y1="79" x2="35.5" y2="80" style="${S}"/>
      </g>
    </g>`
  return `<svg viewBox="0 0 64 88" width="64" height="88" style="overflow:visible;display:block">
    <g style="transform-box:view-box;transform-origin:32px 50px;animation:wrun-bob .6s ease-in-out infinite">
      <g style="opacity:.42">${leg('-.3')}</g>
      <g style="transform-box:view-box;transform-origin:35px 26px;animation:wrun-arm .6s linear infinite;animation-delay:-.3s;opacity:.42">
        <line x1="35" y1="26" x2="29" y2="43" style="${S}"/>
      </g>
      <line x1="36" y1="21" x2="28" y2="47" style="${S}"/>
      <circle cx="38.5" cy="13.5" r="6" style="${S}"/>
      <polyline points="35,26 44.5,19 52,14.5" style="${S}"/>
      <line x1="42.5" y1="13.5" x2="61.5" y2="13.5" style="${S}"/>
      <path d="M48 13.5 q4 -5.5 8 0" style="${S}"/>
      ${leg('0')}
    </g>
  </svg>`
}

let layerEl = null
function getLayer() {
  if (layerEl && document.body.contains(layerEl)) return layerEl
  layerEl = document.createElement('div')
  layerEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200'
  document.body.appendChild(layerEl)
  return layerEl
}

export function spawnWaiter({ from, to, color = '#c68a4a', strokeWidth = 2.2, onArrive }) {
  if (!from || !to) { onArrive && onArrive(); return }

  const layer = getLayer()
  const dx = to.x - from.x
  const flip = dx < 0 ? -1 : 1
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:88px;pointer-events:none;will-change:transform;filter:drop-shadow(0 8px 12px rgba(0,0,0,.22))'
  wrap.innerHTML = figureSVG(color, strokeWidth)

  // Güvenlik ağı: sepete ekleme HİÇBİR ŞEKİLDE animasyona bağımlı kalıp
  // kaybolmasın (sekme arka plana atılırsa WAAPI duraklayabilir, düşük
  // güçlü cihazda kare düşebilir vb.) — en geç 2.2 sn sonra garanti tetiklenir
  // ve yarım kalan figürü de temizler.
  let fired = false
  const fireOnce = () => {
    if (fired) return
    fired = true
    wrap.getAnimations().forEach(a => a.cancel())
    wrap.remove()
    onArrive && onArrive()
  }
  const safety = setTimeout(fireOnce, 2200)

  const OX = 32, OY = 50
  const sx = from.x - OX, sy = from.y - OY
  const ex = to.x - OX, ey = to.y - OY
  const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 46 // menünün üstünden kavis çizerek koşsun

  wrap.style.transform = `translate(${sx}px,${sy}px) scaleX(${flip})`
  layer.appendChild(wrap)

  const run = wrap.animate([
    { transform: `translate(${sx}px,${sy}px) scaleX(${flip}) scale(1)`, offset: 0 },
    { transform: `translate(${mx}px,${my}px) scaleX(${flip}) scale(1.02)`, offset: .5 },
    { transform: `translate(${ex}px,${ey}px) scaleX(${flip}) scale(.96)`, offset: 1 },
  ], { duration: 920, easing: 'cubic-bezier(.4,.02,.35,1)', fill: 'forwards' })

  run.onfinish = () => {
    const suck = wrap.animate([
      { transform: `translate(${ex}px,${ey}px) scaleX(${flip}) scale(.96)`, opacity: 1 },
      { transform: `translate(${to.x - 12}px,${to.y - 12}px) scaleX(${flip}) scale(.12)`, opacity: 0 },
    ], { duration: 300, easing: 'cubic-bezier(.6,0,.85,.35)', fill: 'forwards' })
    suck.onfinish = () => { clearTimeout(safety); fireOnce() }
  }
}

// Tıklanan butondan sepet çubuğuna (varsa) koşturur; sepet henüz boşsa
// (çubuk daha render edilmemişse) ekranın alt-orta noktasını hedefler.
export function runWaiterToCart(e, color, onArrive) {
  const btnRect = e.currentTarget.getBoundingClientRect()
  const from = { x: btnRect.left + btnRect.width / 2, y: btnRect.top + btnRect.height / 2 }
  const cartEl = document.querySelector('[data-cartbar]')
  const to = cartEl
    ? (() => { const cr = cartEl.getBoundingClientRect(); return { x: cr.left + 24, y: cr.top + cr.height / 2 } })()
    : { x: window.innerWidth / 2, y: window.innerHeight - 40 }
  spawnWaiter({ from, to, color, strokeWidth: 2.2, onArrive })
}
