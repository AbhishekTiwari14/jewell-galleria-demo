const debugPort = process.env.OVIA_CDP_PORT ?? '9777'
const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4178'
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
  const expectedPath = new URL(path, appUrl).pathname
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(expectedPath)}`, path)
  await sleep(300)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function setInput(testId, value) {
  await evaluate(`(() => {
    const input = document.querySelector('[data-testid=${JSON.stringify(testId)}]')
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await navigate('/business/products')
await evaluate(`localStorage.removeItem('ovia-demo:v1'); location.reload()`)
await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="add-product"]')`, 'fresh products')

assert(await evaluate(`document.body.innerText.toLowerCase().includes('demo mode') && document.body.innerText.includes('Simulated business data')`), 'Demo disclosure missing')
await evaluate(`document.querySelector('[data-testid="add-product"]').click()`)
await waitFor(`location.pathname === '/business/products/new'`, 'new product route')

await evaluate(`document.querySelector('[data-testid="save-product"]').click()`)
await waitFor(`document.querySelector('[data-testid="product-form-errors"]')`, 'validation feedback')

await setInput('product-name', 'Brown Top')
await setInput('product-price', '699')
await setInput('product-description', 'A polished demo top with an easy modern silhouette.')
await evaluate(`document.querySelector('[data-testid="demo-image-lace-trimmed-top"]').click()`)

for (const color of ['Red', 'Black']) {
  await setInput('product-color', color)
  await evaluate(`document.querySelector('[data-testid="add-color"]').click()`)
}
for (const size of ['S', 'M']) {
  await evaluate(`document.querySelector('[data-testid="toggle-size-${size}"]').click()`)
}

for (const [variant, quantity] of [['Red-S', '4'], ['Red-M', '7'], ['Black-S', '3'], ['Black-M', '5']]) {
  await setInput(`stock-${variant}`, quantity)
}

assert(await evaluate(`document.querySelectorAll('[data-testid="variant-inventory"] input').length === 4`), 'Variant matrix is not 2 colors × 2 sizes')
await evaluate(`document.querySelector('[data-testid="save-product"]').click()`)
await sleep(500)
const saveDiagnostic = await evaluate(`({
  path: location.pathname,
  errors: document.querySelector('[data-testid="product-form-errors"]')?.innerText,
  name: document.querySelector('[data-testid="product-name"]')?.value,
  price: document.querySelector('[data-testid="product-price"]')?.value,
  description: document.querySelector('[data-testid="product-description"]')?.value,
  colors: document.querySelector('[data-testid="selected-colors"]')?.innerText,
  sizes: document.querySelector('[data-testid="selected-sizes"]')?.innerText,
  variants: document.querySelectorAll('[data-testid="variant-inventory"] input').length,
})`)
if (saveDiagnostic.path === '/business/products/new') {
  throw new Error(`Product save remained on form: ${JSON.stringify(saveDiagnostic)}`)
}
await waitFor(`location.pathname.startsWith('/business/products/ovia-demo-')`, 'saved edit page')
await waitFor(`document.querySelector('[data-testid="product-name"]')?.value === 'Brown Top'`, 'saved product editor')
await waitFor(`document.querySelector('[data-testid="product-success-toast"]')`, 'product success feedback')
const productId = await evaluate(`location.pathname.split('/').at(-1)`)

await navigate('/business/products')
assert(await evaluate(`document.querySelector('[data-testid="business-product-brown-top"]')?.innerText.includes('19 units')`), 'Product list missing created product or total stock')
await evaluate(`document.querySelector('[data-testid="open-business-product-brown-top"]').click()`)
await waitFor(`location.pathname === '/business/products/${productId}'`, 'created product detail')
assert(await evaluate(`document.querySelector('[data-testid="product-name"]').value === 'Brown Top'`), 'Created product did not open its edit screen')

await navigate(`/business/inventory?product=${productId}`)
assert(await evaluate(`document.body.innerText.includes('Brown Top') && document.querySelector('[data-testid="inventory-color-Red"]') && document.querySelector('[data-testid="inventory-quantity"]').value === '4'`), 'Created product variants missing from inventory')

await navigate('/')
assert(await evaluate(`document.body.innerText.includes('Just Added') && Boolean(document.querySelector('a[href="/product/brown-top"]'))`), 'Active created product missing from storefront')
await evaluate(`document.querySelector('a[href="/product/brown-top"]').click()`)
await waitFor(`location.pathname === '/product/brown-top'`, 'created PDP')
assert(await evaluate(`document.body.innerText.includes('Brown Top') && document.body.innerText.includes('₹699')`), 'Created PDP is inaccurate')

await navigate('/business/products')
assert(await evaluate(`Boolean(document.querySelector('[data-testid="business-product-brown-top"]'))`), 'Created product did not persist after refresh')
const persisted = await evaluate(`(() => {
  const state = JSON.parse(localStorage.getItem('ovia-demo:v1')).state
  return {
    count: state.createdProducts.length,
    redS: state.inventoryByVariant[${JSON.stringify(`${productId}:Red:S`)}],
    redM: state.inventoryByVariant[${JSON.stringify(`${productId}:Red:M`)}],
    blackS: state.inventoryByVariant[${JSON.stringify(`${productId}:Black:S`)}],
    blackM: state.inventoryByVariant[${JSON.stringify(`${productId}:Black:M`)}],
  }
})()`)
assert(persisted.count === 1 && persisted.redS === 4 && persisted.redM === 7 && persisted.blackS === 3 && persisted.blackM === 5, `Persistence mismatch: ${JSON.stringify(persisted)}`)

await evaluate(`document.querySelector('[aria-label="Reset all simulated business data"]').click()`)
await sleep(250)
assert(await evaluate(`!document.querySelector('[data-testid="business-product-brown-top"]') && document.body.innerText.includes('10 active products')`), 'Reset did not restore original products list')
const resetState = await evaluate(`(() => {
  const state = JSON.parse(localStorage.getItem('ovia-demo:v1')).state
  return { createdProducts: state.createdProducts.length, createdVariant: Object.keys(state.inventoryByVariant).some((key) => key.startsWith('ovia-demo-')) }
})()`)
assert(resetState.createdProducts === 0 && !resetState.createdVariant, `Reset retained created data: ${JSON.stringify(resetState)}`)

await navigate('/')
assert(await evaluate(`!document.body.innerText.includes('Just Added') && !document.querySelector('a[href="/product/brown-top"]')`), 'Reset did not remove created product from storefront')

console.log(JSON.stringify({
  passed: true,
  product: 'Brown Top',
  variants: persisted,
  productsList: true,
  inventory: true,
  storefront: true,
  editScreen: true,
  persistence: true,
  reset: true,
  viewport: '390x844',
}, null, 2))
socket.close()
