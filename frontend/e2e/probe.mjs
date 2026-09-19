import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
const press = async (rx) => {
  const b = pg.getByRole('button', { name: rx }).first()
  if (await b.count()) { await b.click(); await pg.waitForTimeout(1800); return true }
  return false
}
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press(/sign up/i); await press(/connect .*load my records/i); await press(/^allow$/i)
await pg.waitForTimeout(3000)
await pg.goto(`${BASE}/#/call`, { waitUntil: 'networkidle' })
console.log('  before:', (await pg.$$('button')).length, 'buttons,', (await pg.$$('textarea')).length, 'textareas')
await press(/read the check-in in writing/i)
await pg.waitForTimeout(2500)
const btns = await pg.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0,40)))
console.log('  after pressing "read in writing":')
btns.forEach(b => console.log('    btn:', b))
console.log('    textareas:', (await pg.$$('textarea')).length)
const inputs = await pg.evaluate(() => [...document.querySelectorAll('input,textarea')].map(i => i.tagName + ':' + (i.placeholder||i.type||'')))
inputs.forEach(i => console.log('    field:', i))
await br.close()
