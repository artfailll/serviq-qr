import { useEffect, useState } from 'react'
import { Printer, Save } from 'lucide-react'
import { Modal } from '../ui'
import { updateProfile } from '../../lib/store'
import { QR_PRINT_THEMES, getQrPrintTheme, createQrPrintDocument, qrThemeIllustration } from '../../lib/qrPrintTemplates'

export default function QrPrintStudio({open,onClose,bizId,tables,profile}) {
  const [themeId,setThemeId]=useState(getQrPrintTheme(profile.qrPrintTheme).id)
  const [tableId,setTableId]=useState('all')
  const [preview,setPreview]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const table=tables.find(t=>t.id===tableId) || tables[0]
  useEffect(()=>{if(open){setThemeId(getQrPrintTheme(profile.qrPrintTheme).id);setMessage('');setError('')}},[open])
  useEffect(()=>{
    if(!open || !table) return
    let active=true
    setPreview('')
    createQrPrintDocument({bizId,tables:[table],profile,themeId,origin:window.location.origin,preview:true}).then(html=>{if(active)setPreview(html)}).catch(()=>{if(active)setError('Önizleme hazırlanamadı.')})
    return ()=>{active=false}
  },[open,bizId,table?.id,table?.no,table?.name,profile.name,themeId])
  async function print(){
    if(busy || !table) return
    setError('')
    const win=window.open('','_blank')
    if(!win){setError('Yazdırmak için açılır pencerelere izin verin.');return}
    win.opener=null
    setBusy(true)
    try {
      const html=await createQrPrintDocument({bizId,tables:tableId==='all'?tables:[table],profile,themeId,origin:window.location.origin})
      win.document.write(html);win.document.close()
    } catch {win.close();setError('QR dosyası hazırlanamadı. Tekrar deneyin.')}
    finally {setBusy(false)}
  }
  async function save(){
    setBusy(true);setError('');setMessage('')
    try{await updateProfile(bizId,{qrPrintTheme:themeId});setMessage('Bu işletmenin QR baskı şablonu kaydedildi.')}
    catch{setError('Şablon kaydedilemedi. Bağlantınızı kontrol edin.')}
    finally{setBusy(false)}
  }
  return <Modal open={open} onClose={()=>{if(!busy)onClose()}} title="Firma isimli QR tasarımları" maxW="max-w-4xl">
    <p className="text-sm text-ink-500 mb-4">Baskı tasarımı menü temasından bağımsızdır. Firma adı QR’ın içinde ve kartın üzerinde yer alır.</p>
    <div className="grid md:grid-cols-[1fr_350px] gap-5">
      <div className="space-y-3">
        {QR_PRINT_THEMES.map(t=><button key={t.id} type="button" aria-pressed={themeId===t.id} disabled={busy} onClick={()=>{setThemeId(t.id);setMessage('')}} className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${themeId===t.id?'border-brand-500 bg-brand-50':'border-ink-100 hover:border-ink-300'}`}>
          <span className="w-14 h-12 shrink-0 rounded-lg p-1 [&>svg]:w-full [&>svg]:h-full" style={{background:t.bg,color:t.ink}} dangerouslySetInnerHTML={{__html:qrThemeIllustration(t.shape)}}/>
          <span><span className="font-bold block">{t.name}</span><span className="text-xs text-ink-500">{t.description} · {t.font}</span></span><span className="ml-auto" aria-hidden="true">{themeId===t.id?'✓':''}</span>
        </button>)}
        <label className="block text-sm font-semibold">Yazdırılacak masalar<select className="inp mt-2" value={tableId} disabled={busy} onChange={e=>setTableId(e.target.value)}><option value="all">Tüm masalar ({tables.length})</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name || `Masa ${t.no}`}</option>)}</select></label>
        <button className="btn-outline w-full" onClick={save} disabled={busy}><Save size={16}/> İşletmenin varsayılanı yap</button>
      </div>
      <div className="min-w-0">
        <div className="rounded-2xl bg-ink-100 p-3 overflow-auto">
          {preview?<iframe title="QR baskı önizlemesi" sandbox="allow-same-origin" srcDoc={preview} style={{width:326,height:474,border:0,display:'block',margin:'0 auto',pointerEvents:'none'}}/>:<p role="status" className="py-20 text-center">{table?'Önizleme hazırlanıyor…':'Önce masa ekleyin.'}</p>}
        </div>
        <p className="text-xs text-ink-500 mt-3 leading-relaxed">86 × 125 mm · A4’te 4 kart. Renkli çerçeve ve çizimler QR alanına dokunmaz. Yazdırdıktan sonra telefonla okutmayı unutmayın.</p>
        <button className="btn-primary w-full mt-4" onClick={print} disabled={busy || !table}><Printer size={17}/>{busy?'Hazırlanıyor…':'Seçili tasarımı yazdır / PDF'}</button>
      </div>
    </div>
    {message&&<p role="status" className="text-green-700 mt-3">{message}</p>}{error&&<p role="alert" className="text-red-700 mt-3">{error}</p>}
  </Modal>
}
