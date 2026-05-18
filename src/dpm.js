const degToRad = degrees => degrees * Math.PI / 180
const radToDeg = radians => radians * 180 / Math.PI

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const sanitizeInputValue = (input, min, max) => {
  const value = Number(input.value)
  const clamped = clamp(Number.isNaN(value) ? 0 : value, min, max)
  input.value = String(clamped)
  return clamped
}

const createState = () => ({
  t1: degToRad(120),
  t2: degToRad(-10),
  w1: 0,
  w2: 0,
  time: 0,
})

const getDerivatives = ({ t1, t2, w1, w2 }) => {
  const g = 9.81
  const m1 = 1
  const m2 = 1
  const l1 = 1
  const l2 = 1

  const delta = t1 - t2
  const denom1 = (2 * m1 + m2 - m2 * Math.cos(2 * delta))
  const denom2 = (2 * m1 + m2 - m2 * Math.cos(2 * delta))

  const a1 = (
    -g * (2 * m1 + m2) * Math.sin(t1)
    - m2 * g * Math.sin(t1 - 2 * t2)
    - 2 * Math.sin(delta) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(delta))
  ) / (l1 * denom1)

  const a2 = (
    2 * Math.sin(delta) * (
      w1 * w1 * l1 * (m1 + m2)
      + g * (m1 + m2) * Math.cos(t1)
      + w2 * w2 * l2 * m2 * Math.cos(delta)
    )
  ) / (l2 * denom2)

  return { dt1: w1, dt2: w2, dw1: a1, dw2: a2 }
}

const rk4Step = (state, dt) => {
  const k1 = getDerivatives(state)
  const s2 = {
    t1: state.t1 + k1.dt1 * dt * 0.5,
    t2: state.t2 + k1.dt2 * dt * 0.5,
    w1: state.w1 + k1.dw1 * dt * 0.5,
    w2: state.w2 + k1.dw2 * dt * 0.5,
  }
  const k2 = getDerivatives(s2)
  const s3 = {
    t1: state.t1 + k2.dt1 * dt * 0.5,
    t2: state.t2 + k2.dt2 * dt * 0.5,
    w1: state.w1 + k2.dw1 * dt * 0.5,
    w2: state.w2 + k2.dw2 * dt * 0.5,
  }
  const k3 = getDerivatives(s3)
  const s4 = {
    t1: state.t1 + k3.dt1 * dt,
    t2: state.t2 + k3.dt2 * dt,
    w1: state.w1 + k3.dw1 * dt,
    w2: state.w2 + k3.dw2 * dt,
  }
  const k4 = getDerivatives(s4)

  return {
    t1: state.t1 + (dt / 6) * (k1.dt1 + 2 * k2.dt1 + 2 * k3.dt1 + k4.dt1),
    t2: state.t2 + (dt / 6) * (k1.dt2 + 2 * k2.dt2 + 2 * k3.dt2 + k4.dt2),
    w1: state.w1 + (dt / 6) * (k1.dw1 + 2 * k2.dw1 + 2 * k3.dw1 + k4.dw1),
    w2: state.w2 + (dt / 6) * (k1.dw2 + 2 * k2.dw2 + 2 * k3.dw2 + k4.dw2),
  }
}

const formatAngle = value => value.toFixed(1)
const formatVelocity = value => value.toFixed(2)
const formatTime = value => value.toFixed(2)

const renderDoublePendulumPage = root => {
  const state = createState()
  const trail = []
  let running = false
  let lastFrameTime = null
  const canvas = document.createElement('canvas')
  canvas.id = 'dpm-canvas'
  canvas.width = 900
  canvas.height = 600
  const ctx = canvas.getContext('2d')

  root.innerHTML = `
    <section id="dpm-page">
      <div id="dpm-header">
        <h1>Double Pendulum Simulation</h1>
      </div>
      <div id="dpm-controls">
        <div>
          <label for="theta1">θ₁ (degrees)</label>
          <input id="theta1" type="number" step="1" min="-180" max="180" value="120" />
        </div>
        <div>
          <label for="theta2">θ₂ (degrees)</label>
          <input id="theta2" type="number" step="1" min="-180" max="180" value="-10" />
        </div>
        <div>
          <label for="omega1">ω₁ (deg/s)</label>
          <input id="omega1" type="number" step="0.5" min="-360" max="360" value="0" />
        </div>
        <div>
          <label for="omega2">ω₂ (deg/s)</label>
          <input id="omega2" type="number" step="0.5" min="-360" max="360" value="0" />
        </div>
        <div>
          <button id="start-button" type="button">Start</button>
          <button id="reset-button" type="button">Reset</button>
        </div>
      </div>
      <div id="dpm-metrics">
        <span>Time: <strong id="time-value">0.00</strong> s</span>
        <span>θ₁: <strong id="angle1-value">120.0</strong>°</span>
        <span>θ₂: <strong id="angle2-value">-10.0</strong>°</span>
      </div>
      <div id="dpm-canvas-wrap"></div>
    </section>
  `

  const controls = {
    theta1: root.querySelector('#theta1'),
    theta2: root.querySelector('#theta2'),
    omega1: root.querySelector('#omega1'),
    omega2: root.querySelector('#omega2'),
    startButton: root.querySelector('#start-button'),
    resetButton: root.querySelector('#reset-button'),
    timeValue: root.querySelector('#time-value'),
    angle1Value: root.querySelector('#angle1-value'),
    angle2Value: root.querySelector('#angle2-value'),
    canvasWrap: root.querySelector('#dpm-canvas-wrap'),
  }

  controls.canvasWrap.appendChild(canvas)

  const updateFieldValues = () => {
    controls.timeValue.textContent = formatTime(state.time)
    controls.angle1Value.textContent = formatAngle(radToDeg(state.t1))
    controls.angle2Value.textContent = formatAngle(radToDeg(state.t2))
  }

  const applyInputs = ({ resetTime = false } = {}) => {
    state.t1 = degToRad(sanitizeInputValue(controls.theta1, -180, 180))
    state.t2 = degToRad(sanitizeInputValue(controls.theta2, -180, 180))
    state.w1 = degToRad(sanitizeInputValue(controls.omega1, -360, 360))
    state.w2 = degToRad(sanitizeInputValue(controls.omega2, -360, 360))

    if (resetTime) {
      state.time = 0
      trail.length = 0
    }

    if (running && !resetTime) {
      lastFrameTime = performance.now()
    }

    updateFieldValues()
    drawFrame()
  }

  const resetSimulation = () => {
    applyInputs({ resetTime: true })
    running = false
    controls.startButton.textContent = 'Start'
    lastFrameTime = null
  }

  const toggleSimulation = () => {
    running = !running
    controls.startButton.textContent = running ? 'Pause' : 'Start'
    if (running && lastFrameTime === null) {
      lastFrameTime = performance.now()
    }
    if (running) {
      requestAnimationFrame(animate)
    }
  }

  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    drawFrame()
  }

  const drawFrame = () => {
    const width = canvas.clientWidth || 900
    const height = canvas.clientHeight || 600
    const centerX = width / 2
    const centerY = 300
    const scale = 140
    const l1 = 1
    const l2 = 1

    const x1 = centerX + scale * l1 * Math.sin(state.t1)
    const y1 = centerY + scale * l1 * Math.cos(state.t1)
    const x2 = x1 + scale * l2 * Math.sin(state.t2)
    const y2 = y1 + scale * l2 * Math.cos(state.t2)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#f8f2e8'
    ctx.fillRect(0, 0, width, height)

    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(15, 139, 141, 0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(trail[0].x, trail[0].y)
      for (let i = 1; i < trail.length; i += 1) {
        ctx.lineTo(trail[i].x, trail[i].y)
      }
      ctx.stroke()
    }

    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    ctx.fillStyle = '#0f8b8d'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#241e2b'
    ctx.beginPath()
    ctx.arc(x1, y1, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x2, y2, 8, 0, Math.PI * 2)
    ctx.fill()
  }

  const animate = now => {
    if (!running) {
      return
    }
    if (lastFrameTime === null) {
      lastFrameTime = now
    }

    const delta = Math.min((now - lastFrameTime) / 1000, 0.033)
    lastFrameTime = now

    const stepCount = Math.max(1, Math.round(delta / 0.005))
    for (let i = 0; i < stepCount; i += 1) {
      const dt = delta / stepCount
      const next = rk4Step(state, dt)
      state.t1 = next.t1
      state.t2 = next.t2
      state.w1 = next.w1
      state.w2 = next.w2
      state.time += dt
    }

    const width = canvas.clientWidth || 900
    const height = canvas.clientHeight || 600
    const centerX = width / 2
    const centerY = 300
    const scale = 140
    const x1 = centerX + scale * Math.sin(state.t1)
    const y1 = centerY + scale * Math.cos(state.t1)
    const x2 = x1 + scale * Math.sin(state.t2)
    const y2 = y1 + scale * Math.cos(state.t2)

    trail.push({ x: x2, y: y2 })
    if (trail.length > 720) {
      trail.shift()
    }

    updateFieldValues()
    drawFrame()
    requestAnimationFrame(animate)
  }

  controls.startButton.addEventListener('click', toggleSimulation)
  controls.resetButton.addEventListener('click', resetSimulation)

  const liveUpdateHandler = () => {
    applyInputs({ resetTime: false })
  }

  controls.theta1.addEventListener('input', liveUpdateHandler)
  controls.theta2.addEventListener('input', liveUpdateHandler)
  controls.omega1.addEventListener('input', liveUpdateHandler)
  controls.omega2.addEventListener('input', liveUpdateHandler)

  window.addEventListener('resize', resizeCanvas)
  resizeCanvas()
  updateFieldValues()
  drawFrame()
}

export { renderDoublePendulumPage }
