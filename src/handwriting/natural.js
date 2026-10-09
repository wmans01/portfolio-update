import { seeded } from './model.js'
import { maximumStrokeWidth } from './pressure.js'

export const DEFAULT_NATURALNESS = .55
const radians = degrees => degrees * Math.PI / 180
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
export function hashId(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}
// Addressable layout streams never consume the original glyph-shape stream.
function tendency(seed, id) {
  const random = seeded(hashId(`${seed}:layout:${id}`))
  return Object.fromEntries(['start', 'slope', 'curve', 'phase', 'rotation', 'lean', 'spacing', 'gap', 'offset', 'leading'].map(k => [k, random() * 2 - 1]))
}
export function inkBounds(strokes, weight = 0) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const stroke of strokes) for (const [x, y] of stroke) {
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  return { left: left - weight / 2, right: right + weight / 2, top: top - weight / 2, bottom: bottom + weight / 2 }
}
export function transformStroke(stroke, [a, b, c, d, e, f]) {
  return stroke.map(([x, y]) => [a * x + c * y + e, b * x + d * y + f])
}
function lineParameters(seed, page, id, previous, ordinal) {
  const target = tendency(seed, id), result = {}
  for (const key of Object.keys(target)) {
    // Convex AR(1), not a random walk: bounded and mean-reverting.
    const drift = .72 * (previous?.[key] ?? 0) + .28 * target[key]
    result[key] = drift
  }
  // Line-scale movement needs more range than the fine word/letter deviations.
  // Smooth saturation restores visible amplitude lost to repeated averaging,
  // while the underlying correlated state stays bounded and mean-reverting.
  const broad = new Set(['start', 'leading', 'slope', 'curve'])
  const values = Object.fromEntries(Object.keys(target).map(k => [k,
    broad.has(k) ? .15 * page[k] + .85 * Math.tanh(3 * result[k]) : .45 * page[k] + .55 * result[k],
  ]))
  // Two long, unequal rhythms prevent short runs of similar targets from
  // flattening the margin. They are bounded, smooth, and never move ink points.
  const phase = page.phase * Math.PI
  const wander = .65 * Math.sin(.82 * ordinal + phase) + .35 * Math.sin(.37 * ordinal - phase)
  values.start = .1 * page.start + .35 * Math.tanh(2 * result.start) + .55 * wander
  return { drift: result, values }
}
function baseline(x, start, span, scale, n, p) {
  const t = clamp((x - start) / span, 0, 1)
  // At most .40 + .30 = .70 x-height peak-to-peak; smooth over a full line.
  return n * scale * (.40 * p.slope * t + .15 * p.curve * (Math.sin(Math.PI * 1.3 * t + p.phase) - Math.sin(p.phase)))
}

// A token is stable across reflow. Content + occurrence identifiers keep unrelated
// blocks/words stable when text is inserted elsewhere. Shapes retain legacy order.
export function identifyBlocks(blocks) {
  const occurrences = new Map()
  return blocks.map(block => {
    const key = JSON.stringify([block.scale, block.indent, block.glyphs])
    const count = occurrences.get(key) || 0; occurrences.set(key, count + 1)
    const id = `b${hashId(key)}:${count}`, tokens = [], seen = new Map()
    for (let i = 0; i < block.glyphs.length;) {
      const space = /^[ \t]$/.test(block.glyphs[i].char)
      let end = i + 1
      while (end < block.glyphs.length && /^[ \t]$/.test(block.glyphs[end].char) === space) end++
      const glyphs = block.glyphs.slice(i, end), text = glyphs.map(g => g.char).join('')
      const occurrence = seen.get(text) || 0; seen.set(text, occurrence + 1)
      const tokenId = `${id}:w${hashId(text)}:${occurrence}`
      tokens.push({ id: tokenId, text, space, glyphs: glyphs.map((g, j) => ({ ...g, id: `${tokenId}:g${j}`, tokenId })) })
      i = end
    }
    return { ...block, id, tokens }
  })
}

function wordGeometry(token, from, x, params, context) {
  const { seed, naturalness: n, scale, left, right } = context
  const target = tendency(seed, token.id)
  const shared = key => .78 * params[key] + .22 * target[key]
  const rotation = radians(.8) * n * shared('rotation')
  const lean = radians(1) * n * shared('lean'), shear = -Math.tan(lean)
  // Bottom-aligning normalized glyphs removes the pen's vertical placement.
  // Restore it at word scale, without moving individual stroke points.
  const offsetState = .55 * (context.wordDrift ?? params.offset) + .45 * target.offset
  const offset = .45 * scale * n * (.2 * params.offset + .8 * Math.tanh(2.5 * offsetState))
  const cos = Math.cos(rotation), sin = Math.sin(rotation)
  const glyphs = []
  let pen = 0, previousRight = x, letterDrift = 0
  for (const g of token.glyphs.slice(from)) {
    const letter = tendency(seed, g.id), jitter = letter.spacing
    letterDrift = .65 * letterDrift + .35 * letter.offset
    const settling = .14 * scale * n * Math.tanh(2 * letterDrift)
    const advance = g.advance * (1 + .05 * n * (.8 * shared('spacing') + .2 * jitter))
    // Transform order: additional glyph lean, word rotation about its baseline
    // anchor, then placement on the smooth line baseline. Never point noise.
    const matrix = [cos, sin, cos * shear - sin, sin * shear + cos,
      x + cos * pen, sin * pen + offset + settling + baseline(x + cos * pen, left, right - left, scale, n, params)]
    let strokes = g.strokes.map(s => transformStroke(s, matrix))
    let bounds = inkBounds(strokes, maximumStrokeWidth(g.bold ? 1.5 : 1, context.pressure))
    const clearance = glyphs.length ? scale * .07 : 0
    const correction = Math.max(0, previousRight + clearance - bounds.left)
    if (correction) {
      // Only safety clearance can enlarge a nominal advance. Move the complete
      // glyph, preserving its shape, rotation, and the gap from previous ink.
      matrix[4] += correction
      pen += correction / cos
      matrix[5] = sin * pen + offset + settling + baseline(matrix[4], left, right - left, scale, n, params)
      strokes = g.strokes.map(s => transformStroke(s, matrix))
      bounds = inkBounds(strokes, maximumStrokeWidth(g.bold ? 1.5 : 1, context.pressure))
    }
    glyphs.push({ id: g.id, tokenId: token.id, char: g.char, bold: Boolean(g.bold), italic: Boolean(g.italic), source: g.strokes,
      advance, nominalAdvance: g.advance, settling, transform: matrix, position: [matrix[4], matrix[5]], strokes, bounds })
    // Wrapping needs only the first overflowing glyph, even for a 12,000-letter
    // token. Avoid repeatedly transforming its entire remaining suffix.
    if (bounds.right > right) break
    previousRight = bounds.right
    pen += advance
  }
  return { id: `${token.id}:${from}`, tokenId: token.id, rotation, lean, offset, offsetState, anchor: [x, baseline(x, left, right - left, scale, n, params)], glyphs }
}

function makeLine(block, cursor, lineIndex, context, page, previous) {
  const { size, spacing, naturalness: n, seed, width, margin } = context
  const scale = size * block.scale, lineId = `${block.id}:line${lineIndex}`
  const parameters = lineParameters(seed, page.tendency, lineId, previous, context.lineOrdinal)
  // Keep list markers on a common rail; reserve space for negative margin drift.
  const startOffset = block.indent ? 0 : 1.5 * scale * n * parameters.values.start
  const left = margin + block.indent + 1.5 * scale * n + startOffset, right = width - margin
  const line = { id: lineId, blockId: block.id, scale, indent: block.indent, startOffset,
    parameters, left, right, words: [], glyphs: [], spaces: [], explicitBreak: false }
  let x = left, tokenIndex = cursor.token, from = cursor.glyph, wordDrift = parameters.values.offset
  while (tokenIndex < block.tokens.length) {
    const token = block.tokens[tokenIndex]
    if (token.space) {
      const nominal = token.glyphs.reduce((sum, g) => sum + g.advance, 0)
      const advance = nominal * (1 + .15 * n * (.78 * parameters.values.gap + .22 * tendency(seed, token.id).gap))
      line.spaces.push({ id: token.id, text: token.text, advance, nominalAdvance: nominal, x })
      tokenIndex++; from = 0
      if (x + advance > right && line.glyphs.length) break
      x = Math.min(right, x + advance)
      continue
    }
    const word = wordGeometry(token, from, x, parameters.values, { ...context, scale, left, right, wordDrift })
    const fits = word.glyphs.findIndex(g => g.bounds.right > right)
    if (fits !== -1 && line.glyphs.length) break // move a whole word to the next line
    if (fits === 0) {
      // Leading whitespace may consume a narrow line. Retry the same glyph on
      // a fresh line; if it cannot fit there, report it rather than discard it.
      if (x > left) break
      throw Error('The page is too narrow for this handwriting size. Use a wider page or smaller size.')
    }
    if (fits !== -1) word.glyphs = word.glyphs.slice(0, fits)
    const last = word.glyphs.at(-1)
    line.words.push(word); line.glyphs.push(...word.glyphs)
    wordDrift = word.offsetState
    x = Math.max(last.position[0] + last.advance * Math.cos(word.rotation), last.bounds.right + .07 * scale)
    if (fits !== -1) { from += fits; break }
    tokenIndex++; from = 0
  }
  line.explicitBreak = tokenIndex === block.tokens.length
  line.bounds = line.glyphs.length ? {
    left: Math.min(...line.glyphs.map(g => g.bounds.left)), right: Math.max(...line.glyphs.map(g => g.bounds.right)),
    top: Math.min(...line.glyphs.map(g => g.bounds.top)), bottom: Math.max(...line.glyphs.map(g => g.bounds.bottom)),
  } : { left, right: left, top: 0, bottom: 0 }
  line.baseline = -Math.min(line.bounds.top, -2 * scale)
  line.leading = scale * 4.2 * spacing * (1 + .22 * n * parameters.values.leading)
  line.extent = Math.max(line.leading, line.baseline + line.bounds.bottom + .7 * scale)
  return { line, cursor: { token: tokenIndex, glyph: from } }
}

export function naturalLayout(blocks, options) {
  const { width, height, margin, ink, seed } = options
  const pages = [], newPage = () => {
    const page = { paths: [], lines: [], tendency: tendency(seed, `page:${pages.length}`) }
    pages.push(page); return page
  }
  let page = newPage(), y = margin, previous, lineOrdinal = 0
  for (const block of blocks) {
    let cursor = { token: 0, glyph: 0 }, lineIndex = 0
    do {
      let result = makeLine(block, cursor, lineIndex, { ...options, lineOrdinal }, page, previous)
      if (y + result.line.extent > height - margin && result.line.glyphs.length) {
        if (y > margin) { page = newPage(); y = margin }
        // Recompute using the destination page tendency before committing.
        result = makeLine(block, cursor, lineIndex, { ...options, lineOrdinal }, page, previous)
        if (y + result.line.extent > height - margin) throw Error('The page is too short for this handwriting size.')
      }
      const { line } = result
      const baselineY = y + line.baseline
      line.y = y; line.baseline = baselineY
      for (const word of line.words) word.anchor[1] += baselineY
      for (const g of line.glyphs) {
        g.transform[5] += baselineY; g.position[1] += baselineY
        g.strokes = g.source.map(s => transformStroke(s, g.transform))
        g.bounds = inkBounds(g.strokes, maximumStrokeWidth(g.bold ? 1.5 : 1, options.pressure))
        for (const points of g.strokes) page.paths.push({ points, weight: g.bold ? 1.5 : 1, char: g.char })
      }
      line.bounds.top += baselineY; line.bounds.bottom += baselineY
      page.lines.push(line); previous = line.parameters.drift
      y = Math.min(height - margin, y + line.extent)
      cursor = result.cursor; lineIndex++; lineOrdinal++
    } while (cursor.token < block.tokens.length)
  }
  return { width, height, ink, naturalness: options.naturalness, blocks: blocks.map(({ id, scale, indent, tokens }) => ({ id, scale, indent, text: tokens.map(t => t.text).join('') })), pages }
}
