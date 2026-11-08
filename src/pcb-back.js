// Delegation works for both a direct gallery load and the in-page gallery swap.
let returning = false
document.addEventListener('click', async event => {
  const link = event.target.closest?.('[data-pcb-back]')
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (returning) return
  returning = true
  const cover = document.createElement('div')
  cover.className = 'pcb-return-transition'
  cover.setAttribute('aria-hidden', 'true')
  document.body.append(cover)
  const radius = Math.ceil(Math.hypot(innerWidth, innerHeight)) + 2
  await cover.animate([
    { clipPath: 'circle(0px at 0% 0%)' },
    { clipPath: `circle(${radius}px at 0% 0%)` },
  ], { duration: 950, easing: 'cubic-bezier(.22, .61, .36, 1)', fill: 'forwards' }).finished
  window.location.assign(link.href)
})
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    document.querySelector('.pcb-return-transition')?.remove()
    returning = false
  }
})
