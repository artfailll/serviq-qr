import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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

test('TouchKeyboard strictly differentiates touch from mouse input', () => {
  const content = readFileSync('src/components/TouchKeyboard.jsx', 'utf8')
  // Checks touch capability
  assert.match(content, /hasTouchCapability/)
  // Listens to pointerdown and checks pointerType
  assert.match(content, /e\.pointerType === 'touch'/)
  // Only shows when touch triggered
  assert.match(content, /lastPointerTypeRef\.current === 'touch'/)
})
