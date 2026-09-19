const REMINDER_WINDOW_MINUTES = 90
const LATE_AFTER_MINUTES = 120

export function doseStatus(dueAtIso, nowMs) {
  const due = new Date(dueAtIso).getTime()
  if (Number.isNaN(due)) return null
  const minutesLate = (nowMs - due) / 60000
  if (minutesLate < -REMINDER_WINDOW_MINUTES) return 'upcoming'
  if (minutesLate < 0) return 'due_soon'
  if (minutesLate <= LATE_AFTER_MINUTES) return 'due_now'
  return 'missed'
}

export function nextDoseShiftMs(plan) {
  if (!plan || !plan.next_dose || !plan.next_dose.due_at) return 0
  const due = new Date(plan.next_dose.due_at).getTime()
  const asOf = new Date(plan.as_of).getTime()
  if (Number.isNaN(due) || Number.isNaN(asOf)) return 0
  return Math.max(0, due - asOf)
}

export function applyClockShift(plan, shiftMs) {
  if (!plan || !shiftMs) return plan

  const nowMs = new Date(plan.as_of).getTime() + shiftMs
  const doses = (plan.doses || []).map((dose) => {
    if (dose.status === 'taken') return dose
    const status = doseStatus(dose.due_at, nowMs)
    return status ? { ...dose, status } : dose
  })

  const nextDose =
    doses.find((d) => ['upcoming', 'due_soon', 'due_now'].includes(d.status)) ||
    null

  return {
    ...plan,
    doses,
    next_dose: nextDose,
    next_call: nextDose
      ? {
          at: nextDose.due_at,
          time: nextDose.time,
          reason: 'Check in on ' + nextDose.medication + ' ' + nextDose.dosage,
          medication_id: nextDose.medication_id,
        }
      : null,
    doses_taken: doses.filter((d) => d.status === 'taken').length,
    doses_missed: doses.filter((d) => d.status === 'missed').length,
    shifted_now: new Date(nowMs).toISOString(),
  }
}

export function clockAfterShift(asOfIso, shiftMs) {
  const parts = String(asOfIso || '').match(/T(\d{2}):(\d{2})/)
  if (!parts) return null
  const base = Number(parts[1]) * 60 + Number(parts[2])
  const moved = base + Math.round((shiftMs || 0) / 60000)
  const minutes = ((moved % 1440) + 1440) % 1440
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return hh + ':' + mm
}
