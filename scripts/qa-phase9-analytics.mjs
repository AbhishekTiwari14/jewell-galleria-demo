import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase9-analytics')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9458
const profileDirectory = join(tmpdir(), `jewellgalleria-analytics-edge-${process.pid}`)
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
  await setViewport(390, 844)
  await navigate('/business/analytics')
  await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1'); location.reload()`)
  await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="analytics-content"]')`, 'fresh Daily analytics')
  await sleep(850)

  const daily = await evaluate(`(() => {
    const chart = document.querySelector('[data-testid="revenue-chart"]')
    const ticks = [...chart.querySelectorAll('.recharts-cartesian-axis-tick-value')].map((node) => ({
      label: node.textContent,
      ...(() => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right } })(),
    }))
    const values = Object.fromEntries([
      'analytics-visitors',
      'analytics-product-views',
      'analytics-add-to-bag',
      'analytics-checkout',
      'analytics-orders',
      'analytics-revenue',
      'analytics-conversion',
    ].map((id) => [id, document.querySelector('[data-testid="' + id + '"]').textContent.trim()]))
    return {
      selected: document.querySelector('[data-testid="analytics-tab-daily"]').getAttribute('aria-selected'),
      period: document.querySelector('[data-testid="analytics-content"]').dataset.period,
      demoDisclosure: document.body.innerText.includes('All events, metrics, trends, and insights below are simulated') && document.body.innerText.includes('Simulated business data'),
      labels: ['Visitors', 'Product Views', 'Add to Bag', 'Checkout', 'Orders', 'Revenue', 'Conversion Rate'].every((label) => document.body.innerText.includes(label)),
      values,
      mobileChart: chart.dataset.mobileLayout,
      chartHeight: chart.getBoundingClientRect().height,
      ticks,
      tickOverlap: ticks.some((tick, index) => index > 0 && tick.left < ticks[index - 1].right),
      funnel: [...document.querySelectorAll('[data-testid="analytics-funnel"] > div')].map((row) => row.querySelector('span').innerText),
      insights: document.querySelector('[data-testid="analytics-insights"]').innerText,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(daily.selected === 'true' && daily.period === 'daily', 'Daily is not the initial analytics period.')
  assert(daily.demoDisclosure, 'Analytics is missing explicit simulated/demo-data disclosure.')
  assert(daily.labels, 'One or more requested metric labels are missing.')
  assert(daily.values['analytics-visitors'] === '612' && daily.values['analytics-product-views'] === '392', 'Daily visitor or product-view totals are incorrect.')
  assert(daily.values['analytics-add-to-bag'] === '87' && daily.values['analytics-checkout'] === '41' && daily.values['analytics-orders'] === '9', 'Daily funnel metric totals are incorrect.')
  assert(daily.values['analytics-revenue'].includes('2,766') && daily.values['analytics-conversion'] === '1.47%', 'Daily revenue or conversion rate is incorrect.')
  assert(daily.mobileChart === 'adapted' && daily.chartHeight >= 280 && !daily.tickOverlap, 'The 390px chart is not using its readable mobile treatment.')
  assert(JSON.stringify(daily.funnel) === JSON.stringify(['Visitors', 'Product Views', 'Add to Bag', 'Checkout', 'Orders']), 'The funnel stages are incomplete or out of order.')
  assert(daily.insights.includes('Pear Drop Statement Necklace') && daily.insights.includes('Oval and Marquise Bracelet') && daily.insights.includes('Demo drop-off'), 'Daily insights do not use the expected real Jewellgalleria products and demo wording.')
  assert(!daily.overflow, 'Daily analytics has horizontal overflow at 390px.')
  const dailyCapture = await capture('mobile-daily')

  await evaluate(`window.__phase9SwitchStarted = performance.now(); document.querySelector('[data-testid="analytics-tab-weekly"]').click()`)
  await waitFor(`document.querySelector('[data-testid="analytics-loading"]')`, 'Weekly loading skeleton')
  const duringLoad = await evaluate(`({
    weeklySelected: document.querySelector('[data-testid="analytics-tab-weekly"]').getAttribute('aria-selected'),
    hasContent: Boolean(document.querySelector('[data-testid="analytics-content"]')),
    skeletonCards: document.querySelectorAll('[data-testid="analytics-loading"] > div:first-of-type > div').length,
  })`)
  assert(duringLoad.weeklySelected === 'true' && !duringLoad.hasContent, 'Weekly was not selected immediately while its skeleton was visible.')
  assert(duringLoad.skeletonCards === 7, 'The loading state does not preserve the seven-metric layout.')
  await sleep(300)
  assert(await evaluate(`Boolean(document.querySelector('[data-testid="analytics-loading"]'))`), 'The skeleton ended before the requested loading window.')
  const loadingCapture = await capture('mobile-weekly-loading')
  await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'weekly'`, 'Weekly analytics content')
  const loadingDuration = await evaluate(`performance.now() - window.__phase9SwitchStarted`)
  assert(loadingDuration >= 400 && loadingDuration <= 750, `Weekly loading duration was outside the intended range: ${loadingDuration}ms.`)
  await sleep(900)

  const weekly = await evaluate(`(() => {
    const chart = document.querySelector('[data-testid="revenue-chart"]')
    const ticks = [...chart.querySelectorAll('.recharts-cartesian-axis-tick-value')].map((node) => {
      const rect = node.getBoundingClientRect()
      return { label: node.textContent, left: rect.left, right: rect.right }
    })
    const curve = chart.querySelector('.recharts-area-curve')
    return {
      visitors: document.querySelector('[data-testid="analytics-visitors"]').textContent.trim(),
      views: document.querySelector('[data-testid="analytics-product-views"]').textContent.trim(),
      bag: document.querySelector('[data-testid="analytics-add-to-bag"]').textContent.trim(),
      checkout: document.querySelector('[data-testid="analytics-checkout"]').textContent.trim(),
      orders: document.querySelector('[data-testid="analytics-orders"]').textContent.trim(),
      revenue: document.querySelector('[data-testid="analytics-revenue"]').textContent.trim(),
      conversion: document.querySelector('[data-testid="analytics-conversion"]').textContent.trim(),
      chartPathLength: curve?.getTotalLength?.() ?? 0,
      ticks,
      tickOverlap: ticks.some((tick, index) => index > 0 && tick.left < ticks[index - 1].right),
      funnelText: document.querySelector('[data-testid="analytics-funnel"]').innerText,
      insights: document.querySelector('[data-testid="analytics-insights"]').innerText,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(weekly.visitors === '4,238' && weekly.views === '2,870' && weekly.bag === '624', 'Weekly traffic metrics did not update.')
  assert(weekly.checkout === '289' && weekly.orders === '52' && weekly.revenue.includes('18,642') && weekly.conversion === '1.23%', 'Weekly commerce metrics did not update.')
  assert(weekly.chartPathLength > 0 && weekly.ticks.length >= 4 && !weekly.tickOverlap, 'The Weekly chart did not draw cleanly at 390px.')
  assert(weekly.funnelText.includes('4,238') && weekly.funnelText.includes('2,870') && weekly.funnelText.includes('624') && weekly.funnelText.includes('289') && weekly.funnelText.includes('52'), 'The Weekly funnel did not update.')
  assert(weekly.insights.includes('Heritage Jhumka Earrings') && weekly.insights.includes('Oval and Marquise Bracelet') && weekly.insights.includes('illustrative'), 'The Weekly illustrative insights did not update with actual product names.')
  assert(!weekly.overflow, 'Weekly analytics has horizontal overflow at 390px.')
  await evaluate(`document.querySelector('[data-testid="revenue-chart"]').scrollIntoView({ block: 'center' })`)
  await sleep(150)
  const weeklyChartCapture = await capture('mobile-weekly-chart')
  await evaluate(`document.querySelector('[data-testid="analytics-insights"]').scrollIntoView({ block: 'start' })`)
  await sleep(150)
  const weeklyInsightsCapture = await capture('mobile-weekly-insights')

  await evaluate(`document.querySelector('[data-testid="analytics-tab-monthly"]').click()`)
  await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'monthly'`, 'Monthly analytics content')
  await sleep(900)
  const monthly = await evaluate(`({
    selected: document.querySelector('[data-testid="analytics-tab-monthly"]').getAttribute('aria-selected'),
    visitors: document.querySelector('[data-testid="analytics-visitors"]').textContent.trim(),
    orders: document.querySelector('[data-testid="analytics-orders"]').textContent.trim(),
    insight: document.querySelector('[data-testid="analytics-insights"]').innerText,
    persisted: JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.analyticsPeriod,
  })`)
  assert(monthly.selected === 'true' && monthly.visitors === '18,420' && monthly.orders === '213', 'Monthly metrics did not update.')
  assert(monthly.insight.includes('Pear Drop Statement Necklace') && monthly.persisted === 'monthly', 'Monthly insight or period persistence is incorrect.')

  await setViewport(1440, 1000)
  await navigate('/business/analytics')
  await sleep(900)
  const desktop = await evaluate(`(() => {
    const metricCards = [...document.querySelectorAll('[data-testid^="analytics-"]')]
      .filter((node) => ['analytics-visitors', 'analytics-product-views', 'analytics-add-to-bag', 'analytics-checkout', 'analytics-orders', 'analytics-revenue', 'analytics-conversion'].includes(node.dataset.testid))
      .map((node) => node.closest('article').getBoundingClientRect())
    const chartCard = document.querySelector('[data-testid="revenue-chart"]').closest('article').getBoundingClientRect()
    const funnelCard = document.querySelector('[data-testid="analytics-funnel"]').closest('article').getBoundingClientRect()
    return {
      period: document.querySelector('[data-testid="analytics-content"]').dataset.period,
      metricRowCount: new Set(metricCards.map((rect) => Math.round(rect.top))).size,
      chartDesktop: document.querySelector('[data-testid="revenue-chart"]').dataset.mobileLayout,
      chartWidth: document.querySelector('[data-testid="revenue-chart"] svg').getBoundingClientRect().width,
      panelsAligned: Math.abs(chartCard.top - funnelCard.top) < 2,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(desktop.period === 'monthly' && desktop.metricRowCount === 1, 'The desktop period or seven-card metric layout is incorrect.')
  assert(desktop.chartDesktop === 'desktop' && desktop.chartWidth > 600 && desktop.panelsAligned && !desktop.overflow, 'The desktop chart/funnel layout is not responsive.')
  const desktopCapture = await capture('desktop-monthly', true)

  await evaluate(`document.querySelector('[aria-label="Reset all simulated business data"]').click()`)
  await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'daily'`, 'Reset Demo Daily analytics')

  console.log(JSON.stringify({
    passed: true,
    initialPeriod: 'daily',
    weeklyLoadingMs: Math.round(loadingDuration),
    metrics: ['Visitors', 'Product Views', 'Add to Bag', 'Checkout', 'Orders', 'Revenue', 'Conversion Rate'],
    funnel: daily.funnel,
    realProductsInInsights: ['Pear Drop Statement Necklace', 'Heritage Jhumka Earrings', 'Oval and Marquise Bracelet'],
    mobile: { viewport: '390x844', adaptedChart: true, labelOverlap: false, horizontalOverflow: false },
    desktop: { viewport: '1440x1000', responsiveChart: true, sevenMetricRow: true },
    resetRestoredDaily: true,
    captures: [dailyCapture, loadingCapture, weeklyChartCapture, weeklyInsightsCapture, desktopCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
