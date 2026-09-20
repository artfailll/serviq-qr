#!/usr/bin/env node
import provision from './scripts/provision.cjs'
provision.main().catch(error => {
  console.error(`Kurulum durduruldu: ${error.message}`)
  process.exitCode = 1
})
