export default function DemoControls({ children }) {
  return (
    <section
      aria-labelledby="demo-controls-heading"
      className="mt-16 rounded-panel border border-dashed border-line-strong bg-sunken px-6 py-7 sm:px-8"
    >
      <h2 id="demo-controls-heading" className="smallcaps text-micro text-clay">
        Demonstration controls, not part of the patient product
      </h2>
      <p className="measure mt-3 text-sm text-ink-2">
        These exist so a reviewer can watch a scheduled call come due without
        waiting for the hour. They change nothing on the record.
      </p>
      <div className="mt-6 max-w-[26rem]">{children}</div>
    </section>
  )
}
