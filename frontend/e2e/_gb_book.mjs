import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 1100 } })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1600); return true } return false }
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow'); await pg.waitForTimeout(2000)
await pg.getByRole('link', { name: 'Check-in' }).first().click(); await pg.waitForTimeout(2500)
await press('Read the check-in in writing'); await pg.waitForTimeout(2500)
// walk the scripted call
for (let step=0; step<14; step++) {
  const btns = await pg.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>!b.disabled).map(b=>b.innerText.trim().replace(/\n/g,' | ')))
  console.log('STEP', step, JSON.stringify(btns.filter(b=>!/Sign out|clock|version code/i.test(b))))
  const inputs = await pg.evaluate(()=>[...document.querySelectorAll('textarea,input[type=text]')].length)
  if (inputs) { console.log('  >> input field present'); break }
  const next = btns.find(b=>/Continue|Next|Say|Reply|Answer|Tell|Yes|Start/i.test(b) && !/call my phone/i.test(b))
  if (!next) break
  await press(next)
}
console.log('---- PAGE ----'); console.log((await pg.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n').slice(0,3000))
await br.close()
