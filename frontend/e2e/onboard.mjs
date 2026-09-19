import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const BASE = process.argv[2] || 'http://localhost:5173'
const OUT = process.argv[3] || '/tmp/careloop-onboard'
mkdirSync(OUT, { recursive: true })

const shot = async (page, name) => {
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log('  ' + name)
}

const press = async (page, rx) => {
  const button = page.getByRole('button', { name: rx }).first()
  if (await button.count()) {
    await button.click()
    await page.waitForTimeout(900)
    return true
  }
  console.log('  [not found] ' + rx)
  return false
}

const walk = async (page, tag) => {
  await page.goto(`${BASE}/#/signup`, { waitUntil: 'networkidle' })
  await shot(page, `${tag}-1-signup`)

  await press(page, /^Sign up and choose my insurance$/)
  await shot(page, `${tag}-2-insurance`)

  await press(page, /^Connect .* and load my records$/)
  await shot(page, `${tag}-3-consent`)

  await press(page, /^Allow$/)
  await page.waitForTimeout(5000)
  await shot(page, `${tag}-4-today`)

  await page.goto(`${BASE}/#/meds`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  await shot(page, `${tag}-5-meds`)

  await press(page, /Show where this list comes from/)
  await shot(page, `${tag}-6-meds-open`)

  await page.goto(`${BASE}/#/appointments`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  await shot(page, `${tag}-7-appointments`)

  await page.goto(`${BASE}/#/call`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  await shot(page, `${tag}-8-call`)

  await page.goto(`${BASE}/#/connect`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await shot(page, `${tag}-9-after-reload`)
}

const run = async () => {
  const browser = await chromium.launch()
  const errors = []

  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  wide.on('pageerror', (e) => errors.push('WIDE ' + e.message))
  wide.on('console', (m) => m.type() === 'error' && errors.push('WIDE ' + m.text()))
  await walk(wide, 'wide')

  const phone = await browser.newPage({ viewport: { width: 400, height: 900 } })
  phone.on('pageerror', (e) => errors.push('PHONE ' + e.message))
  await walk(phone, 'phone')

  console.log(errors.length ? `\nERRORS (${errors.length}):` : '\nno page errors')
  errors.slice(0, 10).forEach((e) => console.log('  ' + e.slice(0, 200)))
  await browser.close()
}

run().catch((e) => {
  console.error('FAILED', e.message)
  process.exit(1)
})
