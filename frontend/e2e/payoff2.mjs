import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
const BASE = 'https://careloop-woad.vercel.app'
mkdirSync('/tmp/cl-payoff', { recursive: true })
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
const errs = []
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
const press = async (n) => {
  const b = pg.getByRole('button', { name: n }).first()
  await b.waitFor({ state: 'visible', timeout: 15000 })
  await b.click()
  await pg.waitForTimeout(1600)
}
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.waitForTimeout(3000)
await pg.goto(`${BASE}/#/call`, { waitUntil: 'networkidle' })
await press('Read the check-in in writing')
await pg.waitForTimeout(3000)
await pg.locator('textarea').first().fill('I have been dizzy for two days and my ankles are swollen')
await pg.waitForTimeout(800)
const send = pg.getByRole('button', { name: 'Send my answer' }).first()
await send.waitFor({ state: 'visible', timeout: 15000 })
await send.click()
await pg.waitForTimeout(12000)
console.log('  landed on:', pg.url().split('#')[1], '|', await pg.evaluate(() => document.body.scrollHeight), 'px')
await pg.screenshot({ path: '/tmp/cl-payoff/decision.png', fullPage: true })
const txt = await pg.evaluate(() => document.body.innerText)
const m = txt.match(/(booked|appointment)[^\n]{0,110}/i)
console.log('  booking:', m ? m[0].slice(0,120) : 'none found')
console.log(errs.length ? '  ERRORS ' + errs[0] : '  no page errors')
await br.close()
