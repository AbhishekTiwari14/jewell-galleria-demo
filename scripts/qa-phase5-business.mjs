import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase5-business')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9454
const profileDirectory = join(tmpdir(), `jewellgalleria-business-edge-${process.pid}`)
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

await mkdir(outputDirectory, { recursive: true })
await mkdir(profileDirectory, { recursive: true })

const edgeProcess = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  `--remote-debugging-port=${remotePort}`,
  `--user-data-dir=${profileDirectory}`,
  'about:blank',
], { stdio: 'ignore', windowsHide: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitForBrowser() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${remotePort}/json/version`)
      if (response.ok) return
    } catch {
      // Edge is still starting.
    }
    await sleep(100)
  }
  throw new Error('Edge DevTools did not become ready.')
}

async function createClient() {
  const response = await fetch(`http://127.0.0.1:${remotePort}/json/new?about:blank`, { method: 'PUT' })
  const target = await response.json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  let nextId = 0

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })

  const send = (method, params = {}) => {
    const id = ++nextId
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  return { evaluate, send, socket, target }
}

await waitForBrowser()
const client = await createClient()
const { evaluate, send } = client

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 140; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(75)
  }
  throw new Error(`Timed out waiting for ${label}.`)
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
    screenWidth: width,
    screenHeight: height,
  })
  await send('Emulation.setTouchEmulationEnabled', { enabled: width < 768, maxTouchPoints: 5 })
}

async function navigate(path) {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await waitFor(`document.querySelector('main h1')`, `${path} heading`)
  await sleep(path === '/business/analytics' ? 800 : 250)
}

async function capture(name, fullPage = false) {
  const parameters = { captureBeyondViewport: fullPage, format: 'png', fromSurface: true }
  if (fullPage) {
    const metrics = await send('Page.getLayoutMetrics')
    parameters.clip = {
      x: 0,
      y: 0,
      width: Math.ceil(metrics.cssContentSize.width),
      height: Math.ceil(metrics.cssContentSize.height),
      scale: 1,
    }
  }
  const result = await send('Page.captureScreenshot', parameters)
  const path = join(outputDirectory, `${name}.png`)
  await writeFile(path, Buffer.from(result.data, 'base64'))
  return path
}

const routes = [
  { path: '/business', name: 'dashboard' },
  { path: '/business/products', name: 'products' },
  { path: '/business/products/new', name: 'product-editor' },
  { path: '/business/inventory', name: 'inventory' },
  { path: '/business/orders', name: 'orders' },
  { path: '/business/analytics', name: 'analytics' },
]

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })

  await setViewport(390, 844)
  const mobileCaptures = []
  for (const route of routes) {
    await navigate(route.path)
    const audit = await evaluate(`(() => {
      const text = document.body.innerText
      const navLabels = [...document.querySelectorAll('nav[aria-label="Business"] a')].map((link) => link.textContent.trim())
      const navHeights = [...document.querySelectorAll('nav[aria-label="Business"] a')].map((link) => link.getBoundingClientRect().height)
      const back = [...document.querySelectorAll('a')].find((link) => link.textContent.includes('Back to Store'))
      const brokenImages = [...document.images].filter((image) => image.getBoundingClientRect().width > 0 && image.complete && image.naturalWidth === 0).length
      return {
        demoMode: text.includes('DEMO MODE'),
        simulated: text.includes('Simulated business data'),
        navLabels,
        minNavHeight: Math.min(...navHeights),
        backVisible: Boolean(back && back.getBoundingClientRect().width > 0),
        backHeight: back?.getBoundingClientRect().height ?? 0,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        brokenImages,
      }
    })()`)
    assert(audit.demoMode && audit.simulated, `${route.name} is missing the demo disclosure.`)
    assert(JSON.stringify(audit.navLabels) === JSON.stringify(['Dashboard', 'Products', 'Inventory', 'Orders', 'Analytics']), `${route.name} navigation labels are incorrect.`)
    assert(audit.minNavHeight >= 44 && audit.backVisible && audit.backHeight >= 44, `${route.name} has an undersized shared control.`)
    assert(!audit.overflow, `${route.name} overflows the 390px viewport.`)
    assert(audit.brokenImages === 0, `${route.name} contains a broken visible image.`)
    mobileCaptures.push(await capture(`mobile-${route.name}`, route.name === 'dashboard'))
  }

  await navigate('/business')
  const dashboard = await evaluate(`(() => {
    const text = document.body.innerText
    const normalizedText = text.toLocaleLowerCase()
    const required = ['Revenue', 'Orders', 'Average order value', 'Active products', 'Low stock', 'Recent orders', 'Top products', 'Low stock alerts']
    const cards = [...document.querySelectorAll('section[aria-label="Business metrics"] article')]
    return {
      required: required.every((label) => normalizedText.includes(label.toLocaleLowerCase())),
      metricCount: cards.length,
      distinctValues: cards.every((card) => card.innerText.trim().length > 0),
      allFiguresNote: text.includes('All figures are demo data.'),
    }
  })()`)
  assert(dashboard.required && dashboard.metricCount === 5 && dashboard.distinctValues && dashboard.allFiguresNote, 'Dashboard content is incomplete or not clearly simulated.')

  await navigate('/business/products')
  const productsMobile = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('[data-testid^="business-product-"]')]
    const widths = cards.slice(0, 4).map((card) => card.getBoundingClientRect().width)
    return { count: cards.length, minWidth: Math.min(...widths), maxWidth: Math.max(...widths) }
  })()`)
  assert(productsMobile.count > 0 && productsMobile.minWidth > 160 && productsMobile.maxWidth < 390, 'Product cards are not mobile-readable.')

  await navigate('/business/orders')
  const ordersMobile = await evaluate(`(() => {
    const firstOrder = document.querySelector('[data-testid^="open-order-"]')
    const mobileBadge = firstOrder?.children[0]?.lastElementChild
    const desktopBadge = firstOrder?.children[2]
    return {
      cardWidth: firstOrder?.getBoundingClientRect().width ?? 0,
      mobileVisible: mobileBadge && getComputedStyle(mobileBadge).display !== 'none',
      desktopHidden: desktopBadge && getComputedStyle(desktopBadge).display === 'none',
    }
  })()`)
  assert(ordersMobile.cardWidth <= 390 && ordersMobile.mobileVisible && ordersMobile.desktopHidden, 'Orders did not switch to the mobile card presentation.')

  await setViewport(1440, 1000)
  await navigate('/business')
  await sleep(700)
  const dashboardDesktop = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('section[aria-label="Business metrics"] article')]
    const tops = cards.map((card) => Math.round(card.getBoundingClientRect().top))
    return {
      oneRow: new Set(tops).size === 1,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cardWidths: cards.map((card) => Math.round(card.getBoundingClientRect().width)),
    }
  })()`)
  assert(dashboardDesktop.oneRow && !dashboardDesktop.overflow, `Desktop dashboard metric layout is incorrect: ${JSON.stringify(dashboardDesktop)}`)
  const desktopDashboardCapture = await capture('desktop-dashboard', true)

  await navigate('/business/analytics')
  await waitFor(`document.querySelector('[data-testid="analytics-content"]')`, 'analytics content')
  const analyticsDesktop = await evaluate(`(() => {
    const chart = document.querySelector('[data-testid="revenue-chart"]').getBoundingClientRect()
    return {
      chartVisible: chart.width > 500 && chart.height >= 250,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      disclosure: document.body.innerText.includes('Simulated business data'),
    }
  })()`)
  assert(analyticsDesktop.chartVisible && !analyticsDesktop.overflow && analyticsDesktop.disclosure, 'Desktop analytics layout is incorrect.')
  await sleep(1800)
  const desktopAnalyticsCapture = await capture('desktop-analytics', true)

  console.log(JSON.stringify({
    passed: true,
    routesAudited: routes.map((route) => route.path),
    mobileViewport: '390x844',
    desktopViewport: '1440x1000',
    dashboardMetrics: 5,
    demoDisclosureEverywhere: true,
    horizontalOverflow: false,
    brokenImages: 0,
    captures: [...mobileCaptures, desktopDashboardCapture, desktopAnalyticsCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
