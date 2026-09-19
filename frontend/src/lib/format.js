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

export function groupSchedule(doses) {
  const byMedication = new Map()
  for (const dose of doses || []) {
    const key = dose.medication_id || dose.medication
    if (!byMedication.has(key)) {
      byMedication.set(key, {
        key,
        medication: dose.medication,
        dosage: dose.dosage,
        prescriber: dose.prescriber,
        doses: [],
      })
    }
    byMedication.get(key).doses.push({ time: dose.time, status: dose.status })
  }
  return Array.from(byMedication.values()).map((med) => ({
    ...med,
    doses: med.doses.slice().sort((a, b) => a.time.localeCompare(b.time)),
  }))
}
