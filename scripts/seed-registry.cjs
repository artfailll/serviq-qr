#!/usr/bin/env node
'use strict'

const { registerRestaurant, syncDesktopList } = require('./registry.cjs')

const initialList = [
  {
    id: 'sezgin-usta-doner',
    name: 'Sezgin Usta Döner Ve Kebap Evi',
    tableCount: 14,
    password: 'sezgin19742009',
    createdAt: 1792845877124
  },
  {
    id: 'test1',
    name: 'test1',
    tableCount: 10,
    password: '1234',
    createdAt: 1794075600113
  },
  {
    id: 'alindroid-cafe',
    name: 'ALİNDROİD CAFE',
    tableCount: 34,
    password: '1111',
    createdAt: 1783260243470
  },
  {
    id: 'bey-sos',
    name: 'cafesilivri',
    tableCount: 57,
    password: '1234',
    createdAt: 1787407969299
  },
  {
    id: 'cihan-cafe1',
    name: 'cihan cafe',
    tableCount: 56,
    password: '3404',
    createdAt: 1782989591349
  },
  {
    id: 'emre-cafe',
    name: 'emre abi cafe',
    tableCount: 31,
    password: '1234',
    createdAt: 1783887144780
  },
  {
    id: 'silivri-cafe',
    name: 'silivri cafe',
    tableCount: 25,
    password: '1234',
    createdAt: 1782913271674
  },
  {
    id: 'CAFE SİNAN',
    name: 'SİNAN CAFE',
    tableCount: 25,
    password: '3404',
    createdAt: 1784719000000
  },
  {
    id: 'CAFE-SİNAN1',
    name: 'CAFE SİNAN1',
    tableCount: 25,
    password: '3404',
    createdAt: 1784719820673
  },
  {
    id: 'demo cafe',
    name: 'deneme cafe demo',
    tableCount: 60,
    password: '1234',
    createdAt: 1782900000000
  }
]

initialList.forEach(r => registerRestaurant(r))
const p = syncDesktopList()
console.log('Başlangıç restoran listesi başarıyla oluşturuldu ve masaüstüne kaydedildi:', p)
