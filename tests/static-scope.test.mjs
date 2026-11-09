import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'
import traversePackage from '@babel/traverse'
const traverse = traversePackage.default
const globals = new Set(('undefined arguments console window document navigator localStorage sessionStorage setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame queueMicrotask IntersectionObserver ResizeObserver MutationObserver Image URL URLSearchParams Blob File FileReader FormData fetch Headers Response Request AbortController AbortSignal TextDecoder TextEncoder CustomEvent Event BroadcastChannel Promise Date Math JSON Number String Boolean Object Array Map Set WeakMap WeakSet Error TypeError RegExp Intl Infinity NaN parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent alert confirm performance getComputedStyle atob btoa Audio crypto').split(' '))
for (const file of ['src/App.jsx', 'src/pages/Customer.jsx', 'src/pages/Waiter.jsx', 'src/pages/Cashier.jsx', 'src/pages/Admin.jsx', 'src/pages/AdminLogin.jsx', 'src/components/ConnectionStatus.jsx', 'src/components/RestaurantMenuTheme.jsx', 'src/components/PaymentModal.jsx', 'src/components/admin/ProfileEditor.jsx', 'src/components/admin/LoyaltyPanel.jsx', 'src/components/admin/OperationsHub.jsx', 'src/components/admin/TableMap.jsx', 'src/components/admin/MenuManager.jsx', 'src/components/admin/QrPrintStudio.jsx', 'src/components/admin/NfcSetup.jsx', 'src/lib/store.js', 'src/lib/db.js', 'src/lib/seed.js', 'src/lib/bestsellers.js', 'src/lib/touchDevice.js', 'src/components/TouchKeyboard.jsx', 'src/lib/apiAuth.js']) {
  test(`${file}: referenced variables are bound`, () => {
    const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] })
    const missing = []
    traverse(ast, { ReferencedIdentifier(p) {
      const name = p.node.name
      if (!globals.has(name) && !p.scope.hasBinding(name)) missing.push(`${name}:${p.node.loc.start.line}`)
    } })
    assert.deepEqual(missing, [])
  })
}
