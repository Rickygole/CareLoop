import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
const BASE = 'https://careloop-woad.vercel.app'
const OUT = '/tmp/careloop-new'
mkdirSync(OUT, { recursive: true })
const shot = async (p, n) => { await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log('  ' + n) }
const press = async (p, rx) => {
  const b = p.getByRole('button', { name: rx }).first()
  if (await b.count()) { await b.click(); await p.waitForTimeout(1800); return true }
  console.log('  [not found] ' + rx); return false
}
const run = async () => {
  const br = await chromium.launch()
  const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  pg.on('pageerror', e => errs.push(e.message))
  pg.on('console', m => m.type() === 'error' && errs.push('CONSOLE ' + m.text()))

  await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await shot(pg, '1-first-screen')
  await press(pg, /sign up/i)
  await shot(pg, '2-insurance')
  await press(pg, /connect .*load my records/i)
  await shot(pg, '3-consent')
  await press(pg, /^allow$/i)
  await pg.waitForTimeout(4000)
  await shot(pg, '4-today')

  console.log('\n  === THE REFRESH TEST ===')
  const before = pg.url()
  await pg.reload({ waitUntil: 'networkidle' })
  await pg.waitForTimeout(3000)
  console.log('  before:', before.split('#')[1] || '/')
  console.log('  after :', pg.url().split('#')[1] || '/')
  await shot(pg, '5-after-reload')

  console.log(errs.length ? '\n  ERRORS: ' + errs.slice(0,4).join(' | ') : '\n  no console or page errors')
  await br.close()
}
run().catch(e => { console.error('FAILED', e.message); process.exit(1) })
