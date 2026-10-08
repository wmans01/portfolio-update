import homeImg from './assets/home.png'

const currentWork = [
  {
    title: 'Illini Electric Motorsports (Formula SAE)',
    subtitle: 'High Voltage & Sensor Board Subteams',
    description:
      "Working on Battery Management System and Sensorboard circuit design teams for the University of Illinois' Formula SAE team.",
  },
  {
    title: 'Open Source Hi-Fi Audio Player',
    description:
      'A dedicated portable high-fidelity audio player with custom DAC/amp circuitry, discrete power stages, and an open hardware architecture.',
  },
  {
    title: 'Open Source Cinema Drone',
    description:
      'A quadcopter designed for heavy cinema-grade payloads, custom avionics, low vibration transmission, and open flight control.',
  },
]

const selectWork = [
  {
    id: 'cnc-mill',
    title: 'DIY 3-Axis CNC Mill',
    subtitle: "Budget 4' × 3' × 1' SolidWorks CAD & Build",
    description:
      "A budget DIY 3-axis CNC router and mill with a 4' × 3' × 1' working envelope. Designed from scratch and modeled in SolidWorks, optimizing frame stiffness, rigidity, and cost-effective linear motion assemblies.",
    media: [
      { type: 'image', src: '/media/cnc1.jpg', alt: 'CNC Mill frame and mechanics' },
      { type: 'image', src: '/media/cnc2.jpg', alt: 'CNC Mill gantry detail' },
    ],
  },
  {
    id: 'sorter',
    title: 'Automatic Hardware Sorter',
    subtitle: '3-Axis Gantry + CNN Computer Vision Pipeline',
    description:
      'An automated 3-axis Cartesian gantry paired with a custom mechanical manipulator, using a Convolutional Neural Network to classify and sort loose fasteners such as screws, nuts, and standoffs.',
    links: [{ url: 'https://github.com/wmans01/SortingPi', text: 'github' }],
    media: [
      { type: 'image', src: '/media/sorter.jpg', alt: 'Automatic Hardware Sorter unit' },
      { type: 'video', src: '/media/sortervideo.mp4', label: 'Stepper Motor Testing', poster: '/media/sorter.jpg' },
      { type: 'video', src: '/media/sortervideo2.mp4', label: 'MVP Working', poster: '/media/sorter.jpg' },
    ],
  },
  {
    id: 'numberosity',
    title: 'Numberosity Academy',
    subtitle: 'Founder, 501(c)(3) Non-profit',
    description:
      'Founded a 501(c)(3) non-profit organization dedicated to fostering and sharing the curiosity of robotics and STEM with the local community and students.',
    link: { url: 'https://numberosity.org', text: 'numberosity.org' },
  },
  {
    id: 'vex-robotics',
    title: 'VEX Robotics (Team 8889A)',
    subtitle: 'Team Captain & Hardware Lead',
    description:
      'Led mechanical architecture, CAD, rapid prototyping, and mechanism iteration as team captain and hardware lead. Qualified for the VEX Robotics World Championship all seven competitive seasons.',
    media: [
      { type: 'video', src: '/media/vexvideo.mp4', label: 'Elevation Testing' },
      { type: 'video', src: '/media/vexvideo2.mp4', label: 'Holonomic Drive Testing' },
    ],
  },
]

const otherProjects = [
  {
    title: 'Ink Study',
    description: 'A Markdown notebook that turns your words into my handwriting, with image and PDF exports. Note: This proof-of-concept was entirely vibe-coded.',
    link: { url: '/handwriting', text: 'try Ink Study' },
  },
  {
    title: 'DPM Simulation',
    description:
      'A numerical exploration into double pendulums and chaotic dynamics using RK4 integration for an AP Physics C final project.',
    link: { url: '/dpm', text: 'jeremp0.me/dpm' },
  },
  {
    title: 'Illini Redstone Computing',
    description:
      'Building fully functional computer architectures, ALUs, memory registers, and digital logic devices inside Minecraft.',
  },
  {
    title: 'Beaver Works Summer Institute RACECAR',
    description:
      'Autonomous software development on an Ackermann RC chassis. Conducted research on state estimation and localization with malformed LiDAR data in adverse weather conditions.',
    links: [
      {
        url: 'https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/e/772/files/2024/11/Team_6__Enhancing_Autonomous_Vehicle_Navigation_in_Foggy_Conditions_Through_Analysis_of_the_Deteriorating_Quality_of_LIDAR_Data.pdf',
        text: 'paper',
      },
      {
        url: 'https://github.com/MITRacecarNeo/bwsi-racecar-su24-team-6',
        text: 'github',
      },
    ],
    media: [{ type: 'video', src: '/media/racecar.mp4', label: 'Data Acquisition Run' }],
  },
  {
    title: 'BWSI CubeSAT',
    description:
      '1U CubeSat payload architecture leveraging edge computer vision to detect municipal power grid outages from orbit in order to support emergency first responders.',
    media: [
      { type: 'image', src: '/media/cubesat.jpg', alt: 'CubeSat payload electronics' },
      { type: 'image', src: '/media/cubesat2.jpg', alt: 'CubeSat structural frame' },
    ],
  },
  {
    title: 'Gutter Gutter',
    description:
      'Autonomous track-driven gutter cleaning robot engineered to clear debris and navigate downspouts, replacing a hazardous manual chore.',
  },
  {
    title: 'Massbuilders',
    description:
      'BWSI CreATe Challenge: collaborated with co-designer to construct a motorized walker engineered to assist mobility on inclines and declines.',
    media: [{ type: 'image', src: '/media/create.jpg', alt: 'Motorized walker prototype' }],
  },
  {
    title: 'Echo10',
    description:
      'Mechanical 10-key numpad powered by a Raspberry Pi RP2040 microcontroller with custom PCB routing and firmware.',
    links: [{ url: 'https://github.com/wmans01/Echo10', text: 'github' }],
    media: [{ type: 'image', src: '/media/Echo10.png', alt: 'Echo10 PCB and CAD render' }],
  },
  {
    title: 'Mechanical Keyboard',
    description:
      '72-key custom mechanical keyboard built from scratch with an ATmega32U4 microcontroller, custom routed PCB, and an aluminum CNC-machined enclosure.',
    media: [
      { type: 'image', src: '/media/keyboard.jpg', alt: 'Assembled 72-key mechanical keyboard' },
      { type: 'image', src: '/media/keyboard.png', alt: 'Keyboard PCB routing design' },
    ],
  },
  {
    title: 'BANSHEE UAV Lab — Robotics Internship',
    description:
      'Developed low-level embedded firmware and operating routines for a multi-DOF robotic arm mounted on an RC ground rover.',
    links: [{ url: 'https://github.com/galgim/ROBOTIS_INTERNSHIP_SUMMER_2025', text: 'github' }],
  },
  {
    title: 'VEX Mini Competition Switch',
    description:
      'Custom hardware robotics competition switch engineered to be 6× smaller and 8× cheaper than the commercial alternative while preserving reliability.',
    media: [
      { type: 'image', src: '/media/compswitch.jpg', alt: 'Mini competition switch hardware' },
      { type: 'video', src: '/media/compswitchvid.mp4', label: 'Switch test' },
    ],
  },
  {
    title: 'Giftly',
    description:
      'Recommendation engine leveraging the Google Cloud Natural Language API to analyze preferences and suggest tailored gifts.',
  },
  {
    title: 'Decaptcha',
    description:
      'Machine learning model trained to preprocess, segment, and solve classic distorted text challenges from ReCAPTCHA v1.',
    links: [{ url: 'https://github.com/wmans01/DeCaptcha', text: 'github' }],
    media: [{ type: 'image', src: '/media/decaptcha.jpg', alt: 'Decaptcha model evaluation' }],
  },
]

const renderProjectLinks = proj => {
  const links = proj.links || (proj.link ? [proj.link] : [])
  if (!links.length) return ''
  return `
    <div class="project-links-wrap">
      ${links
      .map(l => {
        const isExternal = l.url.startsWith('http')
        const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
        return `<a href="${l.url}"${targetAttr} class="project-inline-link">${l.text} ↗</a>`
      })
      .join('')}
    </div>
  `
}

export const renderProjectsPage = root => {
  root.innerHTML = `
<div id="projects-page">
  <section id="dpm-header" class="projects-hero">
    <h1>Projects</h1>
    <a href="/" class="mobile-home-link">← home</a>
    <div class="back-home-wrap">
      <a href="/" id="home-trigger" title="Back to home">
        <img src="${homeImg}" alt="Home" draggable="false" />
        <span class="home-label">home</span>
      </a>
    </div>
  </section>

  <main class="projects-content">
    <!-- SECTION 1: CURRENTLY WORKING ON -->
    <section class="project-group">
      <div class="section-title-wrap">
        <h2 class="section-title">What I'm currently working on</h2>
        <div class="section-rule"></div>
      </div>
      <ul class="current-list">
        ${currentWork
      .map(
        item => `
          <li class="current-item">
            <span class="current-bullet">/</span>
            <div class="current-body">
              <div class="current-headline">
                <span class="current-title">${item.title}</span>
                ${item.subtitle ? `<span class="current-sub">— ${item.subtitle}</span>` : ''}
              </div>
              <p class="current-desc">${item.description}</p>
            </div>
          </li>
        `
      )
      .join('')}
      </ul>
    </section>

    <!-- SECTION 2: SELECT WORK -->
    <section class="project-group">
      <div class="section-title-wrap">
        <h2 class="section-title">Select Work</h2>
        <div class="section-rule"></div>
      </div>
      <div class="select-grid">
        ${selectWork
      .map(
        proj => `
          <article class="select-card" id="${proj.id}">
            <header class="select-card-header">
              <div class="select-card-title-row">
                <h3 class="select-card-title">${proj.title}</h3>
                ${renderProjectLinks(proj)}
              </div>
              ${proj.subtitle ? `<div class="select-card-sub">${proj.subtitle}</div>` : ''}
            </header>
            <p class="project-text">${proj.description}</p>
            ${proj.media && proj.media.length
            ? `
              <div class="select-media-row">
                ${proj.media
              .map(m =>
                m.type === 'image'
                  ? `
                    <button class="media-trigger media-thumb-box" data-type="image" data-src="${m.src}" data-alt="${m.alt || proj.title}">
                      <img src="${m.src}" alt="${m.alt || proj.title}" loading="lazy" decoding="async" />
                      <span class="media-zoom-hint">zoom</span>
                    </button>
                  `
                  : `
                    <button class="media-trigger media-video-card" data-type="video" data-src="${m.src}" title="Play ${m.label || 'video'}">
                      ${m.poster ? `<img src="${m.poster}" alt="${m.label || proj.title}" loading="lazy" decoding="async" class="video-card-poster" />` : ''}
                      <div class="video-card-overlay ${m.poster ? 'has-poster' : 'no-poster'}">
                        <span class="video-play-btn">▶</span>
                        <span class="video-card-title">${m.label || 'Play video'}</span>
                      </div>
                    </button>
                  `
              )
              .join('')}
              </div>
            `
            : ''
          }
          </article>
        `
      )
      .join('')}
      </div>
    </section>

    <!-- SECTION 3: OTHERS -->
    <section class="project-group">
      <div class="section-title-wrap">
        <h2 class="section-title">Others</h2>
        <div class="section-rule"></div>
      </div>
      <div class="others-list">
        ${otherProjects
      .map(
        proj => `
          <div class="other-item">
            <div class="other-main">
              <div class="other-header-line">
                <h4 class="other-title">${proj.title}</h4>
                ${renderProjectLinks(proj)}
              </div>
              <p class="other-desc">${proj.description}</p>
            </div>
            ${proj.media && proj.media.length
            ? `
              <div class="other-media-strip">
                ${proj.media
              .map(m =>
                m.type === 'image'
                  ? `
                    <button class="media-trigger other-thumb" data-type="image" data-src="${m.src}" data-alt="${m.alt || proj.title}" title="${m.alt || 'View photo'}">
                      <img src="${m.src}" alt="${m.alt || proj.title}" loading="lazy" decoding="async" />
                    </button>
                  `
                  : `
                    <button class="media-trigger other-thumb other-thumb-video" data-type="video" data-src="${m.src}" title="Play video">
                      <span class="video-play-icon">▶</span>
                      <span class="video-play-label">${m.label || 'video'}</span>
                    </button>
                  `
              )
              .join('')}
              </div>
            `
            : ''
          }
          </div>
        `
      )
      .join('')}
      </div>
    </section>
  </main>

  <footer class="projects-footer">
    <p>Jeremy Wang</p>
  </footer>
</div>

<!-- LIGHTBOX MODAL -->
<div id="projects-lightbox" class="lightbox-backdrop" aria-hidden="true">
  <div class="lightbox-dialog">
    <button class="lightbox-close" id="lightbox-close-btn" aria-label="Close">✕</button>
    <div class="lightbox-content" id="lightbox-mount"></div>
  </div>
</div>
  `

  initLightbox()
}

function initLightbox() {
  const lightbox = document.getElementById('projects-lightbox')
  const mount = document.getElementById('lightbox-mount')
  const closeBtn = document.getElementById('lightbox-close-btn')
  if (!lightbox || !mount) return

  const closeLightbox = () => {
    lightbox.classList.remove('active')
    lightbox.setAttribute('aria-hidden', 'true')
    mount.innerHTML = ''
    document.body.style.overflow = ''
  }

  const openLightbox = (type, src, alt = '') => {
    mount.innerHTML = ''
    if (type === 'image') {
      const img = document.createElement('img')
      img.src = src
      img.alt = alt
      img.className = 'lightbox-media-img'
      mount.appendChild(img)
    } else if (type === 'video') {
      const vid = document.createElement('video')
      vid.src = src
      vid.controls = true
      vid.autoplay = true
      vid.playsInline = true
      vid.className = 'lightbox-media-vid'
      mount.appendChild(vid)
    }
    lightbox.classList.add('active')
    lightbox.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  document.querySelectorAll('.media-trigger').forEach(trigger => {
    trigger.addEventListener('click', e => {
      e.stopPropagation()
      const type = trigger.getAttribute('data-type')
      const src = trigger.getAttribute('data-src')
      const alt = trigger.getAttribute('data-alt') || ''
      if (src) openLightbox(type, src, alt)
    })
  })

  closeBtn?.addEventListener('click', closeLightbox)

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) {
      closeLightbox()
    }
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox()
    }
  })
}
