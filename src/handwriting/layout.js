import { seeded } from './model.js'
import { applyPressure } from './pressure.js'
import { normalizeTypography } from './typography.js'
import { DEFAULT_NATURALNESS, identifyBlocks, inkBounds, naturalLayout } from './natural.js'

// Unsupported Markdown constructs remain literal. Mark their non-text regions
// so typography normalization cannot rewrite a destination, attribute, URL or code.
function literalLength(text, start) {
  const rest = text.slice(start)
  if (rest.startsWith('](')) {
    let depth = 1, quote = null, angle = false
    for (let j = 2; j < rest.length; j++) {
      if (rest[j] === '\\') { j++; continue }
      if (quote) { if (rest[j] === quote) quote = null; continue }
      if (angle) { if (rest[j] === '>') angle = false; continue }
      if (rest[j] === '<' && (j === 2 || /\s/.test(rest[j - 1]))) { angle = true; continue }
      if ((rest[j] === '"' || rest[j] === "'") && /\s/.test(rest[j - 1])) { quote = rest[j]; continue }
      if (rest[j] === '(') depth++
      if (rest[j] === ')' && --depth === 0) return j + 1
    }
    // Protect a destination still being typed as well.
    return rest.length
  }
  const tag = /^(?:<!--[\s\S]*?-->|<\/?[A-Za-z](?:[^"'<>]|"[^"]*"|'[^']*')*>)/.exec(rest)
  if (tag) return tag[0].length
  const url = /^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|mailto:|www\.)[^\s<>]+/.exec(rest)
  if (url) return url[0].length
  const ticks = /^`+/.exec(rest)
  if (ticks) {
    const end = text.indexOf(ticks[0], start + ticks[0].length)
    if (end !== -1) return end + ticks[0].length - start
  }
  return 0
}
function closingMarker(text, marker, start, protectedText) {
  for (let i = start; i < text.length;) {
    if (protectedText[i]) { i++; continue }
    if (text[i] === '\\') { i += 2; continue }
    const length = literalLength(text, i)
    if (length) { i += length; continue }
    if (text.startsWith(marker, i)) return i
    i++
  }
  return -1
}

// Deliberately small Markdown dialect. Unrecognized syntax (including HTML) stays literal.
function inline(text, style = {}, protectedText = []) {
  const result = []
  for (let i = 0; i < text.length;) {
    let literal = 0
    while (protectedText[i + literal]) literal++
    literal ||= literalLength(text, i)
    if (literal) {
      result.push(...Array.from(text.slice(i, i + literal), char => ({ char, ...style, verbatim: true })))
      i += literal; continue
    }
    if (text[i] === '\\' && /[\\*_`#-]/.test(text[i + 1] || '')) {
      result.push({ char: text[i + 1], ...style }); i += 2; continue
    }
    const marker = ['***', '**', '*', '__', '_'].find(m => text.startsWith(m, i) && closingMarker(text, m, i + m.length, protectedText) > i + m.length)
    if (marker) {
      const end = closingMarker(text, marker, i + marker.length, protectedText)
      result.push(...inline(text.slice(i + marker.length, end), { ...style, ...(marker.length >= 2 ? { bold: true } : {}), ...(marker.length !== 2 ? { italic: true } : {}) }, protectedText.slice(i + marker.length, end)))
      i = end + marker.length
    } else {
      const char = String.fromCodePoint(text.codePointAt(i))
      result.push({ char, ...style }); i += char.length
    }
  }
  return result
}
export function parseMarkdown(text) {
  const source = text.replace(/\r\n?/g, '\n'), protectedSource = new Uint8Array(source.length)
  // Scan complete constructs before splitting blocks, including multiline HTML
  // attributes and link destinations. The original editor value is untouched.
  for (let i = 0; i < source.length;) {
    const length = literalLength(source, i)
    if (length) protectedSource.fill(1, i, i + length)
    i += length || 1
  }
  let offset = 0
  return source.split('\n').map(line => {
    const protectedLine = protectedSource.slice(offset, offset + line.length)
    offset += line.length + 1
    const reference = /^ {0,3}\[[^\]]+\]:/.test(line)
    const heading = !protectedLine[0] && /^(#{1,6})\s+(.*)$/.exec(line)
    const list = !protectedLine[0] && /^(\s*)([-+*]|\d+[.)])\s+(.*)$/.exec(line)
    return {
      scale: heading ? [1.65, 1.45, 1.25, 1.15, 1.1, 1.05][heading[1].length - 1] : 1,
      indent: list ? Math.min(4, Math.floor(list[1].length / 2)) * 16 + 18 : 0,
      glyphs: reference ? Array.from(line, char => ({ char, verbatim: true })) : inline(heading ? heading[2] : list ? `${/\d/.test(list[2]) ? list[2] : '-'} ${list[3]}` : line, heading ? { bold: true } : {}, heading ? protectedLine.slice(line.length - heading[2].length) : list ? [false, ...Array(list[2].length).fill(false), ...protectedLine.slice(line.length - list[3].length)] : protectedLine),
    }
  })
}
export function layout(model, text, options) {
  const { size = 14, spacing = 1, variation = .7, seed = 31415, paper = 'letter', ink = '#182235', naturalness = DEFAULT_NATURALNESS, normalizeTypography: normalize = true, pressure = false } = options
  if (text.length > 12000) throw Error('Please keep each document under 12,000 characters.')
  if (typeof pressure !== 'boolean' || typeof normalize !== 'boolean' || ![size, spacing, variation, seed, naturalness].every(Number.isFinite) || naturalness < 0 || naturalness > 1 || size < 8 || size > 24 || spacing < .8 || spacing > 1.6 || variation < 0 || variation > 1.5 || !Number.isInteger(seed) || seed < 0 || seed > 4294967295 || !['letter', 'a4'].includes(paper) || !/^#[0-9a-f]{6}$/i.test(ink)) throw Error('Please check the handwriting settings.')
  const blocks = identifyBlocks(normalizeTypography(parseMarkdown(text), model.characters, normalize))
  const unknown = [...new Set(blocks.flatMap(b => b.glyphs.map(g => g.char)).filter(c => !/^[ \t]$/.test(c) && !model.characters.has(c)))]
  if (unknown.length) throw Error(`Unsupported characters: ${unknown.map(c => `${JSON.stringify(c)} (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}. Please replace them to generate handwriting.`)
  // Explicit page dimensions support deterministic narrow-page validation and future formats.
  const width = options.width ?? (paper === 'a4' ? 595.28 : 612), height = options.height ?? (paper === 'a4' ? 841.89 : 792), margin = 42
  if (![width, height].every(Number.isFinite) || width < 180 || width > 1600 || height < 200 || height > 2400) throw Error('Please check the page dimensions.')
  const random = seeded(seed)
  for (const block of blocks) {
    const scale = size * block.scale
    const shape = g => {
      if (g.char === ' ' || g.char === '\t') return { ...g, advance: scale * .8 * (g.char === '\t' ? 4 : 1) }
      const strokes = model.generate(g.char, random, variation), points = strokes.flat()
      const xmin = Math.min(...points.map(p => p[0])), ymin = Math.min(...points.map(p => p[1])), ymax = Math.max(...points.map(p => p[1]))
      const anchor = 'gjpqy'.includes(g.char) ? ymin + 1 : /^[a-z0-9]$/i.test(g.char) ? ymax : 0
      const adjusted = strokes.map(s => s.map(([px, py]) => [(px - xmin - (g.italic ? .16 * (py - anchor) : 0)) * scale, (py - anchor) * scale]))
      const left = Math.min(...adjusted.flat().map(p => p[0])), right = Math.max(...adjusted.flat().map(p => p[0]))
      return { ...g, strokes: adjusted.map(s => s.map(([px, py]) => [px - left, py])), advance: Math.max(.15 * scale, right - left) + scale * .22 }
    }
    block.tokens = block.tokens.map(t => ({ ...t, glyphs: t.glyphs.map(shape) }))
    block.glyphs = block.tokens.flatMap(t => t.glyphs)
  }
  if (naturalness > 0) return applyPressure(naturalLayout(blocks, { size, spacing, seed, width, height, margin, ink, naturalness, pressure }), pressure)
  // Preserve the original unperturbed arithmetic and wrapping at exactly zero.
  const pages = [{ paths: [], lines: [] }]
  let y = margin, pathPage = pages[0]
  for (const block of blocks) {
    const scale = size * block.scale, lineHeight = scale * 4.2 * spacing
    let x = margin + block.indent, line = [], top = 0, bottom = 0, hasContent = false, lineNumber = 0
    const finish = () => {
      const extent = Math.max(lineHeight, -Math.min(top, -scale * 2) + bottom + scale * .7)
      if (y + extent > height - margin && hasContent) {
        pathPage = { paths: [], lines: [] }; pages.push(pathPage); y = margin
      } else if (y + extent > height - margin && !hasContent) {
        // Blank lines keep their spacing without producing a trailing empty page.
        y = height - margin; return
      }
      const baseline = y - Math.min(top, -scale * 2)
      const record = { id: `${block.id}:line${lineNumber++}`, blockId: block.id, scale, indent: block.indent, y, baseline, glyphs: [], words: [] }
      for (const glyph of line) {
        const transform = [1, 0, 0, 1, glyph.x, baseline]
        const strokes = glyph.strokes.map(s => s.map(([px, py]) => [glyph.x + px, baseline + py]))
        const item = { id: glyph.id, tokenId: glyph.tokenId, char: glyph.char, source: glyph.strokes, position: [glyph.x, baseline], transform, strokes, bounds: inkBounds(strokes, glyph.bold ? 1.5 : 1), advance: glyph.advance, nominalAdvance: glyph.advance }
        record.glyphs.push(item)
        let word = record.words.at(-1)
        if (word?.tokenId !== glyph.tokenId) { word = { tokenId: glyph.tokenId, anchor: [glyph.x, baseline], rotation: 0, lean: 0, offset: 0, glyphs: [] }; record.words.push(word) }
        word.glyphs.push(item)
      }
      record.bounds = inkBounds(record.glyphs.flatMap(g => g.strokes))
      // Empty lines have no ink bounds (keep the document JSON-serializable).
      if (!line.length) record.bounds = null
      pathPage.lines.push(record)
      for (const glyph of line) for (const stroke of glyph.strokes) {
        pathPage.paths.push({ points: stroke.map(([px, py]) => [glyph.x + px, baseline + py]), weight: glyph.bold ? 1.5 : 1, char: glyph.char })
      }
      y += Math.max(extent, baseline + bottom - y + scale * .7)
      x = margin + block.indent; line = []; top = 0; bottom = 0; hasContent = false
    }
    const glyphs = block.glyphs
    // Wrap words first; oversized words wrap at a character boundary.
    for (let i = 0; i < glyphs.length;) {
      if (!glyphs[i].strokes) {
        if (x + glyphs[i].advance <= width - margin) x += glyphs[i].advance
        else if (hasContent) finish()
        i++; continue
      }
      let end = i
      while (end < glyphs.length && glyphs[end].strokes) end++
      const wordWidth = glyphs.slice(i, end).reduce((n, g) => n + g.advance, 0)
      if (hasContent && x + wordWidth > width - margin) finish()
      while (i < end) {
        const g = glyphs[i++]
        if (hasContent && x + g.advance > width - margin) finish()
        line.push({ ...g, x }); hasContent = true
        for (const [, py] of g.strokes.flat()) { top = Math.min(top, py); bottom = Math.max(bottom, py) }
        x += g.advance
      }
    }
    finish()
  }
  return applyPressure({ width, height, ink, naturalness, blocks: blocks.map(({ id, scale, indent, tokens }) => ({ id, scale, indent, text: tokens.map(t => t.text).join('') })), pages }, pressure)
}
const number = n => n.toFixed(3)
export function pageSvg(document, index) {
  const { width, height, ink, pages } = document
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Handwriting page ${index + 1}"><rect width="100%" height="100%" fill="white"/>${pages[index].paths.map(p => p.outline ? `<path d="M${p.outline.map(pair => pair.map(number).join(',')).join(' L')} Z" fill="${ink}"/>` : `<path d="M${p.points.map(pair => pair.map(number).join(',')).join(' L')}" fill="none" stroke="${ink}" stroke-width="${p.weight}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`
}
// Minimal vector PDF: the same page geometry, stroke widths and colors as SVG.
export function pdfBytes(document) {
  const { width, height, ink, pages } = document
  const color = [1, 3, 5].map(i => number(parseInt(ink.slice(i, i + 2), 16) / 255)).join(' ')
  const objects = ['', `<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] >>`]
  for (const page of pages) {
    const id = objects.length
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << >> /Contents ${id + 1} 0 R >>`)
    const stream = `1 J 1 j\n${color} RG\n${document.pressure ? `${color} rg\n` : ''}` + page.paths.map(p => p.outline ? `${p.outline.map(([x, y], i) => `${number(x)} ${number(height - y)} ${i ? 'l' : 'm'}`).join('\n')}\nh f\n` : `${p.weight} w\n${p.points.map(([x, y], i) => `${number(x)} ${number(height - y)} ${i ? 'l' : 'm'}`).join('\n')}\nS\n`).join('')
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
  }
  let pdf = '%PDF-1.4\n', offsets = [0]
  for (let i = 1; i < objects.length; i++) { offsets.push(pdf.length); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n` }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
