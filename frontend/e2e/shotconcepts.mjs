import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
mkdirSync('/tmp/cl-concepts', { recursive: true })
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1400, height: 1000 } })
await pg.goto('file:///Users/rickygole/Careloop/CareLoop/mockups/concepts.html', { waitUntil: 'networkidle' })
await pg.waitForTimeout(1200)
const h = await pg.evaluate(() => document.body.scrollHeight)
console.log('  page is', h, 'px tall')
await pg.screenshot({ path: '/tmp/cl-concepts/full.png', fullPage: true })
const boards = await pg.evaluate(() =>
  [...document.querySelectorAll('h2,h3')].slice(0, 14).map(e => e.textContent.trim().slice(0, 60)))
boards.forEach(b => console.log('   ' + b))
await br.close()
