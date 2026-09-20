#!/usr/bin/env node
require('./scripts/provision.cjs').main().catch(error => {
  console.error(`Kurulum durduruldu: ${error.message}`)
  process.exitCode = 1
})
