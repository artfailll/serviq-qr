import { useEffect, useState } from 'react'
import { IS_DEMO, subscribeConnection } from '../lib/db'

export default function ConnectionStatus() {
  const [connected, setConnected] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => subscribeConnection(setConnected), [])
  useEffect(() => {
    const fail = () => setFailed(true)
    window.addEventListener('serviq:data-error', fail)
    return () => window.removeEventListener('serviq:data-error', fail)
  }, [])
  if (connected && !failed) return null
  return <div role="status" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '10px 16px', background: '#fff3cd', color: '#664d03', textAlign: 'center', fontSize: 13 }}>
    {IS_DEMO ? 'YEREL DEMO — Siparişler diğer cihazlara gitmez.' : failed ? 'Veri erişim hatası. Değişiklikler doğrulanamadı; bağlantıyı kontrol edip sayfayı yenileyin.' : 'Sunucu bağlantısı bekleniyor. Sipariş onayı gelmeden bu sayfayı kapatmayın.'}
  </div>
}
