import homeImg from './assets/home.png'

export const renderProjectsPage = root => {
  root.innerHTML = `
<section id="dpm-header">
  <h1>Projects</h1>
  <p>Hi there! Welcome to my workshop.</p>
  <div class="back-home-wrap">
    <a href="/" id="home-trigger">
      <img src="${homeImg}" alt="Home" draggable="false" />
      <span class="home-label">home</span>
    </a>
  </div>
</section>
  `
}
