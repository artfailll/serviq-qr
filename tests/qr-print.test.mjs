import test from 'node:test'
import assert from 'node:assert/strict'
import { QR_PRINT_THEMES, getQrPrintTheme, createQrPrintDocument } from '../src/lib/qrPrintTemplates.js'
import { existsSync } from 'node:fs'

test('five distinct sector QR themes have self-hosted fonts',()=>{
  assert.equal(QR_PRINT_THEMES.length,5)
  assert.equal(new Set(QR_PRINT_THEMES.map(t=>t.font)).size,5)
  for(const t of QR_PRINT_THEMES) assert(existsSync(`public/fonts/qr/${t.file}.ttf`))
  assert.equal(getQrPrintTheme('unknown').id,'kebap')
})
test('all print themes escape names, keep branded QR, and support print layout',async()=>{
  for(const theme of QR_PRINT_THEMES){
    const html=await createQrPrintDocument({bizId:'cafe-qa',tables:[{no:5,name:'Teras & Bahçe'}],profile:{name:'Çınar & Oğulları'},themeId:theme.id})
    assert(html.includes(`data-qr-theme="${theme.id}"`))
    assert(html.includes('Çınar &amp; Oğulları'))
    assert(html.includes('Teras &amp; Bahçe'))
    assert.equal((html.match(/class="qr-card qr-card--/g)||[]).length,1)
    assert(html.includes('document.fonts.ready'))
    assert(html.includes('@page{size:A4'))
    assert(!html.includes('fonts.googleapis.com'))
  }
})
test('saved business print theme is used by installer; preview has no print scripts',async()=>{
  const html=await createQrPrintDocument({bizId:'cafe-qa',tables:[{no:1},{no:2}],profile:{name:'Şekerci',qrPrintTheme:'tatli'},preview:true})
  assert.equal((html.match(/data-qr-theme="tatli"/g)||[]).length,2)
  assert(!html.includes('onclick='))
})
