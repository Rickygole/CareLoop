export default function Screen({ title, lead, children }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="hold pb-10 pt-10 sm:pb-12 sm:pt-12">
          <h1 className="display max-w-[22ch] text-3xl text-ink">{title}</h1>
          {lead ? (
            <p className="measure mt-5 text-ink-2 sm:text-lg">{lead}</p>
          ) : null}
        </div>
      </header>

      <div className="hold pb-16 pt-10 sm:pt-12">{children}</div>
    </>
  )
}
