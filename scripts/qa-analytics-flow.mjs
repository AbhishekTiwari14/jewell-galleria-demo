import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const debugPort = process.env.OVIA_CDP_PORT ?? '9444'
const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4175'
const outputDirectory = process.env.OVIA_QA_OUTPUT ?? join(process.cwd(), 'qa-analytics')
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function getTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())
      const target = targets.find((item) => item.type === 'page')
      if (target) return target
    } catch {
      // Browser may still be starting.
    }
    await sleep(200)
  }
  throw new Error('Could not connect to browser')
}

await mkdir(outputDirectory, { recursive: true })
const target = await getTarget()
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(80)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function navigate(path) {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await sleep(400)
}

async function viewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 500 })
}

async function capture(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(result.data, 'base64'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

await send('Page.enable')
await send('Runtime.enable')
await viewport(390, 844)
await navigate('/business/analytics')
await evaluate(`localStorage.removeItem('ovia-demo:v1'); location.reload()`)
await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="analytics-content"]')`, 'fresh analytics')
await sleep(300)

const initial = await evaluate(`({
  daily: document.querySelector('[data-testid="analytics-tab-daily"]').getAttribute('aria-selected'),
  weekly: document.querySelector('[data-testid="analytics-tab-weekly"]').getAttribute('aria-selected'),
  period: document.querySelector('[data-testid="analytics-content"]').dataset.period,
  disclosure: document.body.innerText.includes('All events, metrics, trends, and insights below are simulated'),
  businessDisclosure: document.body.innerText.toLowerCase().includes('demo mode') && document.body.innerText.toLowerCase().includes('simulated business data'),
  required: ['Revenue', 'Sessions / visitors', 'Product views', 'Add to cart', 'Checkout', 'Orders', 'Conversion rate'].every((label) => document.body.innerText.includes(label)),
  width: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
})`)
assert(initial.daily === 'true' && initial.weekly === 'false' && initial.period === 'daily', 'Daily is not the fresh initial period')
assert(initial.disclosure && initial.businessDisclosure, 'Analytics is missing clear demo-data disclosure')
assert(initial.required, 'A required analytics metric is missing')
assert(initial.width === initial.scrollWidth, 'Initial mobile analytics has horizontal overflow')
await capture('mobile-daily')

await evaluate(`window.__oviaAnalyticsSwitchStarted = performance.now(); document.querySelector('[data-testid="analytics-tab-weekly"]').click()`)
await waitFor(`document.querySelector('[data-testid="analytics-loading"]')`, 'weekly loading skeleton')
const selectedDuringLoad = await evaluate(`({
  weekly: document.querySelector('[data-testid="analytics-tab-weekly"]').getAttribute('aria-selected'),
  daily: document.querySelector('[data-testid="analytics-tab-daily"]').getAttribute('aria-selected'),
  hasContent: Boolean(document.querySelector('[data-testid="analytics-content"]')),
})`)
assert(selectedDuringLoad.weekly === 'true' && selectedDuringLoad.daily === 'false', 'Weekly did not become visibly selected immediately')
assert(!selectedDuringLoad.hasContent, 'Previous analytics content remains visible over skeleton')
await sleep(300)
assert(await evaluate(`Boolean(document.querySelector('[data-testid="analytics-loading"]'))`), 'Skeleton ended before 400ms target window')
await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'weekly'`, 'weekly content')
const loadDuration = await evaluate(`performance.now() - window.__oviaAnalyticsSwitchStarted`)
assert(loadDuration >= 400 && loadDuration <= 700, `Loading duration outside expected range: ${loadDuration}ms`)
await sleep(1250)

const weekly = await evaluate(`(() => {
  const ticks = [...document.querySelectorAll('[data-testid="revenue-chart"] .recharts-cartesian-axis-tick-value')]
    .map((node) => node.getBoundingClientRect())
  const overlaps = ticks.some((tick, index) => index > 0 && tick.left < ticks[index - 1].right)
  const area = document.querySelector('.recharts-area-curve')
  const insight = document.querySelector('[data-testid="analytics-insights"]')
  return {
    period: document.querySelector('[data-testid="analytics-content"]').dataset.period,
    revenue: document.querySelector('[data-testid="analytics-revenue"]').textContent.trim(),
    chart: Boolean(document.querySelector('[data-testid="revenue-chart"] svg')),
    chartPathLength: area?.getTotalLength?.() ?? 0,
    tickCount: ticks.length,
    tickRects: ticks.map((tick) => ({ left: tick.left, right: tick.right, width: tick.width })),
    overlaps,
    funnelRows: document.querySelectorAll('[data-testid="analytics-funnel"] > div').length,
    insightOpacity: Number.parseFloat(getComputedStyle(insight).opacity),
    products: ['Brown Off Shoulder Dress', 'Lace trimmed top'].every((name) => document.body.innerText.includes(name)),
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }
})()`)
assert(weekly.period === 'weekly', 'Weekly content did not render')
assert(weekly.revenue.includes('18,642'), `Weekly revenue did not animate to its expected value: ${weekly.revenue}`)
assert(weekly.chart && weekly.chartPathLength > 0, 'Responsive revenue chart did not draw')
assert(weekly.tickCount >= 4 && !weekly.overlaps, `Weekly chart labels overlap on mobile: ${JSON.stringify(weekly.tickRects)}`)
assert(weekly.funnelRows === 5, 'Funnel does not contain all five stages')
assert(weekly.insightOpacity > 0.95 && weekly.products, `Catalogue-backed insights did not enter: opacity=${weekly.insightOpacity}, products=${weekly.products}`)
assert(weekly.width === weekly.scrollWidth, 'Weekly mobile analytics has horizontal overflow')
await capture('mobile-weekly')
await evaluate(`document.querySelector('[data-testid="revenue-chart"]').scrollIntoView({ block: 'center' })`)
await sleep(250)
await capture('mobile-weekly-chart')
await evaluate(`document.querySelector('[data-testid="analytics-insights"]').scrollIntoView({ block: 'start' })`)
await sleep(250)
await capture('mobile-weekly-insights')

await evaluate(`document.querySelector('[data-testid="analytics-tab-monthly"]').click()`)
await waitFor(`document.querySelector('[data-testid="analytics-loading"]')`, 'monthly loading')
await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'monthly'`, 'monthly content')
await sleep(900)
const monthly = await evaluate(`({
  selected: document.querySelector('[data-testid="analytics-tab-monthly"]').getAttribute('aria-selected'),
  period: document.querySelector('[data-testid="analytics-content"]').dataset.period,
  labels: [...document.querySelectorAll('[data-testid="revenue-chart"] .recharts-cartesian-axis-tick-value')].map((node) => node.textContent),
  persisted: JSON.parse(localStorage.getItem('ovia-demo:v1')).state.analyticsPeriod,
})`)
assert(monthly.selected === 'true' && monthly.period === 'monthly', 'Monthly did not become selected and render')
assert(monthly.labels.length === 4 && monthly.persisted === 'monthly', 'Monthly chart or persistence is incorrect')

await viewport(1440, 1000)
await navigate('/business/analytics')
await sleep(1000)
const desktop = await evaluate(`({
  width: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  chartWidth: document.querySelector('[data-testid="revenue-chart"] svg').getBoundingClientRect().width,
  persistedPeriod: document.querySelector('[data-testid="analytics-content"]').dataset.period,
})`)
assert(desktop.width === desktop.scrollWidth, 'Desktop analytics has horizontal overflow')
assert(desktop.chartWidth > 600, 'Desktop chart did not respond to available width')
assert(desktop.persistedPeriod === 'monthly', 'Selected analytics period did not persist after navigation')
await capture('desktop-monthly')

console.log(JSON.stringify({
  passed: true,
  initialPeriod: 'daily',
  weekly: { selected: true, loadingMs: loadDuration, animatedRevenue: weekly.revenue, chartDrawn: true, mobileLabelsOverlap: weekly.overlaps, funnelStages: weekly.funnelRows, insightsEntered: true },
  monthly: { selected: true, persisted: true },
  viewports: ['390x844', '1440x1000'],
}, null, 2))
socket.close()
