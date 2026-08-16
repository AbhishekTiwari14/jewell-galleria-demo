import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4181'
const debugPort = process.env.OVIA_CDP_PORT ?? '9890'
const outputDirectory = join(process.cwd(), 'dist', 'qa-mobile-first')
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
]
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

await mkdir(outputDirectory, { recursive: true })
let target
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())
    target = targets.find((item) => item.type === 'page')
    if (target) break
  } catch {
    // The local browser may still be opening.
  }
  await sleep(200)
}
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
async function navigate(path) {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`, path)
  await sleep(280)
}
async function reset() {
  await navigate('/')
  await evaluate(`localStorage.removeItem('ovia-demo:v1'); sessionStorage.clear(); location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 'demo reset')
  await sleep(300)
}
async function capture(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(result.data, 'base64'))
}
async function captureFull(name) {
  const dimensions = await evaluate(`({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })`)
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 },
  })
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(result.data, 'base64'))
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })

const responsive = []
for (const viewport of viewports) {
  await setViewport(viewport)
  await reset()
  const audit = await evaluate(`(() => {
    const hero = document.querySelector('[data-testid="home-hero-carousel"]')
    const slide = document.querySelector('[data-testid="hero-active-slide"]')
    const visible = (element) => element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0
    const image = [...slide.querySelectorAll('img')].find(visible)
    const cta = innerWidth < 640
      ? document.querySelector('[data-testid="hero-mobile-cta"]')
      : document.querySelector('[data-testid="hero-cta"]')
    const categories = document.querySelector('#category-title').parentElement.parentElement.querySelectorAll('a')
    const mobile = innerWidth < 1024
    const menu = document.querySelector('[data-testid="mobile-menu-trigger"]')
    const search = document.querySelector('[data-testid="mobile-search-trigger"]')
    const mobileBag = document.querySelector('[data-testid="header-bag-button"]')
    const desktopBusiness = document.querySelector('[data-testid="desktop-business-preview"]')
    const rect = (element) => element.getBoundingClientRect()
    const firstCategory = categories[0]
    const newArrivalImage = document.querySelector('#new-arrivals article img')
    const editorialImage = document.querySelector('#one-shoulder-edit article img')
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportHeight: innerHeight,
      heroRatio: rect(hero).height / innerHeight,
      imageRatio: rect(image).height / rect(hero).height,
      ctaHeight: rect(cta).height,
      ctaText: cta.innerText.trim(),
      imageLoaded: image.complete && image.naturalWidth > 0,
      indicators: [...document.querySelectorAll('[data-testid^="hero-indicator-"]')].every((item) => rect(item).height >= 44),
      mobileControls: mobile ? [menu, search, mobileBag].every(visible) : !visible(menu) && !visible(search),
      businessEntry: mobile ? !visible(desktopBusiness) : visible(desktopBusiness),
      categoryCards: categories.length,
      categoryCardsVisible: innerWidth / (rect(firstCategory).width + 12),
      newArrivalAspect: rect(newArrivalImage).width / rect(newArrivalImage).height,
      newArrivalHeight: rect(newArrivalImage).height,
      editorialAspect: rect(editorialImage).width / rect(editorialImage).height,
      editorialHeight: rect(editorialImage).height,
      mobileHeroIsMinimal: innerWidth >= 640 || (![...slide.querySelectorAll('h1')].some(visible) && cta.innerText.includes('Shop Now')),
      reveal: Boolean(document.querySelector('[data-testid="business-reveal-section"]')),
      floatingPillVisible: visible(document.querySelector('[data-testid="business-discovery-pill"]')),
      brokenImages: [...document.images].filter((item) => item.complete && item.naturalWidth === 0).length,
    }
  })()`)
  assert(audit.width === audit.scrollWidth, `${viewport.width}px homepage has horizontal overflow`)
  assert(audit.imageLoaded && audit.brokenImages === 0, `${viewport.width}px homepage has a broken image`)
  assert(audit.ctaHeight >= 44 && audit.indicators, `${viewport.width}px hero controls are too small`)
  assert(audit.mobileControls && audit.businessEntry, `${viewport.width}px responsive header is incorrect`)
  assert(audit.categoryCards >= 4 && audit.reveal, `${viewport.width}px discovery content is incomplete`)
  if (viewport.width <= 430) {
    assert(audit.heroRatio >= 0.65 && audit.heroRatio <= 0.72, `${viewport.width}px hero is not 65–72vh (${audit.heroRatio.toFixed(3)})`)
    assert(audit.imageRatio >= 0.98 && audit.mobileHeroIsMinimal, `${viewport.width}px hero is not a dedicated minimal image composition`)
    assert(audit.categoryCardsVisible >= 2.05 && audit.categoryCardsVisible <= 2.45, `${viewport.width}px category rail does not show roughly 2.1–2.4 cards`)
    assert(audit.newArrivalAspect >= 0.79 && audit.newArrivalAspect <= 0.81 && audit.newArrivalHeight < audit.viewportHeight * 0.4, `${viewport.width}px New Arrivals cards are too tall`)
    assert(audit.editorialAspect >= 0.79 && audit.editorialAspect <= 0.81 && audit.editorialHeight < audit.viewportHeight * 0.7, `${viewport.width}px editorial feature is too tall`)
    assert(!audit.floatingPillVisible, `${viewport.width}px floating pill obstructs the mobile storefront`)
  }

  if (viewport.width < 1024) {
    await evaluate(`document.querySelector('[data-testid="mobile-menu-trigger"]').click()`)
    await waitFor(`document.querySelector('[data-testid="mobile-drawer-business-preview"]')`, 'mobile navigation')
    const menuAudit = await evaluate(`(() => {
      const link = document.querySelector('[data-testid="mobile-drawer-business-preview"]')
      const text = document.body.innerText
      const rect = link.getBoundingClientRect()
      return { visible: rect.width > 0 && rect.height > 0, target: link.getAttribute('href'), labels: ['New Arrivals', 'Dresses', 'Tops', 'Kurtis'].every((label) => text.includes(label)) }
    })()`)
    assert(menuAudit.visible && menuAudit.target === '/business' && menuAudit.labels, `${viewport.width}px mobile navigation is incomplete`)
    if (viewport.width === 390) await capture('390-mobile-navigation')
    await evaluate(`document.querySelector('[aria-label="Close navigation"]').click()`)
    await waitFor(`!document.querySelector('[data-testid="mobile-drawer-business-preview"]')`, 'mobile navigation close')

    await evaluate(`document.querySelector('[data-testid="mobile-search-trigger"]').click()`)
    await waitFor(`document.querySelector('[data-testid="customer-search-input"]')`, 'search sheet')
    const searchAudit = await evaluate(`(() => { const input=document.querySelector('[data-testid="customer-search-input"]'); return {height:input.closest('label').getBoundingClientRect().height, focused:document.activeElement===input} })()`)
    assert(searchAudit.height >= 48 && searchAudit.focused, `${viewport.width}px mobile search is not touch-ready`)
    await evaluate(`(() => { const input=document.querySelector('[data-testid="customer-search-input"]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'Brown'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
    await waitFor(`document.querySelector('a[href="/product/brown-off-shoulder-dress"]')`, 'Brown Dress search result')
    if (viewport.width === 390) await capture('390-search')
    await evaluate(`document.querySelector('[aria-label="Close search"]').click()`)
  }
  await capture(`${viewport.width}-home`)
  if (viewport.width === 390) {
    for (let index = 0; index < 3; index += 1) {
      await evaluate(`document.querySelector('[data-testid="hero-indicator-${index}"]').click()`)
      await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '${index}'`, `mobile hero slide ${index + 1}`)
      await sleep(120)
      await capture(`390-hero-slide-${index + 1}`)
    }
    for (const [name, selector] of [
      ['categories', '#category-title'],
      ['new-arrivals', '#new-arrivals'],
      ['one-shoulder-edit', '#one-shoulder-edit'],
      ['tops', '#tops'],
      ['corset-edit', '#corset-edit'],
      ['business-reveal', '[data-testid="business-reveal-section"]'],
    ]) {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'start', behavior: 'instant' })`)
      await sleep(220)
      await capture(`390-${name}`)
    }
    await captureFull('390-home-full')
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  } else if (viewport.width <= 430) {
    const pageHeight = await evaluate(`document.documentElement.scrollHeight`)
    for (let y = 0; y < pageHeight; y += 700) {
      await evaluate(`window.scrollTo({ top: ${y}, behavior: 'instant' })`)
      await sleep(45)
    }
    await captureFull(`${viewport.width}-home-full`)
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  }
  responsive.push({ viewport: viewport.width, ...audit })

  if (viewport.width <= 430) {
    await navigate('/product/brown-off-shoulder-dress')
    const phonePdp = await evaluate(`(() => {
      const image=document.querySelector('img[alt="Brown Off Shoulder Dress"]')
      const imageRect=image.getBoundingClientRect()
      const sticky=document.querySelector('[data-testid="mobile-pdp-action-bar"]')
      const sizeS=document.querySelector('[data-testid="size-S"]')
      return {
        width:document.documentElement.clientWidth,
        scrollWidth:document.documentElement.scrollWidth,
        imageLeft:imageRect.left,
        imageRight:imageRect.right,
        imageHeight:imageRect.height,
        viewportHeight:innerHeight,
        stickyVisible:sticky.getBoundingClientRect().height>0,
        stickyDisabled:document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled,
        sizeTarget:sizeS.getBoundingClientRect().height,
      }
    })()`)
    assert(phonePdp.width === phonePdp.scrollWidth && phonePdp.imageLeft === 0 && phonePdp.imageRight === phonePdp.width, `${viewport.width}px PDP image is not deliberately full width`)
    assert(phonePdp.imageHeight < phonePdp.viewportHeight * 0.65 && phonePdp.stickyVisible && phonePdp.stickyDisabled && phonePdp.sizeTarget >= 44, `${viewport.width}px PDP mobile composition failed`)
    await capture(`${viewport.width}-pdp-top`)
  }
}

await setViewport({ width: 390, height: 844 })
await reset()
await evaluate(`document.querySelector('[data-testid="hero-mobile-cta"]').click()`)
await waitFor(`location.pathname === '/product/brown-off-shoulder-dress'`, 'Brown Dress PDP from home')
await sleep(280)
let pdp = await evaluate(`(() => {
  const bar=document.querySelector('[data-testid="mobile-pdp-action-bar"]')
  const button=document.querySelector('[data-testid="mobile-sticky-add-to-bag"]')
  const image=document.querySelector('img[alt="Brown Off Shoulder Dress"]')
  return {width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,barVisible:bar.getBoundingClientRect().height>0,buttonHeight:button.getBoundingClientRect().height,disabled:button.disabled,text:document.body.innerText,imageFit:getComputedStyle(image).objectFit}
})()`)
assert(pdp.width === pdp.scrollWidth && pdp.barVisible && pdp.buttonHeight >= 48, '390px PDP sticky action failed')
assert(pdp.disabled && pdp.text.includes('Brown Off Shoulder Dress') && pdp.text.includes('₹1,199') && pdp.imageFit === 'contain', '390px PDP initial state/data failed')
await evaluate(`document.querySelector('[data-testid="size-S"]').click()`)
pdp = await evaluate(`({s:document.querySelector('[data-testid="size-S"]').getAttribute('aria-pressed'),m:document.querySelector('[data-testid="size-M"]').getAttribute('aria-pressed'),disabled:document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled,status:document.querySelector('[data-testid="mobile-pdp-action-bar"]').innerText})`)
assert(pdp.s === 'true' && pdp.m === 'false' && !pdp.disabled && pdp.status.includes('Size S'), 'Size S did not activate the sticky CTA correctly')
await capture('390-pdp-size-s')
await evaluate(`document.querySelector('[data-testid="size-S"]').scrollIntoView({ block: 'center', behavior: 'instant' })`)
await sleep(180)
const selectedStyle = await evaluate(`(() => { const size=document.querySelector('[data-testid="size-S"]'); const style=getComputedStyle(size); return {background:style.backgroundColor,color:style.color,barBottom:document.querySelector('[data-testid="mobile-pdp-action-bar"]').getBoundingClientRect().bottom,viewportHeight:innerHeight} })()`)
assert(selectedStyle.background === 'rgb(166, 79, 140)' && selectedStyle.color === 'rgb(255, 255, 255)' && selectedStyle.barBottom === selectedStyle.viewportHeight, 'Selected size styling or sticky placement is incorrect')
await capture('390-pdp-variant-controls')
await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').click()`)
await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'added confirmation')
const confirmation = await evaluate(`(() => { const sheet=document.querySelector('[data-testid="added-to-bag-sheet"]'); return {text:sheet.innerText,badge:document.querySelector('[data-testid="cart-badge"]').textContent.trim()} })()`)
assert(confirmation.text.includes('Brown Off Shoulder Dress') && confirmation.text.includes('Size S') && confirmation.text.includes('₹1,199') && confirmation.badge === '1', 'Added confirmation is inaccurate')
await capture('390-pdp-added')
await evaluate(`document.querySelector('[aria-label="Close confirmation"]').click()`)
await waitFor(`!document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'confirmation close')
await evaluate(`document.querySelector('[data-testid="header-bag-button"]').click()`)
await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'mobile bag')
const drawer = await evaluate(`(() => { const drawer=document.querySelector('[data-testid="cart-drawer"]'); const rect=drawer.getBoundingClientRect(); return {text:drawer.innerText,bottom:rect.bottom,height:rect.height,width:rect.width,viewportHeight:innerHeight,viewportWidth:innerWidth} })()`)
assert(drawer.text.includes('Brown Off Shoulder Dress') && drawer.text.includes('Size S') && drawer.text.includes('₹1,199') && drawer.bottom === drawer.viewportHeight && drawer.height <= drawer.viewportHeight * 0.93 && drawer.width === drawer.viewportWidth, 'Mobile bag sheet is incorrect')
await capture('390-cart-drawer')
await evaluate(`document.querySelector('[data-testid="cart-drawer"] a[href="/cart"]').click()`)
await waitFor(`location.pathname === '/cart'`, 'cart page')
const cart = await evaluate(`({text:document.body.innerText,width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('button')].filter((item)=>item.getBoundingClientRect().width>0).every((item)=>item.getBoundingClientRect().height>=44)})`)
assert(cart.width === cart.scrollWidth && cart.text.includes('Size S') && cart.text.includes('₹1,199') && cart.targets, 'Mobile cart is incorrect')
await capture('390-cart')
await evaluate(`document.querySelector('main a[href="/checkout"]').click()`)
await waitFor(`location.pathname === '/checkout'`, 'checkout')
const checkout = await evaluate(`({text:document.body.innerText,width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,buttonHeight:document.querySelector('[data-testid="place-demo-order"]').getBoundingClientRect().height})`)
assert(checkout.width === checkout.scrollWidth && checkout.text.includes('Size S') && checkout.text.includes('₹1,199') && checkout.buttonHeight >= 48, 'Mobile checkout is incorrect')
await capture('390-checkout')

await reset()
await evaluate(`document.querySelector('[data-testid="mobile-menu-trigger"]').click()`)
await waitFor(`document.querySelector('[data-testid="mobile-drawer-business-preview"]')`, 'business preview link')
await evaluate(`document.querySelector('[data-testid="mobile-drawer-business-preview"]').click()`)
await waitFor(`location.pathname === '/business'`, 'business route')
await waitFor(`document.body.innerText.includes('DEMO MODE') && document.body.innerText.includes('Simulated business data')`, 'business demo disclosure')
assert(await evaluate(`document.body.innerText.includes('DEMO MODE') && document.body.innerText.includes('Simulated business data')`), 'Business discovery reached an unlabelled screen')

console.log(JSON.stringify({ passed: true, responsive, journey: { product: 'Brown Off Shoulder Dress', size: 'S', price: '₹1,199', cart: true, checkout: true, businessDiscovery: true } }, null, 2))
socket.close()
