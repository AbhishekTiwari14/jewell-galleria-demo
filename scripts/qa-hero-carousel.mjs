import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const debugPort = process.env.OVIA_CDP_PORT ?? '9888'
const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4179'
const outputDirectory = process.env.OVIA_QA_OUTPUT ?? join(process.cwd(), 'qa-hero-carousel')
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
]
const expectedSlides = [
  { index: '0', headline: 'THE AFTER-DARK EDIT', product: 'Brown Off Shoulder Dress', price: '₹1,199', cta: 'Shop the Dress', path: '/product/brown-off-shoulder-dress' },
  { index: '1', headline: 'SOFT STATEMENTS', product: 'Lace trimmed top', price: '₹499', cta: 'Explore Tops', path: '/product/lace-trimmed-top' },
  { index: '2', headline: 'MODERN MUSE', product: 'White One shoulder piece', price: '₹999', cta: 'Shop One-Shoulder', path: '/product/white-one-shoulder-piece' },
]
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())
const target = targets.find((item) => item.type === 'page')
if (!target) throw new Error('Could not find browser page')
const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 0
await mkdir(outputDirectory, { recursive: true })
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
async function navigate(path = '/') {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await waitFor(`document.querySelector('[data-testid="home-hero-carousel"]')`, 'hero')
  await sleep(250)
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
async function activeSlide() {
  return evaluate(`document.querySelector('[data-testid="hero-active-slide"]').dataset.slideIndex`)
}
async function capture(name) {
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
}

await send('Page.enable')
await send('Runtime.enable')

const responsive = []
for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width <= 500 })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await navigate()
  for (const slide of expectedSlides) {
    await evaluate(`document.querySelector('[data-testid="hero-indicator-${slide.index}"]').click()`)
    await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '${slide.index}'`, `slide ${slide.index}`)
    await sleep(80)
    const audit = await evaluate(`(() => {
      const hero = document.querySelector('[data-testid="home-hero-carousel"]')
      const visible = (element) => element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0
      const image = [...hero.querySelectorAll('img')].find(visible)
      const cta = innerWidth < 640
        ? document.querySelector('[data-testid="hero-mobile-cta"]')
        : document.querySelector('[data-testid="hero-cta"]')
      const indicators = [...document.querySelectorAll('[data-testid^="hero-indicator-"]')]
      const heroRect = hero.getBoundingClientRect()
      const imageRect = image.getBoundingClientRect()
      const ctaRect = cta.getBoundingClientRect()
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        heroHeight: heroRect.height,
        viewportHeight: innerHeight,
        headline: hero.innerText.includes(${JSON.stringify(slide.headline)}),
        product: hero.innerText.includes(${JSON.stringify(slide.product)}),
        price: hero.innerText.includes(${JSON.stringify(slide.price)}),
        ctaText: cta.innerText.trim(),
        ctaSize: { width: ctaRect.width, height: ctaRect.height },
        imageVisible: image.complete && image.naturalWidth > 0 && imageRect.width > 0 && imageRect.height > 0,
        objectPosition: getComputedStyle(image).objectPosition,
        indicatorsVisible: indicators.length === 3 && indicators.every((item) => {
          const rect = item.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && rect.bottom <= innerHeight
        }),
      }
    })()`)
    assert(audit.clientWidth === audit.scrollWidth, `${viewport.width}px slide ${slide.index}: horizontal overflow`)
    const expectedCta = viewport.width < 640 ? 'Shop Now' : slide.cta
    assert((viewport.width < 640 || audit.headline) && audit.product && audit.price && audit.ctaText === expectedCta, `${viewport.width}px slide ${slide.index}: copy mismatch`)
    assert(audit.imageVisible, `${viewport.width}px slide ${slide.index}: image not visible`)
    assert(audit.ctaSize.height >= 44 && audit.indicatorsVisible, `${viewport.width}px slide ${slide.index}: controls not comfortably usable`)
    if (viewport.width <= 430) assert(audit.heroHeight / audit.viewportHeight >= 0.65 && audit.heroHeight / audit.viewportHeight <= 0.72, `${viewport.width}px hero height outside 65–72vh range: ${audit.heroHeight / audit.viewportHeight}`)
    responsive.push({ viewport: viewport.width, slide: Number(slide.index) + 1, objectPosition: audit.objectPosition })
    if (viewport.width === 390 || viewport.width === 1440) await capture(`${viewport.width}-slide-${Number(slide.index) + 1}`)
  }
}

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
await navigate()
const autoplayStart = performance.now()
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '1'`, 'autoplay advance')
const autoplayMs = performance.now() - autoplayStart
assert(autoplayMs >= 4_500 && autoplayMs <= 5_900, `Autoplay timing outside expected range: ${autoplayMs}`)

await navigate()
await evaluate(`document.querySelector('[data-testid="hero-indicator-0"]').click()`)
await sleep(5_400)
assert(await activeSlide() === '0', 'Autoplay did not pause after clicking the active indicator')

await navigate()
const heroCenter = await evaluate(`(() => { const r=document.querySelector('[data-testid="home-hero-carousel"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/3} })()`)
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: heroCenter.x + 90, y: heroCenter.y, radiusX: 1, radiusY: 1, force: 1 }] })
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: heroCenter.x - 90, y: heroCenter.y + 2, radiusX: 1, radiusY: 1, force: 1 }] })
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '1'`, 'touch swipe')
await sleep(5_400)
assert(await activeSlide() === '1', 'Autoplay did not pause after touch interaction')

await evaluate(`document.querySelector('[data-testid="home-hero-carousel"]').focus()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '2'`, 'keyboard right')
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '1'`, 'keyboard left')

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
await navigate()
await evaluate(`document.querySelector('[data-testid="hero-next"]').click()`)
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '1'`, 'desktop next arrow')
await evaluate(`document.querySelector('[data-testid="hero-previous"]').click()`)
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '0'`, 'desktop previous arrow')

await evaluate(`document.querySelector('[data-testid="hero-indicator-1"]').click()`)
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '1'`, 'indicator click')
await evaluate(`document.querySelector('[data-testid="hero-cta"]').click()`)
await waitFor(`location.pathname === '/product/lace-trimmed-top'`, 'CTA destination')
await navigate()
await evaluate(`document.querySelector('[data-testid="hero-indicator-2"]').click()`)
await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '2'`, 'whole slide setup')
await evaluate(`document.querySelector('[data-testid="hero-slide-link"]').click()`)
await waitFor(`location.pathname === '/product/white-one-shoulder-piece'`, 'whole slide destination')

await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await navigate()
await sleep(5_400)
assert(await activeSlide() === '0', 'Autoplay continued under prefers-reduced-motion')

console.log(JSON.stringify({
  passed: true,
  responsiveAudits: responsive.length,
  viewports: viewports.map(({ width }) => width),
  autoplayMs: Math.round(autoplayMs),
  swipe: true,
  arrows: true,
  indicators: true,
  slideLink: true,
  ctaLink: true,
  keyboard: true,
  reducedMotion: true,
}, null, 2))
socket.close()
