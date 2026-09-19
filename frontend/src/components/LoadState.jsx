import Notice from './Notice.jsx'
import { BTN_SECONDARY } from '../lib/ui.js'
import { READ_TIMEOUT_SECONDS } from '../lib/api.js'

export function Loading({ what }) {
  return (
    <p
      aria-live="polite"
      aria-busy="true"
      className="measure text-lg font-semibold text-ink-2"
    >
      {what}
      <span className="mt-2 block text-base font-normal text-ink-2">
        If there is no answer within {READ_TIMEOUT_SECONDS} seconds, CareLoop
        stops waiting and says so.
      </span>
    </p>
  )
}

export function LoadFailed({ what, detail, onRetry }) {
  return (
    <Notice role="alert" tone="alarm" word="Not loaded" className="measure">
      <p>{what}</p>
      {detail ? <p className="mt-3 text-sm text-ink-2">{detail}</p> : null}
      <p className="mt-3 text-sm">
        Nothing is shown below, because nothing was read. This is not a
        statement that your record is empty.
      </p>
      <button type="button" onClick={onRetry} className={BTN_SECONDARY + ' mt-6'}>
        Try again
      </button>
    </Notice>
  )
}

export function RefreshFailed({ what, detail, onRetry }) {
  return (
    <Notice
      role="status"
      tone="caution"
      word="Not refreshed"
      className="measure mb-10"
    >
      <p>{what}</p>
      {detail ? <p className="mt-3 text-sm text-ink-2">{detail}</p> : null}
      <p className="mt-3 text-sm">
        What is below is the last thing CareLoop read, not what MyHealth holds
        right now.
      </p>
      <button type="button" onClick={onRetry} className={BTN_SECONDARY + ' mt-6'}>
        Try again
      </button>
    </Notice>
  )
}
