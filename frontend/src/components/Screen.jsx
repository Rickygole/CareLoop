export default function Screen({ title, lead, children }) {
  return (
    <>
      <header className="border-b-4 border-ink bg-canvas">
        <div className="hold pb-14 pt-14 sm:pb-20 sm:pt-20">
          <h1 className="display max-w-[17ch] text-3xl text-ink">{title}</h1>
          {lead ? (
            <p className="measure mt-7 text-ink-2 sm:text-lg sm:leading-[1.5]">
              {lead}
            </p>
          ) : null}
        </div>
      </header>

      <div className="hold pb-16 pt-12 sm:pt-16">{children}</div>
    </>
  )
}
