export default function Screen({ title, lead, children }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="hold pb-7 pt-7 sm:pb-8 sm:pt-8">
          <h1 className="display max-w-[22ch] text-3xl text-ink">{title}</h1>
          {lead ? <p className="measure mt-3 text-ink-2">{lead}</p> : null}
        </div>
      </header>

      <div className="hold pb-16 pt-8 sm:pt-10">{children}</div>
    </>
  )
}
