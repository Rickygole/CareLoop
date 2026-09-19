import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
const press = async (n) => {
  const b = pg.getByRole('button', { name: n }).first()
  if (await b.count()) { await b.click(); await pg.waitForTimeout(1600) }
}
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.waitForTimeout(3000)
await pg.goto(`${BASE}/#/call`, { waitUntil: 'networkidle' })
await press('Read the check-in in writing')
await pg.waitForTimeout(3000)

const state = async (label) => {
  const s = await pg.evaluate(() => [...document.querySelectorAll('button')]
    .filter(b => /send/i.test(b.textContent))
    .map(b => ({ text: b.textContent.trim(), disabled: b.disabled })))
  console.log(`  ${label}:`, JSON.stringify(s))
}
await state('before typing')
await pg.locator('textarea').first().fill('I have been dizzy for two days and my ankles are swollen')
await pg.waitForTimeout(600)
await state('after fill()')
await pg.locator('textarea').first().press('a')
await pg.locator('textarea').first().press('Backspace')
await pg.waitForTimeout(600)
await state('after a real keystroke')
await br.close()
