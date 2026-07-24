import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// Bir alt bileşen render sırasında hata fırlatırsa tüm ekranı karartmak
// yerine kullanıcıya anlaşılır bir "tekrar dene" ekranı gösterir.
// (React'te hata sınırları yalnızca class bileşenlerle kurulabilir.)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Geliştirme için konsola yaz; üretimde sessizce yutulur
    console.error('Yakalanan render hatası:', error, info)
  }

  reset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] grid place-items-center p-6">
          <div className="card p-8 max-w-sm text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600 mx-auto mb-4">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="font-display text-lg font-extrabold text-ink-900">
              Bir şeyler ters gitti
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Ekran yüklenirken küçük bir sorun oldu. Tekrar deneyin — verileriniz güvende.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={this.reset} className="btn-primary w-full">
                <RotateCcw className="h-4 w-4" /> Tekrar Dene
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-ghost w-full text-sm"
              >
                Sayfayı Yenile
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
