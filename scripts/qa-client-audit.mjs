import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const debugPort = process.env.OVIA_CDP_PORT ?? '9555'
const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4176'
const outputDirectory = process.env.OVIA_QA_OUTPUT ?? join(process.cwd(), 'qa-client-audit')
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
]
const routes = [
  '/',
  '/product/brown-off-shoulder-dress',
  '/cart',
  '/checkout',
  '/business',
  '/business/products',
  '/business/inventory',
  '/business/orders',
  '/business/analytics',
  '/not-a-real-route',
]

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function getTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(80)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function navigate(path) {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await sleep(path.includes('analytics') ? 900 : 350)
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 500 })
}

async function capture(name, fullPage = false) {
  const params = { format: 'png', captureBeyondViewport: fullPage }
  if (fullPage) {
    const dimensions = await evaluate(`({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })`)
    params.clip = { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 }
  }
  const result = await send('Page.captureScreenshot', params)
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(result.data, 'base64'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function reset() {
  await navigate('/')
  await evaluate(`localStorage.removeItem('ovia-demo:v1'); location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 'demo reset')
  await sleep(250)
}

async function auditRoute(path, viewport) {
  await navigate(path)
  const audit = await evaluate(`(() => {
    const brokenImages = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.src)
    const elements = [...document.querySelectorAll('body *')]
      .filter((node) => {
        const style = getComputedStyle(node)
        if (style.position === 'fixed' || style.position === 'absolute') return false
        const rect = node.getBoundingClientRect()
        return rect.width > 0 && (rect.right > document.documentElement.clientWidth + 1 || rect.left < -1)
      })
      .slice(0, 8)
      .map((node) => ({ tag: node.tagName, className: node.className?.toString?.().slice(0, 100), text: node.textContent?.trim().slice(0, 60) }))
    return {
      path: location.pathname,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenImages,
      overflowElements: elements,
      aarini: /aarini/i.test(document.body.innerText),
      mojibake: /Ã|Â|â€|â€¢|â†|ðŸ/.test(document.body.innerText),
      placeholder: /phase 1 foundation|route reserved|coming soon|lorem ipsum/i.test(document.body.innerText),
      businessDisclosure: location.pathname.startsWith('/business')
        ? /demo mode/i.test(document.body.innerText) && /simulated business data/i.test(document.body.innerText)
        : true,
    }
  })()`)
  assert(audit.scrollWidth === audit.clientWidth, `${viewport.width}px ${path}: horizontal overflow ${audit.scrollWidth}/${audit.clientWidth}; ${JSON.stringify(audit.overflowElements)}`)
  assert(audit.brokenImages.length === 0, `${viewport.width}px ${path}: broken images ${audit.brokenImages.join(', ')}`)
  assert(!audit.aarini, `${viewport.width}px ${path}: Aarini branding found`)
  assert(!audit.mojibake, `${viewport.width}px ${path}: mojibake found`)
  assert(!audit.placeholder, `${viewport.width}px ${path}: generic placeholder copy found`)
  assert(audit.businessDisclosure, `${viewport.width}px ${path}: missing business demo disclosure`)
  return audit
}

async function customerJourney(size, width, height) {
  await setViewport(width, height)
  await reset()
  await navigate('/')
  assert(await evaluate(`Boolean(document.querySelector('a[href="/product/brown-off-shoulder-dress"]'))`), `${width}px: Brown Dress home link missing`)
  await evaluate(`document.querySelector('a[href="/product/brown-off-shoulder-dress"]').click()`)
  await waitFor(`location.pathname === '/product/brown-off-shoulder-dress'`, 'Brown Dress route')
  await sleep(250)
  const initial = await evaluate(`({
    s: document.querySelector('[data-testid="size-S"]').getAttribute('aria-pressed'),
    m: document.querySelector('[data-testid="size-M"]').getAttribute('aria-pressed'),
    disabled: document.querySelector('[data-testid="add-to-bag"]').disabled,
    price: document.body.innerText.includes('₹1,199'),
  })`)
  assert(initial.s === 'false' && initial.m === 'false' && initial.disabled, `${width}px ${size}: initial PDP state is wrong`)
  assert(initial.price, `${width}px ${size}: Brown Dress price is wrong`)
  await evaluate(`document.querySelector('[data-testid="size-${size}"]').click()`)
  await sleep(150)
  const selected = await evaluate(`({
    chosen: document.querySelector('[data-testid="size-${size}"]').getAttribute('aria-pressed'),
    other: document.querySelector('[data-testid="size-${size === 'S' ? 'M' : 'S'}"]').getAttribute('aria-pressed'),
    disabled: document.querySelector('[data-testid="add-to-bag"]').disabled,
  })`)
  assert(selected.chosen === 'true' && selected.other === 'false' && !selected.disabled, `${width}px ${size}: selected size state is wrong`)
  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'add confirmation')
  const sheet = await evaluate(`({
    size: document.querySelector('[data-testid="confirmation-size"]').textContent.trim(),
    name: document.querySelector('[data-testid="added-to-bag-sheet"]').innerText.includes('Brown Off Shoulder Dress'),
    price: document.querySelector('[data-testid="added-to-bag-sheet"]').innerText.includes('₹1,199'),
    badge: document.querySelector('[data-testid="cart-badge"]').textContent.trim(),
  })`)
  assert(sheet.size === size && sheet.name && sheet.price && sheet.badge === '1', `${width}px ${size}: confirmation/cart badge mismatch`)
  await evaluate(`document.querySelector('[data-testid="confirmation-checkout"]').click()`)
  await waitFor(`location.pathname === '/checkout'`, 'checkout')
  const checkout = await evaluate(`({
    size: document.body.innerText.includes('Size ${size}'),
    price: document.body.innerText.includes('₹1,199'),
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  })`)
  assert(checkout.size && checkout.price && checkout.width === checkout.scrollWidth, `${width}px ${size}: checkout variant/overflow mismatch`)
  await navigate('/cart')
  const cart = await evaluate(`({
    size: document.querySelector('[data-testid="cart-line-brown-off-shoulder-dress"]').innerText.includes('Size ${size}'),
    price: document.querySelector('[data-testid="cart-line-brown-off-shoulder-dress"]').innerText.includes('₹1,199'),
  })`)
  assert(cart.size && cart.price, `${width}px ${size}: cart variant/price mismatch`)
  return { width, size, passed: true }
}

async function inventoryResetJourney() {
  await setViewport(390, 844)
  await reset()
  await navigate('/business/inventory')
  assert(await evaluate(`document.querySelector('[data-testid="inventory-quantity"]').value === '8'`), 'Inventory S did not start at 8')
  await evaluate(`(() => {
    const input = document.querySelector('[data-testid="inventory-quantity"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '14')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(100)
  await evaluate(`document.querySelector('[data-testid="save-inventory"]').click()`)
  await waitFor(`document.querySelector('[data-testid="inventory-success-toast"]')`, 'inventory save')
  assert(await evaluate(`document.querySelector('[data-testid="saved-stock-S"]').innerText.includes('14 units')`), 'Inventory list did not update to 14')
  await navigate('/business/inventory')
  assert(await evaluate(`document.querySelector('[data-testid="inventory-quantity"]').value === '14'`), 'Inventory did not persist after refresh')
  await evaluate(`document.querySelector('[aria-label="Reset all simulated business data"]').click()`)
  await sleep(150)
  assert(await evaluate(`document.querySelector('[data-testid="inventory-quantity"]').value === '8' && document.querySelector('[data-testid="saved-stock-S"]').innerText.includes('8 units')`), 'Reset demo did not restore inventory editor and list')
  const stored = await evaluate(`JSON.parse(localStorage.getItem('ovia-demo:v1')).state.inventoryByVariant['ovia-006:S']`)
  assert(stored === 8, 'Reset demo did not persist reset state')
  return true
}

async function analyticsJourney() {
  await setViewport(390, 844)
  await reset()
  await navigate('/business/analytics')
  assert(await evaluate(`document.querySelector('[data-testid="analytics-content"]').dataset.period === 'daily'`), 'Analytics did not start Daily')
  await evaluate(`window.__auditStarted = performance.now(); document.querySelector('[data-testid="analytics-tab-weekly"]').click()`)
  await waitFor(`document.querySelector('[data-testid="analytics-loading"]')`, 'analytics skeleton')
  await sleep(300)
  assert(await evaluate(`Boolean(document.querySelector('[data-testid="analytics-loading"]'))`), 'Analytics skeleton too brief')
  await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'weekly'`, 'weekly chart')
  const elapsed = await evaluate(`performance.now() - window.__auditStarted`)
  assert(elapsed >= 400 && elapsed <= 700, `Analytics loading outside target: ${elapsed}`)
  await sleep(1200)
  assert(await evaluate(`Boolean(document.querySelector('[data-testid="revenue-chart"] svg')) && document.querySelectorAll('[data-testid="analytics-funnel"] > div').length === 5`), 'Weekly chart/funnel missing')
  await evaluate(`document.querySelector('[data-testid="analytics-tab-monthly"]').click()`)
  await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'monthly'`, 'monthly analytics')
  return { loadingMs: elapsed }
}

async function routeTransitionJourney() {
  await setViewport(390, 844)
  await navigate('/')
  await evaluate(`window.scrollTo(0, 900)`)
  await sleep(100)
  await evaluate(`document.querySelector('a[href="/product/brown-off-shoulder-dress"]').click()`)
  await waitFor(`location.pathname === '/product/brown-off-shoulder-dress'`, 'PDP route transition')
  await sleep(100)
  const customerScroll = await evaluate(`window.scrollY`)
  assert(customerScroll === 0, `Customer route did not restore top: ${customerScroll}`)
  await navigate('/business')
  await evaluate(`window.scrollTo(0, 800)`)
  await sleep(100)
  await evaluate(`document.querySelector('a[href="/business/products"]').click()`)
  await waitFor(`location.pathname === '/business/products'`, 'business route transition')
  await sleep(100)
  const businessScroll = await evaluate(`window.scrollY`)
  assert(businessScroll === 0, `Business route did not restore top: ${businessScroll}`)
  return true
}

async function interactionStateAudit() {
  await setViewport(1280, 900)
  await reset()
  await navigate('/product/brown-off-shoulder-dress')
  const disabled = await evaluate(`(() => {
    const button = document.querySelector('[data-testid="add-to-bag"]')
    const style = getComputedStyle(button)
    return { disabled: button.disabled, cursor: style.cursor, background: style.backgroundColor }
  })()`)
  assert(disabled.disabled && disabled.cursor === 'not-allowed', 'Add-to-bag disabled state is not clear')
  let focusedSize = false
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    focusedSize = await evaluate(`document.activeElement?.dataset?.testid === 'size-S'`)
    if (focusedSize) break
  }
  assert(focusedSize, 'Size S is not reachable by keyboard')
  const focus = await evaluate(`(() => {
    const style = getComputedStyle(document.querySelector('[data-testid="size-S"]'))
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })()`)
  assert(focus.outlineStyle !== 'none' && Number.parseFloat(focus.outlineWidth) > 0, 'Keyboard focus is not visible')
  const sizeRect = await evaluate(`(() => {
    const rect = document.querySelector('[data-testid="size-S"]').getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sizeRect.x, y: sizeRect.y })
  await sleep(80)
  const hover = await evaluate(`getComputedStyle(document.querySelector('[data-testid="size-S"]')).borderColor`)
  assert(hover !== 'rgb(233, 223, 228)', `Size hover state is not visible: ${hover}`)
  return true
}

async function quantitySummaryAudit() {
  await setViewport(390, 844)
  await reset()
  await navigate('/product/brown-off-shoulder-dress')
  await evaluate(`document.querySelector('[aria-label="Increase quantity"]').click(); document.querySelector('[data-testid="size-S"]').click()`)
  await sleep(100)
  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'quantity confirmation')
  const summary = await evaluate(`document.querySelector('[data-testid="added-to-bag-sheet"]').innerText`)
  assert(summary.includes('Qty 2') && summary.includes('₹2,398'), 'Add confirmation does not match selected quantity and line total')
  return true
}

async function activeCustomerScreenshotAudit() {
  await setViewport(390, 844)
  await reset()
  await navigate('/product/brown-off-shoulder-dress')
  await evaluate(`document.querySelector('[data-testid="size-S"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="add-to-bag"]').disabled`, 'mobile add button')
  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'mobile active sheet')
  await capture('active-mobile-added-sheet-s')
  await evaluate(`document.querySelector('[data-testid="confirmation-checkout"]').click()`)
  await waitFor(`location.pathname === '/checkout'`, 'active mobile checkout')
  await capture('active-mobile-checkout-s')
  await navigate('/cart')
  await capture('active-mobile-cart-s')

  await setViewport(1440, 1000)
  await reset()
  await navigate('/product/brown-off-shoulder-dress')
  await evaluate(`document.querySelector('[data-testid="size-M"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="add-to-bag"]').disabled`, 'desktop add button')
  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'desktop active sheet')
  await capture('active-desktop-added-sheet-m')
  await evaluate(`document.querySelector('[data-testid="confirmation-checkout"]').click()`)
  await waitFor(`location.pathname === '/checkout'`, 'active desktop checkout')
  await capture('active-desktop-checkout-m')
  await navigate('/cart')
  await capture('active-desktop-cart-m')
  return true
}

async function assetAndResetScopeAudit() {
  await setViewport(390, 844)
  await navigate('/')
  const assets = await evaluate(`Promise.all([
    '/brand/ovia-logo.jpg',
    '/products/lime-shells-corset-kurti/primary.png',
    '/products/green-heart-corset-kurti/primary.png',
    '/products/purple-shell-kurti/primary.png',
    '/products/beige-off-shoulder-one-piece/primary.png',
    '/products/white-one-shoulder-piece/primary.png',
    '/products/brown-off-shoulder-dress/primary.png',
    '/products/lace-trimmed-top/primary.png',
    '/products/waist-coat/primary.png',
    '/products/brown-ombre-top/primary.png',
    '/products/red-ombre-top/primary.png',
  ].map((src) => new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ src, loaded: true, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ src, loaded: false, width: 0, height: 0 })
    image.src = src
  })))`)
  const broken = assets.filter((asset) => !asset.loaded || asset.width === 0 || asset.height === 0)
  assert(broken.length === 0, `Broken source assets: ${JSON.stringify(broken)}`)

  await reset()
  await navigate('/product/brown-off-shoulder-dress')
  await evaluate(`document.querySelector('[data-testid="size-S"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="add-to-bag"]').disabled`, 'reset-scope add button')
  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await navigate('/business/inventory')
  await evaluate(`(() => {
    const input = document.querySelector('[data-testid="inventory-quantity"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '14')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(100)
  await evaluate(`document.querySelector('[data-testid="save-inventory"]').click()`)
  await navigate('/business/orders')
  await evaluate(`document.querySelector('[data-testid="open-order-OVD-260813-018"]').click()`)
  await waitFor(`document.querySelector('[data-testid="order-status-select"]')`, 'reset-scope order')
  await evaluate(`(() => {
    const select = document.querySelector('[data-testid="order-status-select"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(select, 'shipped')
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  await evaluate(`document.querySelector('[data-testid="save-order-status"]').click()`)
  await navigate('/business/analytics')
  await evaluate(`document.querySelector('[data-testid="analytics-tab-monthly"]').click()`)
  await waitFor(`document.querySelector('[data-testid="analytics-content"]')?.dataset.period === 'monthly'`, 'reset-scope monthly')
  await evaluate(`document.querySelector('[aria-label="Reset all simulated business data"]').click()`)
  await sleep(250)
  const resetState = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('ovia-demo:v1')).state
    return {
      cart: state.cart.length,
      stock: state.inventoryByVariant['ovia-006:S'],
      orderStatus: state.orders.find((order) => order.id === 'OVD-260813-018').status,
      analyticsPeriod: state.analyticsPeriod,
      visiblePeriod: document.querySelector('[data-testid="analytics-content"]')?.dataset.period,
    }
  })()`)
  assert(resetState.cart === 0 && resetState.stock === 8 && resetState.orderStatus === 'confirmed' && resetState.analyticsPeriod === 'daily' && resetState.visiblePeriod === 'daily', `Reset scope incomplete: ${JSON.stringify(resetState)}`)
  return { assetCount: assets.length, resetState }
}

await send('Page.enable')
await send('Runtime.enable')

const routeAudits = []
for (const viewport of viewports) {
  await setViewport(viewport.width, viewport.height)
  await reset()
  for (const route of routes) {
    routeAudits.push(await auditRoute(route, viewport))
    const routeName = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')
    await capture(`${viewport.width}-${routeName}`)
  }
}

const customerS = await customerJourney('S', 390, 844)
const customerM = await customerJourney('M', 430, 932)
const inventoryReset = await inventoryResetJourney()
const analytics = await analyticsJourney()
const routeTransitions = await routeTransitionJourney()
const interactionStates = await interactionStateAudit()
const quantitySummary = await quantitySummaryAudit()
const activeCustomerScreens = await activeCustomerScreenshotAudit()
const assetAndResetScope = await assetAndResetScopeAudit()

console.log(JSON.stringify({
  passed: true,
  routeAudits: routeAudits.length,
  viewports: viewports.map(({ width }) => width),
  customerJourneys: [customerS, customerM],
  inventoryReset,
  analytics,
  routeTransitions,
  interactionStates,
  quantitySummary,
  activeCustomerScreens,
  assetAndResetScope,
}, null, 2))
socket.close()
