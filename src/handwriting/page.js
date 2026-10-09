import './style.css'
import { pageSvg, pdfBytes } from './layout.js'
import { DEFAULT_NATURALNESS } from './natural.js'

export function renderHandwritingPage(root) {
  document.title = 'Ink Study · Jeremy Wang'
  root.innerHTML = `
    <main class="ink-page">
      <header class="ink-header"><h1>Ink Study</h1></header>
      <div class="ink-workspace">
        <section class="ink-editor" aria-label="Markdown editor">
          <label class="ink-sr" for="ink-text">Markdown text</label>
          <textarea id="ink-text" spellcheck="false" maxlength="12000" aria-describedby="ink-help"></textarea>
          <div class="ink-editor-meta"><p id="ink-help" class="ink-note">Headings (#), lists (- or 1.), **bold**, and *italic*.</p><span id="ink-count"></span></div>
          <label class="ink-naturalness" for="ink-naturalness">Naturalness <output id="naturalness-value">${DEFAULT_NATURALNESS}</output><input id="ink-naturalness" type="range" min="0" max="1" step="0.05" value="${DEFAULT_NATURALNESS}"></label>
          <details class="ink-settings">
          <summary>Other settings</summary>
          <div class="ink-controls">
            <label>Size <output id="size-value">14</output><input id="ink-size" type="range" min="8" max="24" step="1" value="14"></label>
            <label>Shape variation <output id="variation-value">0.7</output><input id="ink-variation" type="range" min="0" max="1.5" step="0.1" value="0.7"></label>
            <label>Line spacing <output id="spacing-value">1.0</output><input id="ink-spacing" type="range" min="0.8" max="1.6" step="0.1" value="1"></label>
            <label>Paper<select id="ink-paper"><option value="letter">US Letter</option><option value="a4">A4</option></select></label>
            <label>Ink color<input id="ink-color" type="color" value="#182235"></label>
            <label>Seed<input id="ink-seed" type="number" min="0" max="4294967295" step="1" value="31415"></label>
            <label class="ink-checkbox"><input id="ink-pressure" type="checkbox" checked>Stroke pressure</label>
            <label class="ink-checkbox"><input id="ink-normalize" type="checkbox" checked>Normalize typography</label>
          </div>
          <div class="ink-settings-actions"><button id="ink-shuffle" type="button">Reshuffle ↻</button><button id="ink-reset" type="button" class="ink-link">reset style</button></div>
          </details>
        </section>
        <section class="ink-preview" aria-label="Handwriting preview">
          <div class="ink-toolbar"><button id="ink-prev" aria-label="Previous page" disabled>←</button><label>Page <select id="ink-page" disabled><option>1</option></select></label><button id="ink-next" aria-label="Next page" disabled>→</button><span id="ink-pages"></span><span class="ink-spacer"></span><button data-export="svg" disabled>SVG</button><button data-export="png" disabled>PNG</button><button data-export="pdf" disabled>PDF ↓</button></div>
          <p class="ink-note ink-export-note">SVG / PNG: current page · PDF: all pages</p>
          <div id="ink-status" role="status" aria-live="polite">Loading handwriting model…</div>
          <button id="ink-retry" type="button" hidden>Retry generation</button>
          <div id="ink-paper-preview" aria-busy="true"></div>
        </section>
      </div>
      <footer class="ink-footer">Jeremy Wang</footer>
    </main>`
  const $ = id => root.querySelector(`#ink-${id}`)
  const editor = $('text'), status = $('status'), preview = $('paper-preview')
  editor.value = '# Hi Gang\n\nThis is very handwritten.\n\n- A little ink\n- A few **good words**\n- Something *worth keeping*\n\nJosh x Megaknight'
  let worker, timer, request = 0, doc = null, page = 0, exportBusy = false
  function setEnabled(enabled) {
    root.querySelectorAll('[data-export]').forEach(b => { b.disabled = !enabled || exportBusy })
    $('page').disabled = !enabled
    $('prev').disabled = !enabled || page === 0
    $('next').disabled = !enabled || page >= (doc?.pages.length || 0) - 1
  }
  function showPage() {
    preview.innerHTML = pageSvg(doc, page)
    $('page').value = String(page)
    setEnabled(true)
  }
  function startWorker() {
    worker?.terminate()
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      if (data.id !== request) return
      preview.setAttribute('aria-busy', 'false')
      if (data.error) { status.textContent = data.error; $('retry').hidden = false; return }
      doc = data.document; page = Math.min(page, doc.pages.length - 1)
      $('page').replaceChildren(...doc.pages.map((_, i) => new Option(String(i + 1), String(i))))
      $('pages').textContent = `${doc.pages.length} ${doc.pages.length === 1 ? 'sheet' : 'sheets'}`
      status.textContent = editor.value.trim() ? 'Ready to download.' : 'Start typing to make a note.'
      showPage()
    }
    worker.onerror = () => { status.textContent = 'Generation failed. Please retry.'; preview.setAttribute('aria-busy', 'false'); setEnabled(false); $('retry').hidden = false }
  }
  function schedule() {
    request++; clearTimeout(timer); doc = null
    setEnabled(false); preview.replaceChildren(); preview.setAttribute('aria-busy', 'true')
    $('retry').hidden = true; $('pages').textContent = ''
    status.textContent = 'Preparing your handwriting…'
    $('count').textContent = `${editor.value.length.toLocaleString()} / 12,000`
    for (const key of ['size', 'variation', 'spacing', 'naturalness']) root.querySelector(`#${key}-value`).value = $(key).value
    timer = setTimeout(() => {
      if (!$('seed').validity.valid || !$('seed').value) { status.textContent = 'Enter a whole-number seed from 0 to 4294967295.'; preview.setAttribute('aria-busy', 'false'); return }
      worker.postMessage({ id: request, text: editor.value, options: { pressure: $('pressure').checked, normalizeTypography: $('normalize').checked, naturalness: +$('naturalness').value, size: +$('size').value, variation: +$('variation').value, spacing: +$('spacing').value, seed: +$('seed').value, paper: $('paper').value, ink: $('color').value } })
    }, 300)
  }
  editor.addEventListener('input', schedule)
  $('naturalness').addEventListener('input', schedule)
  root.querySelectorAll('.ink-controls input, .ink-controls select').forEach(el => el.addEventListener('input', schedule))
  $('shuffle').onclick = () => { $('seed').value = crypto.getRandomValues(new Uint32Array(1))[0]; schedule() }
  $('reset').onclick = () => {
    $('normalize').checked = true
    $('pressure').checked = true
    for (const [key, value] of Object.entries({ naturalness: DEFAULT_NATURALNESS, size: 14, variation: .7, spacing: 1, paper: 'letter', color: '#182235', seed: 31415 })) $(key).value = value
    schedule()
  }
  $('retry').onclick = () => { startWorker(); schedule() }
  $('page').onchange = () => { page = +$('page').value; showPage() }
  $('prev').onclick = () => { page--; showPage() }
  $('next').onclick = () => { page++; showPage() }
  root.querySelectorAll('[data-export]').forEach(button => button.onclick = async () => {
    if (!doc) return
    const snapshot = doc, current = page, format = button.dataset.export
    exportBusy = true; setEnabled(true)
    try {
      let blob
      if (format === 'pdf') blob = new Blob([pdfBytes(snapshot)], { type: 'application/pdf' })
      else {
        blob = new Blob([pageSvg(snapshot, current)], { type: 'image/svg+xml' })
        if (format === 'png') {
          const url = URL.createObjectURL(blob)
          try {
            const image = new Image()
            await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url })
            const canvas = document.createElement('canvas')
            canvas.width = Math.ceil(snapshot.width * 2); canvas.height = Math.ceil(snapshot.height * 2)
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
            blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
            if (!blob) throw Error('PNG export failed')
          } finally { URL.revokeObjectURL(url) }
        }
      }
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = `ink-study${format === 'pdf' ? '' : `-page-${current + 1}`}.${format}`
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { status.textContent = 'Download failed. Please try again.' }
    finally { exportBusy = false; setEnabled(Boolean(doc)) }
  })
  startWorker(); schedule()
}
