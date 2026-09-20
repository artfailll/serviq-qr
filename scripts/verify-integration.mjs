// Explicit opt-in only: creates and removes two isolated QA businesses.
// Usage: SERVIQ_RUN_INTEGRATION=1 SERVIQ_ENV_FILE=/path/.env SERVIQ_TEST_BASE=https://preview node scripts/verify-integration.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
if(process.env.SERVIQ_RUN_INTEGRATION!=='1') throw new Error('Explicit integration test opt-in required')
const env=dotenv.parse(fs.readFileSync(process.env.SERVIQ_ENV_FILE))
const base=process.env.SERVIQ_TEST_BASE
if(!base?.startsWith('https://') && !base?.startsWith('http://127.0.0.1:')) throw new Error('Explicit preview/test URL required')
const id=`serviq-qa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
const ids=[id,`${id}-other`]
const created=[]
const pin=crypto.randomBytes(12).toString('hex')
const out=path.resolve('outputs',id)
fs.mkdirSync(out,{recursive:true})
const errors=[]
const report={id,base,checks:[],screenshots:[]}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function db(biz,tail='',method='GET',value,headers={}) {
  if(!ids.includes(biz)) throw new Error('Refusing non-QA tenant')
  const response=await fetch(`${env.VITE_FIREBASE_DATABASE_URL}/businesses/${biz}${tail}.json`,{method,headers:{'Content-Type':'application/json',...headers},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(15000)})
  if(!response.ok) throw new Error(`QA data request failed: ${method} ${response.status}`)
  return response
}
async function read(tail='',biz=id){return (await db(biz,tail)).json()}
async function until(fn,label) {
  const start=Date.now()
  while(Date.now()-start<20000){if(await fn())return;await sleep(200)}
  throw new Error(`Timed out: ${label}`)
}
const product=(name,price,categoryId,order)=>({name,price,categoryId,order,available:true,desc:'Test menüsü · gerçek müşteri ürünü değildir'})
const fixture={
  menu:{profile:{name:'Serviq Test Mutfağı',template:'donerhane',tagline:'Döner zamanı.',stockTracking:false,loyalty:{enabled:true,earnEveryTL:30,rewardPoints:5,rewardName:'Bir ayran'}},
    tables:{'custom-table-5':{no:5,name:'Masa 5'},'custom-table-6':{no:6,name:'Masa 6'}},
    categories:{mains:{name:'Ateşten lezzetler',order:1},sides:{name:'Yan lezzetler',order:2},drinks:{name:'İçecekler',order:3}},
    products:{doner:product('Et Döner',150.25,'mains',1),kebap:product('Adana Kebap',180,'mains',2),kofte:product('Izgara Köfte',175,'mains',3),fries:product('Patates Kızartması',45,'sides',1),salad:product('Çoban Salata',50,'sides',2),dessert:product('Künefe',80,'sides',3),ayran:product('Ayran',25,'drinks',1),cola:product('Kola',35,'drinks',2)},seededAt:Date.now()},config:{password:pin},
}
let browser
async function login(page,route,biz=id){
  await page.goto(`${base}/${route}?isletme=${biz}`,{waitUntil:'domcontentloaded'})
  await page.getByPlaceholder('••••••').fill(pin,{timeout:25000})
  await page.getByRole('button',{name:'Giriş Yap',exact:true}).click()
}
try {
  for(const biz of ids){
    const existing=await db(biz,'','GET',undefined,{'X-Firebase-ETag':'true'})
    assert.equal(await existing.json(),null)
    await db(biz,'','PUT',fixture,{'if-match':existing.headers.get('etag')})
    created.push(biz)
  }
  browser=await chromium.launch({channel:'chrome',headless:true})
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})
  const staffContext=await browser.newContext({viewport:{width:1365,height:900}})
  const adminContext=await browser.newContext({viewport:{width:1365,height:900}})
  const otherContext=await browser.newContext({viewport:{width:1024,height:768}})
  const customer=await context.newPage(),cashier=await staffContext.newPage(),admin=await adminContext.newPage(),other=await otherContext.newPage()
  for(const page of [customer,cashier,admin,other]) page.on('pageerror',error=>errors.push(error.stack || error.message))
  await Promise.all([customer.goto(`${base}/menu?isletme=${id}&masa=5`),login(cashier,'kasa'),login(admin,'yonetim'),login(other,'kasa',ids[1])])
  await cashier.getByText('Kasa Ekranı',{exact:true}).first().waitFor({timeout:25000})
  await admin.getByRole('heading',{name:'NFC masa tanımlama'}).waitFor({timeout:25000})
  for(const theme of ['donerhane','ocakbasi','koz']) {
    await db(id,'/menu/profile','PATCH',{template:theme,tagline:''})
    await customer.locator(`[data-template="${theme}"] .food-card`).first().waitFor({timeout:15000})
    await sleep(500)
    assert(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile horizontal overflow')
    for (const card of await customer.locator('.food-card').all()) await card.scrollIntoViewIfNeeded()
    await customer.evaluate(()=>scrollTo(0,0))
    await sleep(600)
    const screenshot=path.join(out,`${theme}-mobile.png`)
    await customer.screenshot({path:screenshot,fullPage:true})
    report.screenshots.push(screenshot)
    report.checks.push(`render:${theme}`)
  }
  await customer.emulateMedia({reducedMotion:'reduce'})
  assert.equal(await customer.locator('.food-ember').first().evaluate(el=>getComputedStyle(el).animationName),'none')
  report.checks.push('reduced-motion respected')
  await customer.emulateMedia({reducedMotion:'no-preference'})
  await db(id,'/menu/profile','PATCH',{template:'donerhane'})
  await customer.locator('[data-template="donerhane"] .food-card').first().waitFor()
  await customer.locator('.food-card').filter({hasText:'Et Döner'}).click()
  await customer.getByRole('button',{name:/Sepete Ekle/}).click()
  await customer.locator('[data-cartbar]').click()
  await customer.locator('[data-testid="pairings"]').getByText('Ayran',{exact:true}).waitFor()
  await customer.getByPlaceholder('Ad soyad').fill('QA müşteri')
  await customer.getByPlaceholder('Telefon').fill('0000000000')
  await customer.getByLabel(/Bilgilerimin bu işletmede/).check()
  await customer.getByRole('button',{name:'Siparişi Onayla',exact:true}).click()
  await customer.getByText('Siparişiniz alındı!',{exact:true}).waitFor({timeout:20000})
  await cashier.locator('article').filter({hasText:'Et Döner'}).waitFor({timeout:20000})
  const orders=await read('/orders')
  assert.equal(Object.keys(orders).length,1)
  const [orderId,order]=Object.entries(orders)[0]
  assert.equal(order.tableId,'custom-table-5')
  assert.equal(order.total,150.25)
  await until(async()=> (await read('/menu/stats/doner'))===1,'product sales count is exactly one')
  assert.equal(await read('/orders',ids[1]),null)
  await admin.getByRole('button').filter({hasText:/^M5/}).first().click()
  await admin.getByText('Et Döner',{exact:false}).waitFor()
  report.checks.push('customer order visible in isolated cashier/admin; other business unaffected')
  await cashier.getByRole('button',{name:'Mutfağa Al',exact:true}).click()
  await until(async()=> (await read(`/orders/${orderId}/status`))==='kitchen','kitchen status')
  await customer.getByRole('button',{name:/Siparişim/}).click()
  await customer.getByText('Hazırlanıyor',{exact:true}).waitFor()
  await cashier.getByRole('button',{name:'Hazır',exact:true}).click()
  await cashier.getByRole('button',{name:'Servis Et',exact:true}).click()
  await cashier.getByRole('button',{name:'Hesabı Kapat',exact:true}).click()
  await cashier.getByRole('button',{name:'Nakit',exact:true}).click()
  await until(async()=> (await read(`/orders/${orderId}/status`))==='paid','paid status')
  await until(async()=> (await read('/crm/customers/p0000000000/points'))===5,'loyalty points')
  report.checks.push('kitchen/ready/served/payment synced; correct loyalty credited')
  // Reload admin to close the selected-table modal, then decode actual printed QR.
  await admin.reload()
  await admin.getByRole('button',{name:/QR Tasarla/}).click()
  const popupPromise=admin.waitForEvent('popup')
  await admin.getByRole('button',{name:'Seçili tasarımı yazdır / PDF',exact:true}).click()
  const popup=await popupPromise
  const qr=popup.locator('.qr svg').first()
  await qr.waitFor()
  const png=PNG.sync.read(await qr.screenshot())
  const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height)
  assert(decoded,'branded QR must decode')
  const target=new URL(decoded.data)
  assert.equal(target.searchParams.get('isletme'),id)
  assert.equal(target.searchParams.get('masa'),'5')
  report.checks.push('printed branded QR decodes to correct tenant/table')
  await popup.close()
  for(const [name,key] of [['Ocakbaşı','kebap'],['Döner Sokağı','doner'],['Tatlı Molası','tatli'],['Serin Mola','icecek'],['İmza','imza']]){
    await admin.getByRole('button',{name:new RegExp(`^${name}`)}).click()
    await admin.frameLocator('iframe[title="QR baskı önizlemesi"]').locator(`[data-qr-theme="${key}"]`).waitFor()
  }
  await admin.getByLabel('Yazdırılacak masalar').selectOption('custom-table-6')
  await admin.getByRole('button',{name:'İşletmenin varsayılanı yap',exact:true}).click()
  await until(async()=>await read('/menu/profile/qrPrintTheme')==='imza','QR template saved')
  const singlePopupPromise=admin.waitForEvent('popup')
  await admin.getByRole('button',{name:'Seçili tasarımı yazdır / PDF',exact:true}).click()
  const singlePopup=await singlePopupPromise
  await singlePopup.locator('[data-qr-theme="imza"]').waitFor()
  assert.equal(await singlePopup.locator('.qr-card').count(),1)
  const singlePng=PNG.sync.read(await singlePopup.locator('.qr svg').screenshot())
  assert.equal(new URL(jsQR(new Uint8ClampedArray(singlePng.data),singlePng.width,singlePng.height).data).searchParams.get('masa'),'6')
  await singlePopup.close()
  await admin.setViewportSize({width:390,height:844})
  assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await admin.screenshot({path:path.join(out,'qr-studio-mobile.png')})
  await admin.setViewportSize({width:1365,height:900})
  report.checks.push('five QR template previews, saved default and single-table print work; mobile dialog fits')
  await admin.getByRole('button',{name:'Kapat',exact:true}).click()
  await admin.getByRole('button',{name:'İşletme OS',exact:true}).click()
  await admin.getByRole('button',{name:'Müşteri & Sadakat',exact:true}).click()
  await admin.getByLabel('Ödül için müşteri').selectOption('p0000000000')
  admin.once('dialog',d=>d.accept())
  await admin.getByRole('button',{name:'Ödülü teslim et ve puanı düş',exact:true}).click()
  await until(async()=> (await read('/crm/customers/p0000000000/points'))===0,'reward deducted')
  assert.equal(Object.keys(await read('/crm/customers/p0000000000/redemptions')).length,1)
  report.checks.push('staff reward recorded once and points deducted')
  await admin.getByRole('button',{name:'İşletme Profili',exact:true}).click()
  await admin.getByLabel('1 puan için harcama',{exact:true}).fill('50')
  await admin.getByLabel('Ödül puanı',{exact:true}).fill('10')
  await admin.getByLabel('Sadakat ödülü',{exact:true}).fill('Bir çay')
  await admin.getByRole('button',{name:'Profili Kaydet',exact:true}).click()
  await until(async()=> Number(await read('/menu/profile/loyalty/earnEveryTL'))===50,'owner loyalty rate saved')
  assert.equal(await read('/menu/profile/loyalty/rewardName'),'Bir çay')
  report.checks.push('owner can configure earning rate, reward threshold and reward')
  const waiterContext=await browser.newContext({viewport:{width:390,height:844}})
  const waiter=await waiterContext.newPage()
  waiter.on('pageerror',error=>errors.push(error.stack||error.message))
  await login(waiter,'garson')
  await waiter.getByRole('button',{name:'6',exact:true}).click()
  await waiter.getByRole('button',{name:/Adana Kebap/}).click()
  await waiter.getByRole('button',{name:/Sepeti Gör/}).click()
  await waiter.getByRole('button',{name:'Mutfağa Gönder',exact:true}).click()
  await waiter.getByText('Sipariş mutfağa gönderildi!',{exact:true}).waitFor()
  await until(async()=> Object.keys(await read('/orders')).length===2,'waiter order received')
  const waiterOrder=Object.entries(await read('/orders')).find(([key])=>key!==orderId)
  assert.equal(waiterOrder[1].tableId,'custom-table-6')
  await cashier.locator('article').filter({hasText:'Adana Kebap'}).waitFor()
  await db(id,'/layout','PUT',{'custom-table-6':{x:120,y:150}})
  await db(id,'/calls','PUT',{'test-call':{tableId:'custom-table-6',tableNo:6,type:'waiter',createdAt:Date.now()}})
  await admin.getByRole('button',{name:'İstatistikler',exact:true}).click()
  admin.on('dialog',d=>d.accept())
  await admin.getByRole('button',{name:'Günü kapat & arşivle',exact:true}).click()
  await until(async()=> await read(`/orders/${orderId}`)===null,'paid order archived')
  assert.equal((await read(`/orders/${waiterOrder[0]}`)).status,'new')
  assert.equal(Object.keys(await read('/orders')).length,1)
  const archive=await read('/archive')
  assert(Object.values(archive).some(day=>day[orderId]?.total===150.25))
  assert.equal((await read('/layout'))['custom-table-6'].x,120)
  assert((await read('/calls'))['test-call'])
  report.checks.push('waiter order reaches cashier; day-close archives paid bill and preserves active order/calls/layout')
  // Offline attempt: keep existing cart and do not show a success message.
  await customer.reload()
  await customer.locator('.food-card').filter({hasText:'Et Döner'}).click()
  await customer.getByRole('button',{name:/Sepete Ekle/}).click()
  await customer.locator('[data-cartbar]').click()
  await context.setOffline(true)
  await sleep(800)
  await customer.getByRole('button',{name:'Siparişi Onayla',exact:true}).click()
  await customer.getByText(/Sunucu bağlantısı yok/).waitFor({timeout:15000})
  assert.equal(Object.keys(await read('/orders')).length,1)
  assert(await customer.getByRole('button',{name:'Siparişi Onayla',exact:true}).isVisible())
  await context.setOffline(false)
  report.checks.push('offline submit does not falsely succeed or clear cart')
  assert.deepEqual(errors,[])
  report.result='PASS'
} catch(error) {
  report.result='FAIL';report.error=error.message
  if(browser) for(const [i,c] of browser.contexts().entries()) for(const [j,p] of c.pages().entries()) await p.screenshot({path:path.join(out,`failure-${i}-${j}.png`)}).catch(()=>{})
  process.exitCode=1
} finally {
  report.browserErrors=errors
  await browser?.close()
  for(const biz of created){await db(biz,'','DELETE');assert.equal(await (await db(biz)).json(),null)}
  report.cleaned=created
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
}
