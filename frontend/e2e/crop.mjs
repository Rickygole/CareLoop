import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
mkdirSync('/tmp/cl-concepts', { recursive: true })
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1400, height: 1000 } })
await pg.goto('file:///Users/rickygole/Careloop/CareLoop/mockups/concepts.html', { waitUntil: 'networkidle' })
await pg.waitForTimeout(1000)
const secs = await pg.$$('section, article, .board')
console.log('  containers:', secs.length)
let n = 0
for (const s of secs) {
  const box = await s.boundingBox()
  if (!box || box.height < 500 || box.width < 500) continue
  n += 1
  if (n > 8) break
  await s.screenshot({ path: `/tmp/cl-concepts/b${n}.png` })
  const t = await s.evaluate(e => (e.querySelector('h2,h3')?.textContent || '').trim().slice(0,50))
  console.log(`  b${n}: ${Math.round(box.width)}x${Math.round(box.height)}  ${t}`)
}
await br.close()
