import { useEffect, useState, useRef, useCallback } from 'react'
import { Delete, CornerDownLeft, X, Keyboard, Hash, Check } from 'lucide-react'
import { isTouchComputer } from '../lib/touchDevice'

// React onChange tetikleyicisi
function setNativeInputValue(element, nextValue, cursorOffset = null) {
  if (!element) return

  if (element.maxLength && element.maxLength > 0) {
    nextValue = nextValue.slice(0, element.maxLength)
  }

  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set
  const prototype = Object.getPrototypeOf(element)
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, nextValue)
  } else if (valueSetter) {
    valueSetter.call(element, nextValue)
  } else {
    element.value = nextValue
  }

  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))

  if (cursorOffset !== null && typeof element.setSelectionRange === 'function') {
    try {
      element.setSelectionRange(cursorOffset, cursorOffset)
    } catch {}
  }
}

function isNumericTarget(target) {
  if (!target) return false
  const type = (target.type || '').toLowerCase()
  const inputMode = (target.inputMode || '').toLowerCase()
  const name = (target.name || '').toLowerCase()
  const placeholder = (target.placeholder || '').toLowerCase()
  const id = (target.id || '').toLowerCase()

  if (type === 'number' || type === 'tel') return true
  if (inputMode === 'numeric' || inputMode === 'decimal' || inputMode === 'tel') return true
  if (name.includes('pin') || id.includes('pin') || placeholder.includes('pin')) return true
  if (name.includes('phone') || name.includes('telefon') || placeholder.includes('telefon')) return true
  if (name.includes('fiyat') || name.includes('price') || placeholder.includes('tutar') || placeholder.includes('fiyat')) return true
  if (name.includes('qty') || name.includes('adet') || name.includes('miktar') || placeholder.includes('adet')) return true
  return false
}

// Türkçe QWERTY Tuş Dizilimi
const TURKISH_QWERTY_LOWER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç'],
]

const TURKISH_QWERTY_UPPER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç'],
]

export default function TouchKeyboard() {
  const [visible, setVisible] = useState(false)
  const [activeTarget, setActiveTarget] = useState(null)
  const [currentValue, setCurrentValue] = useState('')
  const [mode, setMode] = useState('text') // 'text' | 'numpad'
  const [shift, setShift] = useState(false)

  const keyboardRef = useRef(null)
  const lastTouchTimeRef = useRef(0)
  const lastPointerTypeRef = useRef('mouse')

  // Global dokunmatik / pointer dinleyicileri
  useEffect(() => {
    // Yalnızca dokunmatik BİLGİSAYARLARDA dinle (tablet/telefonlar hariç)
    if (!isTouchComputer()) return

    function onPointerDown(e) {
      lastPointerTypeRef.current = e.pointerType || 'mouse'
      if (e.pointerType === 'touch') {
        lastTouchTimeRef.current = Date.now()
      }
    }

    function onTouchStart() {
      lastPointerTypeRef.current = 'touch'
      lastTouchTimeRef.current = Date.now()
    }

    function onFocusIn(e) {
      const target = e.target
      if (!target || target.nodeType !== 1) return

      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (!isInput) return

      const type = (target.getAttribute('type') || '').toLowerCase()
      if (['checkbox', 'radio', 'file', 'submit', 'button', 'image', 'range', 'color'].includes(type)) return
      if (target.readOnly || target.disabled) return

      // SADECE VE SADECE DOKUNMATİK İLE TIKLANMIŞSA AÇ
      // Fare ile tıklanmışsa kesinlikle açılmaz!
      const isTouch = lastPointerTypeRef.current === 'touch' || (Date.now() - lastTouchTimeRef.current < 800)
      if (!isTouch) {
        return
      }

      setActiveTarget(target)
      setCurrentValue(target.value || '')
      const isNum = isNumericTarget(target)
      setMode(isNum ? 'numpad' : 'text')
      setShift(false)
      setVisible(true)

      // Giriş alanını görünür alana kaydır
      setTimeout(() => {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } catch {}
      }, 150)
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('focusin', onFocusIn, true)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('touchstart', onTouchStart, { capture: true })
      document.removeEventListener('focusin', onFocusIn, true)
    }
  }, [])

  // Aktif alanın içeriği dışarıdan değişirse önizlemeyi senkron tut
  useEffect(() => {
    if (!visible || !activeTarget) return

    function syncValue() {
      if (activeTarget) setCurrentValue(activeTarget.value || '')
    }

    activeTarget.addEventListener('input', syncValue)
    activeTarget.addEventListener('change', syncValue)
    return () => {
      activeTarget.removeEventListener('input', syncValue)
      activeTarget.removeEventListener('change', syncValue)
    }
  }, [visible, activeTarget])

  const handleChar = useCallback((char) => {
    if (!activeTarget) return
    const curVal = activeTarget.value || ''
    const start = activeTarget.selectionStart ?? curVal.length
    const end = activeTarget.selectionEnd ?? curVal.length

    const nextVal = curVal.slice(0, start) + char + curVal.slice(end)
    const nextOffset = start + char.length

    setNativeInputValue(activeTarget, nextVal, nextOffset)
    setCurrentValue(nextVal)

    // Shift bir tuşa basıldıktan sonra otomatik küçük harfe döner
    if (shift) setShift(false)
  }, [activeTarget, shift])

  const handleBackspace = useCallback(() => {
    if (!activeTarget) return
    const curVal = activeTarget.value || ''
    const start = activeTarget.selectionStart ?? curVal.length
    const end = activeTarget.selectionEnd ?? curVal.length

    if (start !== end) {
      const nextVal = curVal.slice(0, start) + curVal.slice(end)
      setNativeInputValue(activeTarget, nextVal, start)
      setCurrentValue(nextVal)
    } else if (start > 0) {
      const nextVal = curVal.slice(0, start - 1) + curVal.slice(end)
      setNativeInputValue(activeTarget, nextVal, start - 1)
      setCurrentValue(nextVal)
    }
  }, [activeTarget])

  const handleClear = useCallback(() => {
    if (!activeTarget) return
    setNativeInputValue(activeTarget, '', 0)
    setCurrentValue('')
  }, [activeTarget])

  const handleEnter = useCallback(() => {
    if (!activeTarget) return
    try {
      if (typeof window !== 'undefined' && window.KeyboardEvent) {
        activeTarget.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
        activeTarget.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
      }
      if (activeTarget.form) {
        if (typeof activeTarget.form.requestSubmit === 'function') {
          activeTarget.form.requestSubmit()
        } else {
          activeTarget.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
        }
      }
    } catch {}
    setVisible(false)
  }, [activeTarget])

  const handleClose = useCallback(() => {
    setVisible(false)
  }, [])

  if (!visible) return null

  const rows = shift ? TURKISH_QWERTY_UPPER : TURKISH_QWERTY_LOWER
  const fieldName = activeTarget?.getAttribute('placeholder') || activeTarget?.getAttribute('name') || 'Giriş Alanı'

  return (
    <div
      ref={keyboardRef}
      role="dialog"
      aria-label="Dokunmatik Ekran Klavyesi"
      className="fixed bottom-0 inset-x-0 z-[99999] bg-ink-950/95 backdrop-blur-xl border-t-2 border-brand-500/40 shadow-[0_-10px_35px_rgba(0,0,0,0.5)] select-none text-white animate-in slide-in-from-bottom duration-200"
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Üst Bar: Aktif alan bilgisi ve önizleme */}
      <div className="flex items-center justify-between px-3 py-2 bg-ink-900/80 border-b border-ink-800 text-sm">
        <div className="flex items-center gap-2 max-w-[70%] truncate">
          <span className="flex items-center gap-1 text-brand-400 font-semibold text-xs px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
            {mode === 'numpad' ? <Hash className="h-3.5 w-3.5" /> : <Keyboard className="h-3.5 w-3.5" />}
            {mode === 'numpad' ? 'Sayı Tuşları' : 'Klavye'}
          </span>
          <span className="text-ink-400 text-xs truncate">{fieldName}:</span>
          <span className="font-mono text-white font-bold truncate">
            {currentValue ? (
              activeTarget?.type === 'password' ? '•'.repeat(currentValue.length) : currentValue
            ) : (
              <span className="text-ink-500 italic text-xs">boş</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMode(mode === 'numpad' ? 'text' : 'numpad')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-200 flex items-center gap-1 transition-colors"
          >
            {mode === 'numpad' ? <Keyboard className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
            {mode === 'numpad' ? 'Harfler' : 'Sayılar'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
            title="Klavyeyi Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Klavye Gövdesi */}
      <div className="p-2 sm:p-3 max-w-4xl mx-auto">
        {mode === 'numpad' ? (
          /* NUMPAD MODU: Büyük, dokunmatik dostu POS tuşları */
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5 max-w-md mx-auto">
            {['1', '2', '3'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleChar(k)}
                className="h-14 sm:h-16 text-2xl font-bold bg-ink-800 hover:bg-ink-700 active:bg-brand-600 active:scale-95 rounded-xl border border-ink-700 text-white shadow transition-all flex items-center justify-center"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 sm:h-16 bg-red-600/30 hover:bg-red-600/40 active:bg-red-600 active:scale-95 rounded-xl border border-red-500/40 text-red-200 font-bold flex items-center justify-center shadow transition-all"
              title="Sil"
            >
              <Delete className="h-6 w-6" />
            </button>

            {['4', '5', '6'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleChar(k)}
                className="h-14 sm:h-16 text-2xl font-bold bg-ink-800 hover:bg-ink-700 active:bg-brand-600 active:scale-95 rounded-xl border border-ink-700 text-white shadow transition-all flex items-center justify-center"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 sm:h-16 bg-ink-800 hover:bg-ink-700 active:bg-ink-600 active:scale-95 rounded-xl border border-ink-700 text-ink-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center shadow transition-all"
            >
              Temizle
            </button>

            {['7', '8', '9'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleChar(k)}
                className="h-14 sm:h-16 text-2xl font-bold bg-ink-800 hover:bg-ink-700 active:bg-brand-600 active:scale-95 rounded-xl border border-ink-700 text-white shadow transition-all flex items-center justify-center"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleChar('.')}
              className="h-14 sm:h-16 text-2xl font-bold bg-ink-800 hover:bg-ink-700 active:bg-brand-600 active:scale-95 rounded-xl border border-ink-700 text-white shadow transition-all flex items-center justify-center"
            >
              .
            </button>

            <button
              type="button"
              onClick={() => handleChar('00')}
              className="h-14 sm:h-16 text-lg font-bold bg-ink-800 hover:bg-ink-700 active:bg-brand-600 active:scale-95 rounded-xl border border-ink-700 text-ink-200 shadow transition-all flex items-center justify-center"
            >
              00
            </button>
            <button
              type="button"
              onClick={() => handleChar('0')}
              className="h-14 sm:h-16 text-2xl font-bold bg-ink-800 hover:bg-ink-700 active:bg-brand-600 active:scale-95 rounded-xl border border-ink-700 text-white shadow transition-all flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleEnter}
              className="col-span-2 h-14 sm:h-16 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 active:scale-95 rounded-xl font-bold text-lg text-white shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Check className="h-5 w-5" />
              <span>Tamam</span>
            </button>
          </div>
        ) : (
          /* QWERTY TÜRKÇE HARF MODU */
          <div className="space-y-1.5 sm:space-y-2">
            {rows.map((row, rIdx) => (
              <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
                {rIdx === 3 && (
                  <button
                    type="button"
                    onClick={() => setShift(!shift)}
                    className={`h-11 sm:h-12 px-3 sm:px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center ${
                      shift ? 'bg-brand-600 text-white shadow-brand-500/30' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
                    }`}
                  >
                    ⇧
                  </button>
                )}

                {row.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleChar(k)}
                    className="flex-1 max-w-[42px] sm:max-w-[48px] h-11 sm:h-12 bg-ink-800 hover:bg-ink-700 active:bg-brand-600 active:scale-95 rounded-lg border border-ink-700/60 font-semibold text-base sm:text-lg text-white shadow transition-all flex items-center justify-center"
                  >
                    {k}
                  </button>
                ))}

                {rIdx === 3 && (
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-11 sm:h-12 px-3 sm:px-4 bg-red-600/30 hover:bg-red-600/40 active:bg-red-600 rounded-lg border border-red-500/40 text-red-200 font-bold transition-all flex items-center justify-center"
                    title="Sil"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}

            {/* Alt İşlem Çubuğu: Boşluk, Temizle, Tamam */}
            <div className="flex justify-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setMode('numpad')}
                className="h-11 px-3 sm:px-4 rounded-lg bg-ink-800 hover:bg-ink-700 active:bg-ink-600 font-bold text-xs text-ink-300 border border-ink-700 flex items-center gap-1"
              >
                <Hash className="h-3.5 w-3.5" />
                <span>123</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="h-11 px-3 rounded-lg bg-ink-800 hover:bg-ink-700 active:bg-ink-600 font-bold text-xs text-ink-300 border border-ink-700"
              >
                Temizle
              </button>

              <button
                type="button"
                onClick={() => handleChar(' ')}
                className="flex-[3] max-w-sm h-11 bg-ink-800 hover:bg-ink-700 active:bg-brand-600 rounded-lg border border-ink-700 font-semibold text-xs text-ink-200 tracking-wider uppercase flex items-center justify-center gap-1 transition-all"
              >
                Boşluk (Space)
              </button>

              <button
                type="button"
                onClick={handleEnter}
                className="h-11 px-4 sm:px-6 rounded-lg bg-brand-600 hover:bg-brand-500 active:bg-brand-700 font-bold text-sm text-white shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all"
              >
                <CornerDownLeft className="h-4 w-4" />
                <span>Tamam</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
