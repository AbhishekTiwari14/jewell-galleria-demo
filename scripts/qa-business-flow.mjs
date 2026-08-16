import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const debugPort = process.env.OVIA_CDP_PORT ?? '9333'
const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4174'
const outputDirectory = process.env.OVIA_QA_OUTPUT ?? join(process.cwd(), 'qa-business')

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function getDebugTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())
      const target = targets.find((item) => item.type === 'page')
      if (target) return target
    } catch {
      // Edge may still be launching.
    }
    await sleep(200)
  }
  throw new Error('Could not connect to Edge')
}

await mkdir(outputDirectory, { recursive: true })
const target = await getDebugTarget()
const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let messageId = 0

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
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function navigate(path) {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await sleep(350)
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 500,
  })
}

async function capture(name) {
  const response = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const path = join(outputDirectory, `${name}.png`)
  await writeFile(path, Buffer.from(response.data, 'base64'))
  return path
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function auditPage(path, name) {
  await navigate(path)
  const audit = await evaluate(`({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    text: document.body.innerText,
  })`)
  assert(audit.width === audit.scrollWidth, `${path} has horizontal overflow (${audit.scrollWidth}/${audit.width})`)
  assert(audit.text.toLowerCase().includes('demo mode'), `${path} is missing DEMO MODE`)
  assert(audit.text.toLowerCase().includes('simulated business data'), `${path} is missing simulated-data disclosure`)
  await capture(name)
  return audit
}

await send('Page.enable')
await send('Runtime.enable')
await setViewport(390, 844)

await navigate('/')
await evaluate(`localStorage.removeItem('ovia-demo:v1'); location.reload()`)
await waitFor(`document.readyState === 'complete'`, 'storefront reset')
await sleep(300)
const entryAudit = await evaluate(`({
  desktop: [...document.querySelectorAll('a')].some((link) => link.textContent.trim() === 'Business Preview' && link.getAttribute('href') === '/business'),
  width: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
})`)
assert(entryAudit.desktop, 'Storefront Business Preview entry is missing')
assert(entryAudit.width === entryAudit.scrollWidth, 'Storefront has horizontal overflow')

const initialDashboard = await auditPage('/business', 'mobile-dashboard-before')
const lowBefore = Number(await evaluate(`document.querySelector('[data-testid="low-stock-count"]').textContent.trim()`))
assert(initialDashboard.text.includes('Orders') && initialDashboard.text.includes('Revenue') && initialDashboard.text.includes('Average order value') && initialDashboard.text.includes('Active products'), 'Dashboard metrics are incomplete')
assert(initialDashboard.text.includes('Recent orders') && initialDashboard.text.includes('Top products'), 'Dashboard operations content is incomplete')

await auditPage('/business/inventory', 'mobile-inventory-before')
const inventoryBefore = await evaluate(`({
  product: document.querySelector('[data-testid="inventory-editor"] h2').textContent.trim(),
  quantity: document.querySelector('[data-testid="inventory-quantity"]').value,
  savedS: document.querySelector('[data-testid="saved-stock-S"]').innerText,
  savedM: document.querySelector('[data-testid="saved-stock-M"]').innerText,
  sPressed: document.querySelector('[data-testid="inventory-size-S"]').getAttribute('aria-pressed'),
})`)
assert(inventoryBefore.product === 'Brown Off Shoulder Dress', 'Brown Dress is not the default inventory product')
assert(inventoryBefore.quantity === '8' && inventoryBefore.savedS.includes('8 units'), 'Brown Dress S does not start at 8')
assert(inventoryBefore.savedM.includes('4 units'), 'Brown Dress M does not start at 4')
assert(inventoryBefore.sPressed === 'true', 'Brown Dress S is not selected')

await evaluate(`document.querySelector('[data-testid="inventory-plus"]').click()`)
await sleep(150)
assert(await evaluate(`document.querySelector('[data-testid="inventory-quantity"]').value === '9'`), 'Inventory plus control did not increment')
await evaluate(`document.querySelector('[data-testid="inventory-minus"]').click()`)
await sleep(150)
assert(await evaluate(`document.querySelector('[data-testid="inventory-quantity"]').value === '8'`), 'Inventory minus control did not decrement')

await evaluate(`(() => {
  const input = document.querySelector('[data-testid="inventory-quantity"]')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, '14')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await sleep(250)
assert(await evaluate(`!document.querySelector('[data-testid="save-inventory"]').disabled`), 'Save did not enable after stock edit')
await evaluate(`document.querySelector('[data-testid="save-inventory"]').click()`)
await waitFor(`document.querySelector('[data-testid="inventory-success-toast"]')`, 'inventory toast')
const inventoryAfter = await evaluate(`({
  savedS: document.querySelector('[data-testid="saved-stock-S"]').innerText,
  storage: JSON.parse(localStorage.getItem('ovia-demo:v1')).state.inventoryByVariant['ovia-006:S'],
})`)
assert(inventoryAfter.savedS.includes('14 units'), 'Inventory list did not update to 14')
assert(inventoryAfter.storage === 14, 'S=14 did not persist to localStorage')
await capture('mobile-inventory-saved')

await auditPage('/business', 'mobile-dashboard-after')
const lowAfter = Number(await evaluate(`document.querySelector('[data-testid="low-stock-count"]').textContent.trim()`))
assert(lowAfter === lowBefore - 1, `Low-stock count did not respond (${lowBefore} → ${lowAfter})`)

await navigate('/business/inventory')
assert(await evaluate(`document.querySelector('[data-testid="inventory-quantity"]').value === '14'`), 'Inventory did not survive navigation/reload')

await auditPage('/business/orders', 'mobile-orders')
await evaluate(`document.querySelector('[data-testid="open-order-OVD-260813-018"]').click()`)
await waitFor(`document.querySelector('[data-testid="order-detail"]')`, 'order detail')
await evaluate(`(() => {
  const select = document.querySelector('[data-testid="order-status-select"]')
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  setter.call(select, 'shipped')
  select.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await sleep(200)
assert(await evaluate(`!document.querySelector('[data-testid="save-order-status"]').disabled`), 'Order status save did not enable')
await evaluate(`document.querySelector('[data-testid="save-order-status"]').click()`)
await waitFor(`document.querySelector('[data-testid="order-success-toast"]')`, 'order status toast')
const orderSaved = await evaluate(`JSON.parse(localStorage.getItem('ovia-demo:v1')).state.orders.find((order) => order.id === 'OVD-260813-018').status`)
assert(orderSaved === 'shipped', 'Order status did not persist')
await capture('mobile-order-updated')
await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
await waitFor(`!document.querySelector('[data-testid="order-detail"]')`, 'order detail close')
await evaluate(`document.querySelector('[data-testid="order-filter-shipped"]').click()`)
await sleep(200)
const filterAudit = await evaluate(`({
  pressed: document.querySelector('[data-testid="order-filter-shipped"]').getAttribute('aria-pressed'),
  visible: Boolean(document.querySelector('[data-testid="open-order-OVD-260813-018"]')),
})`)
assert(filterAudit.pressed === 'true' && filterAudit.visible, 'Shipped filter did not include updated order')

await setViewport(1440, 1000)
for (const [path, name] of [
  ['/business', 'desktop-dashboard'],
  ['/business/products', 'desktop-products'],
  ['/business/inventory', 'desktop-inventory'],
  ['/business/orders', 'desktop-orders'],
]) {
  await auditPage(path, name)
}

console.log(JSON.stringify({
  passed: true,
  storefrontEntry: true,
  inventory: { product: 'Brown Off Shoulder Dress', size: 'S', before: 8, after: 14, persisted: true },
  lowStock: { before: lowBefore, after: lowAfter, responsive: true },
  orders: { filtered: true, detailOpened: true, updatedTo: 'shipped', persisted: true },
  viewports: ['390x844', '1440x1000'],
}, null, 2))

socket.close()
