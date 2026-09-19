import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
const BASE = 'https://careloop-woad.vercel.app'
const OUT = '/tmp/cl-audit'
mkdirSync(OUT, { recursive: true })

const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
const errs = []
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
pg.on('console', m => m.type() === 'error' && errs.push('CONSOLE ' + m.text()))
pg.on('response', r => r.status() >= 400 && errs.push(`HTTP ${r.status()} ${r.url().slice(-60)}`))

const press = async (rx) => {
  const b = pg.getByRole('button', { name: rx }).first()
  if (await b.count()) { await b.click(); await pg.waitForTimeout(1800); return true }
  return false
}
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press(/sign up/i); await press(/connect .*load my records/i); await press(/^allow$/i)
await pg.waitForTimeout(3500)

// walk the written check-in to the decision page, which is the payoff screen
await pg.goto(`${BASE}/#/call`, { waitUntil: 'networkidle' })
await press(/read the check-in in writing/i)
const ta = pg.locator('textarea').first()
if (await ta.count()) {
  await ta.fill('I have been dizzy for two days and my ankles are swollen')
  await press(/send|submit|answer/i)
  await pg.waitForTimeout(6000)
}
await pg.screenshot({ path: `${OUT}/decision.png`, fullPage: true })
const h = await pg.evaluate(() => document.body.scrollHeight)
console.log('  decision page:', h, 'px tall, url', pg.url().split('#')[1])

const heads = await pg.evaluate(() =>
  [...document.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0,52)))
heads.slice(0, 12).forEach(x => console.log('   ' + x))
console.log(errs.length ? '\n  ISSUES:' : '\n  no console, page or http errors')
errs.slice(0, 6).forEach(e => console.log('   ' + e.slice(0, 120)))
await br.close()
