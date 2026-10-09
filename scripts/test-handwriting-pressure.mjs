import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { ShapeModel } from '../src/handwriting/model.js'
import { layout, pageSvg, pdfBytes } from '../src/handwriting/layout.js'
import { pressureOutline } from '../src/handwriting/pressure.js'
const close = (a, b, e = 1e-10) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`)
const straight = pressureOutline([[0, 0], [1, 0], [10, 0]], 1)
close(straight[0][1], .59)
close(straight[1][1], (1.18 - .53 * .028) / 2)
close(straight[2][1], .325)
const bold = pressureOutline([[0, 0], [1, 0], [10, 0]], 1.5)
close(bold[0][1] / straight[0][1], 1.5)
for (const points of [[], [[1, 1]], [[1, 1], [1, 1]], [[0, 0], [10, 0], [0, 0]], [[0, 0], [0, 1], [.01, 0]]]) {
  assert.ok(pressureOutline(points, 1).flat().every(Number.isFinite))
}
const bytes = readFileSync('public/handwriting-model/weights.bin')
const model = new ShapeModel(JSON.parse(readFileSync('public/handwriting-model/model.json')), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const text = '# The Raven\n\nOnce upon a midnight dreary,\nwhile I pondered, weak and weary.\n\n**A little pressure**, then a lighter touch.'
const opts = { seed: 31415, size: 16, naturalness: .55, ink: '#182235' }
const before = layout(model, text, { ...opts, pressure: false }), after = layout(model, text, { ...opts, pressure: true })
assert.deepEqual(after, layout(model, text, { ...opts, pressure: true }))
const shapes = d => d.pages.flatMap(p => p.lines.flatMap(l => l.glyphs.map(g => g.source)))
assert.deepEqual(shapes(after), shapes(before))
assert.throws(() => layout(model, 'Hi', { pressure: 'true' }), /settings/)
const all = layout(model, [...model.characters].join(' '), { ...opts, pressure: true, width: 260, height: 360 })
for (const page of all.pages) for (const path of page.paths) {
  assert.deepEqual(path.outline, pressureOutline(path.points, path.weight))
  for (const [x, y] of path.outline) assert.ok(x >= 42 - 1e-8 && x <= all.width - 42 + 1e-8 && y >= 42 - 1e-8 && y <= all.height - 42 + 1e-8)
}
// Pressure is independent of Naturalness; disabling it recovers exact uniform
// stroke exports, and enabling it at Naturalness zero keeps legacy placement.
const zero = layout(model, text, { ...opts, naturalness: 0, pressure: false })
const zeroPressure = layout(model, text, { ...opts, naturalness: 0, pressure: true })
assert.deepEqual(zero.pages.map(p => p.paths.map(s => s.points)), zeroPressure.pages.map(p => p.paths.map(s => s.points)))
const pdf = new TextDecoder().decode(pdfBytes(after))
const exported = [...pdf.matchAll(/^(-?[\d.]+) (-?[\d.]+) [ml]$/gm)].map(m => [+m[1], after.height - +m[2]])
const expected = after.pages.flatMap(p => p.paths.flatMap(s => s.outline))
assert.equal(exported.length, expected.length)
expected.forEach(([x, y], i) => { close(x, exported[i][0], .000501); close(y, exported[i][1], .000501) })
for (let i = 0; i < after.pages.length; i++) {
  const svg = pageSvg(after, i)
  assert.ok(!svg.includes('stroke-width'))
  const points = [...svg.matchAll(/(?:M| L)(-?[\d.]+),(-?[\d.]+)/g)].map(m => [+m[1], +m[2]])
  const expected = after.pages[i].paths.flatMap(s => s.outline)
  assert.equal(points.length, expected.length)
  expected.forEach(([x, y], j) => { close(x, points[j][0], .000501); close(y, points[j][1], .000501) })
}
for (const [name, doc] of [['before', before], ['after', after]]) {
  writeFileSync(`handwriting/results/pressure-${name}.svg`, pageSvg(doc, 0))
  writeFileSync(`handwriting/results/pressure-${name}.pdf`, pdfBytes(doc))
}
const crop = svg => svg.replace('width="612" height="792" viewBox="0 0 612 792"', 'width="1090" height="190" viewBox="35 35 545 95"')
writeFileSync('handwriting/results/pressure-comparison.html', `<!doctype html><html lang="en"><meta charset="utf-8"><title>Stroke pressure comparison</title><style>body{margin:24px;background:#f3efe0;font:13px monospace}h1{font:28px Georgia}h2{font:16px monospace}svg{display:block;max-width:100%;height:auto;background:white}</style><h1>Stroke pressure</h1><p>Same text, shapes and seed. Pressure follows distance along each recorded stroke, from 118% to 65% width.</p><h2>Uniform strokes</h2>${crop(pageSvg(before, 0))}<h2>Pressure enabled</h2>${crop(pageSvg(after, 0))}</html>`)
console.log('Pressure: distance-based taper, bold scaling, round caps, degenerate strokes, unchanged shapes, all-character bounds, determinism and canonical SVG/PDF outline parity passed.')
