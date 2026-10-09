import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { ShapeModel } from '../src/handwriting/model.js'
import { layout, parseMarkdown, pageSvg, pdfBytes } from '../src/handwriting/layout.js'
import { DEFAULT_NATURALNESS, identifyBlocks, transformStroke } from '../src/handwriting/natural.js'
const bytes = readFileSync('public/handwriting-model/weights.bin')
const model = new ShapeModel(JSON.parse(readFileSync('public/handwriting-model/model.json')), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const hash = x => createHash('sha256').update(x).digest('hex')
const glyphs = d => d.pages.flatMap(p => p.lines.flatMap(l => l.glyphs))
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`)
const opts = { seed: 31415, size: 14, spacing: 1, variation: .7, naturalness: DEFAULT_NATURALNESS }
// Captured from the unmodified renderer before this implementation.
for (const c of JSON.parse(readFileSync('scripts/fixtures/handwriting-zero.json'))) {
  const doc = layout(model, c.text, { ...c.options, naturalness: 0 })
  assert.equal(hash(JSON.stringify(doc.pages.map(p => p.paths))), c.paths)
  assert.deepEqual(doc.pages.map((_, i) => hash(pageSvg(doc, i))), c.svg)
  assert.equal(hash(pdfBytes(doc)), c.pdf)
}
console.log('Zero naturalness: exact legacy path, SVG and PDF hashes match all 3 reference documents.')
const sample = '# Notes from today\n\nThe afternoon was quiet, so I sat down to write a few things. A good paragraph has room to breathe. Some words lean together; others settle gently into the next line. Nothing needs to be perfectly straight.\n\n- Bring a **pencil** and a notebook.\n- Keep *practicing*, day by day.'
const before = layout(model, sample, { ...opts, naturalness: 0 })
const after = layout(model, sample, opts)
assert.deepEqual(after, layout(model, sample, opts))
assert.notDeepEqual(after.pages[0].paths, layout(model, sample, { ...opts, seed: 99 }).pages[0].paths)
const paragraphLines = after.pages.flatMap(p => p.lines).filter(l => l.glyphs.length && l.scale === opts.size && !l.indent)
const spread = key => Math.max(...paragraphLines.map(l => l[key])) - Math.min(...paragraphLines.map(l => l[key]))
assert.ok(spread('left') > 5, 'Default margins should visibly wander')
assert.ok(spread('leading') > 5, 'Default line spacing should visibly vary')
console.log(`Default paragraph: margin spread ${spread('left').toFixed(1)} pt; leading spread ${spread('leading').toFixed(1)} pt.`)
const full = layout(model, sample, { ...opts, naturalness: 1 })
assert.deepEqual(glyphs(before).map(g => g.source), glyphs(after).map(g => g.source))
assert.deepEqual(glyphs(before).map(g => g.source), glyphs(full).map(g => g.source))
const noRandom = Math.random
try { Math.random = () => { throw Error('Unseeded rendering randomness') }; layout(model, 'No random globals.', opts) } finally { Math.random = noRandom }
assert.equal(identifyBlocks(parseMarkdown('Unchanged block.'))[0].id, identifyBlocks(parseMarkdown('A new block.\nUnchanged block.'))[1].id)
for (const n of [-1, 1.1, NaN, Infinity]) assert.throws(() => layout(model, 'a', { ...opts, naturalness: n }), /settings/)
console.log('Determinism, separate shape stream, stable block IDs, bounded input and seeded-only rendering passed.')

function checkDocument(doc, text, options) {
  const expected = parseMarkdown(text).flatMap(b => b.glyphs).filter(g => !/^[ \t]$/.test(g.char)).map(g => g.char).join('')
  assert.equal(glyphs(doc).map(g => g.char).join(''), expected, 'No lost, duplicated, or reordered glyphs')
  assert.equal(new Set(glyphs(doc).map(g => g.id)).size, glyphs(doc).length)
  let previousDrift = null
  for (const page of doc.pages) {
    let bottom = 0
    const paths = []
    for (const line of page.lines) {
      const n = options.naturalness ?? DEFAULT_NATURALNESS
      assert.ok(Math.abs(line.startOffset) <= 1.5 * line.scale * n)
      if (line.indent) close(line.startOffset, 0)
      close(line.leading / (line.scale * 4.2 * options.spacing) - 1, .22 * n * line.parameters.values.leading)
      for (const [key, value] of Object.entries(line.parameters.drift)) {
        assert.ok(Math.abs(value) <= 1)
        if (previousDrift) assert.ok(Math.abs(value - .72 * previousDrift[key]) <= .28000001)
      }
      previousDrift = line.parameters.drift
      for (const space of line.spaces) {
        assert.ok(space.advance > 0)
        assert.ok(Math.abs(space.advance / space.nominalAdvance - 1) <= .15 * n + 1e-10)
      }
      if (!line.glyphs.length) continue
      assert.ok(line.bounds.top >= bottom, 'Interline ink bounds overlap')
      bottom = line.bounds.bottom
      let right = 0
      for (const g of line.glyphs) {
        assert.ok(g.bounds.left >= 42 - 1e-8 && g.bounds.right <= doc.width - 42 + 1e-8, 'Horizontal clipping')
        assert.ok(g.bounds.top >= 42 - 1e-8 && g.bounds.bottom <= doc.height - 42 + 1e-8, 'Vertical clipping')
        assert.ok(g.bounds.left >= right - 1e-8, 'Adjacent ink overlaps')
        right = g.bounds.right
        assert.ok(Math.abs(g.advance / g.nominalAdvance - 1) <= .05 * n + 1e-10)
        assert.deepEqual(g.strokes, g.source.map(s => transformStroke(s, g.transform)))
        for (const points of g.strokes) paths.push({ points, weight: g.bold ? 1.5 : 1, char: g.char })
      }
      const baselines = []
      for (const word of line.words) {
        assert.ok(Math.abs(word.rotation) <= .8 * Math.PI / 180 * n + 1e-10)
        assert.ok(Math.abs(word.lean) <= Math.PI / 180 * n + 1e-10)
        assert.ok(Math.abs(word.offset) <= .45 * line.scale * n + 1e-10)
        for (const g of word.glyphs) {
          assert.ok(Math.abs(g.settling) <= .14 * line.scale * n + 1e-10)
          baselines.push(g.position[1] - line.baseline - word.offset - g.settling - Math.tan(word.rotation) * (g.position[0] - word.anchor[0]))
        }
      }
      assert.ok(Math.max(...baselines) - Math.min(...baselines) <= .70 * line.scale * n + 1e-8, 'Excessive baseline drift')
    }
    assert.deepEqual(page.paths, paths, 'Canonical glyph transforms must produce rendered paths')
  }
}
const narrowText = '# Heading\n\n' + ('Jumping puppies play; gypsy jazz, **bold** & *leaning* words! ').repeat(12) + '\n\n1. First item\n2. Second item\n  - Nested item with descenders gjpqy.\n\n' + 'W'.repeat(100) + '\n\n\nEnd.'
const cases = [
  { text: sample, options: opts },
  { text: narrowText, options: { ...opts, width: 260, height: 410, naturalness: 1, spacing: .8 } },
  { text: narrowText.repeat(2), options: { ...opts, paper: 'a4', naturalness: 1, size: 24, spacing: .8, seed: 99 } },
  { text: '\n\n\t\tLeading\n\n\n' + [...model.characters].join(' ') + '\n- Item\n- Item\n', options: { ...opts, naturalness: .05, size: 8, seed: 0 } },
  { text: ('Blank line\n\n').repeat(20) + 'Text after breaks.', options: { ...opts, width: 200, height: 240, naturalness: 1 } },
]
let totalPages = 0
for (const { text, options } of cases) {
  const doc = layout(model, text, options)
  checkDocument(doc, text, options); totalPages += doc.pages.length
}
console.log(`Bounds, clearance, exact glyph order, parameter limits, headings/lists, all punctuation, oversized words and page breaks: ${totalPages} pages passed.`)
// Export paths are rounded once at the serialization boundary, not relaid out.
const doc = after, pdf = new TextDecoder().decode(pdfBytes(doc))
const pdfPoints = [...pdf.matchAll(/^(-?[\d.]+) (-?[\d.]+) [ml]$/gm)].map(m => [+m[1], doc.height - +m[2]])
const canonical = doc.pages.flatMap(p => p.paths.flatMap(p => p.points))
assert.equal(pdfPoints.length, canonical.length)
canonical.forEach((p, i) => { close(p[0], pdfPoints[i][0], .000501); close(p[1], pdfPoints[i][1], .000501) })
for (let i = 0; i < doc.pages.length; i++) {
  const svg = pageSvg(doc, i)
  const svgPoints = [...svg.matchAll(/(?:M| L)(-?[\d.]+),(-?[\d.]+)/g)].map(m => [+m[1], +m[2]])
  const points = doc.pages[i].paths.flatMap(p => p.points)
  assert.equal(svgPoints.length, points.length)
  points.forEach((p, j) => { close(p[0], svgPoints[j][0], .000501); close(p[1], svgPoints[j][1], .000501) })
}
console.log('Preview/SVG/PDF coordinates match canonical paths to export precision (0.0005 pt).')
const folder = 'handwriting/results'
mkdirSync(folder, { recursive: true })
for (const [name, doc] of [['before', before], ['after', after], ['full', full]]) {
  writeFileSync(`${folder}/${name}.svg`, pageSvg(doc, 0))
  writeFileSync(`${folder}/${name}.pdf`, pdfBytes(doc))
}
writeFileSync(`${folder}/comparison.html`, `<!doctype html><html lang="en"><meta charset="UTF-8"><title>Naturalness comparison</title><style>body{background:#f3efe0;color:#08060d;font:14px monospace;margin:24px}h1{font:32px Georgia}main{display:flex;gap:24px}section{width:612px}svg{width:100%;height:auto;box-shadow:0 2px 12px #0001}p{max-width:1100px;line-height:1.6}</style><h1>Handwriting layout comparison</h1><p>Identical text, glyph shapes, seed 31415, size 14, Letter paper. Left: Naturalness 0. Right: Naturalness ${DEFAULT_NATURALNESS} (default).</p><main><section><h2>Before · 0</h2>${pageSvg(before, 0)}</section><section><h2>After · ${DEFAULT_NATURALNESS}</h2>${pageSvg(after, 0)}</section></main></html>`)
writeFileSync(`${folder}/settings.json`, JSON.stringify({ text: sample, options: opts, beforePages: before.pages.length, afterPages: after.pages.length }, null, 2) + '\n')
console.log(`Wrote before/after and full-strength SVG/PDF previews to ${folder}.`)
