import { chromium } from '@playwright/test'
const BASE = process.env.BASE || 'http://localhost:5173'

const shoot = async (mode, file) => {
  const br = await chromium.launch()
  const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
  for (const b of ['**/call/start', '**/call/clinic', '**/call/reminder']) await pg.route(b, (r) => r.abort())

  const doctor = (plan) => {
    if (mode === 'done') {
      plan.doses = plan.doses.map((d) => ({ ...d, status: 'taken' }))
      plan.calls = plan.calls.map((c) => ({ ...c, status: 'taken' }))
      plan.next_dose = null
      plan.next_call = null
      plan.doses_taken = plan.doses.length
    }
    if (mode === 'one') {
      plan.doses = [plan.doses[3]]
      plan.calls = [plan.calls[1]]
      plan.doses_total = 1
      plan.calls_total = 1
      plan.next_dose = plan.doses[0]
    }
    if (mode === 'none') {
      plan.doses = []
      plan.calls = []
      plan.doses_total = 0
      plan.calls_total = 0
      plan.next_dose = null
    }
    return plan
  }

  for (const url of ['**/regimen/**', '**/portal/sync']) {
    await pg.route(url, async (route) => {
      const res = await route.fetch()
      const body = await res.json()
      if (body.schedule) body.schedule = doctor(body.schedule)
      await route.fulfill({ response: res, body: JSON.stringify(body) })
    })
  }

  await pg.goto(BASE + '/', { waitUntil: 'networkidle' })
  const press = async (rx) => { const b = pg.getByRole('button', { name: rx }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1200) } }
  await press(/sign up and choose/i); await press(/connect aetna and load my records/i); await press(/^allow$/i)
  await pg.waitForTimeout(2500)
  await pg.locator('section[aria-labelledby="day-heading"]').screenshot({ path: file })
  await br.close()
}

await shoot('done', '/tmp/cl-b/empty-done.png')
await shoot('one', '/tmp/cl-b/empty-one.png')
await shoot('none', '/tmp/cl-b/empty-none.png')
console.log('shot')
