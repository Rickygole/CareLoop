import { chromium } from '@playwright/test'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); await b.waitFor({state:'visible',timeout:15000}); await b.click(); await pg.waitForTimeout(1600) }
await pg.goto('https://careloop-woad.vercel.app/', { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.waitForTimeout(3000)
await pg.goto('https://careloop-woad.vercel.app/#/call', { waitUntil: 'networkidle' })
await press('Read the check-in in writing'); await pg.waitForTimeout(3000)
await pg.locator('textarea').first().fill('I have been dizzy for two days and my ankles are swollen')
await pg.waitForTimeout(800)
const s = pg.getByRole('button', { name: 'Send my answer' }).first()
await s.waitFor({ state: 'visible', timeout: 15000 }); await s.click()
await pg.waitForTimeout(12000)
const el = pg.locator('li', { hasText: 'CareLoop booked it' }).first()
if (await el.count()) { await el.screenshot({ path: '/tmp/cl-payoff/booking-crop.png' }); console.log('  cropped the booking turn') }
else console.log('  booking turn not found')
await br.close()
