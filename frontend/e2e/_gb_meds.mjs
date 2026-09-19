import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 1000 } })
pg.on('console', m => { if (m.type()==='error') console.log('PAGEERR', m.text().slice(0,200)) })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1800); return true } return false }
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.goto(`${BASE}/#/meds`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(3000)
console.log('=========== BEFORE ==========='); console.log(await pg.evaluate(()=>document.body.innerText))
await press('Get the new prescription from MyHealth'); await pg.waitForTimeout(3000)
console.log('=========== AFTER PULL ==========='); console.log(await pg.evaluate(()=>document.body.innerText))
await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(3000)
console.log('=========== AFTER RELOAD ==========='); console.log(await pg.evaluate(()=>document.body.innerText))
await br.close()
