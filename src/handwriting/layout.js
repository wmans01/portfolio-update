import { seeded } from './model.js'

// Deliberately small Markdown dialect. Unrecognized syntax (including HTML) stays literal.
function inline(text, style = {}) {
  const result = []
  for (let i = 0; i < text.length;) {
    if (text[i] === '\\' && /[\\*_`#-]/.test(text[i + 1] || '')) {
      result.push({ char: text[i + 1], ...style }); i += 2; continue
    }
    const marker = ['***', '**', '*', '__', '_'].find(m => text.startsWith(m, i) && text.indexOf(m, i + m.length) > i + m.length)
    if (marker) {
      const end = text.indexOf(marker, i + marker.length)
      result.push(...inline(text.slice(i + marker.length, end), { ...style, ...(marker.length >= 2 ? { bold: true } : {}), ...(marker.length !== 2 ? { italic: true } : {}) }))
      i = end + marker.length
    } else {
      const char = String.fromCodePoint(text.codePointAt(i))
      result.push({ char, ...style }); i += char.length
    }
  }
  return result
}
export function parseMarkdown(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').map(line => {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    const list = /^(\s*)([-+*]|\d+[.)])\s+(.*)$/.exec(line)
    return {
      scale: heading ? [1.65, 1.45, 1.25, 1.15, 1.1, 1.05][heading[1].length - 1] : 1,
      indent: list ? Math.min(4, Math.floor(list[1].length / 2)) * 16 + 18 : 0,
      glyphs: inline(heading ? heading[2] : list ? `${/\d/.test(list[2]) ? list[2] : '-'} ${list[3]}` : line, heading ? { bold: true } : {}),
    }
  })
}
export function layout(model, text, options) {
  const { size = 14, spacing = 1, variation = .7, seed = 31415, paper = 'letter', ink = '#182235' } = options
  if (text.length > 12000) throw Error('Please keep each document under 12,000 characters.')
  if (![size, spacing, variation, seed].every(Number.isFinite) || size < 8 || size > 24 || spacing < .8 || spacing > 1.6 || variation < 0 || variation > 1.5 || !Number.isInteger(seed) || seed < 0 || seed > 4294967295 || !['letter', 'a4'].includes(paper) || !/^#[0-9a-f]{6}$/i.test(ink)) throw Error('Please check the handwriting settings.')
  const blocks = parseMarkdown(text)
  const unknown = [...new Set(blocks.flatMap(b => b.glyphs.map(g => g.char)).filter(c => !/^[ \t]$/.test(c) && !model.characters.has(c)))]
  if (unknown.length) throw Error(`Unsupported characters: ${unknown.map(c => `${JSON.stringify(c)} (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}. Please replace them to generate handwriting.`)
  const width = paper === 'a4' ? 595.28 : 612, height = paper === 'a4' ? 841.89 : 792, margin = 42
  const pages = [{ paths: [] }], random = seeded(seed)
  let y = margin, pathPage = pages[0]
  for (const block of blocks) {
    const scale = size * block.scale, lineHeight = scale * 4.2 * spacing
    let x = margin + block.indent, line = [], top = 0, bottom = 0, hasContent = false
    const finish = () => {
      const extent = Math.max(lineHeight, -Math.min(top, -scale * 2) + bottom + scale * .7)
      if (y + extent > height - margin && hasContent) {
        pathPage = { paths: [] }; pages.push(pathPage); y = margin
      } else if (y + extent > height - margin && !hasContent) {
        // Blank lines keep their spacing without producing a trailing empty page.
        y = height - margin; return
      }
      const baseline = y - Math.min(top, -scale * 2)
      for (const glyph of line) for (const stroke of glyph.strokes) {
        pathPage.paths.push({ points: stroke.map(([px, py]) => [glyph.x + px, baseline + py]), weight: glyph.bold ? 1.5 : 1, char: glyph.char })
      }
      y += Math.max(extent, baseline + bottom - y + scale * .7)
      x = margin + block.indent; line = []; top = 0; bottom = 0; hasContent = false
    }
    const glyphs = block.glyphs.map(g => {
      if (g.char === ' ' || g.char === '\t') return { ...g, advance: scale * .8 * (g.char === '\t' ? 4 : 1) }
      const strokes = model.generate(g.char, random, variation), points = strokes.flat()
      const xmin = Math.min(...points.map(p => p[0])), ymin = Math.min(...points.map(p => p[1])), ymax = Math.max(...points.map(p => p[1]))
      const anchor = 'gjpqy'.includes(g.char) ? ymin + 1 : /^[a-z0-9]$/i.test(g.char) ? ymax : 0
      const adjusted = strokes.map(s => s.map(([px, py]) => [(px - xmin - (g.italic ? .16 * (py - anchor) : 0)) * scale, (py - anchor) * scale]))
      const left = Math.min(...adjusted.flat().map(p => p[0])), right = Math.max(...adjusted.flat().map(p => p[0]))
      return { ...g, strokes: adjusted.map(s => s.map(([px, py]) => [px - left, py])), advance: Math.max(.15 * scale, right - left) + scale * .22 }
    })
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
  return { width, height, ink, pages }
}
const number = n => n.toFixed(3)
export function pageSvg(document, index) {
  const { width, height, ink, pages } = document
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Handwriting page ${index + 1}"><rect width="100%" height="100%" fill="white"/>${pages[index].paths.map(p => `<path d="M${p.points.map(pair => pair.map(number).join(',')).join(' L')}" fill="none" stroke="${ink}" stroke-width="${p.weight}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`
}
// Minimal vector PDF: the same page geometry, stroke widths and colors as SVG.
export function pdfBytes(document) {
  const { width, height, ink, pages } = document
  const color = [1, 3, 5].map(i => number(parseInt(ink.slice(i, i + 2), 16) / 255)).join(' ')
  const objects = ['', `<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] >>`]
  for (const page of pages) {
    const id = objects.length
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << >> /Contents ${id + 1} 0 R >>`)
    const stream = `1 J 1 j\n${color} RG\n` + page.paths.map(p => `${p.weight} w\n${p.points.map(([x, y], i) => `${number(x)} ${number(height - y)} ${i ? 'l' : 'm'}`).join('\n')}\nS\n`).join('')
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
  }
  let pdf = '%PDF-1.4\n', offsets = [0]
  for (let i = 1; i < objects.length; i++) { offsets.push(pdf.length); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n` }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
