import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SRC = join(ROOT, 'src')
const CSS = join(SRC, 'index.css')

const BODY_MIN = 7
const SHAPE_MIN = 3
const TYPE_FLOOR_PX = 16
const TARGET_FLOOR_PX = 44

function channel(value) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex) {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function ratio(a, b) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function readTokens() {
  const css = readFileSync(CSS, 'utf8')
  const tokens = new Map()
  const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g
  let match
  while ((match = re.exec(css))) tokens.set(match[1], match[2].toLowerCase())
  return tokens
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(jsx?|css)$/.test(name)) out.push(full)
  }
  return out
}

const TOKENS = readTokens()
const failures = []
const rows = []

function colourOf(name) {
  if (name.startsWith('#')) return name
  const value = TOKENS.get(name)
  if (!value) {
    failures.push('unknown colour token: ' + name)
    return '#ff00ff'
  }
  return value
}

function check(fg, bg, role, min) {
  const value = ratio(colourOf(fg), colourOf(bg))
  const ok = value >= min
  rows.push({ fg, bg, role, min, value, ok })
  if (!ok) {
    failures.push(
      role + ': ' + fg + ' on ' + bg + ' is ' + value.toFixed(2) + ':1, needs ' + min + ':1',
    )
  }
}

const TEXT_PAIRS = [
  ['ink', 'canvas', 'body on the page'],
  ['ink', 'surface', 'body on a card'],
  ['ink', 'sunken', 'body on a sunken card'],
  ['ink', 'sand', 'body on the gold rail'],
  ['ink-2', 'canvas', 'secondary body on the page'],
  ['ink-2', 'surface', 'secondary body on a card'],
  ['ink-2', 'sunken', 'secondary body on a sunken card'],
  ['ink', 'mild-tint', 'body on the all clear tint'],
  ['ink', 'moderate-tint', 'body on the caution tint'],
  ['ink', 'severe-tint', 'body on the severe tint'],
  ['ink', 'emergency-tint', 'body on the emergency tint'],
  ['ink', 'brand-wash', 'body on the ocean wash'],
  ['ink-2', 'mild-tint', 'secondary on the all clear tint'],
  ['ink-2', 'moderate-tint', 'secondary on the caution tint'],
  ['ink-2', 'severe-tint', 'secondary on the severe tint'],
  ['ink-2', 'emergency-tint', 'secondary on the emergency tint'],
  ['ink-2', 'brand-wash', 'secondary on the ocean wash'],
  ['brand', 'canvas', 'ocean link on the page'],
  ['brand', 'surface', 'ocean link on a card'],
  ['brand', 'sunken', 'ocean link on a sunken card'],
  ['brand', 'mild-tint', 'ocean link on the all clear tint'],
  ['clay', 'canvas', 'clay label on the page'],
  ['clay', 'surface', 'clay label on a card'],
  ['clay', 'sunken', 'clay label on a sunken card'],
  ['mild', 'canvas', 'all clear word on the page'],
  ['mild', 'surface', 'all clear word on a card'],
  ['mild', 'mild-tint', 'all clear word on its tint'],
  ['moderate', 'canvas', 'caution word on the page'],
  ['moderate', 'surface', 'caution word on a card'],
  ['moderate', 'moderate-tint', 'caution word on its tint'],
  ['moderate', 'sunken', 'caution word on a sunken card'],
  ['severe', 'canvas', 'severe word on the page'],
  ['severe', 'surface', 'severe word on a card'],
  ['severe', 'severe-tint', 'severe word on its tint'],
  ['emergency', 'canvas', 'emergency word on the page'],
  ['emergency', 'surface', 'emergency word on a card'],
  ['emergency', 'emergency-tint', 'emergency word on its tint'],
  ['emergency', 'sunken', 'emergency word on a sunken card'],
  ['brand-ink', 'brand', 'cream on the ocean band'],
  ['brand-ink', 'brand-deep', 'cream on the pressed ocean band'],
  ['brand-ink-2', 'brand', 'secondary cream on the ocean band'],
  ['sand', 'brand', 'gold label on the ocean band'],
  ['dark-emergency', 'brand', 'offline warning on the ocean band'],
  ['brand-ink', 'clay', 'cream on the clay button'],
  ['brand-ink', 'clay-deep', 'cream on the pressed clay button'],
  ['canvas', 'line-strong', 'disabled button label'],
  ['console-ink', 'console-bg', 'night body'],
  ['console-ink-2', 'console-bg', 'night secondary body'],
  ['console-muted', 'console-bg', 'night caption'],
  ['console-accent', 'console-bg', 'night label'],
  ['console-ink', 'console-panel', 'night body on a panel'],
  ['console-ink-2', 'console-panel', 'night secondary on a panel'],
  ['console-muted', 'console-panel', 'night caption on a panel'],
  ['console-accent', 'console-panel', 'night label on a panel'],
  ['console-accent-ink', 'console-accent', 'ink on the night accent fill'],
  ['dark-mild', 'console-bg', 'night all clear word'],
  ['dark-moderate', 'console-bg', 'night caution word'],
  ['dark-severe', 'console-bg', 'night severe word'],
  ['dark-emergency', 'console-bg', 'night emergency word'],
]

const SHAPE_PAIRS = [
  ['line-strong', 'surface', 'control border on a card'],
  ['line-strong', 'canvas', 'control border on the page'],
  ['ink', 'canvas', 'focus ring on the page'],
  ['ink', 'surface', 'focus ring on a card'],
  ['sand', 'brand', 'focus ring on the ocean band'],
  ['console-accent', 'console-bg', 'focus ring on the night surface'],
  ['brand', 'sand', 'current step chip on the gold rail'],
  ['ink', 'sand', 'chip border on the gold rail'],
  ['mild-edge', 'mild-tint', 'all clear card border'],
  ['moderate-edge', 'moderate-tint', 'caution card border'],
  ['severe-edge', 'severe-tint', 'severe card border'],
  ['emergency-edge', 'emergency-tint', 'emergency card border'],
]

for (const [fg, bg, role] of TEXT_PAIRS) check(fg, bg, role, BODY_MIN)
for (const [fg, bg, role] of SHAPE_PAIRS) check(fg, bg, role, SHAPE_MIN)

const traceSource = readFileSync(join(SRC, 'lib', 'trace.js'), 'utf8')
for (const match of traceSource.matchAll(/color: '(#[0-9a-f]{6})'/g)) {
  check(match[1], 'console-bg', 'machine record entry', BODY_MIN)
}

const tierSource = readFileSync(join(SRC, 'components', 'TierBadge.jsx'), 'utf8')
for (const match of tierSource.matchAll(/rail: '(#[0-9a-f]{6})'/g)) {
  check(match[1], 'surface', 'verdict headline', BODY_MIN)
}

const cssSource = readFileSync(CSS, 'utf8')
const typeRows = []
for (const match of cssSource.matchAll(/--text-([a-z0-9]+):\s*([^;]+);/g)) {
  const name = match[1]
  const raw = match[2].trim()
  const first = raw.startsWith('clamp(') ? raw.slice(6).split(',')[0].trim() : raw
  const rem = parseFloat(first)
  if (Number.isNaN(rem) || !first.endsWith('rem')) continue
  const px = rem * 16
  const ok = px >= TYPE_FLOOR_PX
  typeRows.push({ name, px, ok })
  if (!ok) {
    failures.push(
      'type scale: --text-' + name + ' is ' + px + 'px, floor is ' + TYPE_FLOOR_PX + 'px',
    )
  }
}

const targetRows = []
for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/min-h(?:eight)?-\[(\d+)px\]/g)) {
    const px = Number(match[1])
    const ok = px >= TARGET_FLOOR_PX
    targetRows.push({ file: relative(ROOT, file), px, ok })
    if (!ok) {
      failures.push(
        'target size: ' + relative(ROOT, file) + ' declares ' + px + 'px, floor is ' +
          TARGET_FLOOR_PX + 'px',
      )
    }
  }
}

const pad = (text, width) => String(text).padEnd(width)

console.log('CareLoop design floors')
console.log('')
console.log('Contrast, ' + BODY_MIN + ':1 for text and ' + SHAPE_MIN + ':1 for shapes')
console.log('')
for (const row of rows) {
  console.log(
    '  ' +
      (row.ok ? 'pass' : 'FAIL') +
      '  ' +
      pad(row.value.toFixed(2) + ':1', 9) +
      pad('min ' + row.min, 8) +
      pad(row.fg + ' on ' + row.bg, 44) +
      row.role,
  )
}

console.log('')
console.log('Type scale, floor ' + TYPE_FLOOR_PX + 'px')
console.log('')
for (const row of typeRows) {
  console.log(
    '  ' + (row.ok ? 'pass' : 'FAIL') + '  ' + pad(row.px + 'px', 9) + '--text-' + row.name,
  )
}

const smallest = targetRows.reduce(
  (low, row) => (row.px < low ? row.px : low),
  Infinity,
)
console.log('')
console.log('Interactive targets, floor ' + TARGET_FLOOR_PX + 'px')
console.log('')
console.log(
  '  ' +
    (targetRows.every((row) => row.ok) ? 'pass' : 'FAIL') +
    '  ' +
    targetRows.length +
    ' declared heights, smallest is ' +
    (smallest === Infinity ? 'none' : smallest + 'px'),
)

console.log('')
if (failures.length) {
  console.log(failures.length + ' failures')
  for (const line of failures) console.log('  ' + line)
  process.exit(1)
}
console.log('All floors held.')
