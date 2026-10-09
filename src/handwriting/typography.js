// Deliberately explicit: no Unicode folding, accent stripping, or transliteration.
const replacements = new Map([
  ...Array.from('‘’‚‛', c => [c, "'"]),
  ...Array.from('“”„‟', c => [c, '"']),
  ...Array.from('–—−‐‑', c => [c, '-']),
  ['…', '...'],
  ...Array.from('\u00a0\u202f\u2009', c => [c, ' ']),
])

// Operates on parsed glyph/text nodes, never on the source Markdown. ASCII space
// is handled by the layout engine rather than the neural character vocabulary.
export function normalizeTypography(blocks, characters, enabled = true) {
  if (!enabled) return blocks
  return blocks.map(block => ({
    ...block,
    glyphs: block.glyphs.flatMap(glyph => {
      if (glyph.verbatim || characters.has(glyph.char)) return [glyph]
      const replacement = replacements.get(glyph.char)
      if (!replacement || !Array.from(replacement).every(c => c === ' ' || characters.has(c))) return [glyph]
      return Array.from(replacement, char => ({ ...glyph, char }))
    }),
  }))
}
