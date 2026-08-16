import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4177'
const debugPort = process.env.OVIA_CDP_PORT ?? '9566'
const outputDirectory = join(process.cwd(), 'qa-storefront-upgrade')
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
]
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

await mkdir(outputDirectory, { recursive: true })
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
async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(60)
  }
  throw new Error(`Timed out waiting for ${label}`)
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
async function setViewport({ width, height }) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 500 })
}
async function navigate(path = '/') {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await sleep(300)
}
async function reset() {
  await navigate('/')
  await evaluate(`localStorage.removeItem('ovia-demo:v1'); location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 'demo reset')
  await sleep(250)
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
async function loadFullPageImages() {
  const pageHeight = await evaluate(`document.documentElement.scrollHeight`)
  for (let y = 0; y < pageHeight; y += 700) {
    await evaluate(`window.scrollTo({ top: ${y}, behavior: 'instant' })`)
    await sleep(90)
  }
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  await sleep(350)
}

await send('Page.enable')
await send('Runtime.enable')

const responsiveAudits = []
for (const viewport of viewports) {
  await setViewport(viewport)
  await reset()
  const homeAudit = await evaluate(`(() => {
    const requiredTitles = ['New Arrivals', 'The One-Shoulder Edit', 'Tops We’re Loving', 'The Corset Edit']
    const brokenImages = [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length
    const quickAdds = [...document.querySelectorAll('[data-testid^="quick-add-"]')]
    const header = document.querySelector('header')
    const headingStyles = [...document.querySelectorAll('h2')].map((heading) => getComputedStyle(heading).fontFamily)
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      titles: requiredTitles.every((title) => document.body.innerText.includes(title)),
      brokenImages,
      quickAddCount: quickAdds.length,
      mobileTapTargets: quickAdds.every((button) => button.getBoundingClientRect().height >= 44),
      headerState: header.dataset.headerState,
      serifTitles: headingStyles.every((family) => /Cormorant|Iowan|Baskerville|Times/i.test(family)),
    }
  })()`)
  assert(homeAudit.clientWidth === homeAudit.scrollWidth, `${viewport.width}px homepage overflow`)
  assert(homeAudit.titles && homeAudit.brokenImages === 0, `${viewport.width}px homepage content/image failure`)
  assert(homeAudit.quickAddCount >= 10 && homeAudit.mobileTapTargets, `${viewport.width}px quick-add controls incomplete`)
  assert(homeAudit.headerState === 'integrated' && homeAudit.serifTitles, `${viewport.width}px header/type system failure`)

  await evaluate(`window.scrollTo(0, 700)`)
  await sleep(350)
  assert(await evaluate(`document.querySelector('header').dataset.headerState === 'solid'`), `${viewport.width}px sticky header did not become solid`)

  await navigate('/product/brown-off-shoulder-dress')
  const pdpAudit = await evaluate(`(() => {
    const image = document.querySelector('main img[alt="Brown Off Shoulder Dress"]')
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      imageFit: getComputedStyle(image).objectFit,
      disabled: document.querySelector('[data-testid="add-to-bag"]').disabled,
    }
  })()`)
  assert(pdpAudit.clientWidth === pdpAudit.scrollWidth && pdpAudit.imageFit === 'contain' && pdpAudit.disabled, `${viewport.width}px PDP audit failed`)
  responsiveAudits.push({ width: viewport.width, home: homeAudit, pdp: pdpAudit })

  await navigate('/')
  await loadFullPageImages()
  assert(await evaluate(`[...document.images].every((image) => image.complete && image.naturalWidth > 0)`), `${viewport.width}px images did not load during full-page review`)
  await capture(`${viewport.width}-home-full`, true)
}

await setViewport({ width: 1280, height: 900 })
await send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'pointer', value: 'fine' }, { name: 'hover', value: 'hover' }] })
await reset()
await evaluate(`document.querySelector('[data-testid="quick-add-brown-off-shoulder-dress"]').closest('article').scrollIntoView({ block: 'center', behavior: 'instant' })`)
await sleep(450)
const quickAdd = await evaluate(`(() => {
  const button = document.querySelector('[data-testid="quick-add-brown-off-shoulder-dress"]')
  const article = button.closest('article')
  const rect = article.getBoundingClientRect()
  const buttonRect = button.getBoundingClientRect()
  return { article: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, point: { x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + buttonRect.height / 2 }, opacity: getComputedStyle(button).opacity }
})()`)
assert(quickAdd.opacity === '0', 'Desktop quick add should be restrained before hover')
const livePoint = await evaluate(`(() => { const r=document.querySelector('[data-testid="quick-add-brown-off-shoulder-dress"]').closest('article').getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2, scrollY:window.scrollY, element:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.tagName } })()`)
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1000, y: 80 })
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: livePoint.x, y: livePoint.y })
await sleep(350)
const hovered = await evaluate(`(() => {
  const button = document.querySelector('[data-testid="quick-add-brown-off-shoulder-dress"]')
  const article = button.closest('article')
  const rect = article.getBoundingClientRect()
  const wishlist = article.querySelector('[aria-label*="wishlist"]')
  return { opacity: getComputedStyle(button).opacity, wishlistOpacity: getComputedStyle(wishlist).opacity, hovered: article.matches(':hover'), article: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
})()`)
assert(hovered.opacity === '1' && hovered.wishlistOpacity === '1', `Desktop hover controls did not appear: ${JSON.stringify({ hovered, livePoint })}`)
assert(hovered.article.width === quickAdd.article.width && hovered.article.height === quickAdd.article.height, 'Product card changed size during hover')
await evaluate(`document.querySelector('[data-testid="quick-add-brown-off-shoulder-dress"]').click()`)
await waitFor(`document.querySelector('[data-testid="quick-add-brown-off-shoulder-dress"]')?.innerText.includes('ADDED TO BAG')`, 'quick add feedback')
await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'quick add cart drawer')
const drawer = await evaluate(`(() => {
  const text = document.querySelector('[data-testid="cart-drawer"]').innerText
  return { name: text.includes('Brown Off Shoulder Dress'), size: text.includes('Size S'), price: text.includes('₹1,199'), badge: document.querySelector('[data-testid="cart-badge"]').textContent.trim() }
})()`)
assert(drawer.name && drawer.size && drawer.price && drawer.badge === '1', 'Quick Add cart contents are incorrect')
await capture('1280-quick-add-drawer')

await setViewport({ width: 390, height: 844 })
await reset()
await navigate('/product/brown-off-shoulder-dress')
await evaluate(`document.querySelector('[data-testid="size-S"]').click()`)
const sizeState = await evaluate(`({ s: document.querySelector('[data-testid="size-S"]').getAttribute('aria-pressed'), m: document.querySelector('[data-testid="size-M"]').getAttribute('aria-pressed') })`)
assert(sizeState.s === 'true' && sizeState.m === 'false', 'Size selector state is incorrect')
await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
assert((await evaluate(`document.querySelector('[data-testid="add-to-bag"]').innerText`)).includes('Adding'), 'Adding state did not appear')
await waitFor(`document.querySelector('[data-testid="add-to-bag"]')?.innerText.includes('Added to bag')`, 'PDP added state')
await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'PDP confirmation')
const confirmation = await evaluate(`(() => { const text=document.querySelector('[data-testid="added-to-bag-sheet"]').innerText; return { name:text.includes('Brown Off Shoulder Dress'), size:text.includes('Size S'), price:text.includes('₹1,199') } })()`)
assert(confirmation.name && confirmation.size && confirmation.price, 'PDP confirmation data mismatch')
await capture('390-pdp-added')

console.log(JSON.stringify({ passed: true, responsiveAudits: responsiveAudits.length, viewports: viewports.map(({ width }) => width), hover: true, quickAdd: true, stickyHeader: true, sizeAndBagStates: true, drawerCorrectness: true }, null, 2))
socket.close()
