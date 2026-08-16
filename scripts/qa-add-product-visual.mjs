const debugPort = process.env.OVIA_CDP_PORT ?? '9777'
const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4178'
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
]
const routes = ['/business/products', '/business/products/new']
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())
const target = targets.find((item) => item.type === 'page')
if (!target) throw new Error('Could not find browser page')
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
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

await send('Page.enable')
await send('Runtime.enable')
const results = []
for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width <= 500 })
  for (const route of routes) {
    await send('Page.navigate', { url: `${appUrl}${route}` })
    await sleep(700)
    const result = await evaluate(`(() => ({
      path: location.pathname,
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src),
      disclosure: document.body.innerText.toLowerCase().includes('demo mode') && document.body.innerText.includes('Simulated business data'),
      addButton: ${JSON.stringify(route)} !== '/business/products' || Boolean(document.querySelector('[data-testid="add-product"]')),
      form: ${JSON.stringify(route)} !== '/business/products/new' || Boolean(document.querySelector('[data-testid="save-product"]')),
    }))()`)
    assert(result.path === route, `${viewport.width}px ${route}: wrong route ${result.path}`)
    assert(result.width === result.scrollWidth, `${viewport.width}px ${route}: horizontal overflow ${result.width}/${result.scrollWidth}`)
    assert(result.brokenImages.length === 0, `${viewport.width}px ${route}: broken images`)
    assert(result.disclosure && result.addButton && result.form, `${viewport.width}px ${route}: required UI missing`)
    results.push({ viewport: viewport.width, route, passed: true })
  }
}
console.log(JSON.stringify({ passed: true, audits: results }, null, 2))
socket.close()
