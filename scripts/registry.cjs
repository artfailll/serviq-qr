#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

function findDesktopDir() {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  if (!home) return null
  const candidates = [
    path.join(home, 'Desktop'),
    path.join(home, 'Masaüstü'),
    path.join(home, 'OneDrive', 'Desktop'),
    path.join(home, 'OneDrive', 'Masaüstü'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function getRegistryPath() {
  const dir = path.join(ROOT, 'kurulum-paketleri')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'restoranlar.json')
}

function loadRegistry() {
  const p = getRegistryPath()
  if (!fs.existsSync(p)) return []
  try {
    const raw = fs.readFileSync(p, 'utf8')
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveRegistry(list) {
  const p = getRegistryPath()
  fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8')
}

function registerRestaurant(info) {
  if (!info || !info.id) return
  const list = loadRegistry()
  const idx = list.findIndex(r => r.id === info.id)
  const entry = {
    id: info.id,
    name: info.name || info.id,
    tableCount: Number(info.tableCount) || 10,
    password: info.password || '1234',
    createdAt: info.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry }
  } else {
    list.push(entry)
  }
  saveRegistry(list)
  syncDesktopList()
  return list
}

function unregisterRestaurant(id) {
  if (!id) return
  const list = loadRegistry()
  const filtered = list.filter(r => r.id !== id)
  saveRegistry(filtered)
  syncDesktopList()
  return filtered
}

function formatRestaurantsTxt(list) {
  const nowStr = new Date().toLocaleString('tr-TR')
  let out = `======================================================================
                 SERVIQ - KURULU RESTORANLAR LİSTESİ
======================================================================
Son Güncelleme : ${nowStr}
Toplam Restoran: ${list.length} Adet

Bu dosya Serviq sistemindeki tüm kayıtlı restoranları listeler.
Yeni bir restoran kurulduğunda veya silindiğinde otomatik güncellenir.
======================================================================\n\n`

  if (!list.length) {
    out += 'Sistemde henüz kayıtlı restoran bulunmamaktadır.\n'
    out += 'Yeni restoran kurmak için YENI-RESTORAN-KUR.bat dosyasını çalıştırabilirsiniz.\n'
    return out
  }

  list.forEach((r, idx) => {
    const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleString('tr-TR') : '-'
    out += `[${idx + 1}] ${r.name}
----------------------------------------------------------------------
İşletme Kodu (ID) : ${r.id}
Masa Sayısı       : ${r.tableCount || 10} Masa
Yönetici Şifresi  : ${r.password || '1234'}
Kurulum Tarihi    : ${dateStr}

HIZLI ERİŞİM LİNKLERİ:
* Yönetim Paneli  : https://serviq.com.tr/yonetim?isletme=${encodeURIComponent(r.id)}
* Kasa Ekranı     : https://serviq.com.tr/kasa?isletme=${encodeURIComponent(r.id)}
* Garson Ekranı   : https://serviq.com.tr/garson?isletme=${encodeURIComponent(r.id)}
* Müşteri QR Menü : https://serviq.com.tr/menu?isletme=${encodeURIComponent(r.id)}
----------------------------------------------------------------------\n\n`
  })

  out += `======================================================================
Destek & Bilgi: https://serviq.com.tr
======================================================================\n`
  return out
}

function syncDesktopList() {
  const list = loadRegistry()
  const content = formatRestaurantsTxt(list)

  // 1. Kurulum paketlerine kaydet
  const dir = path.join(ROOT, 'kurulum-paketleri')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'KURULU-RESTORANLAR.txt'), content, 'utf8')

  // 2. Masaüstüne kaydet (varsa)
  const desktopDir = findDesktopDir()
  if (desktopDir) {
    const desktopPath = path.join(desktopDir, 'KURULU-RESTORANLAR.txt')
    fs.writeFileSync(desktopPath, content, 'utf8')
    return desktopPath
  }
  return null
}

module.exports = {
  findDesktopDir,
  getRegistryPath,
  loadRegistry,
  saveRegistry,
  registerRestaurant,
  unregisterRestaurant,
  formatRestaurantsTxt,
  syncDesktopList,
}

if (require.main === module) {
  const p = syncDesktopList()
  console.log('Restoran listesi güncellendi:', p)
}
