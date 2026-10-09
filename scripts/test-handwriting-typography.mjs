import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ShapeModel } from '../src/handwriting/model.js'
import { layout, parseMarkdown, pageSvg, pdfBytes } from '../src/handwriting/layout.js'
import { normalizeTypography } from '../src/handwriting/typography.js'
const bytes = readFileSync('public/handwriting-model/weights.bin')
const model = new ShapeModel(JSON.parse(readFileSync('public/handwriting-model/model.json')), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const renderText = blocks => blocks.map(b => b.glyphs.map(g => g.char).join('')).join('\n')
const normalize = (text, chars = model.characters, enabled = true) => normalizeTypography(parseMarkdown(text), chars, enabled)
const examples = [
  ['“I’m writing…” — Jeremy', '"I\'m writing..." - Jeremy'],
  ['‘one’ ‚two‛ and it’s Jeremy\'s', "'one' 'two' and it's Jeremy's"],
  ['“one” „two‟ and "three"', '"one" "two" and "three"'],
  ['– — − ‐ ‑ -', '- - - - - -'],
  ['Wait… then…', 'Wait... then...'],
  ['A\u00a0B\u202fC\u2009D\tE\n\nF', 'A B C D\tE\n\nF'],
  ['é ö α Ж ± × ÷ ≠ ∞ 🙂', 'é ö α Ж ± × ÷ ≠ ∞ 🙂'],
  ['— Not a Markdown list\n\n# “Heading”\n- **It’s…**\n  - *“Indented”*', '- Not a Markdown list\n\n"Heading"\n- It\'s...\n- "Indented"'],
]
for (const [input, expected] of examples) {
  const parsed = parseMarkdown(input), original = structuredClone(parsed)
  for (const b of parsed) { b.glyphs.forEach(Object.freeze); Object.freeze(b.glyphs); Object.freeze(b) }
  Object.freeze(parsed)
  const result = normalizeTypography(parsed, model.characters)
  assert.equal(renderText(result), expected)
  assert.deepEqual(parsed, original, 'Original parsed Markdown was mutated')
  assert.deepEqual(normalizeTypography(result, model.characters), result, 'Not idempotent')
  assert.deepEqual(normalizeTypography(parsed, model.characters, false), parsed)
}
const structured = normalize('# **“Title”**\n\n- *It’s…*\n  - More\n\tTabs\n')
assert.equal(structured[0].scale, 1.65)
assert.ok(structured[0].glyphs.every(g => g.bold))
assert.ok(structured[2].glyphs.slice(2).every(g => g.italic))
assert.equal(structured[3].indent, 34)
assert.equal(structured.length, 6)
assert.equal(renderText(normalize('a\r\n\r\nb\rc')), 'a\n\nb\nc')
assert.equal(renderText(normalize('‘’…\u00a0', new Set([...model.characters, '‘', '’', '…', '\u00a0']))), '‘’…\u00a0', 'Supported originals must win')
assert.equal(renderText(normalize('‘’…', new Set(['a']))), '‘’…', 'Unavailable replacements must not be substituted')
// Destinations, titles, HTML attributes, bare URLs, and code stay literal in the
// existing dialect; only visible labels/body text receives typography changes.
const protectedCases = [
  ['[“Label…”](https://example.test/it’s—here?q=“x”)', '["Label..."](https://example.test/it’s—here?q=“x”)'],
  ['[It’s](relative/“path”(a)/… "‘title’") after…', '[It\'s](relative/“path”(a)/… "‘title’") after...'],
  ['[“Label”](url "title ) …") after…', '["Label"](url "title ) …") after...'],
  ['<a title="text\n# **‘attribute’**\n- …">“Visible”</a>', '<a title="text\n# **‘attribute’**\n- …">"Visible"</a>'],
  ['[“Label”](relative/…\n  "‘title’") text…', '["Label"](relative/…\n  "‘title’") text...'],
  ['[ref]: https://example.test/… “title”', '[ref]: https://example.test/… “title”'],
  ['<a title="‘quoted’ > …" href="https://example.test/—">“Visible…”</a>', '<a title="‘quoted’ > …" href="https://example.test/—">"Visible..."</a>'],
  ['<a\n title="‘quoted’\n …">“Visible…”</a>', '<a\n title="‘quoted’\n …">"Visible..."</a>'],
  ['https://example.test/a_b_… ftp://example.test/— www.example.test/‘x’', 'https://example.test/a_b_… ftp://example.test/— www.example.test/‘x’'],
  ['`“code…”` and **“words…”**', '`“code…”` and "words..."'],
]
for (const [source, expected] of protectedCases) {
  const result = normalize(source)
  assert.equal(renderText(result), expected)
  assert.deepEqual(normalizeTypography(result, model.characters), result)
}
const opts = { seed: 31415, naturalness: .55, size: 14, width: 240, height: 320 }
const unicode = ('“I’m writing…” — Jeremy\n\n').repeat(6)
const ascii = ('"I\'m writing..." - Jeremy\n\n').repeat(6)
const doc = layout(model, unicode, opts), expected = layout(model, ascii, { ...opts, normalizeTypography: false })
assert.deepEqual(doc, expected, 'Normalization must happen before measuring, wrapping, IDs, and pagination')
assert.ok(doc.pages.length > 1)
for (let i = 0; i < doc.pages.length; i++) assert.equal(pageSvg(doc, i), pageSvg(expected, i))
assert.deepEqual(pdfBytes(doc), pdfBytes(expected))
assert.throws(() => layout(model, '“Hi”', { ...opts, normalizeTypography: false }), /Unsupported characters.*“.*”/)
assert.throws(() => layout(model, '“é” ± 🙂', opts), error => /Unsupported characters.*é.*±.*🙂/.test(error.message) && !error.message.includes('“'))
assert.throws(() => layout(model, '[Link](https://example.test/…)', opts), /Unsupported characters.*…/)
assert.throws(() => layout(model, 'Hi', { ...opts, normalizeTypography: 'true' }), /settings/)
console.log('Typography: all quote/dash/space mappings, vocabulary precedence, missing replacements, idempotence, formatting/newlines/tabs, immutable source, protected destinations/attributes/URLs/code, toggle, unsupported notices, and multipage SVG/PDF equivalence passed.')
