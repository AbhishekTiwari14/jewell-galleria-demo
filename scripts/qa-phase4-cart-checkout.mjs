import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase4-checkout')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9453
const profileDirectory = join(tmpdir(), `jewellgalleria-checkout-edge-${process.pid}`)
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
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path.split('?')[0])}`, path)
  await waitFor(`document.querySelector('main')`, `${path} content`)
  await sleep(180)
}

async function resetDemo() {
  await navigate('/')
  await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1')`)
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
  await resetDemo()
  await navigate('/product/wave-station-ring')
  await evaluate(`document.querySelector('[data-testid="option-ring-size-7"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled`, 'ring size selection')
  await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'PDP add confirmation')
  await evaluate(`document.querySelector('[data-testid="confirmation-view-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'cart drawer')

  const drawerInitial = await evaluate(`(() => {
    const line = document.querySelector('[data-testid="cart-line-wave-station-ring"]')
    return {
      text: line.innerText,
      quantity: line.querySelector('[data-testid="cart-line-quantity"]').textContent.trim(),
      subtotal: document.querySelector('[data-testid="cart-drawer"]').innerText,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })()`)
  assert(drawerInitial.text.includes('Ring Size: 7') && drawerInitial.text.includes('1,790'), 'Drawer lost the selected ring size or price.')
  assert(drawerInitial.quantity === '1' && drawerInitial.clientWidth === drawerInitial.scrollWidth, 'Initial drawer quantity or mobile width is incorrect.')

  await evaluate(`document.querySelector('[data-testid="cart-line-wave-station-ring"] [aria-label="Increase quantity"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-line-wave-station-ring"] [data-testid="cart-line-quantity"]').textContent.trim() === '2'`, 'drawer quantity update')
  const drawerUpdated = await evaluate(`document.querySelector('[data-testid="cart-drawer"]').innerText`)
  assert(drawerUpdated.includes('3,580'), 'Drawer subtotal did not update to ₹3,580.')
  const drawerCapture = await capture('mobile-cart-drawer-quantity-2')

  await evaluate(`document.querySelector('[data-testid="cart-drawer"] a[href="/cart"]').click()`)
  await waitFor(`location.pathname === '/cart'`, 'full cart page')
  const cartPage = await evaluate(`(() => {
    const line = document.querySelector('[data-testid="cart-line-wave-station-ring"]')
    return {
      text: line.innerText,
      quantity: line.querySelector('[data-testid="cart-line-quantity"]').textContent.trim(),
      page: document.body.innerText,
    }
  })()`)
  assert(cartPage.text.includes('Ring Size: 7') && cartPage.quantity === '2', 'Full cart lost the selected variant or quantity.')
  assert(cartPage.page.includes('3,580'), 'Full cart total is incorrect.')
  const cartPageCapture = await capture('mobile-cart-page')
  await evaluate(`document.querySelector('[data-testid="cart-line-wave-station-ring"] [aria-label="Decrease quantity"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-line-wave-station-ring"] [data-testid="cart-line-quantity"]').textContent.trim() === '1'`, 'cart decrement')
  assert((await evaluate(`document.body.innerText`)).includes('1,790'), 'Cart decrement did not update totals.')
  await evaluate(`document.querySelector('[data-testid="cart-line-wave-station-ring"] [aria-label="Increase quantity"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-line-wave-station-ring"] [data-testid="cart-line-quantity"]').textContent.trim() === '2'`, 'cart increment')

  await evaluate(`document.querySelector('[data-testid="cart-checkout"]').click()`)
  await waitFor(`location.pathname === '/checkout'`, 'checkout page')
  const checkoutMobile = await evaluate(`(() => {
    const summary = document.querySelector('[data-testid="checkout-order-summary"]')
    const action = document.querySelector('[data-testid="mobile-place-demo-order"]')
    return {
      summary: summary.innerText,
      actionHeight: action.getBoundingClientRect().height,
      paymentFields: document.querySelectorAll('input[type="text"][name*="card"], input[name*="payment"], input[name*="cvv"]').length,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })()`)
  assert(checkoutMobile.summary.includes('Ring Size: 7') && checkoutMobile.summary.includes('Qty 2') && checkoutMobile.summary.includes('3,580'), 'Mobile checkout summary is incorrect.')
  assert(checkoutMobile.actionHeight >= 44 && checkoutMobile.paymentFields === 0, 'Mobile action or payment safety is incorrect.')
  assert(checkoutMobile.clientWidth === checkoutMobile.scrollWidth, 'Mobile checkout has horizontal overflow.')
  const checkoutCapture = await capture('mobile-checkout')
  const checkoutFullCapture = await capture('mobile-checkout-full', true)

  await evaluate(`(() => {
    const values = {
      email: 'asha@example.com',
      'first-name': 'Asha',
      'last-name': 'Demo',
      address: '1 Sample Lane',
      city: 'Mumbai',
      'postal-code': '400001',
      phone: '9000000000',
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    for (const [id, value] of Object.entries(values)) {
      const input = document.getElementById(id)
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })()`)
  await evaluate(`document.querySelector('[data-testid="mobile-place-demo-order"]').click()`)
  await waitFor(`document.querySelector('[data-testid="checkout-success"]')`, 'checkout success')

  const success = await evaluate(`(() => {
    const persisted = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state
    const orderId = document.querySelector('[data-testid="demo-order-number"]').textContent.trim()
    const order = persisted.orders.find((item) => item.id === orderId)
    return {
      orderId,
      cartCount: persisted.cart.length,
      customerName: order?.customerName,
      shippingCity: order?.shippingCity,
      paymentStatus: order?.paymentStatus,
      quantity: order?.items?.[0]?.quantity,
      ringSize: order?.items?.[0]?.selection?.['ring-size'],
      amount: order?.amountInPaise,
      itemText: document.querySelector('[data-testid="success-order-item-wave-station-ring"]').innerText,
      total: document.querySelector('[data-testid="success-total"]').textContent,
    }
  })()`)
  assert(/^JGD-D\d{6}-\d{3}$/.test(success.orderId), 'Demo order number is malformed.')
  assert(success.cartCount === 0 && success.customerName === 'Asha Demo' && success.shippingCity === 'Mumbai', 'Order placement did not atomically persist and clear the cart.')
  assert(success.paymentStatus === 'demo' && success.quantity === 2 && success.ringSize === '7' && success.amount === 358000, 'Persisted demo order is inaccurate.')
  assert(success.itemText.includes('Ring Size: 7') && success.itemText.includes('Qty 2') && success.total.includes('3,580'), 'Confirmation summary is inaccurate.')
  const successCapture = await capture('mobile-order-confirmed')

  await evaluate(`document.querySelector('[data-testid="view-demo-order"]').click()`)
  await waitFor(`location.pathname === '/business/orders' && document.querySelector('[data-testid="order-detail"]')`, 'Business Preview order')
  await sleep(500)
  const businessOrder = await evaluate(`document.querySelector('[data-testid="order-detail"]').innerText`)
  assert(businessOrder.includes(success.orderId) && businessOrder.includes('Ring Size: 7'), 'Business Preview did not receive the exact demo order.')
  assert(businessOrder.includes('Demo payment') && businessOrder.includes('3,580'), 'Business Preview payment label or total is incorrect.')
  const businessCapture = await capture('business-preview-new-order')

  await navigate('/cart')
  const emptyPage = await evaluate(`document.body.innerText`)
  assert(emptyPage.includes('Your bag is empty') && emptyPage.includes('Continue Shopping'), 'Cart page empty state is incomplete.')

  await resetDemo()
  await navigate('/product/asymmetric-stone-huggies')
  await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'remove-flow confirmation')
  await evaluate(`document.querySelector('[data-testid="confirmation-view-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'remove-flow drawer')
  await evaluate(`document.querySelector('[data-testid="cart-line-asymmetric-stone-huggies"] [aria-label^="Remove"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]').innerText.includes('Your bag is waiting')`, 'empty drawer after remove')
  const emptyDrawer = await evaluate(`document.querySelector('[data-testid="cart-drawer"]').innerText`)
  assert(emptyDrawer.includes('Continue shopping'), 'Cart drawer empty CTA is missing.')

  await setViewport(1440, 1000)
  await resetDemo()
  await navigate('/product/asymmetric-stone-huggies')
  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'desktop add confirmation')
  await evaluate(`document.querySelector('[data-testid="confirmation-view-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'desktop cart drawer')
  const desktopDrawerCapture = await capture('desktop-cart-drawer')
  await evaluate(`document.querySelector('[data-testid="drawer-checkout"]').click()`)
  await waitFor(`location.pathname === '/checkout'`, 'desktop checkout')
  const desktopCheckout = await evaluate(`(() => {
    const first = document.getElementById('first-name').getBoundingClientRect()
    const last = document.getElementById('last-name').getBoundingClientRect()
    const mobileAction = document.querySelector('[data-testid="mobile-checkout-action"]')
    return {
      alignedNames: Math.abs(first.top - last.top) < 2 && first.width > 200 && last.width > 200,
      desktopAction: document.querySelector('[data-testid="place-demo-order"]').getBoundingClientRect().height,
      mobileActionHidden: getComputedStyle(mobileAction).display === 'none',
      summary: document.querySelector('[data-testid="checkout-order-summary"]').innerText,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })()`)
  assert(desktopCheckout.alignedNames && desktopCheckout.desktopAction >= 44 && desktopCheckout.mobileActionHidden, 'Desktop checkout layout is incorrect.')
  assert(desktopCheckout.summary.includes('Asymmetric Stone Huggies') && desktopCheckout.summary.includes('1,490'), 'Desktop order summary is incorrect.')
  assert(desktopCheckout.clientWidth === desktopCheckout.scrollWidth, 'Desktop checkout has horizontal overflow.')
  const desktopCheckoutCapture = await capture('desktop-checkout')

  console.log(JSON.stringify({
    passed: true,
    journey: 'PDP → cart drawer → quantity update → cart page → checkout → confirmation → Business Orders',
    exactVariant: 'Ring Size: 7',
    quantity: 2,
    totalInPaise: 358000,
    emptyCartPage: true,
    emptyCartDrawer: true,
    removeAction: true,
    mobileCheckout: true,
    desktopCheckout: true,
    captures: [drawerCapture, cartPageCapture, checkoutCapture, checkoutFullCapture, successCapture, businessCapture, desktopDrawerCapture, desktopCheckoutCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
