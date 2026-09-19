export default function RegimenSnapshot({ hash, previousHash, count, flash }) {
  if (!hash) return null

  return (
    <section
      aria-labelledby="snapshot-heading"
      className={
        'ledge mt-10 rounded-card border border-line bg-sunken px-6 py-6 text-ink sm:px-8 ' +
        (flash ? 'trace-flash' : '')
      }
    >
      <h2 id="snapshot-heading" className="smallcaps text-micro text-clay">
        Which version of the list this is
      </h2>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <span className="numeric font-mono text-lg font-semibold text-ink">
          {hash}
        </span>
        {previousHash && previousHash !== hash ? (
          <span className="numeric font-mono text-xs text-ink-2">
            replaces {previousHash}
          </span>
        ) : null}
      </p>
      <p className="measure mt-4 text-sm text-ink-2">
        A fingerprint of the {count} {count === 1 ? 'medicine' : 'medicines'} on
        this list. Change the list and the fingerprint changes with it, so every
        call can be tied back to the exact list it was made against.
      </p>
    </section>
  )
}
