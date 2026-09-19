import { chromium } from '@playwright/test'
const BASE = 'https://careloop-woad.vercel.app'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 1000 } })
const press = async (n) => { const b = pg.getByRole('button', { name: n }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1800); return true } return false }
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow'); await pg.waitForTimeout(2000)
await pg.getByRole('link', { name: 'Medications' }).first().click(); await pg.waitForTimeout(3000)
const sig = async (t) => {
  const r = await pg.evaluate(()=>{ const x=document.body.innerText
    return { motrin: /Motrin/i.test(x), n:(x.match(/All (\d+) medications/)||[])[1],
      pairs: [...x.matchAll(/appear together|Taken together these two carry/g)].length,
      conc: [...x.matchAll(/(additive bleeding risk[^.]*)/g)].map(m=>m[1]).slice(0,4),
      pending: /new prescription is waiting/i.test(x) }})
  console.log(t.padEnd(26), JSON.stringify(r))
}
await sig('BEFORE')
const ok = await pg.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/Get the new prescription/i.test(b.innerText)); if(b){b.click();return true} return false })
console.log('clicked:', ok); await pg.waitForTimeout(4000)
await sig('RIGHT AFTER PULL')
for (let i=1;i<=8;i++){ await pg.waitForTimeout(6000); await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(2500); await sig(`RELOAD #${i}`) }
await br.close()
