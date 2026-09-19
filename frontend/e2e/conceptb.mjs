import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = process.env.OUT || '/tmp/cl-b'
mkdirSync(OUT, { recursive: true })

const shoot = async (br, width, height) => {
  const pg = await br.newPage({ viewport: { width, height } })
  pg.on('console', (m) => {
    if (m.type() === 'error') console.log('  console error: ' + m.text())
  })
  for (const blocked of ['**/call/start', '**/call/clinic', '**/call/reminder']) {
    await pg.route(blocked, (route) => route.abort())
  }
  await pg.goto(BASE + '/', { waitUntil: 'networkidle' })
  const press = async (rx) => {
    const b = pg.getByRole('button', { name: rx }).first()
    if (await b.count()) {
      await b.click()
      await pg.waitForTimeout(1200)
    }
  }
  await press(/sign up and choose/i)
  await press(/connect aetna and load my records/i)
  await press(/^allow$/i)
  await pg.waitForTimeout(3000)
  await pg.screenshot({ path: OUT + '/today-' + width + '.png', fullPage: true })
  console.log('  today ' + width + ': ' + (await pg.evaluate(() => document.body.scrollHeight)) + 'px')

  await pg.goto(BASE + '/#/call', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(2000)
  await pg.screenshot({ path: OUT + '/call-' + width + '.png', fullPage: true })
  console.log('  call ' + width + ': ' + (await pg.evaluate(() => document.body.scrollHeight)) + 'px')

  await pg.goto(BASE + '/#/meds', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(2000)
  await pg.screenshot({ path: OUT + '/meds-' + width + '.png', fullPage: true })
  await pg.close()
}

const br = await chromium.launch()
await shoot(br, 1280, 900)
await shoot(br, 400, 900)
await br.close()
