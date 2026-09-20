import { useEffect, useRef, useState } from 'react'
import { tableUrl } from '../../lib/tableQr'

export default function NfcSetup({ bizId, tables, profile }) {
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const controller = useRef(null)
  const table = tables.find(t => t.id === selected) || tables[0]
  const url = table ? tableUrl(bizId, table.no) : ''
  const supported = typeof window !== 'undefined' && 'NDEFReader' in window && window.isSecureContext
  useEffect(() => () => controller.current?.abort(), [])

  async function operate(verify) {
    if (controller.current || !url || !supported) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setMessage(verify ? 'Kontrol etmek için etiketi telefona yaklaştırın…' : 'Yazmak için boş NFC etiketini telefona yaklaştırın…')
    const timer = setTimeout(() => abort.abort(), 20000)
    try {
      const reader = new window.NDEFReader()
      if (verify) {
        await new Promise((resolve, reject) => {
          abort.signal.addEventListener('abort', () => reject(new Error('İşlem iptal edildi veya süre doldu.')), { once: true })
          reader.onreadingerror = () => reject(new Error('Etiket okunamadı. Tekrar yaklaştırın.'))
          reader.onreading = event => {
            const match = event.message.records.some(record => record.recordType === 'url' && new TextDecoder().decode(record.data) === url)
            if (match) resolve()
            else reject(new Error('Bu etiket farklı bir işletme veya masaya ait.'))
          }
          reader.scan({ signal: abort.signal }).catch(reject)
        })
        setMessage(`Doğrulandı: ${profile.name} · ${table.name || `Masa ${table.no}`}`)
      } else {
        await reader.write({ records: [{ recordType: 'url', data: url }] }, { signal: abort.signal, overwrite })
        setMessage('Etiket yazıldı. Şimdi “Etiketi doğrula” ile işletme ve masa eşleşmesini kontrol edin.')
      }
    } catch (error) {
      setMessage(error.name === 'NotAllowedError' ? 'NFC izni verilmedi. Tarayıcı iznini ve telefonun NFC ayarını kontrol edin.' : error.message || 'NFC işlemi tamamlanamadı.')
    } finally {
      clearTimeout(timer)
      abort.abort()
      controller.current = null
      setBusy(false)
    }
  }

  return <section className="card p-5 mb-5" aria-label="NFC masa tanımlama">
    <h3 className="font-bold text-lg">NFC masa tanımlama</h3>
    <p className="text-sm text-ink-500 mt-1">QR ve NFC aynı işletme/masa adresini açar. Etiketlere yönetim şifresi yazılmaz.</p>
    <div className="flex flex-wrap items-center gap-3 mt-4">
      <select aria-label="NFC için masa" className="inp max-w-xs" value={table?.id || ''} disabled={busy} onChange={e => { setSelected(e.target.value); setMessage('') }}>
        {tables.map(t => <option key={t.id} value={t.id}>{t.name || `Masa ${t.no}`}</option>)}
      </select>
      <button className="btn-outline" disabled={!url || busy} onClick={async () => {
        try { await navigator.clipboard.writeText(url); setMessage('Masa bağlantısı kopyalandı.') }
        catch { setMessage('Kopyalama desteklenmiyor; aşağıdaki adresi seçip kopyalayın.') }
      }}>Bağlantıyı kopyala</button>
      {supported && <><button className="btn-primary" disabled={busy || !url} onClick={() => operate(false)}>NFC etikete yaz</button><button className="btn-outline" disabled={busy || !url} onClick={() => operate(true)}>Etiketi doğrula</button></>}
      {busy && <button className="btn-outline" onClick={() => controller.current?.abort()}>İptal</button>}
    </div>
    <input aria-label="NFC masa bağlantısı" className="inp mt-3" readOnly value={url} onFocus={e => e.target.select()} />
    {supported ? <label className="flex gap-2 mt-3 text-sm"><input type="checkbox" checked={overwrite} disabled={busy} onChange={e => setOverwrite(e.target.checked)} />Dolu etiketteki mevcut bağlantıyı değiştirmeye izin ver</label> : <p className="text-sm text-ink-500 mt-3">Bu tarayıcı NFC yazmayı desteklemiyor. NFC destekli Android cihazda Chrome kullanın veya bu adresi telefonunuzdaki NFC yazma uygulamasında URL kaydı olarak yazın.</p>}
    <p className="text-sm mt-3" role="status">{message}</p>
  </section>
}
