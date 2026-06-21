import './style.css'
import projectsImg from './assets/orientated.png'
import { renderDoublePendulumPage } from './dpm.js'
import { renderProjectsPage } from './projects.js'

const root = document.querySelector('#app')
const path = window.location.pathname.replace(/\/+$/, '')

if (path === '/dpm') {
  renderDoublePendulumPage(root)
} else if (path === '/projects') {
  renderProjectsPage(root)
} else {
  renderHome(root)
}

function renderHome(root) {
  root.innerHTML = `
<section id="center">
  <h1 id="bold">Jeremy Wang</h1>
  <h2>Love for all things hardware</h2>
</section>
<h5>
  Github: <a href="https://github.com/wmans01">wmans01</a>
  LinkedIn: <a href="https://www.linkedin.com/in/jeremy-wang-868a70406/">Jeremy Wang</a>
  Instagram: <a href="https://www.instagram.com/jeremp0/">@jeremp0</a>
  Updated: 6/20/2026
</h5>
<div id="projects-trigger">
  <div id="projects-hitarea">
    <span id="projects-label">projects</span>
  </div>
  <img src="${projectsImg}" alt="Projects" draggable="false" />
</div>
`
  const hitarea = document.getElementById('projects-hitarea')
  const trigger = document.getElementById('projects-trigger')
  if (trigger && hitarea) {
    hitarea.addEventListener('mouseenter', () => trigger.classList.add('active'))
    hitarea.addEventListener('mouseleave', () => trigger.classList.remove('active'))
    hitarea.addEventListener('click', () => { window.location.href = '/projects' })
  }
}


