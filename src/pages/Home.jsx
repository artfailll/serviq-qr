import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  QrCode,
  Smartphone,
  Monitor,
  LayoutDashboard,
  ArrowRight,
  UtensilsCrossed,
} from 'lucide-react'
import { DemoBadge } from '../components/ui'
import { IS_DEMO } from '../lib/db'

const roles = [
  {
    to: '/menu?masa=5',
    icon: Smartphone,
    title: 'Müşteri Ekranı',
    desc: 'QR ile açılan mobil menü. Sipariş ver, garson çağır, hesap iste.',
    tag: 'Telefon',
  },
  {
    to: '/kasa',
    icon: Monitor,
    title: 'Kasa Ekranı',
    desc: 'Gelen siparişler anlık düşer, ses uyarısı ve durum takibi.',
    tag: 'Tablet / PC',
  },
  {
    to: '/yonetim',
    icon: LayoutDashboard,
    title: 'Yönetim Paneli',
    desc: 'Masa haritası, menü yönetimi, ciro ve Z raporu.',
    tag: 'Masaüstü',
  },
]

export default function Home() {
  const nav = useNavigate()
  const [masa, setMasa] = useState(5)

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Arka plan dekoru */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-16">
        {/* Üst bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white shadow-glow">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight">serviq</span>
          </div>
          <DemoBadge />
        </header>

        {/* Hero */}
        <section className="mt-14 sm:mt-20 max-w-2xl">
          <span className="chip bg-brand-100 text-brand-700">
            <QrCode className="h-3.5 w-3.5" />
            QR Restoran Sipariş Sistemi
          </span>
          <h1 className="mt-5 font-display text-4xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight text-ink-900">
            Masadan kasaya,
            <span className="bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-transparent">
              {' '}
              anlık sipariş.
            </span>
          </h1>
          <p className="mt-5 text-lg text-ink-600 leading-relaxed">
            Müşteri telefonundan sipariş verir, kasa ekranı başka cihazda saniyesinde görür.
            Online ödeme yok — sistem yalnızca siparişi mutfağa iletir.
          </p>

          {/* Hızlı masa seçici */}
          <div className="mt-8 card p-2 flex items-center gap-2 max-w-md">
            <div className="flex items-center gap-2 pl-3 text-ink-500">
              <QrCode className="h-5 w-5" />
              <span className="text-sm font-medium">Masa</span>
            </div>
            <input
              type="number"
              min="1"
              value={masa}
              onChange={(e) => setMasa(e.target.value)}
              aria-label="Masa numarası"
              className="w-16 rounded-lg border border-ink-200 px-3 py-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              onClick={() => nav(`/menu?masa=${masa || 1}`)}
              className="btn-primary grow"
            >
              Menüyü Aç
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Üç rol kartı */}
        <section className="mt-16 grid gap-5 sm:grid-cols-3">
          {roles.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="group card p-6 hover:shadow-glow hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-200">
                  <r.icon className="h-6 w-6" />
                </div>
                <span className="chip bg-ink-100 text-ink-500">{r.tag}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{r.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">{r.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                Aç
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </section>

        {IS_DEMO && (
          <p className="mt-10 text-center text-sm text-ink-400 max-w-xl mx-auto">
            Demo modundasınız: veriler bu tarayıcıda saklanır ve sekmeler arası anlık
            senkronlanır. Gerçek cihazlar arası senkron için <code className="text-ink-600">.env</code>{' '}
            dosyasına Firebase bilgilerini girin.
          </p>
        )}
      </div>
    </div>
  )
}
