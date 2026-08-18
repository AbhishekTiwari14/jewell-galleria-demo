import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase10-discovery')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9459
const profileDirectory = join(tmpdir(), `jewellgalleria-discovery-edge-${process.pid}`)
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  return { evaluate, send, socket, target }
}

await waitForBrowser()
const client = await createClient()
const { evaluate, send } = client

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
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
  await waitFor(`document.querySelector('main')`, `${path} content`)
  await sleep(250)
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

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })

  await setViewport(390, 844)
  await navigate('/')
  await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1'); sessionStorage.clear(); location.reload()`)
  await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="business-reveal-section"]')`, 'fresh storefront')
  await sleep(300)

  const mobileHeader = await evaluate(`(() => {
    const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0
    const header = document.querySelector('header')
    return {
      menu: visible(document.querySelector('[data-testid="mobile-menu-trigger"]')),
      search: visible(document.querySelector('[data-testid="mobile-search-trigger"]')),
      bag: visible(document.querySelector('[data-testid="header-bag-button"]')),
      desktopBusinessHidden: !visible(document.querySelector('[data-testid="desktop-business-preview"]')),
      height: header.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(mobileHeader.menu && mobileHeader.search && mobileHeader.bag && mobileHeader.desktopBusinessHidden, 'The mobile header is cluttered or its core controls are missing.')
  assert(mobileHeader.height <= 72 && !mobileHeader.overflow, 'The mobile header is too tall or overflows.')

  await evaluate(`document.querySelector('[data-testid="mobile-menu-trigger"]').click()`)
  await waitFor(`document.querySelector('[data-testid="mobile-drawer-business-preview"]')`, 'mobile Business Preview entry')
  const drawer = await evaluate(`(() => {
    const link = document.querySelector('[data-testid="mobile-drawer-business-preview"]')
    const rect = link.getBoundingClientRect()
    const style = getComputedStyle(link)
    return {
      target: link.getAttribute('href'),
      text: link.innerText,
      height: rect.height,
      visible: rect.top < innerHeight && rect.bottom > 0,
      background: style.backgroundColor,
      contrast: style.color,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(drawer.target === '/business' && drawer.visible && drawer.height >= 120, 'Business Preview is not prominent inside the mobile menu.')
  assert(['Business Preview', 'Products', 'inventory', 'orders', 'analytics'].every((label) => drawer.text.toLowerCase().includes(label.toLowerCase())), 'The mobile Business Preview explanation is incomplete.')
  assert(drawer.background !== 'rgba(0, 0, 0, 0)' && drawer.contrast === 'rgb(255, 255, 255)' && !drawer.overflow, 'The mobile Business Preview entry is not visibly highlighted or overflows.')
  const mobileMenuCapture = await capture('mobile-menu-business-preview')

  await evaluate(`document.querySelector('[data-testid="mobile-drawer-business-preview"]').click()`)
  await waitFor(`location.pathname === '/business' && document.body.innerText.includes('Good morning, Jewellgalleria') && document.body.innerText.includes('Simulated business data')`, 'Business Dashboard from mobile menu')
  assert(await evaluate(`document.body.innerText.includes('Simulated business data')`), 'The mobile Business Preview entry did not reach the clearly labelled dashboard.')

  await navigate('/')
  await evaluate(`document.querySelector('[data-testid="business-reveal-section"]').scrollIntoView({ block: 'start', behavior: 'instant' })`)
  await sleep(250)
  const reveal = await evaluate(`(() => {
    const section = document.querySelector('[data-testid="business-reveal-section"]')
    const preview = document.querySelector('[data-testid="business-reveal-preview"]')
    const cta = document.querySelector('[data-testid="business-reveal-cta"]')
    const earrings = document.querySelector('#earrings')
    const text = section.innerText
    const previewRect = preview.getBoundingClientRect()
    return {
      text,
      midPage: Boolean(section.compareDocumentPosition(earrings) & Node.DOCUMENT_POSITION_FOLLOWING),
      previewWidth: previewRect.width,
      ctaHeight: cta.getBoundingClientRect().height,
      ctaTarget: cta.getAttribute('href'),
      realInterface: Boolean(document.querySelector('[data-testid="reveal-preview-orders"]')) && Boolean(document.querySelector('[data-testid="reveal-preview-stock"]')),
      productNames: text.includes('Pear Drop Statement Necklace'),
      popup: Boolean(document.querySelector('[data-testid="business-discovery-pill"]')),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(reveal.text.includes('The storefront is only half the story.') && ['Products', 'Inventory', 'Orders', 'Analytics'].every((label) => reveal.text.includes(label)), 'The homepage reveal copy is incomplete.')
  assert(reveal.midPage && reveal.realInterface && reveal.productNames, 'The reveal is not mid-page or does not preview the real business interface state.')
  assert(reveal.ctaTarget === '/business' && reveal.ctaHeight >= 44 && reveal.previewWidth <= 358, 'The mobile reveal CTA or preview sizing is incorrect.')
  assert(!reveal.popup && !reveal.overflow, 'Discovery added an intrusive popup or horizontal overflow.')
  const mobileRevealCapture = await capture('mobile-homepage-reveal', true)

  await evaluate(`document.querySelector('[data-testid="business-reveal-cta"]').click()`)
  await waitFor(`location.pathname === '/business' && document.body.innerText.includes('Good morning, Jewellgalleria')`, 'Business Dashboard from homepage reveal')

  await setViewport(1024, 900)
  await navigate('/')
  const tabletDesktopHeader = await evaluate(`(() => {
    const link = document.querySelector('[data-testid="desktop-business-preview"]')
    const rect = link.getBoundingClientRect()
    return { visible: rect.width > 0 && rect.height > 0, withinViewport: rect.right <= innerWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }
  })()`)
  assert(tabletDesktopHeader.visible && tabletDesktopHeader.withinViewport && !tabletDesktopHeader.overflow, 'The desktop Business Preview control does not fit at the lg breakpoint.')

  await setViewport(1440, 1000)
  await navigate('/')
  const desktopHeader = await evaluate(`(() => {
    const link = document.querySelector('[data-testid="desktop-business-preview"]')
    const style = getComputedStyle(link)
    const rect = link.getBoundingClientRect()
    return {
      visible: rect.width > 0 && rect.height >= 44,
      target: link.getAttribute('href'),
      text: link.innerText,
      background: style.backgroundColor,
      color: style.color,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(desktopHeader.visible && desktopHeader.target === '/business' && desktopHeader.text.includes('Business Preview'), 'The desktop header Business Preview entry is missing.')
  assert(desktopHeader.background !== 'rgba(0, 0, 0, 0)' && desktopHeader.color === 'rgb(255, 255, 255)' && !desktopHeader.overflow, 'The desktop Business Preview entry is not distinct or causes overflow.')

  await evaluate(`document.querySelector('[data-testid="business-reveal-section"]').scrollIntoView({ block: 'center', behavior: 'instant' })`)
  await sleep(250)
  const desktopReveal = await evaluate(`(() => {
    const sectionNode = document.querySelector('[data-testid="business-reveal-section"]')
    const section = sectionNode.getBoundingClientRect()
    const copy = sectionNode.firstElementChild.firstElementChild.getBoundingClientRect()
    const preview = document.querySelector('[data-testid="business-reveal-preview"]').getBoundingClientRect()
    return {
      sectionVisible: section.top < innerHeight && section.bottom > 0,
      previewWidth: preview.width,
      sideBySide: preview.left >= copy.right,
      text: sectionNode.innerText,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(desktopReveal.sectionVisible && desktopReveal.previewWidth > 650 && desktopReveal.sideBySide && desktopReveal.text.includes('Heritage Jhumka Earrings') && !desktopReveal.overflow, `The desktop homepage reveal is not using its intended premium layout: ${JSON.stringify(desktopReveal)}`)
  const desktopRevealCapture = await capture('desktop-homepage-reveal')

  await evaluate(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })`)
  await sleep(300)
  assert(!(await evaluate(`Boolean(document.querySelector('[data-testid="business-discovery-pill"]'))`)), 'An unwanted floating discovery popup appeared after scrolling.')

  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('[data-testid="desktop-business-preview"]').click()`)
  await waitFor(`location.pathname === '/business' && document.body.innerText.includes('Good morning, Jewellgalleria')`, 'Business Dashboard from desktop header')

  console.log(JSON.stringify({
    passed: true,
    entryPoints: ['desktop header', 'mobile menu', 'homepage reveal'],
    navigationTarget: '/business',
    homepageReveal: { midPage: true, liveDashboardPreview: true, capabilities: ['Products', 'Inventory', 'Orders', 'Analytics'] },
    noFloatingPopup: true,
    viewports: ['390x844', '1024x900', '1440x1000'],
    captures: [mobileMenuCapture, mobileRevealCapture, desktopRevealCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
