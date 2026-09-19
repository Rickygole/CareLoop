import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 1000 } })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1800); return true } return false }
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow'); await pg.waitForTimeout(2000)
await pg.getByRole('link', { name: 'Medications' }).first().click()
await pg.waitForTimeout(3000)
console.log('URL', pg.url())
const dump = async (t) => { console.log('===== '+t+' url='+pg.url()); console.log((await pg.evaluate(()=>document.body.innerText)).replace(/\n{2,}/g,'\n')) }
await dump('BEFORE')
console.log('BUTTONS', JSON.stringify(await pg.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim().replace(/\n/g,' | ').slice(0,70)))))
if (await press('Get the new prescription from MyHealth')) { await pg.waitForTimeout(3000); await dump('AFTER PULL') } else console.log('!! pull button not present')
await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(3000); await dump('AFTER RELOAD 1')
await pg.waitForTimeout(15000); await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(3000); await dump('AFTER RELOAD 2 (+20s)')
await pg.waitForTimeout(25000); await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(3000); await dump('AFTER RELOAD 3 (+50s)')
await br.close()
