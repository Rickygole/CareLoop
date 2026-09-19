import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const BASE = process.argv[2] || 'https://careloop-woad.vercel.app'
const OUT = process.argv[3] || '/tmp/careloop-shots'
mkdirSync(OUT, { recursive: true })

const shot = async (page, name) => {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`  captured ${name}`)
}

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))

  await page.goto(`${BASE}/#/signin`, { waitUntil: 'networkidle' })
  await shot(page, '01-signin')

  const signIn = page.getByRole('button', { name: /sign in/i }).first()
  if (await signIn.count()) {
    await signIn.click()
    await page.waitForTimeout(1200)
  }
  await shot(page, '02-after-signin')

  for (const [name, hash] of [
    ['03-today', '/#/'],
    ['04-connect', '/#/connect'],
    ['05-meds', '/#/meds'],
    ['06-call', '/#/call'],
    ['07-appointments', '/#/appointments'],
    ['08-safety', '/#/safety'],
  ]) {
    await page.goto(`${BASE}${hash}`, { waitUntil: 'networkidle' }).catch(() => {})
    await shot(page, name)
  }

  const phone = await browser.newPage({ viewport: { width: 400, height: 900 } })
  await phone.goto(`${BASE}/#/signin`, { waitUntil: 'networkidle' })
  const s2 = phone.getByRole('button', { name: /sign in/i }).first()
  if (await s2.count()) { await s2.click(); await phone.waitForTimeout(1200) }
  await phone.goto(`${BASE}/#/meds`, { waitUntil: 'networkidle' }).catch(() => {})
  await shot(phone, '09-meds-phone')

  console.log(errors.length ? `\nCONSOLE ERRORS (${errors.length}):` : '\nno console errors')
  errors.slice(0, 8).forEach((e) => console.log('  ' + e.slice(0, 160)))
  await browser.close()
}

run().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
