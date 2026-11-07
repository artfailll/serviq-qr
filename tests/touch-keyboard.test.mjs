import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isMobileOrTabletDevice, isTouchComputer } from '../src/lib/touchDevice.js'

test('TouchKeyboard component exists and exports default component', () => {
  const content = readFileSync('src/components/TouchKeyboard.jsx', 'utf8')
  assert.match(content, /export default function TouchKeyboard/)
  assert.match(content, /TURKISH_QWERTY_LOWER/)
  assert.match(content, /TURKISH_QWERTY_UPPER/)
})

test('TouchKeyboard includes all Turkish specific letters', () => {
  const content = readFileSync('src/components/TouchKeyboard.jsx', 'utf8')
  // Lowercase
  assert.ok(content.includes("'ğ'"), 'Includes ğ')
  assert.ok(content.includes("'ü'"), 'Includes ü')
  assert.ok(content.includes("'ş'"), 'Includes ş')
  assert.ok(content.includes("'i'"), 'Includes i')
  assert.ok(content.includes("'ı'"), 'Includes ı')
  assert.ok(content.includes("'ö'"), 'Includes ö')
  assert.ok(content.includes("'ç'"), 'Includes ç')

  // Uppercase
  assert.ok(content.includes("'Ğ'"), 'Includes Ğ')
  assert.ok(content.includes("'Ü'"), 'Includes Ü')
  assert.ok(content.includes("'Ş'"), 'Includes Ş')
  assert.ok(content.includes("'İ'"), 'Includes İ')
  assert.ok(content.includes("'I'"), 'Includes I')
  assert.ok(content.includes("'Ö'"), 'Includes Ö')
  assert.ok(content.includes("'Ç'"), 'Includes Ç')
})

test('TouchKeyboard excludes tablets and phones, only activates on touch computers', () => {
  const comp = readFileSync('src/components/TouchKeyboard.jsx', 'utf8')
  const lib = readFileSync('src/lib/touchDevice.js', 'utf8')
  assert.match(comp, /isTouchComputer/)
  assert.match(comp, /if \(!isTouchComputer\(\)\) return/)
  assert.match(comp, /e\.pointerType === 'touch'/)
  assert.match(comp, /lastPointerTypeRef\.current === 'touch'/)
  assert.match(lib, /isMobileOrTabletDevice/)
  assert.match(lib, /isTouchComputer/)
})

test('device detection correctly distinguishes touch PCs from mobile and tablet devices', () => {
  // 1. Android Phone
  const androidPhoneNav = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36', maxTouchPoints: 5 }
  const androidWin = { ontouchstart: true }
  assert.equal(isMobileOrTabletDevice(androidPhoneNav, androidWin), true, 'Android phone is mobile')
  assert.equal(isTouchComputer(androidPhoneNav, androidWin), false, 'Touch keyboard disabled on Android phone')

  // 2. iPad
  const ipadNav = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', maxTouchPoints: 5 }
  const ipadWin = { ontouchstart: true }
  assert.equal(isMobileOrTabletDevice(ipadNav, ipadWin), true, 'iPad is tablet')
  assert.equal(isTouchComputer(ipadNav, ipadWin), false, 'Touch keyboard disabled on iPad')

  // 3. iPhone
  const iphoneNav = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', maxTouchPoints: 5 }
  const iphoneWin = { ontouchstart: true }
  assert.equal(isMobileOrTabletDevice(iphoneNav, iphoneWin), true, 'iPhone is mobile')
  assert.equal(isTouchComputer(iphoneNav, iphoneWin), false, 'Touch keyboard disabled on iPhone')

  // 4. Windows All-in-One Touch POS PC
  const winTouchNav = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36', maxTouchPoints: 10 }
  const winTouchWin = { ontouchstart: true }
  assert.equal(isMobileOrTabletDevice(winTouchNav, winTouchWin), false, 'Windows touch PC is not mobile/tablet')
  assert.equal(isTouchComputer(winTouchNav, winTouchWin), true, 'Touch keyboard ENABLED on Windows Touch POS PC')

  // 5. Windows Non-Touch PC (Mouse & Keyboard only)
  const winNoTouchNav = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36', maxTouchPoints: 0 }
  const winNoTouchWin = {}
  assert.equal(isMobileOrTabletDevice(winNoTouchNav, winNoTouchWin), false)
  assert.equal(isTouchComputer(winNoTouchNav, winNoTouchWin), false, 'Touch keyboard disabled on Non-Touch PC')
})
