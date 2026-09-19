import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
const BASE = process.env.BASE || 'https://careloop-woad.vercel.app'
mkdirSync('/tmp/cl-pages', { recursive: true })
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
await pg.route('**/*', (route) => {
  const url = route.request().url()
  if (/\/call\/(start|clinic|reminder)/.test(url)) return route.abort()
  return route.continue()
})
const press = async (n) => {
  const b = pg.getByRole('button', { name: n }).first()
  if (await b.count()) { await b.click(); await pg.waitForTimeout(1600) }
}
await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await press('Sign up'); await press('Connect Aetna'); await press('Allow')
await pg.waitForTimeout(3000)

for (const [name, hash] of [
  ['today','/#/'], ['meds','/#/meds'], ['call','/#/call'],
  ['appointments','/#/appointments'], ['safety','/#/safety'],
]) {
  await pg.goto(`${BASE}${hash}`, { waitUntil: 'networkidle' })
  await pg.waitForTimeout(2200)
  const m = await pg.evaluate(() => ({
    h: document.body.scrollHeight,
    words: document.body.innerText.trim().split(/\s+/).length,
    boxes: document.querySelectorAll('[class*="border"]').length,
    buttons: [...document.querySelectorAll('button')].filter(b => !b.disabled).length,
    h1: (document.querySelector('h1') || {}).textContent || '',
  }))
  console.log(`  ${name.padEnd(13)} ${String(m.h).padStart(5)}px  ${String(m.words).padStart(4)} words  ${String(m.boxes).padStart(3)} bordered  ${m.buttons} buttons`)
  await pg.screenshot({ path: `/tmp/cl-pages/${name}.png`, fullPage: true })
}
await br.close()
