import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4178'
const debugPort = process.env.OVIA_CDP_PORT ?? '9567'
const outputDirectory = join(process.cwd(), 'qa-business-discovery')
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
]
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

await mkdir(outputDirectory, { recursive: true })
const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())
const target = targets.find((item) => item.type === 'page')
if (!target) throw new Error('Browser page not found')
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
function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}
async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(60)
  }
  throw new Error(`Timed out waiting for ${label}`)
}
function assert(value, message) {
  if (!value) throw new Error(message)
}
async function navigate(path = '/') {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await sleep(300)
}
async function resetSession() {
  await navigate('/')
  await evaluate(`sessionStorage.removeItem('ovia-business-discovery-seen'); location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 'session reset')
  await sleep(250)
}
async function setViewport(viewport) {
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width <= 500 })
}
async function capture(name) {
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
}

await send('Page.enable')
await send('Runtime.enable')

const responsive = []
for (const viewport of viewports) {
  await setViewport(viewport)
  await resetSession()
  const headerAudit = await evaluate(`(() => {
    const mobile = document.querySelector('[data-testid="mobile-business-preview"]')
    const desktop = document.querySelector('[data-testid="desktop-business-preview"]')
    const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0
    const header = document.querySelector('header').getBoundingClientRect()
    return {
      correctControl: innerWidth < 768 ? visible(mobile) && !visible(desktop) : visible(desktop) && !visible(mobile),
      headerBottom: header.bottom,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })()`)
  assert(headerAudit.correctControl, `${viewport.width}px business header control visibility is wrong`)
  assert(headerAudit.scrollWidth === headerAudit.clientWidth, `${viewport.width}px header/home overflow`)

  await evaluate(`document.querySelector('[data-testid="business-reveal-section"]').scrollIntoView({ block: 'center', behavior: 'instant' })`)
  await sleep(300)
  const revealAudit = await evaluate(`(() => {
    const section = document.querySelector('[data-testid="business-reveal-section"]')
    const cta = document.querySelector('[data-testid="business-reveal-cta"]')
    const rect = section.getBoundingClientRect()
    const ctaRect = cta.getBoundingClientRect()
    const text = section.textContent
    return {
      headline: text.includes('The storefront is only half the story.'),
      simulated: text.includes('Simulated business data'),
      preview: text.includes('Recent orders') && text.includes('Stock watch'),
      ctaSize: ctaRect.height,
      visible: rect.top < innerHeight && rect.bottom > 0,
      overflow: document.documentElement.scrollWidth === document.documentElement.clientWidth,
    }
  })()`)
  assert(revealAudit.headline && revealAudit.simulated && revealAudit.preview && revealAudit.visible, `${viewport.width}px reveal content failure: ${JSON.stringify(revealAudit)}`)
  assert(revealAudit.ctaSize >= 44 && revealAudit.overflow, `${viewport.width}px reveal usability/overflow failure`)
  await capture(`${viewport.width}-business-reveal`)

  await resetSession()
  await evaluate(`window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * 0.38, behavior: 'instant' })`)
  await waitFor(`document.querySelector('[data-testid="business-discovery-pill"]')`, `${viewport.width}px discovery pill`)
  const pillAudit = await evaluate(`(() => {
    const pill=document.querySelector('[data-testid="business-discovery-pill"]')
    const rect=pill.getBoundingClientRect()
    const header=document.querySelector('header').getBoundingClientRect()
    const bag=document.querySelector('[data-testid="header-bag-button"]').getBoundingClientRect()
    return {
      withinViewport: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      avoidsHeader: rect.top >= header.bottom,
      avoidsBag: rect.bottom < bag.top || rect.top > bag.bottom || rect.right < bag.left || rect.left > bag.right,
      height: rect.height,
    }
  })()`)
  assert(pillAudit.withinViewport && pillAudit.avoidsHeader && pillAudit.avoidsBag, `${viewport.width}px discovery pill obstructs UI`)
  await capture(`${viewport.width}-floating-pill`)

  await evaluate(`document.querySelector('[data-testid="dismiss-business-discovery"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="business-discovery-pill"]')`, 'pill dismissal')
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  await evaluate(`window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * 0.45, behavior: 'instant' })`)
  await sleep(350)
  assert(await evaluate(`!document.querySelector('[data-testid="business-discovery-pill"]')`), `${viewport.width}px dismissed pill returned in session`)
  responsive.push({ width: viewport.width, header: true, reveal: true, pill: true })
}

const entries = [
  { testId: 'mobile-business-preview', width: 390, height: 844 },
  { testId: 'desktop-business-preview', width: 1280, height: 900 },
  { testId: 'business-reveal-cta', width: 390, height: 844, scroll: true },
  { testId: 'floating-business-preview', width: 390, height: 844, pill: true },
]
for (const entry of entries) {
  await setViewport({ width: entry.width, height: entry.height })
  await resetSession()
  if (entry.scroll) await evaluate(`document.querySelector('[data-testid="business-reveal-section"]').scrollIntoView({ block: 'center', behavior: 'instant' })`)
  if (entry.pill) {
    await evaluate(`window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * 0.38, behavior: 'instant' })`)
    await waitFor(`document.querySelector('[data-testid="business-discovery-pill"]')`, 'pill entry')
  }
  await evaluate(`document.querySelector('[data-testid="${entry.testId}"]').click()`)
  await waitFor(`location.pathname === '/business'`, `${entry.testId} destination`)
  assert(await evaluate(`/DEMO MODE/i.test(document.body.innerText) && /Simulated business data/i.test(document.body.innerText)`), `${entry.testId} did not reach business dashboard`)
}

console.log(JSON.stringify({ passed: true, responsiveAudits: responsive.length, viewports: responsive.map((item) => item.width), entryPoints: entries.length, dismissSessionPersistence: true }, null, 2))
socket.close()
