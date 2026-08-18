import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase3-pdp')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9443
const profileDirectory = join(tmpdir(), `jewellgalleria-pdp-edge-${process.pid}`)
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
  const targetResponse = await fetch(`http://127.0.0.1:${remotePort}/json/new?about:blank`, { method: 'PUT' })
  const target = await targetResponse.json()
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
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
    return response.result.value
  }
  return { evaluate, send, socket, target }
}

await waitForBrowser()
const client = await createClient()
const { evaluate, send } = client

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
  await sleep(180)
}

async function resetDemo() {
  await navigate('/')
  await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1')`)
}

async function capture(name) {
  const result = await send('Page.captureScreenshot', { captureBeyondViewport: false, format: 'png', fromSurface: true })
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
  await navigate('/product/pear-drop-statement-necklace')
  const realMobile = await evaluate(`(() => {
    const track = document.querySelector('[data-testid="mobile-gallery-track"]')
    const slide = document.querySelector('[data-testid="gallery-slide-1"]')
    const sticky = document.querySelector('[data-testid="mobile-sticky-add-to-bag"]')
    const rect = slide.getBoundingClientRect()
    return {
      name: document.querySelector('h1').textContent.trim(),
      imageCount: track.children.length,
      aspectRatio: rect.height / rect.width,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stickyDisabled: sticky.disabled,
      stickyHeight: sticky.getBoundingClientRect().height,
      prohibitedClaims: /925 silver|gold plated|anti-tarnish|hypoallergenic|warranty|certification/i.test(document.body.innerText),
    }
  })()`)
  assert(realMobile.name === 'Pear Drop Statement Necklace', 'Primary real PDP is incorrect.')
  assert(realMobile.imageCount === 3 && Math.abs(realMobile.aspectRatio - 1.2) < 0.02, 'Mobile gallery geometry is incorrect.')
  assert(realMobile.clientWidth === realMobile.scrollWidth, 'Mobile PDP has page-level overflow.')
  assert(realMobile.stickyDisabled && realMobile.stickyHeight >= 44, 'Unknown-price mobile purchase state is incorrect.')
  assert(!realMobile.prohibitedClaims, 'Unsupported product claim found.')
  const realMobileCapture = await capture('pdp-real-390x844')

  await evaluate(`document.querySelector('[data-testid="gallery-slide-1"]').click()`)
  await waitFor(`document.querySelector('[data-testid="product-lightbox"]')`, 'product lightbox')
  await evaluate(`(() => { const track = document.querySelector('[data-testid="lightbox-track"]'); track.scrollLeft = track.clientWidth; track.dispatchEvent(new Event('scroll', { bubbles: true })); })()`)
  await waitFor(`document.querySelector('[data-testid="lightbox-counter"]').textContent.includes('2 / 3')`, 'lightbox swipe count')
  const lightboxCapture = await capture('pdp-lightbox-image-2')
  await evaluate(`document.querySelector('[data-testid="lightbox-close"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="product-lightbox"]')`, 'lightbox close')

  await setViewport(1440, 1000)
  await navigate('/product/pear-drop-statement-necklace')
  const realDesktop = await evaluate(`(() => {
    const primary = document.querySelector('[data-testid="desktop-gallery-primary"]')
    const image = primary.querySelector('img')
    const mobile = document.querySelector('[data-testid="mobile-gallery-track"]')
    return {
      thumbnails: document.querySelectorAll('[data-testid^="gallery-thumbnail-"]').length,
      primaryVisible: getComputedStyle(primary).display !== 'none' && primary.getBoundingClientRect().width > 0,
      mobileHidden: getComputedStyle(mobile).display === 'none' || mobile.getBoundingClientRect().width === 0,
      renderedWidth: image.getBoundingClientRect().width,
      naturalWidth: image.naturalWidth,
      stickyHidden: getComputedStyle(document.querySelector('[data-testid="mobile-pdp-action-bar"]')).display === 'none',
      desktopDisabled: document.querySelector('[data-testid="add-to-bag"]').disabled,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })()`)
  assert(realDesktop.thumbnails === 3 && realDesktop.primaryVisible && realDesktop.mobileHidden, 'Desktop gallery mode is incorrect.')
  assert(realDesktop.renderedWidth <= realDesktop.naturalWidth, 'Desktop source image is magnified beyond its resolution.')
  assert(realDesktop.stickyHidden && realDesktop.desktopDisabled, 'Desktop purchase state is incorrect.')
  assert(realDesktop.clientWidth === realDesktop.scrollWidth, 'Desktop PDP has page-level overflow.')
  await evaluate(`document.querySelector('[data-testid="gallery-thumbnail-2"]').click()`)
  await waitFor(`document.querySelector('[data-testid="desktop-gallery-primary"] img').src.includes('/detail-01.jpg')`, 'desktop thumbnail selection')
  const realDesktopCapture = await capture('pdp-real-1440x1000')

  await setViewport(390, 844)
  await resetDemo()
  await navigate('/product/asymmetric-stone-huggies')
  const noVariantInitial = await evaluate(`(() => ({
    optionCount: document.querySelectorAll('[data-testid^="option-"]').length,
    enabled: !document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled,
  }))()`)
  assert(noVariantInitial.optionCount === 0 && noVariantInitial.enabled, 'No-variant product is not immediately purchasable.')
  await evaluate(`document.querySelector('[aria-label="Increase quantity"]').click()`)
  await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'no-variant add confirmation')
  const noVariantCart = await evaluate(`(() => {
    const stored = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.cart
    const line = stored.find((item) => item.productId === 'jg-demo-002')
    return {
      quantity: line?.quantity,
      selectionCount: line ? Object.keys(line.selection).length : -1,
      badge: document.querySelector('[data-testid="cart-badge"]').textContent.trim(),
      confirmation: document.querySelector('[data-testid="added-to-bag-sheet"]').innerText,
    }
  })()`)
  assert(noVariantCart.quantity === 2 && noVariantCart.selectionCount === 0, 'No-variant cart line is incorrect.')
  assert(noVariantCart.badge === '2' && noVariantCart.confirmation.includes('2,980'), 'No-variant quantity, badge, or total is incorrect.')

  await resetDemo()
  await navigate('/product/wave-station-ring')
  const oneVariantInitial = await evaluate(`(() => ({
    disabled: document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled,
    selected: document.querySelector('[data-testid="option-ring-size-7"]').getAttribute('aria-pressed'),
  }))()`)
  assert(oneVariantInitial.disabled && oneVariantInitial.selected === 'false', 'Required option should begin unselected.')
  await evaluate(`document.querySelector('[data-testid="option-ring-size-7"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled`, 'selected ring option')
  const selectedCapture = await capture('pdp-ring-size-selected-390x844')
  await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'variant add confirmation')
  const variantCart = await evaluate(`(() => {
    const line = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.cart.find((item) => item.productId === 'jg-demo-001')
    const confirmation = document.querySelector('[data-testid="added-to-bag-sheet"]').innerText
    return { quantity: line?.quantity, size: line?.selection?.['ring-size'], badge: document.querySelector('[data-testid="cart-badge"]').textContent.trim(), confirmation }
  })()`)
  assert(variantCart.quantity === 1 && variantCart.size === '7' && variantCart.badge === '1', 'Variant cart line is incorrect.')
  assert(variantCart.confirmation.includes('Ring Size: 7') && variantCart.confirmation.includes('1,790'), 'Selected variant or price is missing from confirmation.')
  await evaluate(`document.querySelector('[data-testid="confirmation-view-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'variant cart drawer')
  const variantDrawer = await evaluate(`document.querySelector('[data-testid="cart-line-wave-station-ring"]').innerText`)
  assert(variantDrawer.includes('Ring Size: 7') && variantDrawer.includes('1,790'), 'Selected variant or price is missing from the cart drawer.')

  await setViewport(1440, 1000)
  await resetDemo()
  await navigate('/product/asymmetric-stone-huggies')
  assert(await evaluate(`!document.querySelector('[data-testid="add-to-bag"]').disabled`), 'Desktop no-variant CTA should be enabled.')
  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'desktop add confirmation')
  await evaluate(`document.querySelector('[data-testid="confirmation-view-bag"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'desktop cart drawer')
  const desktopCart = await evaluate(`(() => {
    const text = document.querySelector('[data-testid="cart-line-asymmetric-stone-huggies"]').innerText
    return { product: text.includes('Asymmetric Stone Huggies'), price: text.includes('1,490'), quantity: text.includes('1') }
  })()`)
  assert(desktopCart.product && desktopCart.price && desktopCart.quantity, 'Desktop cart drawer contents are incorrect.')
  const cartCapture = await capture('pdp-cart-drawer-1440x1000')

  const maxVariantGroups = await evaluate(`Math.max(...[...document.querySelectorAll('[data-testid^="option-"]')].map(() => 0), 0)`)
  console.log(JSON.stringify({
    passed: true,
    primaryProduct: 'Pear Drop Statement Necklace',
    galleryImages: 3,
    lightboxSwipe: true,
    noVariantCart: true,
    oneVariantCart: true,
    multipleVariantProductPresent: maxVariantGroups > 1,
    captures: [realMobileCapture, lightboxCapture, realDesktopCapture, selectedCapture, cartCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
