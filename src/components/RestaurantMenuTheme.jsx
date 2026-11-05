import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, Flame, UtensilsCrossed, Wifi, ChefHat, Tag } from 'lucide-react'
import { ProductImage } from './ui'
import { money } from '../lib/format'
import './restaurant-menu-theme.css'

// SVG pattern structure adapted from Magic UI Animated Grid Pattern (MIT).
// See THIRD_PARTY_NOTICES.md. CSS drives a small, deterministic set of cells.
function TilePattern() {
  const id = useId()
  return <svg className="food-tiles" aria-hidden="true" width="100%" height="100%">
    <defs><pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse"><path d="M24 0 48 24 24 48 0 24Z M0 0 48 48 M48 0 0 48" fill="none" stroke="currentColor" strokeWidth=".55" /></pattern></defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
    {Array.from({ length: 12 }, (_, i) => <rect className="food-tile-glow" key={i} x={(i*97)%520} y={(i*71)%350} width="32" height="32" rx="2" fill="currentColor" style={{ animationDelay: `${-i*.7}s` }} />)}
  </svg>
}

function Atmosphere({ theme }) {
  return <div className={`food-atmosphere food-atmosphere--${theme}`} aria-hidden="true">
    {theme === 'doner' && <><div className="food-orbit food-orbit--one"/><div className="food-orbit food-orbit--two"/><div className="food-sun"/></>}
    {theme === 'kebab' && <TilePattern />}
    {theme === 'grill' && <><div className="food-grate"/>{Array.from({ length: 14 }, (_, i) => <i className="food-ember" key={i} style={{ left:`${(i*37)%100}%`, '--drift':`${(i%3-1)*36}px`, animationDelay:`${-i*.81}s`, animationDuration:`${6+i%5}s` }}/>)}</>}
  </div>
}

const COPY = {
  doner: { overline: 'DÖNER · DÜRÜM · İSKENDER', title: 'Döner zamanı.', word: 'DÖNER', subtitle: 'Menüyü keşfet, favorini seç.' },
  kebab: { overline: 'KEBAP · MEZE · SOFRA', title: 'Sofraya buyurun.', word: 'OCAKBAŞI', subtitle: 'Paylaşılacak bir sofra, seçilecek çok lezzet.' },
  grill: { overline: 'IZGARA · KÖFTE · ET', title: 'Ateşin menüsü.', word: 'IZGARA', subtitle: 'Izgaradan sofrana. Seçim senin.' },
}

export function RestaurantHero({ T, profile, tableLabel }) {
  const node = useRef(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    let visible = true
    const update = () => setPaused(document.hidden || !visible)
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() }) : null
    if (node.current) observer?.observe(node.current)
    document.addEventListener('visibilitychange', update)
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [])
  const copy = COPY[T.foodTheme]
  return <header ref={node} className={`food-hero food-hero--${T.foodTheme}`} data-paused={paused}>
    <Atmosphere theme={T.foodTheme}/>
    <div className="food-hero-top"><span className="food-brand">{profile.logo ? <img src={profile.logo} alt=""/> : <UtensilsCrossed size={20}/>} {profile.name || 'Menümüz'}</span><span className="food-table">{tableLabel}</span></div>
    <div className="food-hero-body">
      <p className="food-eyebrow">{copy.overline}</p>
      <h1>{profile.tagline || copy.title}</h1>
      <p className="food-hero-sub">{copy.subtitle}</p>
      {profile.cover ? <div className="food-hero-image"><ProductImage src={profile.cover} alt="" className="w-full h-full object-cover" /></div> : <div className="food-seal" aria-hidden="true"><Flame/><span>{copy.word}</span><span className="food-seal-line"/></div>}
    </div>
    <div className="food-hero-bottom"><span>MENÜYÜ KEŞFET <span aria-hidden="true">↓</span></span>{profile.wifi ? <span><Wifi size={13}/> {profile.wifi}</span> : <span>AFİYET OLSUN</span>}</div>
  </header>
}

export function RestaurantCard({ p, idx, T, t, trName, trDesc, onOpen, badge, accent }) {
  const isChef = !!p.chef
  const b = badge ? badge(p) : { chef: isChef, best: false, combo: !!p.comboItems?.length }
  const chefLabel = t ? t('chef') : 'Şefin Önerisi'
  const comboLabel = t ? t('combo') : 'Kampanya'
  const bestLabel = t ? t('bestseller') : 'Çok Satan'

  return (
    <button type="button" className={`food-card food-card--${T.foodTheme} anim-card`} disabled={!p.available} onClick={() => onOpen(p)}>
      <span className="food-card-image">
        {p.image ? (
          <ProductImage src={p.image} alt="" className="w-full h-full object-cover"/>
        ) : (
          <span className="food-card-placeholder"><UtensilsCrossed size={32}/></span>
        )}
        {(b.chef || b.combo || b.best) && (
          <span className="food-card-badges">
            {b.chef && (
              <span className="food-card-badge food-card-badge--chef">
                <ChefHat size={11} strokeWidth={2.5}/> {chefLabel}
              </span>
            )}
            {b.combo && (
              <span className="food-card-badge food-card-badge--combo">
                <Tag size={10} strokeWidth={2.5}/> {comboLabel}
              </span>
            )}
            {b.best && !b.chef && (
              <span className="food-card-badge food-card-badge--best">
                <Flame size={10} strokeWidth={2.5}/> {bestLabel}
              </span>
            )}
          </span>
        )}
        {!p.available && <span className="food-soldout">{t ? t('soldout') : 'Tükendi'}</span>}
      </span>
      <span className="food-card-copy">
        <span className="food-card-number">
          {String(idx+1).padStart(2,'0')} / {T.foodTheme === 'kebab' ? 'SOFRADAN' : 'MENÜDEN'}
        </span>
        <span className="food-card-name">
          {trName(p)}
          {b.chef && (
            <span className="food-card-inline-chef" title={chefLabel}>
              <ChefHat size={11} strokeWidth={2.5} style={{ verticalAlign: '-1px' }} /> {chefLabel}
            </span>
          )}
        </span>
        {trDesc(p) && <span className="food-card-description">{trDesc(p)}</span>}
        <span className="food-card-bottom">
          <span>{money(p.price)}{p.variants?.length ? ' +' : ''}</span>
          <span className="food-card-action" aria-hidden="true"><ArrowUpRight size={18}/></span>
        </span>
      </span>
    </button>
  )
}
