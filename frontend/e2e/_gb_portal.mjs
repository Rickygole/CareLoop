import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 1000 } })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1500); return true } return false }
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.goto(`${BASE}/#/meds`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(2500)
const state = async (tag) => {
  const t = await pg.evaluate(()=>document.body.innerText)
  const motrin = /Motrin|ibuprofen/i.test(t)
  const held = (t.match(/Something on this list is worth checking|Nothing on this list conflicts/)||[])[0]
  const pairs = [...t.matchAll(/Major interaction/g)].length
  console.log(`${tag.padEnd(28)} Motrin=${motrin}  heading="${held}"  majorBlocks=${pairs}`)
}
await state('before pull')
console.log('--- clicking Get the new prescription from MyHealth')
await press('Get the new prescription from MyHealth')
await pg.waitForTimeout(2500)
await state('right after pull')
for (let i=1;i<=8;i++){
  await pg.reload({ waitUntil:'networkidle' }); await pg.waitForTimeout(2500)
  await state(`reload #${i} (t+${i*5}s)`)
}
await br.close()
