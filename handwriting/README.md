# Handwriting layout

`/handwriting` keeps the existing Vite/vanilla-JavaScript page and shape-v2 model. The worker returns a canonical document; preview, SVG, PNG (rasterized SVG), and vector PDF all use its `pages[].paths`. No renderer samples randomness or recomputes layout.

Naturalness is the one visible layout control, default **0.55**, range 0–1. **Zero preserves the previous layout exactly**, including wrapping, page breaks, path coordinates, and SVG/PDF bytes. Shape variation, size, line spacing, paper, ink, seed, and **Reshuffle** remain under collapsed Other settings. Reshuffle changes the seed and therefore both shapes and layout; changing Naturalness leaves the generated shapes unchanged.

## Geometry and randomness

- `model.js`: original seeded shape stream, unchanged. The selected epoch-64 decoder is not retrained or modified.
- `layout.js`: Markdown parsing, validation, shared shape preparation, exact zero-naturalness layout, and SVG/PDF serialization.
- `natural.js`: positive-naturalness placement. Each page has a tendency. Lines maintain bounded mean-reverting state (`0.72 * previous + 0.28 * target`). Margin, leading, slope, and curve combine 15% page tendency with 85% smoothly amplified state (`tanh(3 * state)`); fine word-related parameters retain a 45% page / 55% state mix. This avoids suppressing visible line variation through repeated averaging. Line starts additionally mix two smooth, unequal low-frequency rhythms with their mean-reverting state, so similar adjacent random targets cannot flatten the margin. Words combine 78% line tendency and 22% keyed word deviation. Letter advances use primarily the word tendency with a smaller keyed letter deviation.

Layout PRNGs are seeded separately through an explicit `layout` namespace. Block content plus duplicate occurrence, word content plus occurrence, and within-word glyph index provide stable IDs. Reflow doesn't resample glyph shapes. Editing an unrelated block preserves other block IDs; line correlation can still propagate small layout changes. Shape generation deliberately retains its original sequential stream for zero compatibility, so inserting characters can change subsequent shapes.

Full-strength upper bounds before clearance correction:

| Parameter | Limit |
| --- | --- |
| Letter advance | ±5% |
| Whitespace advance | ±15% (always positive) |
| Line start | ±1.5 x-height around a reserved inset |
| Word rotation | ±0.8 degrees |
| Additional word-shared lean | ±1 degree |
| Word baseline offset | ±0.45 x-height |
| Within-word letter settling | ±0.14 x-height |
| Line leading | ±22% |
| Line slope plus smooth drift | ≤0.70 x-height peak-to-peak |

All terms scale linearly with Naturalness, and distances scale with the current heading/body x-height. Convex combinations usually produce smaller changes than these caps. Baseline drift is a smooth, low-frequency sine segment plus slope, evaluated at glyph anchors; there is no per-point noise. List markers use a common left rail rather than randomized starts, retaining the existing nesting indentation.

Transform order: existing glyph normalization (including Markdown italic) → additional word-shared glyph shear → rotation around the word baseline anchor → translation onto the line baseline. Each canonical glyph stores its normalized source strokes, affine matrix, position, transformed strokes, advance, and stroke-aware bounds; words, lines, and pages retain their hierarchy and parameters. For zero Naturalness, the affine matrix is translation only because the existing italic treatment is already in the normalized source.

The positive-naturalness engine measures transformed ink including stroke width. It enforces horizontal clearance, wraps whole words where possible, splits oversized words at glyph boundaries, and reserves vertical clearance below descenders. Safety correction can enlarge spacing beyond its nominal jitter limit. Pagination retries a pending line with the destination page's tendency before committing it. Path order and glyph IDs preserve every rendered character; whitespace and explicit line breaks also remain in canonical block text. Dimensions too small for a single glyph/line produce an explicit error.

## Checks and previews

```sh
npm run test:handwriting
npm run build
```

The first suite checks PyTorch parity, all 83 characters across five seeds, Markdown handling, determinism, and layout/export basics. The layout suite additionally checks:

- Exact zero-naturalness geometry and SVG/PDF SHA-256 hashes captured **before** implementation: three documents including multipage A4, headings/lists, whitespace, and extreme settings.
- Same-seed determinism, different-seed changes, unchanged source glyphs across Naturalness values, stable block IDs, and no unseeded randomness.
- Dozens of pages of narrow and multipage documents, long paragraphs, oversized words, all supported characters, nested lists, explicit blank lines, italic/bold, and descenders.
- Exact glyph order and IDs, transformed/stroke-aware page bounds, horizontal and vertical clearance, bounded drift and parameter amplitudes.
- SVG and PDF coordinates matching canonical preview geometry within 0.0005 points of serialization precision.

The test writes `results/comparison.html`, before/after/full SVGs and vector PDFs, and the exact input/settings. The comparison uses identical text, glyph-shape seed (31415), size (14), and Letter paper. A Firefox screenshot is saved as `results/comparison.png` during visual review. These review artifacts are not part of the Vite page build.

Limitations: formatting and spacing remain procedural rather than learned; this is separated-print handwriting. The existing small Markdown dialect and 83-character alphabet are unchanged. Exact zero preserves the old renderer's heuristics, while transformed-ink clearance applies to positive Naturalness. No deployment is performed by these scripts.

## Typography normalization

**Normalize typography** is enabled by default under Other settings. `typography.js` applies one explicit replacement map to parsed text glyphs before token IDs, measurement, wrapping, or pagination:

- Curly single quotes/apostrophes `‘ ’ ‚ ‛` → `'`.
- Curly double quotes `“ ” „ ‟` → `"`.
- En/em dashes, Unicode minus, and Unicode hyphens `– — − ‐ ‑` → `-`.
- Ellipsis `…` → `...` (three independently measured glyphs).
- NBSP U+00A0, narrow NBSP U+202F, and thin space U+2009 → ordinary layout space.

A model-supported original always wins. A replacement is used only when all its characters are supported by the loaded model (ordinary space is provided by the layout engine). The source Markdown/editor value is never rewritten; tabs, line breaks, block structure, and formatting remain intact. The operation is immutable, deterministic, and idempotent. Preview and all exports consume the same normalized layout.

The small existing Markdown dialect still renders link and HTML syntax literally. Parser annotations protect link destinations/titles, reference definitions, HTML tags/attributes (including multiline attributes), URLs, and inline code from typography changes. Visible labels and HTML body text can be normalized. This is not a full CommonMark or HTML parser. Remaining unsupported characters, including those inside protected literal syntax, continue to block generation with the existing deduplicated character/code-point notice; nothing is silently discarded. No accents, alphabets, or other math symbols are approximated.

`npm run test:handwriting` includes focused typography tests against the loaded vocabulary, plus multipage equality between normalized Unicode and equivalent ASCII layouts/SVG/PDFs. There is no Markdown-save feature in the current editor; its unchanged source value remains the authoritative original.

## Baseline placement regression

The first six stanzas of [The Raven, Broadway Journal, February 8, 1845](https://www.eapoe.org/works/poems/ravenf.htm) are stored in `scripts/fixtures/raven-excerpt.md` as a public-domain regression input. Source line breaks are preserved, with blank lines between stanzas; editorial page/column markers are omitted. `results/raven-before.pdf` captures the previous renderer; `raven-after.pdf` and `raven-comparison.html` show the revised placement at the same shape seed, size 12, Letter paper, and Naturalness 0.55.

Normalizing each non-descending glyph to its lowest point made word bottoms excessively aligned. Positive Naturalness now restores vertical placement with bounded word drift (55% previous / 45% keyed target, smoothly amplified), plus smaller, correlated settling of whole glyphs within words (65% previous / 35% keyed target). Generated strokes remain unchanged; these are translations added after shear/rotation. Actual transformed ink still determines line clearance and pagination. Naturalness zero continues to reproduce the original layout exactly.

The Raven regression checks the actual lower ink bounds of lowercase body letters after removing each line's best-fit slope, so a merely slanted line cannot pass. Across 6 pages, the bottom-position residual RMS rises from 0.134 pt to about 0.819 pt at the default. It also checks unchanged source-glyph hashes, exact text order, determinism, page margins, and line clearance. This is a visual-layout metric, not a learned measure of handwriting quality.

## Stroke pressure

**Stroke pressure** is enabled by default in the page's Other settings. It is independent of Naturalness and shape variation. Each pen-down stroke starts at 118% of its normal width and smoothly eases to 65% at its end, with rounded caps. The profile uses cumulative arc length rather than point index, and bold retains its 1.5× base width. This is simulated pressure; the model's recorded/generated pressure values are not used.

`pressure.js` constructs a filled vector outline around each canonical stroke centerline. Averaged unit normals avoid sharp miter spikes; zero-length strokes become round dots. The outline is computed once and shared by preview, SVG, PNG, and PDF. Natural layout reserves the maximum pressure width when measuring ink bounds. Filled SVG/PDF paths preserve vector output without dozens of separately stroked segments.

The layout API defaults `pressure` to false for backward compatibility; the page explicitly sends the checkbox value. With pressure off, the old uniform-stroke exports are unchanged. Naturalness zero preserves the original placements; pressure can still be applied to those placements independently.

The pressure regression covers taper direction, uneven sampling, bold scaling, duplicate points/dots/reversals, all-character page bounds, unchanged source glyphs, determinism, and SVG/PDF outline parity. `results/pressure-comparison.html` and the pressure before/after SVG/PDFs provide the visual comparison.
