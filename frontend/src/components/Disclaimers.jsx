export const SAFETY_NOTE =
  'Please do not describe your own real health. This is a demonstration and every record in it is fictional.'

export function SafetyNote({ className = '' }) {
  return (
    <p className={'measure flex items-start gap-3 text-sm text-ink ' + className}>
      <span aria-hidden="true" className="leading-[1.6] text-moderate">
        {String.fromCharCode(9651)}
      </span>
      <span>{SAFETY_NOTE}</span>
    </p>
  )
}

