import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 1000 } })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1500); return true } return false }
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.waitForTimeout(2500)
for (const [n,h] of [['call','/#/call'],['appointments','/#/appointments'],['meds','/#/meds']]) {
  await pg.goto(`${BASE}${h}`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(2000)
  console.log('==== '+n)
  console.log('BUTTONS:', JSON.stringify(await pg.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim().slice(0,60)))))
  console.log('INPUTS:', JSON.stringify(await pg.evaluate(()=>[...document.querySelectorAll('input,textarea')].map(b=>b.placeholder||b.name||b.type))))
  console.log('TEXT:', (await pg.evaluate(()=>document.body.innerText)).slice(0,1800))
}
await br.close()
