export function nameKey(text) {
  return String(text || '')
    .split('(')[0]
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
}

export function flaggedNames(findings) {
  const names = new Set()
  for (const finding of findings || []) {
    const parts = [
      ...((finding && finding.labels) || []),
      ...((finding && finding.ingredients) || []),
    ]
    for (const part of parts) {
      const word = nameKey(part)
      if (word) names.add(word)
    }
  }
  return names
}

export function isFlagged(med, names) {
  if (!names || !names.size) return false
  return names.has(nameKey(med && med.medication))
}

export function pinFlagged(list, names, shown) {
  const marked = (list || []).filter((med) => isFlagged(med, names))
  if (!marked.length) return (list || []).slice(0, shown)
  const rest = (list || []).filter((med) => !isFlagged(med, names))
  return marked.concat(rest).slice(0, Math.max(shown, marked.length))
}

export function pairLabels(finding) {
  const parts =
    (finding && finding.labels) || (finding && finding.ingredients) || []
  return parts.map((part) => String(part || ''))
}
