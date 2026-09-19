import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
const BASE = 'https://careloop-woad.vercel.app'
mkdirSync('/tmp/cl-payoff', { recursive: true })
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
const errs = []
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
pg.on('console', m => m.type() === 'error' && errs.push('CONSOLE ' + m.text()))
const press = async (n) => {
  const b = pg.getByRole('button', { name: n, exact: false }).first()
  if (await b.count()) { await b.click(); await pg.waitForTimeout(1600); return true }
  console.log('   [missing]', n); return false
}
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.waitForTimeout(3000)
await pg.goto(`${BASE}/#/call`, { waitUntil: 'networkidle' })
await press('Read the check-in in writing')
await pg.locator('textarea').first().fill('I have been dizzy for two days and my ankles are swollen')
await press('Send my answer')
await pg.waitForTimeout(9000)
console.log('  landed on:', pg.url().split('#')[1])
await pg.screenshot({ path: '/tmp/cl-payoff/after.png', fullPage: true })
console.log('  height:', await pg.evaluate(() => document.body.scrollHeight), 'px')
const booked = await pg.evaluate(() => {
  const t = document.body.innerText
  const m = t.match(/booked[^.]{0,120}/i)
  return m ? m[0] : 'no booking sentence found'
})
console.log('  booking line:', booked.slice(0, 130))
console.log(errs.length ? '  ERRORS: ' + errs.slice(0,3).join(' | ') : '  no errors')
await br.close()
