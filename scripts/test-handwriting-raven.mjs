import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { ShapeModel } from '../src/handwriting/model.js'
import { layout, parseMarkdown, pageSvg, pdfBytes } from '../src/handwriting/layout.js'
import { normalizeTypography } from '../src/handwriting/typography.js'
const bytes = readFileSync('public/handwriting-model/weights.bin')
const model = new ShapeModel(JSON.parse(readFileSync('public/handwriting-model/model.json')), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const reference = JSON.parse(readFileSync('scripts/fixtures/raven-baseline-reference.json'))
const text = readFileSync('scripts/fixtures/raven-excerpt.md', 'utf8')
const doc = layout(model, text, reference.options), allGlyphs = doc.pages.flatMap(p => p.lines.flatMap(l => l.glyphs))
assert.deepEqual(doc, layout(model, text, reference.options))
assert.equal(createHash('sha256').update(JSON.stringify(allGlyphs.map(g => g.source))).digest('hex'), reference.sourceGlyphHash)
assert.equal(allGlyphs.map(g => g.char).join(''), normalizeTypography(parseMarkdown(text), model.characters).flatMap(b => b.glyphs).filter(g => !/^[ \t]$/.test(g.char)).map(g => g.char).join(''))
assert.ok(doc.pages.length >= 5)
const residuals = []
for (const page of doc.pages) {
  let previousBottom = 0
  for (const line of page.lines) {
    if (!line.glyphs.length) continue
    assert.ok(line.bounds.top >= previousBottom - 1e-8)
    previousBottom = line.bounds.bottom
    for (const g of line.glyphs) {
      assert.ok(g.bounds.left >= 42 - 1e-8 && g.bounds.right <= doc.width - 42 + 1e-8)
      assert.ok(g.bounds.top >= 42 - 1e-8 && g.bounds.bottom <= doc.height - 42 + 1e-8)
    }
    // Measure the actual bottoms of lowercase body letters, excluding ascenders,
    // descenders and punctuation. Remove each line's best-fit slope first:
    // increasing the slope alone must not pass this regression check.
    const points = line.glyphs.filter(g => /^[acemnorsuvwxz]$/.test(g.char)).map(g => [(g.bounds.left + g.bounds.right) / 2, g.bounds.bottom])
    if (points.length < 8) continue
    const meanX = points.reduce((s, p) => s + p[0], 0) / points.length
    const meanY = points.reduce((s, p) => s + p[1], 0) / points.length
    const slope = points.reduce((s, p) => s + (p[0] - meanX) * (p[1] - meanY), 0) / points.reduce((s, p) => s + (p[0] - meanX) ** 2, 0)
    residuals.push(...points.map(([x, y]) => y - meanY - slope * (x - meanX)))
  }
}
const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length)
assert.ok(rms > .55 && rms > reference.bottomResidualRms * 3, 'Letter bottoms are still mechanically aligned')
assert.ok(rms < 1.5, 'Baseline movement is exaggerated at the default')
const folder = 'handwriting/results'
writeFileSync(`${folder}/raven-after.svg`, pageSvg(doc, 0))
writeFileSync(`${folder}/raven-after.pdf`, pdfBytes(doc))
writeFileSync(`${folder}/raven-checks.json`, JSON.stringify({ pages: doc.pages.length, measuredLetters: residuals.length, beforeRmsPoints: reference.bottomResidualRms, afterRmsPoints: rms, shapeHashUnchanged: true, source: reference.source }, null, 2) + '\n')
const beforeSvg = readFileSync(`${folder}/raven-before.svg`, 'utf8'), afterSvg = pageSvg(doc, 0)
const crop = svg => svg.replace('width="612" height="792" viewBox="0 0 612 792"', 'width="1090" height="310" viewBox="35 168 545 155"')
writeFileSync(`${folder}/raven-comparison.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Raven baseline comparison</title><style>body{margin:24px;background:#f3efe0;color:#08060d;font:13px monospace}h1{font:28px Georgia}h2{font:16px monospace}svg{display:block;background:white;max-width:100%;height:auto}p{max-width:1050px;line-height:1.6}a{color:#087577}</style><h1>The Raven · baseline placement</h1><p>Same text, glyph shapes, seed 31415, size 12, Naturalness 0.55. Enlarged excerpt from a six-page rendering. Text: <a href="${reference.source}">Edgar Allan Poe, The Raven (1845)</a>.</p><h2>Before</h2>${crop(beforeSvg)}<h2>After</h2>${crop(afterSvg)}</html>`)
console.log(`Raven: ${doc.pages.length} pages, ${residuals.length} letter bottoms checked; detrended baseline RMS ${reference.bottomResidualRms.toFixed(3)} → ${rms.toFixed(3)} pt. Shapes, text, determinism, margins and line clearance passed.`)
