export const BTN_BASE =
  'pressable inline-flex items-center justify-center gap-3 rounded-control font-semibold disabled:cursor-not-allowed'

export const BTN_HERO =
  BTN_BASE +
  ' ledge min-h-[60px] bg-brand px-9 py-4 text-lg text-brand-ink hover:bg-brand-deep disabled:bg-sunken disabled:text-ink-2 disabled:shadow-none'

export const BTN_PRIMARY =
  BTN_BASE +
  ' ledge min-h-[52px] bg-brand px-7 py-3.5 text-base text-brand-ink hover:bg-brand-deep disabled:bg-sunken disabled:text-ink-2 disabled:shadow-none'

export const BTN_SECONDARY =
  BTN_BASE +
  ' min-h-[52px] border border-line-strong bg-surface px-7 py-3.5 text-base text-ink hover:bg-sunken'

export const BTN_QUIET =
  BTN_BASE +
  ' min-h-[48px] border border-line bg-surface px-6 py-3 text-base text-ink-2 hover:border-line-strong hover:text-ink'

export const LINK =
  'inline-flex min-h-[44px] items-center font-semibold text-brand underline'

export const LINK_INLINE =
  'inline-flex min-h-[44px] items-center align-middle font-semibold underline'

export const CARD = 'ledge rounded-card border border-line bg-surface'

export const CARD_ACCENT =
  'ledge-strong rounded-card border border-line bg-surface border-l-4 border-l-brand'

export const PANEL = 'ledge-strong rounded-panel border border-line bg-surface'

export const FOLD =
  'ledge overflow-hidden rounded-card border border-line bg-sunken'

export const FOLD_TOGGLE =
  'block w-full cursor-pointer px-6 py-6 text-left sm:px-8'

export const FOLD_BODY = 'bg-surface px-6 py-6 sm:px-8'

export const SECTION = 'mt-12'

export const LEAD = 'measure text-lg leading-[1.45] text-ink'

export const FIELD =
  'min-h-[52px] w-full rounded-control border border-line-strong bg-surface px-5 py-3 text-ink placeholder:text-ink-2 focus:border-brand'

export const SELECT =
  'field-select min-h-[52px] rounded-control border border-line-strong bg-surface px-5 py-3 font-semibold text-ink'
