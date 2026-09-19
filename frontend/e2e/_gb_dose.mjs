import { chromium } from '@playwright/test'
const BASE='https://careloop-woad.vercel.app'
const ANS = process.env.ANS
const br = await chromium.launch()
const pg = await br.newPage({ viewport:{width:1280,height:1100} })
const press = async n => { const b=pg.getByRole('button',{name:n}).first(); if(await b.count()){await b.click();await pg.waitForTimeout(1600);return true} return false }
await pg.goto(`${BASE}/`,{waitUntil:'networkidle'})
await press('Sign up'); await press('Connect Aetna'); await press('Allow'); await pg.waitForTimeout(2000)
const today = async tag => { await pg.goto(`${BASE}/#/`,{waitUntil:'networkidle'}); await pg.waitForTimeout(2500)
  const t = await pg.evaluate(()=>document.body.innerText)
  const rows = [...t.matchAll(/(\d{1,2}:\d{2} [AP]M)\n(TAKEN|DUE SOON|DUE NOW|LATER TODAY|MISSED)\n(\w+)/g)].map(m=>`${m[1]} ${m[2]} ${m[3]}`)
  console.log(tag, JSON.stringify(rows)) }
await today('TODAY BEFORE:')
await pg.goto(`${BASE}/#/call`,{waitUntil:'networkidle'}); await pg.waitForTimeout(2000)
await press('Read the check-in in writing'); await pg.waitForTimeout(2000)
await pg.locator('textarea, input[type=text]').first().fill(ANS)
await press('Send my answer'); await pg.waitForTimeout(10000)
const t = await pg.evaluate(()=>document.body.innerText)
const said = t.split('The written check-in is running')[1] || t
console.log('WHAT CARELOOP SAID BACK:')
console.log(said.replace(/\n{2,}/g,'\n').split('PLEASE READ THIS')[0].slice(-1400))
await today('TODAY AFTER: ')
await br.close()
