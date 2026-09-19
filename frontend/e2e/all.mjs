import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
const BASE = 'https://careloop-woad.vercel.app'
const OUT = '/tmp/cl-all'
mkdirSync(OUT, { recursive: true })
const run = async () => {
  const br = await chromium.launch()
  const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
  const press = async (rx) => {
    const b = pg.getByRole('button', { name: rx }).first()
    if (await b.count()) { await b.click(); await pg.waitForTimeout(1800) }
  }
  await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await press(/sign up/i); await press(/connect .*load my records/i); await press(/^allow$/i)
  await pg.waitForTimeout(3500)
  for (const [n, h] of [['meds','/#/meds'],['call','/#/call'],['appts','/#/appointments'],['safety','/#/safety']]) {
    await pg.goto(`${BASE}${h}`, { waitUntil: 'networkidle' })
    await pg.waitForTimeout(2200)
    const h2 = await pg.evaluate(() => document.body.scrollHeight)
    await pg.screenshot({ path: `${OUT}/${n}.png`, fullPage: true })
    console.log(`  ${n}: ${h2}px tall`)
  }
  await br.close()
}
run().catch(e => { console.error('FAILED', e.message); process.exit(1) })
