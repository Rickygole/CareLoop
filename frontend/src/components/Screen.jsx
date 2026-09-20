import { LEAD } from '../lib/ui.js'

export default function Screen({ title, lead, children }) {
  return (
    <div className="hold pb-24 pt-9 sm:pt-14">
      <header>
        <h1 className="display max-w-[20ch] text-3xl text-ink">{title}</h1>
        {lead ? <p className={LEAD + ' mt-4'}>{lead}</p> : null}
      </header>

      <div className="mt-8 sm:mt-10">{children}</div>
    </div>
  )
}
