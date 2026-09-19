export const DOSE_STATUS = {
  taken: {
    label: 'Taken',
    glyph: String.fromCharCode(10003),
    tone: 'text-mild',
  },
  due_now: {
    label: 'Due now',
    glyph: String.fromCharCode(9679),
    tone: 'text-brand-deep',
  },
  due_soon: {
    label: 'Due soon',
    glyph: String.fromCharCode(9675),
    tone: 'text-ink-2',
  },
  missed: {
    label: 'Missed',
    glyph: String.fromCharCode(9651),
    tone: 'text-severe',
  },
  upcoming: {
    label: 'Later today',
    glyph: String.fromCharCode(9675),
    tone: 'text-ink-2',
  },
}

export function doseMeta(status) {
  return DOSE_STATUS[status] || DOSE_STATUS.upcoming
}
