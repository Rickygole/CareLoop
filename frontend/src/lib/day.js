import { clockLabel } from './format.js'

const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]

const RANK = { taken: 0, upcoming: 1, due_soon: 2, due_now: 3, missed: 4 }

export function countWord(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return String(value)
  return WORDS[n] === undefined ? String(n) : WORDS[n]
}

export function sentenceCase(text) {
  const value = String(text || '')
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function worstStatus(statuses) {
  let worst = 'taken'
  for (const status of statuses || []) {
    if ((RANK[status] || 0) > (RANK[worst] || 0)) worst = status
  }
  return worst
}

export function callEvents(plan) {
  const doses = (plan && plan.doses) || []
  const calls = (plan && plan.calls) || null

  if (!calls || !calls.length) {
    return doses.map((dose) => ({
      at: dose.due_at,
      time: dose.time,
      status: dose.status,
      covers: 1,
      medications: [dose.medication],
      medication_ids: [dose.medication_id],
      moved_into_contact_window: false,
      doses: [dose],
      grouped: false,
    }))
  }

  const pool = doses.map((dose) => ({ dose, used: false }))

  return calls.map((call) => {
    const members = []
    for (const id of call.medication_ids || []) {
      const slot = pool.find(
        (entry) => !entry.used && entry.dose.medication_id === id,
      )
      if (slot) {
        slot.used = true
        members.push(slot.dose)
      }
    }
    return { ...call, doses: members, grouped: true }
  })
}

export function dayCount(plan, events) {
  const calls = Number(
    plan && plan.calls_total !== undefined ? plan.calls_total : events.length,
  )
  const doses = Number(
    plan && plan.doses_total !== undefined
      ? plan.doses_total
      : ((plan && plan.doses) || []).length,
  )

  if (!calls) return 'No calls today.'
  if (calls === 1) {
    return (
      'One call today. It covers ' +
      countWord(doses) +
      (doses === 1 ? ' dose.' : ' doses.')
    )
  }
  return (
    sentenceCase(countWord(calls)) +
    ' calls today. They cover ' +
    countWord(doses) +
    (doses === 1 ? ' dose.' : ' doses.')
  )
}

export function coversLine(event) {
  const n = Number(event && event.covers) || (event.doses || []).length
  return 'One call, ' + countWord(n) + (n === 1 ? ' dose' : ' doses')
}

export function groupingLine(event, past) {
  const members = (event && event.doses) || []
  if (members.length < 2) return ''

  const times = []
  for (const dose of members) {
    const label = clockLabel(dose.time)
    if (!times.includes(label)) times.push(label)
  }
  const when =
    times.length > 1
      ? times.slice(0, -1).join(', ') + ' and ' + times[times.length - 1]
      : times[0]

  return (
    'Your ' +
    when +
    ' doses were close enough together that CareLoop ' +
    (past ? 'rang' : 'rings') +
    ' once instead of ' +
    countWord(members.length) +
    ' times.'
  )
}

export function windowLine(plan) {
  const window = (plan && plan.contact_window) || null
  if (!window) return ''
  return (
    'CareLoop never rings outside ' +
    clockLabel(window.start) +
    ' to ' +
    clockLabel(window.end) +
    ', New York time.'
  )
}

export function movedLine(event) {
  if (!event || !event.moved_into_contact_window) return ''
  return (
    'One of these doses falls before CareLoop is allowed to ring, so the call sits at ' +
    clockLabel(event.time) +
    '.'
  )
}

export function dayLabel(plan) {
  const raw = (plan && (plan.shifted_now || plan.as_of)) || null
  const when = raw ? new Date(raw) : new Date()
  const date = Number.isNaN(when.getTime()) ? new Date() : when
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function visitGutter(visit) {
  const raw = (visit && (visit.starts_at || visit.due_date)) || ''
  const when = new Date(raw)
  if (Number.isNaN(when.getTime())) return { time: 'Soon', state: 'Booked' }
  return {
    time: when.toLocaleDateString(undefined, { weekday: 'long' }),
    state: when.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
]

export function ordinalWord(value) {
  const n = Number(value)
  return ORDINALS[n - 1] || String(n)
}

export function nextCallIndex(plan, events) {
  const dose = plan && plan.next_dose
  if (!dose) return -1
  return events.findIndex((event) =>
    (event.doses || []).some(
      (member) =>
        member.medication_id === dose.medication_id &&
        member.time === dose.time,
    ),
  )
}
