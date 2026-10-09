// Pressure is a rendering profile, not pressure learned by the shape model.
// Use travelled distance so uneven point sampling cannot create width pulses.
export function maximumStrokeWidth(weight, pressure) {
  return weight * (pressure ? 1.18 : 1)
}
export function pressureOutline(points, weight) {
  const clean = points.filter((p, i) => !i || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-8)
  if (!clean.length) return []
  const distances = [0], normals = []
  for (let i = 1; i < clean.length; i++) {
    const dx = clean[i][0] - clean[i - 1][0], dy = clean[i][1] - clean[i - 1][1], length = Math.hypot(dx, dy)
    distances.push(distances.at(-1) + length)
    normals.push([-dy / length, dx / length])
  }
  const total = distances.at(-1)
  const radius = distance => {
    const t = total ? distance / total : 0, eased = t * t * (3 - 2 * t)
    return weight * (1.18 - .53 * eased) / 2
  }
  if (!total) return Array.from({ length: 16 }, (_, i) => [clean[0][0] + radius(0) * Math.cos(i * Math.PI / 8), clean[0][1] + radius(0) * Math.sin(i * Math.PI / 8)])
  const left = [], right = []
  for (let i = 0; i < clean.length; i++) {
    const a = normals[Math.max(0, i - 1)], b = normals[Math.min(normals.length - 1, i)]
    const length = Math.hypot(a[0] + b[0], a[1] + b[1])
    // Averaged unit normals make a smooth ribbon without miter spikes. Keeping
    // the offset within the local radius also keeps layout's ink bounds valid.
    const normal = length > 1e-8 ? [(a[0] + b[0]) / length, (a[1] + b[1]) / length] : b
    const r = radius(distances[i]), [x, y] = clean[i]
    left.push([x + normal[0] * r, y + normal[1] * r])
    right.push([x - normal[0] * r, y - normal[1] * r])
  }
  const cap = (point, normal, r, direction) => {
    const start = Math.atan2(normal[1], normal[0])
    return Array.from({ length: 7 }, (_, i) => {
      const angle = start + direction * Math.PI * (i + 1) / 8
      return [point[0] + r * Math.cos(angle), point[1] + r * Math.sin(angle)]
    })
  }
  return [...left, ...cap(clean.at(-1), normals.at(-1), radius(total), -1), ...right.reverse(),
    ...cap(clean[0], [-normals[0][0], -normals[0][1]], radius(0), -1)]
}
export function applyPressure(document, enabled) {
  if (!enabled) return document
  // Store the outline once in the canonical document. All exporters consume it.
  for (const page of document.pages) for (const path of page.paths) path.outline = pressureOutline(path.points, path.weight)
  return { ...document, pressure: true }
}
