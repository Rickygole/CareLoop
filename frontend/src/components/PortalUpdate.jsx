import Notice from './Notice.jsx'
import { BTN_PRIMARY, BTN_SECONDARY, CARD } from '../lib/ui.js'
import { dateTimeLabel } from '../lib/format.js'

export default function PortalUpdate({
  syncedAt,
  summary,
  pending,
  checking,
  pulling,
  failed,
  onCheck,
  onPull,
}) {
  return (
    <div className="mt-9">
      <div className={CARD + ' px-7 py-7'}>
        <p className="smallcaps text-micro text-clay">
          MyHealth stays the source of truth
        </p>
        <p className="measure mt-4 text-ink">
          {syncedAt
            ? 'CareLoop read the portal when this page opened at ' +
              dateTimeLabel(syncedAt) +
              '. You can ask it to read again.'
            : 'CareLoop has not read the portal on this visit. You can ask it to read now.'}
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={onCheck}
            disabled={checking || pulling}
            className={BTN_SECONDARY}
          >
            {checking ? 'Reading MyHealth...' : 'Check MyHealth for updates'}
          </button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="measure mt-5 text-sm text-ink-2 empty:hidden"
        >
          {summary}
        </p>
      </div>

      {pending ? (
        <Notice
          tone="caution"
          word="A new prescription is waiting in MyHealth"
          className="enter-fade mt-8"
        >
          Your prescriber has sent a new prescription to MyHealth. It arrives
          from the portal, so nobody types it in here and nobody edits a call
          time by hand.
          <span className="mt-6 block">
            <button
              type="button"
              onClick={onPull}
              disabled={pulling || checking}
              className={BTN_PRIMARY}
            >
              {pulling
                ? 'Pulling it across...'
                : 'Pull the new prescription from MyHealth'}
            </button>
          </span>
        </Notice>
      ) : null}

      {failed ? (
        <Notice
          role="alert"
          tone="alarm"
          word="MyHealth did not answer"
          className="enter-fade measure mt-8"
          size="sm"
        >
          CareLoop could not read the portal just now. Your list is unchanged
          and still shows the last thing MyHealth sent. Try the button again.
        </Notice>
      ) : null}
    </div>
  )
}
