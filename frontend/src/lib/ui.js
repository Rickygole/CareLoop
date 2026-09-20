export const BTN_BASE =
  'pressable inline-flex items-center justify-center gap-3 rounded-control border border-transparent text-center font-semibold disabled:cursor-not-allowed'

const BTN_OFF =
  ' disabled:border-line disabled:bg-sunken disabled:text-ink-2 disabled:shadow-none'

export const BTN_HERO =
  BTN_BASE +
  ' ledge-ink min-h-[56px] bg-brand px-8 py-4 text-lg text-brand-ink hover:bg-brand-deep' +
  BTN_OFF

export const BTN_PRIMARY =
  BTN_BASE +
  ' ledge-ink min-h-[52px] bg-brand px-7 py-3 text-base text-brand-ink hover:bg-brand-deep' +
  BTN_OFF

export const BTN_SECONDARY =
  BTN_BASE +
  ' min-h-[52px] border border-line-strong bg-surface px-6 py-3 text-base text-ink hover:border-ink hover:bg-sunken'

export const BTN_QUIET =
  BTN_BASE +
  ' min-h-[48px] border border-line bg-surface px-5 py-2.5 text-sm text-ink-2 hover:border-line-strong hover:bg-sunken hover:text-ink'

export const LINK =
  'inline-flex min-h-[44px] items-center font-semibold text-brand underline decoration-brand-tint decoration-2 underline-offset-4 hover:decoration-brand'

export const LINK_INLINE =
  'inline-flex min-h-[44px] items-center align-middle font-semibold underline underline-offset-4'

export const CARD = 'rounded-card border border-line bg-surface'

export const CARD_ACCENT =
  'rounded-card border border-line bg-surface border-l-4 border-l-brand'

export const PANEL = 'rounded-panel border border-line bg-surface'

export const INSET = 'rounded-card bg-sunken'

export const FOLD = 'overflow-hidden rounded-card border border-line bg-surface'

export const FOLD_TOGGLE =
  'block w-full cursor-pointer px-5 py-5 text-left hover:bg-sunken sm:px-7'

export const FOLD_BODY = 'border-t border-line bg-surface px-5 py-6 sm:px-7'

export const SECTION = 'mt-12 sm:mt-16'

export const LEAD = 'measure text-lg leading-[1.5] text-ink-2'

export const EYEBROW = 'smallcaps text-micro text-ink-2'

export const FIELD =
  'pressable min-h-[54px] w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-ink placeholder:text-ink-2 hover:border-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand'

export const LABEL = 'block text-sm font-semibold text-ink'

export const SELECT =
  'field-select min-h-[52px] rounded-control border border-line-strong bg-surface px-4 py-3 font-semibold text-ink'
