// Local, read-only visual/QR checks. No Firebase writes or real business records.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import http from 'node:http'
import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { QR_PRINT_THEMES, createQrPrintDocument, qrPrintStyles, qrPrintCard } from '../src/lib/qrPrintTemplates.js'
import { brandedTableQR } from '../src/lib/tableQr.js'
fs.mkdirSync('outputs/qr-print',{recursive:true})
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>QR QA</title>');return}
  const file=/^\/fonts\/qr\/[a-z]+\.ttf$/.test(req.url)?`public${req.url}`:null
  if(file && fs.existsSync(file)){res.setHeader('Content-Type','font/ttf');res.end(fs.readFileSync(file))}
  else{res.statusCode=404;res.end()}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:2})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const examples=['Çınar Ocakbaşı','Usta Döner','Şeker & Krema','Limon Kafe','İmza Restoran']
const cards=[]
try {
  await page.goto(origin)
  for(const [i,t] of QR_PRINT_THEMES.entries()){
    for(const name of [examples[i],'Şehzade İskender Kebap ve Geleneksel Türk Tatlıları Evi']){
      const html=await createQrPrintDocument({bizId:'qr-test-cinar',tables:[{no:5,name:'Masa 5'}],profile:{name},themeId:t.id,origin,preview:true})
      await page.setContent(html)
      await page.evaluate(()=>document.fonts.ready)
      assert(await page.evaluate(font=>document.fonts.check(`24px "QR ${font}"`),t.font),`font loaded: ${t.id}`)
      const bounds=await page.locator('.qr-card').evaluate(el=>{
        const rect=el.getBoundingClientRect()
        return [...el.children].every(child=>{const c=child.getBoundingClientRect();return c.bottom<=rect.bottom && c.right<=rect.right && c.left>=rect.left})
      })
      assert(bounds,`no clipped content: ${t.id} ${name}`)
      // Decode complete designed card, not just an undecorated QR file.
      const png=PNG.sync.read(await page.locator('.qr-card').screenshot())
      const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height)
      assert(decoded,`designed card decodes: ${t.id}`)
      const url=new URL(decoded.data)
      assert.equal(url.searchParams.get('isletme'),'qr-test-cinar')
      assert.equal(url.searchParams.get('masa'),'5')
      if(name===examples[i]) await page.locator('.qr-card').screenshot({path:`outputs/qr-print/${t.id}.png`})
    }
    cards.push(qrPrintCard({themeId:t.id,name:examples[i],tableName:'Masa 5',svg:await brandedTableQR('qr-test-cinar',5,examples[i])}))
  }
  await page.setViewportSize({width:1800,height:525})
  await page.setContent(`<html><head><style>${qrPrintStyles(origin)}</style></head><body><main class="gallery-grid">${cards.join('')}</main></body></html>`)
  await page.evaluate(()=>document.fonts.ready)
  await page.screenshot({path:'outputs/qr-print/bes-tasarim.png',fullPage:true})
  // Six cards cover pagination; check physical card boxes under print CSS.
  await page.setContent(await createQrPrintDocument({bizId:'qr-test-cinar',tables:Array.from({length:6},(_,i)=>({no:i+1})),profile:{name:'Çınar Ocakbaşı'},themeId:'kebap',origin}))
  await page.emulateMedia({media:'print'})
  assert.equal(await page.locator('.qr-card').count(),6)
  assert.equal(await page.locator('.print-toolbar').evaluate(el=>getComputedStyle(el).display),'none')
  const rects=await page.locator('.qr-card').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}))
  assert.equal(rects[0].y,rects[1].y)
  assert(Math.abs(rects[0].w-86*96/25.4)<1)
  assert(Math.abs(rects[0].h-125*96/25.4)<1)
  assert.deepEqual(errors,[])
  console.log('PASS: five fonts; 10 decorated QR cards decode; long Turkish names fit; 2-column A4 print geometry. Gallery: outputs/qr-print/bes-tasarim.png')
} finally {await browser.close();server.close()}
