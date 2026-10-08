// Shape-v2 decoder; weights are row-major Float32 tensors from selected-model.pt.
export class ShapeModel {
  constructor(meta, buffer) {
    this.meta = meta
    this.t = Object.fromEntries(Object.entries(meta.tensors).map(([k, v]) => [k, new Float32Array(buffer, v.offset * 4, v.length)]))
    this.dimension = meta.tensors.means.shape.slice(1).reduce((a, b) => a * b, 1)
    this.characters = new Set(meta.groups.map(g => g.label))
  }
  decode(gid, z, variation) {
    const { embedding, latent } = this.meta.config
    let x = new Float64Array(latent + embedding)
    x.set(z); x.set(this.t['embedding.weight'].subarray(gid * embedding, (gid + 1) * embedding), latent)
    for (const layer of [0, 2, 4]) {
      const w = this.t[`decoder.${layer}.weight`], b = this.t[`decoder.${layer}.bias`]
      const next = new Float64Array(b.length)
      for (let i = 0; i < b.length; i++) {
        let sum = b[i]
        for (let j = 0; j < x.length; j++) sum += w[i * x.length + j] * x[j]
        next[i] = layer === 4 ? sum : sum / (1 + Math.exp(-sum))
      }
      x = next
    }
    return Array.from(x, (v, i) => this.t.means[gid * this.dimension + i] + this.t.scales[gid] * variation * 3 * Math.tanh(v / 3) * this.t.masks[gid * this.dimension + i])
  }
  generate(char, random, variation) {
    const groups = this.meta.groups.map((g, i) => ({ ...g, id: i })).filter(g => g.label === char)
    if (!groups.length) throw Error(`Unsupported character: ${char}`)
    let choice = random() * groups.reduce((n, g) => n + g.count, 0)
    const group = groups.find(g => (choice -= g.count) < 0) || groups.at(-1)
    const bank = this.meta.bank[group.id], a = bank[Math.floor(random() * bank.length)], b = bank[Math.floor(random() * bank.length)]
    const alpha = .15 + random() * .7
    const z = a.map((v, j) => {
      const mean = bank.reduce((n, row) => n + row[j], 0) / bank.length
      const std = Math.sqrt(bank.reduce((n, row) => n + (row[j] - mean) ** 2, 0) / bank.length)
      const normal = Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random())
      return (1 - alpha) * v + alpha * b[j] + normal * .1 * std
    })
    const xy = this.decode(group.id, z, variation), points = this.meta.config.points
    return Array.from({ length: group.strokes }, (_, s) => Array.from({ length: points }, (_, p) => xy.slice((s * points + p) * 2, (s * points + p) * 2 + 2)))
  }
}
// Stable browser seed stream; intentionally different from NumPy's generator.
export function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let t = Math.imul(state ^ state >>> 15, 1 | state)
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
