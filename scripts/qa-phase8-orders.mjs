import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase8-orders')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9457
const profileDirectory = join(tmpdir(), `jewellgalleria-orders-edge-${process.pid}`)
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
  const pathname = path.split('?')[0]
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(pathname)}`, path)
  await waitFor(`document.querySelector('main')`, `${path} content`)
  await sleep(250)
}

async function setControl(selector, value) {
  await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) throw new Error('Missing control: ${selector}')
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(80)
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
  await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1'); location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 'clean demo reload')

  await navigate('/business/orders')
  const mobileList = await evaluate(`(() => {
    const card = document.querySelector('[data-testid="open-order-JGD-260814-011"]')
    const desktopHeader = [...document.querySelectorAll('section > div')].find((node) => node.textContent.includes('Order ID') && node.textContent.includes('Customer') && node.textContent.includes('Items') && node.textContent.includes('Total') && node.textContent.includes('Status') && node.textContent.includes('Date'))
    const filterLabels = [...document.querySelectorAll('[data-testid^="order-filter-"]')].map((button) => button.innerText)
    return {
      cardText: card.innerText,
      cardWidth: card.getBoundingClientRect().width,
      desktopHeaderHidden: desktopHeader ? getComputedStyle(desktopHeader).display === 'none' : false,
      filters: filterLabels,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      clothingTerms: ['Size S', 'Size M', 'Size L', 'clothing'].some((term) => document.body.innerText.toLocaleLowerCase().includes(term.toLocaleLowerCase())),
    }
  })()`)
  assert(mobileList.cardText.includes('Kiara Singh') && mobileList.cardText.includes('Wave Station Ring') && mobileList.cardText.includes('₹1,790') && mobileList.cardText.includes('Delivered'), 'Mobile order card is missing requested fields or the actual product name.')
  assert(['New', 'Confirmed', 'Packed', 'Shipped', 'Delivered'].every((label) => mobileList.filters.some((filter) => filter.includes(label))), 'Required demo statuses are missing.')
  assert(mobileList.cardWidth <= 390 && mobileList.desktopHeaderHidden && !mobileList.overflow && !mobileList.clothingTerms, 'Orders did not use a mobile-safe card layout.')
  const mobileListCapture = await capture('mobile-order-list')

  await evaluate(`document.querySelector('[data-testid="open-order-JGD-260814-011"]').click()`)
  await waitFor(`document.querySelector('[data-testid="order-detail"]')`, 'seeded order detail')
  await sleep(500)
  const seededDetail = await evaluate(`(() => {
    const detail = document.querySelector('[data-testid="order-detail"]')
    const item = document.querySelector('[data-testid="order-detail-item-wave-station-ring"]')
    const timeline = document.querySelector('[data-testid="order-timeline"]')
    return {
      text: detail.innerText,
      itemText: item.innerText,
      stages: [...timeline.children].map((stage) => stage.innerText),
      delivered: document.querySelector('[data-testid="timeline-status-delivered"]').innerText,
      overflow: detail.scrollWidth > detail.clientWidth,
    }
  })()`)
  assert(seededDetail.text.includes('Customer details') && seededDetail.text.includes('Kiara Singh') && seededDetail.text.includes('Chandigarh') && seededDetail.text.includes('Order timeline'), 'Customer details or timeline is incomplete.')
  assert(seededDetail.itemText.includes('Wave Station Ring') && seededDetail.itemText.includes('Ring Size: 7') && seededDetail.itemText.includes('Qty 1') && seededDetail.itemText.includes('₹1,790'), 'Order product, variant, quantity, or pricing is incorrect.')
  assert(seededDetail.stages.length === 5 && seededDetail.delivered.includes('Current demo status') && !seededDetail.overflow, 'Delivered timeline is incorrect.')
  const seededDetailCapture = await capture('mobile-seeded-order-detail')

  await setControl('[data-testid="order-status-select"]', 'packed')
  await evaluate(`document.querySelector('[data-testid="save-order-status"]').click()`)
  await waitFor(`document.querySelector('[data-testid="order-success-toast"]')`, 'status update confirmation')
  const updated = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state
    return {
      status: state.orders.find((order) => order.id === 'JGD-260814-011').status,
      badge: document.querySelector('[data-testid="order-detail"]').innerText,
      timeline: document.querySelector('[data-testid="timeline-status-packed"]').innerText,
      toast: document.querySelector('[data-testid="order-success-toast"]').innerText,
    }
  })()`)
  assert(updated.status === 'packed' && updated.badge.includes('Packed') && updated.timeline.includes('Current demo status') && updated.toast.includes('Order updated'), 'Changing order status did not update real application state and timeline.')

  await send('Page.reload')
  await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="order-detail"]')`, 'updated order after refresh')
  assert((await evaluate(`document.querySelector('[data-testid="order-status-select"]').value`)) === 'packed', 'Updated order status did not persist after refresh.')
  await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="order-detail"]')`, 'close seeded order detail')
  await evaluate(`document.querySelector('[data-testid="order-filter-packed"]').click()`)
  await waitFor(`document.querySelector('[data-testid="open-order-JGD-260814-011"]')`, 'Packed filter result')

  await navigate('/product/wave-station-ring')
  await evaluate(`document.querySelector('[data-testid="option-ring-size-7"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled`, 'selected Ring Size')
  await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'PDP add confirmation')
  await evaluate(`document.querySelector('[data-testid="confirmation-view-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'cart drawer')
  await evaluate(`document.querySelector('[data-testid="drawer-checkout"]').click()`)
  await waitFor(`location.pathname === '/checkout'`, 'mock checkout')
  await waitFor(`document.querySelector('#email')`, 'mock checkout form')

  const checkoutValues = {
    '#email': 'anaya@example.com',
    '#first-name': 'Anaya',
    '#last-name': 'Demo',
    '#address': '1 Sample Lane',
    '#city': 'Jaipur',
    '#postal-code': '302001',
    '#phone': '9000000000',
  }
  for (const [selector, value] of Object.entries(checkoutValues)) {
    await setControl(selector, value)
  }
  await evaluate(`document.querySelector('[data-testid="mobile-place-demo-order"]').click()`)
  await waitFor(`document.querySelector('[data-testid="checkout-success"]')`, 'checkout success')
  const checkoutOrderId = await evaluate(`document.querySelector('[data-testid="demo-order-number"]').textContent.trim()`)
  await evaluate(`document.querySelector('[data-testid="view-demo-order"]').click()`)
  await waitFor(`location.pathname === '/business/orders' && document.querySelector('[data-testid="order-detail"]')`, 'checkout order in Business Orders')
  await sleep(500)

  const checkoutOrder = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state
    const order = state.orders.find((item) => item.id === ${JSON.stringify(checkoutOrderId)})
    const detail = document.querySelector('[data-testid="order-detail"]')
    return {
      status: order.status,
      customer: order.customerName,
      city: order.shippingCity,
      selection: order.items[0].selection,
      amount: order.amountInPaise,
      text: detail.innerText,
      itemText: document.querySelector('[data-testid="order-detail-item-wave-station-ring"]').innerText,
      newTimeline: document.querySelector('[data-testid="timeline-status-new"]').innerText,
    }
  })()`)
  assert(checkoutOrder.status === 'new' && checkoutOrder.customer === 'Anaya Demo' && checkoutOrder.city === 'Jaipur', 'Mock checkout order did not enter the order queue accurately.')
  assert(checkoutOrder.selection['ring-size'] === '7' && checkoutOrder.amount === 179000, 'Checkout order variant or total is incorrect.')
  assert(checkoutOrder.text.includes('New') && checkoutOrder.itemText.includes('Wave Station Ring') && checkoutOrder.itemText.includes('Ring Size: 7') && checkoutOrder.itemText.includes('Qty 1') && checkoutOrder.itemText.includes('₹1,790'), 'Checkout-created order detail is incomplete.')
  assert(checkoutOrder.newTimeline.includes('Current demo status'), 'New order timeline is incorrect.')
  const checkoutDetailCapture = await capture('mobile-checkout-order-detail')

  await setControl('[data-testid="order-status-select"]', 'confirmed')
  await evaluate(`document.querySelector('[data-testid="save-order-status"]').click()`)
  await waitFor(`JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.orders.find((order) => order.id === ${JSON.stringify(checkoutOrderId)}).status === 'confirmed'`, 'checkout order status update')

  await setViewport(1440, 1000)
  await navigate('/business/orders')
  const desktopAudit = await evaluate(`(() => {
    const header = [...document.querySelectorAll('section > div')].find((node) => node.textContent.includes('Order ID') && node.textContent.includes('Customer') && node.textContent.includes('Items') && node.textContent.includes('Total') && node.textContent.includes('Status') && node.textContent.includes('Date'))
    const order = document.querySelector('[data-testid="open-order-' + ${JSON.stringify(checkoutOrderId)} + '"]')
    return {
      headerVisible: header && getComputedStyle(header).display === 'grid',
      headerText: header?.innerText,
      orderText: order?.innerText,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(desktopAudit.headerVisible && ['Order ID', 'Customer', 'Items', 'Total', 'Status', 'Date'].every((label) => desktopAudit.headerText.toLocaleLowerCase().includes(label.toLocaleLowerCase())), 'Desktop order columns are incomplete.')
  assert(desktopAudit.orderText.includes('Anaya Demo') && desktopAudit.orderText.includes('Wave Station Ring') && desktopAudit.orderText.includes('Confirmed') && !desktopAudit.overflow, 'Desktop checkout order row is incorrect.')
  const desktopListCapture = await capture('desktop-order-list', true)
  await evaluate(`document.querySelector('[data-testid="open-order-' + ${JSON.stringify(checkoutOrderId)} + '"]').click()`)
  await waitFor(`document.querySelector('[data-testid="order-detail"]')`, 'desktop checkout order detail')
  await sleep(500)
  const desktopDetailCapture = await capture('desktop-order-detail')

  await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
  await evaluate(`(() => {
    const persisted = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1'))
    persisted.version = 2
    persisted.state.orders[0].status = 'processing'
    localStorage.setItem('jewellgalleria-demo:v1', JSON.stringify(persisted))
    location.reload()
  })()`)
  await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="open-order-' + ${JSON.stringify(checkoutOrderId)} + '"]')?.innerText.includes('Packed')`, 'v2 Processing to Packed migration')
  assert((await evaluate(`JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).version`)) === 3, 'Persisted order state did not migrate to version 3.')
  await evaluate(`document.querySelector('[aria-label="Reset all simulated business data"]').click()`)
  await waitFor(`!JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.orders.some((order) => order.id === ${JSON.stringify(checkoutOrderId)})`, 'Reset Demo checkout order removal')

  console.log(JSON.stringify({
    passed: true,
    seededOrder: 'JGD-260814-011',
    actualProductName: 'Wave Station Ring',
    statuses: ['New', 'Confirmed', 'Packed', 'Shipped', 'Delivered'],
    statusUpdatePersisted: true,
    processingMigration: 'Packed',
    orderTimeline: true,
    checkoutOrderId,
    checkoutOrderAppeared: true,
    checkoutVariant: 'Ring Size: 7',
    mobileCards: true,
    desktopColumns: ['Order ID', 'Customer', 'Items', 'Total', 'Status', 'Date'],
    mobileViewport: '390x844',
    desktopViewport: '1440x1000',
    captures: [mobileListCapture, seededDetailCapture, checkoutDetailCapture, desktopListCapture, desktopDetailCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
