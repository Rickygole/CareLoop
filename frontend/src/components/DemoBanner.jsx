export default function DemoBanner() {
  return (
    <p className="border-b border-line bg-brand-wash px-6 py-3 text-center text-sm font-semibold text-brand-deep sm:px-8">
      <span aria-hidden="true" className="mr-3">
        {String.fromCharCode(9679)}
      </span>
      Demo system. All patient data is synthetic.
    </p>
  )
}
