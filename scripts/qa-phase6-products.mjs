import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase6-products')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9455
const profileDirectory = join(tmpdir(), `jewellgalleria-products-edge-${process.pid}`)
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

async function setControl(testId, value) {
  await evaluate(`(() => {
    const element = document.querySelector('[data-testid="${testId}"]')
    if (!element) throw new Error('Missing control: ${testId}')
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
}

async function click(testId) {
  await evaluate(`document.querySelector('[data-testid="${testId}"]').click()`)
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

  await navigate('/business/products')
  await setControl('product-search', 'wave station')
  await waitFor(`document.querySelectorAll('[data-testid^="business-product-"]').length === 1`, 'product search result')
  await setControl('product-category-filter', 'ring')
  await setControl('product-status-filter', 'active')
  assert(await evaluate(`document.body.innerText.includes('Wave Station Ring')`), 'Search/category/status filters lost the matching product.')
  const filtersCapture = await capture('mobile-product-filters')
  await click('clear-product-filters')

  await click('add-product')
  await waitFor(`location.pathname === '/business/products/new'`, 'Add Product editor')
  await setControl('product-name', 'Celestial Duo Ring')
  await setControl('product-category', 'ring')
  await setControl('product-price', '2490')
  await setControl('product-appearance', 'Silver-tone curves with clear station details')
  await setControl('product-description', 'A curved statement ring presented through a coordinated demo gallery.')

  await click('demo-image-wave-station-ring')
  assert(await evaluate(`document.querySelectorAll('[data-testid^="gallery-image-"]').length === 4`), 'Prepared gallery did not supply four images.')
  await click('make-primary-2')
  await click('remove-image-3')
  const galleryDraft = await evaluate(`(() => {
    const previews = [...document.querySelectorAll('[data-testid^="gallery-image-"] img')]
    return {
      count: previews.length,
      primary: new URL(previews[0].src).pathname,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(galleryDraft.count === 3 && galleryDraft.primary.endsWith('/detail-02.jpg') && !galleryDraft.overflow, 'Gallery primary/reorder/remove behavior is incorrect.')
  await evaluate(`document.querySelector('[data-testid="product-gallery-preview"]').scrollIntoView({ block: 'start', behavior: 'instant' })`)
  const galleryCapture = await capture('mobile-add-product-gallery')

  await click('add-option-group')
  for (const value of ['6', '7', '8']) {
    await setControl('product-option-value-0', value)
    await click('add-option-value-0')
  }
  await click('add-option-group')
  assert(await evaluate(`document.querySelector('[data-testid="product-option-name-1"]').value === 'Finish'`), 'The second flexible option group was not created as Finish.')
  for (const value of ['Gold', 'Silver']) {
    await setControl('product-option-value-1', value)
    await click('add-option-value-1')
  }
  await waitFor(`document.querySelectorAll('[data-testid="variant-inventory"] input').length === 6`, 'six generated stock combinations')
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const inputs = [...document.querySelectorAll('[data-testid="variant-inventory"] input')]
    inputs.forEach((input, index) => {
      setter.call(input, String(index + 5))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    document.querySelector('[data-testid="variant-groups"]').scrollIntoView({ block: 'start', behavior: 'instant' })
  })()`)
  const variantsCapture = await capture('mobile-add-product-variants')

  await click('save-product')
  await waitFor(`location.pathname.startsWith('/business/products/jg-created-')`, 'created product editor')
  await sleep(300)
  const created = await evaluate(`(() => {
    const persisted = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state
    const product = persisted.createdProducts.find((item) => item.catalogueName === 'Celestial Duo Ring')
    const stockKeys = Object.keys(persisted.inventoryByVariant).filter((key) => key.startsWith(product.id + ':'))
    return {
      id: product.id,
      slug: product.slug,
      images: product.images,
      optionNames: product.variantOptions.map((option) => option.name),
      optionValues: product.variantOptions.map((option) => option.values),
      publicationStatus: product.publicationStatus,
      isDemoProduct: product.isDemoProduct,
      stockKeys,
      stockValues: stockKeys.map((key) => persisted.inventoryByVariant[key]).sort((a, b) => a - b),
    }
  })()`)
  assert(created.images.length === 3 && created.images[0].endsWith('/detail-02.jpg'), 'Saved gallery order is incorrect.')
  assert(JSON.stringify(created.optionNames) === JSON.stringify(['Ring Size', 'Finish']), 'Saved flexible option groups are incorrect.')
  assert(created.optionValues[0].length === 3 && created.optionValues[1].length === 2 && created.stockKeys.length === 6, 'Variant combinations were not persisted.')
  assert(JSON.stringify(created.stockValues) === JSON.stringify([5, 6, 7, 8, 9, 10]), 'Per-combination stock is incorrect.')
  assert(created.publicationStatus === 'active' && created.isDemoProduct === true, 'The created product status or demo marker is incorrect.')

  await navigate('/business/products')
  await setControl('product-search', 'Celestial Duo Ring')
  await waitFor(`document.querySelectorAll('[data-testid^="business-product-"]').length === 1`, 'created product in Products')
  const productList = await evaluate(`(() => {
    const card = document.querySelector('[data-testid="business-product-celestial-duo-ring"]')
    return {
      text: card.innerText,
      image: new URL(card.querySelector('img').src).pathname,
    }
  })()`)
  assert(productList.text.includes('Active') && productList.image.endsWith('/detail-02.jpg'), 'Products list did not use images[0] or show Active status.')
  const createdListCapture = await capture('mobile-products-created')

  await navigate(`/business/inventory?product=${created.id}`)
  await waitFor(`document.querySelector('[data-testid="inventory-editor"]').innerText.includes('Celestial Duo Ring')`, 'created product in Inventory')
  const inventoryAudit = await evaluate(`(() => {
    const editor = document.querySelector('[data-testid="inventory-editor"]')
    return {
      selectionButtons: editor.querySelectorAll('[data-testid^="inventory-variant-"]').length,
      text: editor.innerText,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(inventoryAudit.selectionButtons === 6 && inventoryAudit.text.includes('Ring Size: 6') && inventoryAudit.text.includes('Finish: Gold') && !inventoryAudit.overflow, 'Inventory did not receive the generated variant combinations.')
  const inventoryCapture = await capture('mobile-inventory-created')

  await navigate('/')
  await waitFor(`document.querySelector('a[href="/product/${created.slug}"]')`, 'created product on Storefront')
  await evaluate(`document.querySelector('a[href="/product/${created.slug}"]').scrollIntoView({ block: 'center', behavior: 'instant' })`)
  const storefrontCard = await evaluate(`(() => {
    const link = document.querySelector('a[href="/product/${created.slug}"]')
    const image = link.querySelector('img')
    return { image: new URL(image.src).pathname, visible: link.getBoundingClientRect().top < innerHeight }
  })()`)
  assert(storefrontCard.visible && storefrontCard.image.endsWith('/detail-02.jpg'), 'Active product did not appear on Storefront with its primary image.')
  const storefrontCapture = await capture('mobile-storefront-created')

  await navigate(`/product/${created.slug}`)
  const pdp = await evaluate(`(() => ({
    title: document.querySelector('h1').textContent,
    slides: document.querySelectorAll('[data-testid^="gallery-slide-"]').length,
    ringValues: document.querySelectorAll('[data-testid^="option-ring-size-"]').length,
    finishValues: document.querySelectorAll('[data-testid^="option-finish-"]').length,
    addDisabled: document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))()`)
  assert(pdp.title.includes('Celestial Duo Ring') && pdp.slides === 3 && pdp.ringValues === 3 && pdp.finishValues === 2 && pdp.addDisabled && !pdp.overflow, 'Created product PDP is incomplete.')
  await click('gallery-slide-1')
  await waitFor(`document.querySelector('[data-testid="product-lightbox"]')`, 'created gallery lightbox')
  assert(await evaluate(`document.querySelector('[data-testid="lightbox-counter"]').textContent.trim() === '1 / 3'`), 'PDP lightbox count is incorrect.')
  await click('lightbox-close')
  await click('option-ring-size-7')
  await click('option-finish-Gold')
  assert(!(await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled`)), 'PDP Add to Bag did not activate after both option selections.')
  const pdpCapture = await capture('mobile-pdp-created')

  await send('Page.reload')
  await waitFor(`document.readyState === 'complete' && document.querySelector('h1')?.textContent.includes('Celestial Duo Ring')`, 'PDP persistence after refresh')
  const persistedAfterRefresh = await evaluate(`JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.createdProducts.some((item) => item.id === ${JSON.stringify(created.id)})`)
  assert(persistedAfterRefresh, 'Created product did not persist after refresh.')

  await navigate(`/business/products/${created.id}`)
  await click('product-status-draft')
  await click('save-product')
  await waitFor(`JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.createdProducts.find((item) => item.id === ${JSON.stringify(created.id)}).publicationStatus === 'draft'`, 'draft save')
  await navigate('/')
  assert(!(await evaluate(`Boolean(document.querySelector('a[href="/product/${created.slug}"]'))`)), 'Draft product appeared on Storefront.')
  await send('Page.navigate', { url: `${appUrl}/product/${created.slug}` })
  await waitFor(`location.pathname === '/'`, 'draft PDP redirect')

  await navigate(`/business/products/${created.id}`)
  await click('product-status-active')
  await click('save-product')
  await waitFor(`JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.createdProducts.find((item) => item.id === ${JSON.stringify(created.id)}).publicationStatus === 'active'`, 'active restore')

  await setViewport(1440, 1000)
  await navigate('/business/products')
  await setControl('product-search', 'Celestial Duo Ring')
  const desktopAudit = await evaluate(`(() => ({
    productVisible: Boolean(document.querySelector('[data-testid="business-product-celestial-duo-ring"]')),
    controls: ['product-search', 'product-category-filter', 'product-status-filter'].every((id) => document.querySelector('[data-testid="' + id + '"]').getBoundingClientRect().height >= 44),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))()`)
  assert(desktopAudit.productVisible && desktopAudit.controls && !desktopAudit.overflow, 'Desktop Products layout is incorrect.')
  const desktopCapture = await capture('desktop-products-created')

  await evaluate(`document.querySelector('[aria-label="Reset all simulated business data"]').click()`)
  await waitFor(`JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.createdProducts.length === 0`, 'Reset Demo')
  assert(!(await evaluate(`document.body.innerText.includes('Celestial Duo Ring')`)), 'Reset Demo did not remove the created product from Products.')
  await navigate('/')
  assert(!(await evaluate(`Boolean(document.querySelector('a[href="/product/${created.slug}"]'))`)), 'Reset Demo did not remove the created product from Storefront.')

  console.log(JSON.stringify({
    passed: true,
    product: 'Celestial Duo Ring',
    galleryImages: 3,
    primaryImage: created.images[0],
    optionGroups: created.optionNames,
    generatedStockCombinations: created.stockKeys.length,
    productsList: true,
    inventory: true,
    storefront: true,
    pdpGallery: true,
    refreshPersistence: true,
    draftVisibility: true,
    resetDemo: true,
    mobileViewport: '390x844',
    desktopViewport: '1440x1000',
    captures: [filtersCapture, galleryCapture, variantsCapture, createdListCapture, inventoryCapture, storefrontCapture, pdpCapture, desktopCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
