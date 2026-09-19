import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const ANSWER = process.env.ANS || 'I took it, but I have been really dizzy and my ankles are swollen'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 1100 } })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1600); return true } return false }
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow'); await pg.waitForTimeout(2000)
const doses = async () => { const t = await pg.evaluate(()=>document.body.innerText); return (t.match(/✓/g)||[]).length }
await pg.getByRole('link', { name: 'Check-in' }).first().click(); await pg.waitForTimeout(2500)
await press('Read the check-in in writing'); await pg.waitForTimeout(2000)
await pg.locator('textarea, input[type=text]').first().fill(ANSWER)
await press('Send my answer'); await pg.waitForTimeout(9000)
const txt = await pg.evaluate(()=>document.body.innerText)
console.log('---- WHAT THE CHECK-IN SAID ----')
console.log(txt.split('The written check-in is running')[1]?.replace(/\n{2,}/g,'\n').slice(0,3000))
// now go to Appointments and poll
for (let i=0;i<10;i++){
  await pg.goto(`${BASE}/#/appointments`, { waitUntil:'networkidle' }); await pg.waitForTimeout(2500)
  const a = await pg.evaluate(()=>document.body.innerText)
  const vances = (a.match(/Elena Vance/g)||[]).length
  const booked = (a.match(/BOOKED/g)||[]).length
  console.log(`appointments t+${i*8}s  BOOKED=${booked}  ElenaVance=${vances}`)
  await pg.waitForTimeout(6000)
}
await br.close()
