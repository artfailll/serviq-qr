import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, BookOpen, BarChart3, UtensilsCrossed, Monitor, Settings, LogOut, Volume2, VolumeX } from 'lucide-react'
import { DemoBadge } from '../components/ui'
import TableMap from '../components/admin/TableMap'
import MenuManager from '../components/admin/MenuManager'
import Stats from '../components/admin/Stats'
import ProfileEditor from '../components/admin/ProfileEditor'
import AdminLogin, { useAdminAuthState } from './AdminLogin'
import { playNewOrder, primeAudio, useSoundPref, setSoundPref } from '../lib/sound'

const TABS = [
  { key: 'tables', label: 'Masa Haritası', icon: LayoutGrid },
  { key: 'menu', label: 'Menü Yönetimi', icon: BookOpen },
  { key: 'stats', label: 'İstatistikler', icon: BarChart3 },
  { key: 'profile', label: 'İşletme Profili', icon: Settings },
]

const HEADERS = {
  tables:  { t: 'Masa Haritası',    s: 'Kuş bakışı masa durumu, süre takibi, birleştir & taşı' },
  menu:    { t: 'Menü Yönetimi',    s: 'Ürün ekle, fiyat güncelle, stok durumu' },
  stats:   { t: 'İstatistikler',    s: 'Ciro, en çok satanlar ve gün sonu Z raporu' },
  profile: { t: 'İşletme Profili',  s: 'İsim, kapak, logo, renk — müşteri ekranında görünür' },
}

export default function Admin() {
  const [tab, setTab] = useState('tables')
  const [justAuthed, setJustAuthed] = useState(false)
  const status = useAdminAuthState()
  const soundOn = useSoundPref()

  function enableSound() {
    primeAudio()
    setSoundPref(true)
    playNewOrder()
  }

  // Config yüklenene kadar paneli AÇMA — yanlış işletme için bir an açılıp
  // render yarışına girmesini (boş ekran hatası) bu engelliyor.
  if (status === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-100">
        <div className="h-10 w-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    )
  }

  const unlocked = status === 'open' || status === 'authed' || justAuthed
  if (!unlocked) {
    return <AdminLogin onSuccess={() => setJustAuthed(true)} />
  }

  const h = HEADERS[tab]

  function logout() {
    try { sessionStorage.clear() } catch {}
    setJustAuthed(false)
  }

  return (
    <div className="min-h-screen bg-ink-100">
      <div className="lg:flex">
        <aside className="lg:fixed lg:inset-y-0 lg:w-64 bg-ink-900 text-white flex lg:flex-col z-30">
          <div className="flex items-center gap-2.5 px-5 py-4 lg:py-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white shadow-glow">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div className="hidden lg:block">
              <p className="font-display font-extrabold leading-tight">serviq</p>
              <p className="text-xs text-ink-400 leading-tight">Yönetim Paneli</p>
            </div>
          </div>

          <nav className="flex lg:flex-col gap-1 px-2 lg:px-3 lg:mt-4 grow overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200 cursor-pointer
                  ${tab === t.key ? 'bg-brand-500 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}
              >
                <t.icon className="h-5 w-5 shrink-0" />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex flex-col gap-2 p-3">
            <Link to="/kasa" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-300 hover:bg-white/5 hover:text-white transition-colors">
              <Monitor className="h-5 w-5" />
              Kasa Ekranı
            </Link>
            <Link to="/garson" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-300 hover:bg-white/5 hover:text-white transition-colors">
              <UtensilsCrossed className="h-5 w-5" />
              Garson Ekranı
            </Link>
            {soundOn ? (
              <button onClick={() => setSoundPref(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-green-400 hover:bg-white/5 transition-colors cursor-pointer" title="Bildirim sesini kapat">
                <Volume2 className="h-5 w-5" />
                Bildirim Sesi Açık
              </button>
            ) : (
              <button onClick={enableSound} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer" title="Yeni sipariş/çağrı için sesi aç">
                <VolumeX className="h-5 w-5" />
                Bildirim Sesini Aç
              </button>
            )}
            <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-400 hover:bg-white/5 hover:text-red-400 transition-colors cursor-pointer">
              <LogOut className="h-5 w-5" />
              Çıkış Yap
            </button>
            <div className="px-3"><DemoBadge /></div>
          </div>
        </aside>

        <main className="lg:pl-64 grow">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            <div className="mb-6">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900">{h.t}</h1>
              <p className="mt-1 text-ink-500">{h.s}</p>
            </div>
            {tab === 'tables'  && <TableMap />}
            {tab === 'menu'    && <MenuManager />}
            {tab === 'stats'   && <Stats />}
            {tab === 'profile' && <ProfileEditor />}
          </div>
        </main>
      </div>
    </div>
  )
}
