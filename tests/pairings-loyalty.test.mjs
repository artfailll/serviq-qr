import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendPairings, foodGroup } from '../src/lib/recommendations.js'
import { getLoyaltyRules, earnedPoints, applyLoyaltyCredit, applyRewardRedemption } from '../src/lib/loyalty.js'
import { TEMPLATES } from '../src/lib/templates.js'
import { money } from '../src/lib/format.js'
const categories=[{id:'main',name:'Ana yemekler'},{id:'drink',name:'İçecekler'},{id:'side',name:'Yan lezzetler'}]
const product=(id,name,categoryId='main',extra={})=>({id,name,categoryId,price:50,available:true,...extra})
const products=[product('doner','Et döner'),product('kebap','Adana kebap'),product('grill','Izgara köfte'),product('ayran','Ayran','drink'),product('kola','Kola','drink'),product('tea','Çay','drink'),product('salad','Çoban salata','side'),product('fries','Patates kızartması','side'),product('sweet','Künefe','side')]
const cart=(...ids)=>ids.map(productId=>({productId,qty:1}))
test('doner prioritizes ayran; kebab salad; grill salad and sides',()=>{
 assert.equal(recommendPairings(cart('doner'),products,categories)[0].id,'ayran')
 assert.deepEqual(recommendPairings(cart('kebap','ayran'),products,categories).map(p=>p.id).slice(0,2),['salad','sweet'])
 assert.equal(recommendPairings(cart('grill'),products,categories)[0].id,'salad')
})
test('no unavailable, duplicate, unrelated mains, or repeated drinks',()=>{
 const result=recommendPairings(cart('doner','ayran'),products.map(p=>p.id==='fries'?{...p,available:false}:p),categories)
 assert(!result.some(p=>['doner','ayran','kola','tea','fries','kebap','grill'].includes(p.id)))
 assert.equal(recommendPairings([],products,categories).length,0)
 assert.equal(recommendPairings(cart('missing'),products,categories).length,0)
})
test('combo included side is not recommended again',()=>{
 assert.equal(foodGroup({name:'Döner + ayran menü'}),'doner')
 const menu=products.map(p=>p.id==='doner'?{...p,comboItems:[{productId:'ayran',qty:1},{productId:'fries',qty:1}]}:p)
 assert(!recommendPairings(cart('doner'),menu,categories).some(p=>['ayran','kola','fries'].includes(p.id)))
})
test('dessert gets tea rather than another main course',()=>assert.equal(recommendPairings(cart('sweet'),products,categories)[0].id,'tea'))
const profile={loyalty:{enabled:true,earnEveryTL:20,rewardPoints:5,rewardName:'Bir ayran'}}
test('program requires valid explicit rules; earned points use business rate',()=>{
 assert.equal(getLoyaltyRules({}).enabled,false)
 assert.equal(getLoyaltyRules({loyalty:{...profile.loyalty,earnEveryTL:0}}).enabled,false)
 assert.equal(earnedPoints(119.9,profile),5)
 assert.equal(earnedPoints(119.9,{}),0)
})
test('loyalty credit ledger prevents double credit and does not grant marketing consent',()=>{
 const order={total:100,customer:{name:'Test',phone:'0000000000'}}
 const first=applyLoyaltyCredit(null,'o1',order,profile,1)
 assert.equal(first.points,5)
 assert.equal(first.marketingConsent,false)
 assert.equal(applyLoyaltyCredit(first,'o1',order,profile,2),undefined)
 assert.equal(applyLoyaltyCredit(first,'o2',order,profile,2).points,10)
})
test('reward debits atomically, records history and rejects insufficient/double use',()=>{
 const rules=getLoyaltyRules(profile)
 const first=applyRewardRedemption({points:7},'r1',rules,'staff',3)
 assert.equal(first.points,2)
 assert.equal(first.redemptions.r1.reward,'Bir ayran')
 assert.equal(applyRewardRedemption(first,'r1',rules,'staff',4),undefined)
 assert.equal(applyRewardRedemption(first,'r2',rules,'staff',4),undefined)
})
test('three different food themes exist; currency keeps cents',()=>{
 assert.deepEqual(['donerhane','ocakbasi','koz'].map(k=>TEMPLATES[k].foodTheme),['doner','kebab','grill'])
 assert.match(money(150.25),/150,25/)
})
