import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { ShapeModel, seeded } from '../src/handwriting/model.js'
import { layout, parseMarkdown, pageSvg, pdfBytes } from '../src/handwriting/layout.js'
const meta = JSON.parse(readFileSync('public/handwriting-model/model.json'))
const bytes = readFileSync('public/handwriting-model/weights.bin')
const model = new ShapeModel(meta, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
let maxError = 0
for (const c of JSON.parse(readFileSync('scripts/handwriting-parity.json'))) {
  const actual = model.decode(c.group, c.z, .7)
  actual.forEach((v, i) => { maxError = Math.max(maxError, Math.abs(v - c.expected[i])) })
}
assert.ok(maxError < 1e-5, `Decoder differs from PyTorch: ${maxError}`)
console.log(`PyTorch parity: all 150 groups, max absolute error ${maxError}`)
for (const char of model.characters) for (let seed = 0; seed < 5; seed++) {
  const glyph = model.generate(char, seeded(seed), 1.5)
  assert.ok(glyph.length >= 1 && glyph.length <= 4)
  assert.ok(glyph.every(stroke => stroke.length === 48 && stroke.flat().every(Number.isFinite)))
  assert.deepEqual(glyph, model.generate(char, seeded(seed), 1.5))
}
const opts = { seed: 31415, size: 14, spacing: 1, variation: .7 }
const doc = layout(model, '# Hi Gang\n\nThis is **very** *handwritten*.\n- Josh x Megaknight', opts)
assert.deepEqual(doc, layout(model, '# Hi Gang\n\nThis is **very** *handwritten*.\n- Josh x Megaknight', opts))
assert.ok(parseMarkdown('***hi***')[0].glyphs.every(g => g.bold && g.italic))
assert.equal(parseMarkdown('<script>alert(1)</script>')[0].glyphs.map(g => g.char).join(''), '<script>alert(1)</script>')
assert.throws(() => layout(model, 'Hi 🙂 é', opts), /Unsupported characters.*🙂.*é/)
assert.throws(() => layout(model, 'a'.repeat(12001), opts), /12,000/)
assert.throws(() => layout(model, 'a', { ...opts, ink: '" onload="alert(1)' }), /settings/)
const text = ('A long note with descenders gjpqy and **bold** words.\n').repeat(30) + 'x'.repeat(220)
for (const paper of ['letter', 'a4']) {
  const long = layout(model, text, { ...opts, paper, size: 24, variation: 1.5, spacing: .8 })
  assert.ok(long.pages.length > 1)
  // Each glyph emits 48-point strokes. Collapse stroke duplicates to count the actual characters.
  const expectedGlyphs = parseMarkdown(text).flatMap(b => b.glyphs).filter(g => !/\s/.test(g.char)).length
  const pointCount = long.pages.flatMap(p => p.paths).reduce((n, p) => n + p.points.length, 0)
  assert.ok(pointCount >= expectedGlyphs * 48)
  const random = seeded(opts.seed)
  const expectedStrokes = parseMarkdown(text).flatMap(b => b.glyphs).filter(g => !/\s/.test(g.char)).reduce((n, g) => n + model.generate(g.char, random, 1.5).length, 0)
  assert.equal(long.pages.flatMap(p => p.paths).length, expectedStrokes)
  for (const page of long.pages) for (const p of page.paths) for (const [x, y] of p.points) {
    assert.ok(x >= 41 && x <= long.width - 41 && y >= 41 && y <= long.height - 41, `Clipped ${p.char}: ${x}, ${y}`)
  }
  const pdf = pdfBytes(long)
  assert.ok(new TextDecoder().decode(pdf).includes(`/Count ${long.pages.length}`))
  writeFileSync(`/tmp/ink-${paper}.pdf`, pdf)
}
writeFileSync('/tmp/ink-preview.svg', pageSvg(doc, 0))
writeFileSync('/tmp/ink-preview.pdf', pdfBytes(doc))
console.log(`Passed ${model.characters.size} characters × 5 seeds, Markdown, unsupported input, determinism, content/stroke preservation, pagination, margins, vector PDF.`)
