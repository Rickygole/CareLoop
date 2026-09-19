export function clockLabel(hhmm) {
  const [h, m] = String(hhmm || '').split(':')
  const hour = Number(h)
  if (Number.isNaN(hour)) return String(hhmm || '')
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return twelve + ':' + (m || '00') + ' ' + suffix
}

export function dateTimeLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso || '')
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function groupSchedule(schedule) {
  const byMedication = new Map()
  for (const dose of schedule || []) {
    const key = dose.medication_id || dose.medication
    if (!byMedication.has(key)) {
      byMedication.set(key, {
        key,
        medication: dose.medication,
        dosage: dose.dosage,
        frequency: dose.frequency,
        prescriber: dose.prescriber,
        times: [],
      })
    }
    byMedication.get(key).times.push(dose.time)
  }
  return Array.from(byMedication.values()).map((med) => ({
    ...med,
    times: med.times.slice().sort(),
  }))
}

export function nextDoseTime(schedule, now = new Date()) {
  const times = (schedule || []).map((d) => d.time).sort()
  if (!times.length) return null
  const minutes = now.getHours() * 60 + now.getMinutes()
  const upcoming = times.find((t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m >= minutes
  })
  return upcoming || times[0]
}

export function nextDose(schedule, now = new Date()) {
  const doses = (schedule || [])
    .slice()
    .sort((a, b) => String(a.time).localeCompare(String(b.time)))
  if (!doses.length) return null
  const minutes = now.getHours() * 60 + now.getMinutes()
  const upcoming = doses.find((d) => {
    const [h, m] = String(d.time).split(':').map(Number)
    return h * 60 + m >= minutes
  })
  return upcoming || doses[0]
}

export function minutesUntil(hhmm, now = new Date()) {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  if (Number.isNaN(h)) return null
  const target = h * 60 + (m || 0)
  const current = now.getHours() * 60 + now.getMinutes()
  const delta = target - current
  return delta >= 0 ? delta : delta + 24 * 60
}

export function relativeLabel(hhmm, now = new Date()) {
  const delta = minutesUntil(hhmm, now)
  if (delta === null) return ''
  if (delta === 0) return 'now'
  if (delta < 60) return 'in ' + delta + ' min'
  const hours = Math.floor(delta / 60)
  const mins = delta % 60
  if (hours >= 12) return 'tomorrow'
  return 'in ' + hours + 'h' + (mins ? ' ' + mins + 'm' : '')
}
