import { chromium } from '@playwright/test'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1400, height: 1000 } })
await pg.goto('file:///Users/rickygole/Careloop/CareLoop/mockups/concepts.html', { waitUntil: 'networkidle' })
await pg.waitForTimeout(800)
const s = (await pg.$$('section, article, .board'))[2]
await s.evaluate(e => e.scrollIntoView())
await pg.waitForTimeout(400)
const box = await s.boundingBox()
await pg.screenshot({ path: '/tmp/cl-concepts/B-top.png',
  clip: { x: box.x, y: box.y, width: box.width, height: 1500 } })
await pg.screenshot({ path: '/tmp/cl-concepts/B-mid.png',
  clip: { x: box.x, y: box.y + 1500, width: box.width, height: 1500 } })
console.log('  captured concept B, two slices')
await br.close()
