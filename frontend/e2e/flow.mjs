import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const BASE = 'https://careloop-woad.vercel.app'
const OUT = '/tmp/careloop-flow'
mkdirSync(OUT, { recursive: true })

const shot = async (p, n) => {
  await p.waitForTimeout(1000)
  await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true })
  console.log('  ' + n)
}

const click = async (p, rx, label) => {
  const b = p.getByRole('button', { name: rx }).first()
  if (await b.count()) { await b.click(); await p.waitForTimeout(1500); return true }
  const l = p.getByRole('link', { name: rx }).first()
  if (await l.count()) { await l.click(); await p.waitForTimeout(1500); return true }
  console.log(`  [not found] ${label}`)
  return false
}

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))

  await page.goto(`${BASE}/#/signin`, { waitUntil: 'networkidle' })
  await click(page, /^sign in$/i, 'sign in')
  await shot(page, '1-landed')

  await page.goto(`${BASE}/#/connect`, { waitUntil: 'networkidle' })
  await shot(page, '2-connect')
  await click(page, /connect myhealth/i, 'connect')
  await shot(page, '3-consent')
  await click(page, /^allow$/i, 'allow')
  await page.waitForTimeout(3500)
  await shot(page, '4-after-consent')

  await page.goto(`${BASE}/#/meds`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await shot(page, '5-meds')

  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await shot(page, '6-today')

  await page.goto(`${BASE}/#/call`, { waitUntil: 'networkidle' })
  await shot(page, '7-call')

  await page.goto(`${BASE}/#/appointments`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await shot(page, '8-appointments')

  console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors')
  await browser.close()
}
run().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
