import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-current-mobile-visual')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9460
const profileDirectory = join(tmpdir(), `jewellgalleria-mobile-visual-edge-${process.pid}`)
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]
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
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(70)
  }
  throw new Error(`Timed out waiting for ${label}.`)
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
  })
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
}

async function navigate(path) {
  const pathname = path.split('?')[0]
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(pathname)}`, path)
  await waitFor(`document.querySelector('main')`, `${path} content`)
  await sleep(250)
}

async function scrollToSelector(selector, block = 'start') {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: ${JSON.stringify(block)}, behavior: 'instant' })`)
  await sleep(180)
}

async function capture(name) {
  const result = await send('Page.captureScreenshot', { captureBeyondViewport: false, format: 'png', fromSurface: true })
  const path = join(outputDirectory, `${name}.png`)
  await writeFile(path, Buffer.from(result.data, 'base64'))
  return path
}

const audits = []
const captures = []

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })

  for (const viewport of viewports) {
    await setViewport(viewport.width, viewport.height)
    await navigate('/')
    if (viewport.width === 360) {
      await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1'); sessionStorage.clear(); location.reload()`)
      await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="home-hero-carousel"]')`, 'clean homepage')
      await sleep(250)
    }

    const homeTop = await evaluate(`(() => {
      const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0
      const header = document.querySelector('header')
      const logo = header.querySelector('img')
      const hero = document.querySelector('[data-testid="home-hero-carousel"]')
      const slide = document.querySelector('[data-testid="hero-active-slide"]')
      const mobileLayer = [...slide.children].find((node) => visible(node) && node.querySelector('img'))
      const image = mobileLayer.querySelector('img')
      const copy = [...mobileLayer.querySelectorAll('p')].at(-1)
      const cta = [...mobileLayer.querySelectorAll('span')].find((node) => node.textContent.toLowerCase().includes('view'))
      const heroRect = hero.getBoundingClientRect()
      const ctaRect = cta.getBoundingClientRect()
      const buttons = [
        document.querySelector('[data-testid="mobile-menu-trigger"]'),
        document.querySelector('[data-testid="mobile-search-trigger"]'),
        document.querySelector('[data-testid="header-bag-button"]'),
      ]
      return {
        headerHeight: header.getBoundingClientRect().height,
        headerState: header.dataset.headerState,
        logoWidth: logo.getBoundingClientRect().width,
        targets: buttons.map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
        heroHeight: heroRect.height,
        imageLoaded: image.complete && image.naturalWidth > 0,
        objectFit: getComputedStyle(image).objectFit,
        objectPosition: getComputedStyle(image).objectPosition,
        copyVisible: visible(copy),
        ctaVisible: ctaRect.top >= heroRect.top && ctaRect.bottom <= heroRect.bottom,
        ctaHeight: ctaRect.height,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(homeTop.headerHeight <= 72 && homeTop.logoWidth >= 40 && homeTop.logoWidth <= 48, `${viewport.width}px header or logo sizing is not phone-specific.`)
    assert(homeTop.targets.every((target) => target.width >= 44 && target.height >= 44), `${viewport.width}px header has a sub-44px touch target.`)
    assert(homeTop.heroHeight <= 545 && homeTop.heroHeight <= viewport.height * 0.67 && homeTop.imageLoaded && homeTop.objectFit === 'cover', `${viewport.width}px hero crop or height is incorrect: ${JSON.stringify(homeTop)}`)
    assert(homeTop.ctaVisible && homeTop.ctaHeight >= 44 && !homeTop.pageOverflow, `${viewport.width}px hero CTA or page width failed.`)
    assert(viewport.width !== 360 || !homeTop.copyVisible, 'The 360px hero still carries unnecessary body copy over the jewellery.')
    assert(viewport.width === 360 || homeTop.copyVisible, `${viewport.width}px hero supporting copy is unexpectedly hidden.`)
    captures.push(await capture(`${viewport.width}-home-hero`))

    for (let slideIndex = 1; slideIndex < 3; slideIndex += 1) {
      await evaluate(`document.querySelector('[data-testid="hero-indicator-${slideIndex}"]').click()`)
      await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '${slideIndex}'`, `${viewport.width}px hero slide ${slideIndex + 1}`)
      const slideAudit = await evaluate(`(() => {
        const hero = document.querySelector('[data-testid="home-hero-carousel"]')
        const slide = document.querySelector('[data-testid="hero-active-slide"]')
        const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0
        const mobileLayer = [...slide.children].find((node) => visible(node) && node.querySelector('img'))
        const image = mobileLayer.querySelector('img')
        const copy = [...mobileLayer.querySelectorAll('p')].at(-1)
        const cta = [...mobileLayer.querySelectorAll('span')].find((node) => node.textContent.toLowerCase().includes('view'))
        const heroRect = hero.getBoundingClientRect()
        const ctaRect = cta.getBoundingClientRect()
        return {
          product: slide.getAttribute('aria-label'),
          loaded: image.complete && image.naturalWidth > 0,
          objectPosition: getComputedStyle(image).objectPosition,
          copyVisible: visible(copy),
          ctaInside: ctaRect.top >= heroRect.top && ctaRect.bottom <= heroRect.bottom,
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })()`)
      assert(slideAudit.loaded && slideAudit.ctaInside && !slideAudit.pageOverflow, `${viewport.width}px hero slide ${slideIndex + 1} crop or CTA failed: ${JSON.stringify(slideAudit)}`)
      assert(viewport.width !== 360 || !slideAudit.copyVisible, `The 360px hero slide ${slideIndex + 1} has too much overlaid copy.`)
      assert(viewport.width === 360 || slideAudit.copyVisible, `${viewport.width}px hero slide ${slideIndex + 1} lost its supporting copy.`)
      captures.push(await capture(`${viewport.width}-hero-slide-${slideIndex + 1}`))
    }
    await evaluate(`document.querySelector('[data-testid="hero-indicator-0"]').click()`)
    await waitFor(`document.querySelector('[data-testid="hero-active-slide"]')?.dataset.slideIndex === '0'`, `${viewport.width}px first hero restoration`)

    await evaluate(`window.scrollTo({ top: 120, behavior: 'instant' })`)
    await sleep(120)
    const sticky = await evaluate(`(() => { const header = document.querySelector('header'); const rect = header.getBoundingClientRect(); return { state: header.dataset.headerState, top: rect.top, position: getComputedStyle(header).position } })()`)
    assert(sticky.state === 'solid' && sticky.top === 0 && sticky.position === 'sticky', `${viewport.width}px header sticky state is incorrect.`)

    await scrollToSelector('#category-title')
    const categories = await evaluate(`(() => {
      const section = document.querySelector('#category-title').closest('section')
      const rail = section.querySelector('.scrollbar-none')
      const cards = [...rail.querySelectorAll('a')]
      const cardRects = cards.map((card) => card.getBoundingClientRect())
      const labels = cards.map((card) => card.innerText.trim())
      const featuredEyebrow = document.querySelector('#featured .type-eyebrow')
      return {
        labels,
        cardWidth: cardRects[0].width,
        visibleCards: innerWidth / (cardRects[0].width + 12),
        swipeable: rail.scrollWidth > rail.clientWidth,
        gapToFeatured: featuredEyebrow.getBoundingClientRect().top - rail.getBoundingClientRect().bottom,
        imageRatio: cards[0].querySelector('img').getBoundingClientRect().width / cards[0].querySelector('img').getBoundingClientRect().height,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(JSON.stringify(categories.labels) === JSON.stringify(['Necklaces', 'Earrings', 'Bracelets', 'Rings']), `${viewport.width}px category labels are incomplete.`)
    assert(categories.swipeable && categories.visibleCards >= 2 && categories.visibleCards <= 2.65, `${viewport.width}px category rail does not clearly behave as a phone swipe rail.`)
    assert(categories.imageRatio >= 0.79 && categories.imageRatio <= 0.81 && categories.gapToFeatured <= 65, `${viewport.width}px category cards or following whitespace are incorrect: ${JSON.stringify(categories)}`)
    assert(!categories.pageOverflow, `${viewport.width}px category rail leaks into page overflow.`)
    captures.push(await capture(`${viewport.width}-categories`))

    await scrollToSelector('#featured')
    const grid = await evaluate(`(() => {
      const section = document.querySelector('#featured')
      const cards = [...section.querySelectorAll('article')]
      const firstImage = cards[0].querySelector('img')
      const firstName = cards[0].querySelector('a[href^="/product/"]:not([aria-label])')
      const firstRect = firstImage.getBoundingClientRect()
      const names = cards.map((card) => card.innerText.split('\\n')[0]).filter(Boolean)
      return {
        cardCount: cards.length,
        columns: Math.round(section.querySelector('article').parentElement.getBoundingClientRect().width / cards[0].getBoundingClientRect().width),
        imageRatio: firstRect.width / firstRect.height,
        imageHeight: firstRect.height,
        nameFontSize: Number.parseFloat(getComputedStyle(firstName).fontSize),
        names,
        wishlistTargets: cards.map((card) => card.querySelector('button').getBoundingClientRect().height),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(grid.cardCount === 4 && grid.columns === 2 && grid.imageRatio >= 0.79 && grid.imageRatio <= 0.81, `${viewport.width}px product grid density or image ratio is incorrect.`)
    assert(grid.imageHeight < viewport.height * 0.36 && grid.nameFontSize >= 14 && grid.wishlistTargets.every((height) => height >= 44), `${viewport.width}px product cards are too tall or unreadable: ${JSON.stringify(grid)}`)
    assert(!grid.pageOverflow, `${viewport.width}px product grid has horizontal overflow.`)
    captures.push(await capture(`${viewport.width}-product-grid`))

    await scrollToSelector('#editorial')
    const editorial = await evaluate(`(() => {
      const section = document.querySelector('#editorial')
      const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0
      const mobileComposition = [...section.children].find((node) => visible(node) && node.querySelector('h2'))
      const desktopComposition = [...section.children].find((node) => !visible(node) && node.querySelector('h2'))
      const imageLinks = [...mobileComposition.querySelectorAll('a')].filter((link) => link.querySelector('img'))
      return {
        dedicatedMobile: Boolean(mobileComposition) && Boolean(desktopComposition),
        collageHeight: imageLinks[0].parentElement.getBoundingClientRect().height,
        largestImageHeight: Math.max(...imageLinks.map((link) => link.getBoundingClientRect().height)),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(editorial.dedicatedMobile && editorial.largestImageHeight < viewport.height * 0.56 && !editorial.pageOverflow, `${viewport.width}px editorial composition is a compressed desktop layout or too tall.`)
    if (viewport.width === 390) captures.push(await capture('390-editorial'))

    await scrollToSelector('#details')
    const details = await evaluate(`(() => {
      const section = document.querySelector('#details')
      const rail = section.querySelector('.scrollbar-none')
      const card = rail.querySelector('a')
      const image = card.querySelector('img').getBoundingClientRect()
      return {
        swipeable: rail.scrollWidth > rail.clientWidth,
        cardWidth: card.getBoundingClientRect().width,
        imageHeight: image.height,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(details.swipeable && details.cardWidth < viewport.width * 0.8 && details.imageHeight < viewport.height * 0.53 && !details.pageOverflow, `${viewport.width}px detail editorial cards are oversized or not swipeable.`)

    await scrollToSelector('[data-testid="business-reveal-section"]')
    const businessReveal = await evaluate(`(() => {
      const section = document.querySelector('[data-testid="business-reveal-section"]')
      const preview = document.querySelector('[data-testid="business-reveal-preview"]')
      return {
        height: section.getBoundingClientRect().height,
        previewWidth: preview.getBoundingClientRect().width,
        text: section.innerText,
        popup: Boolean(document.querySelector('[data-testid="business-discovery-pill"]')),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(businessReveal.height <= viewport.height * 1.08 && businessReveal.previewWidth <= viewport.width - 32, `${viewport.width}px Business Reveal is intrusive or too wide: ${JSON.stringify(businessReveal)}`)
    assert(['Products', 'Inventory', 'Orders', 'Analytics'].every((label) => businessReveal.text.includes(label)) && !businessReveal.popup && !businessReveal.pageOverflow, `${viewport.width}px Business Reveal content or behavior failed.`)
    captures.push(await capture(`${viewport.width}-business-reveal`))

    await navigate('/product/pear-drop-statement-necklace')
    const realPdp = await evaluate(`(() => {
      const gallery = document.querySelector('[data-testid="mobile-gallery-track"]')
      const slide = document.querySelector('[data-testid="gallery-slide-1"]')
      const image = slide.querySelector('img')
      const sticky = document.querySelector('[data-testid="mobile-pdp-action-bar"]')
      const stickyButton = document.querySelector('[data-testid="mobile-sticky-add-to-bag"]')
      const title = document.querySelector('main h1')
      return {
        galleryWidth: gallery.getBoundingClientRect().width,
        galleryHeight: slide.getBoundingClientRect().height,
        imageLoaded: image.complete && image.naturalWidth > 0,
        imageFit: getComputedStyle(image).objectFit,
        titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
        stickyBottom: sticky.getBoundingClientRect().bottom,
        stickyHeight: sticky.getBoundingClientRect().height,
        stickyButtonHeight: stickyButton.getBoundingClientRect().height,
        unavailable: stickyButton.disabled && sticky.innerText.includes('Official price not supplied'),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(realPdp.galleryWidth === viewport.width && realPdp.galleryHeight < viewport.height * 0.61 && realPdp.imageLoaded && realPdp.imageFit === 'contain', `${viewport.width}px real PDP gallery is oversized, cropped, or unloaded: ${JSON.stringify(realPdp)}`)
    assert(realPdp.titleFontSize >= 34 && realPdp.stickyBottom === viewport.height && realPdp.stickyHeight >= 72 && realPdp.stickyButtonHeight >= 48, `${viewport.width}px PDP hierarchy or sticky purchase bar failed.`)
    assert(realPdp.unavailable && !realPdp.pageOverflow, `${viewport.width}px real PDP price state or overflow is incorrect.`)
    captures.push(await capture(`${viewport.width}-real-pdp`))

    await evaluate(`(() => { const track = document.querySelector('[data-testid="mobile-gallery-track"]'); track.scrollTo({ left: track.clientWidth, behavior: 'instant' }); track.dispatchEvent(new Event('scroll', { bubbles: true })); })()`)
    await waitFor(`document.querySelector('[data-testid="gallery-slide-2"]') && document.body.innerText.includes('2 / 4')`, `${viewport.width}px gallery swipe state`)
    await evaluate(`document.querySelector('[data-testid="gallery-slide-2"]').click()`)
    await waitFor(`document.querySelector('[data-testid="product-lightbox"]')`, `${viewport.width}px lightbox`)
    const lightbox = await evaluate(`(() => {
      const dialog = document.querySelector('[data-testid="product-lightbox"]')
      const close = document.querySelector('[data-testid="lightbox-close"]')
      const rect = dialog.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        counter: document.querySelector('[data-testid="lightbox-counter"]').innerText,
        closeTarget: close.getBoundingClientRect().height,
        bodyLocked: getComputedStyle(document.body).overflow === 'hidden',
      }
    })()`)
    assert(lightbox.width === viewport.width && lightbox.height === viewport.height && lightbox.counter === '2 / 4' && lightbox.closeTarget >= 48 && lightbox.bodyLocked, `${viewport.width}px lightbox behavior is incomplete: ${JSON.stringify(lightbox)}`)
    if (viewport.width === 390) captures.push(await capture('390-pdp-lightbox'))
    await evaluate(`document.querySelector('[data-testid="lightbox-close"]').click()`)
    await waitFor(`!document.querySelector('[data-testid="product-lightbox"]')`, `${viewport.width}px lightbox close`)

    await navigate('/product/wave-station-ring')
    await waitFor(`document.querySelector('[data-testid="option-ring-size-7"]')`, `${viewport.width}px variant PDP`)
    await scrollToSelector('[data-testid="option-ring-size-7"]', 'center')
    captures.push(await capture(`${viewport.width}-variant-controls`))
    const variantBefore = await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('[data-testid^="option-ring-size-"]')]
      const sticky = document.querySelector('[data-testid="mobile-sticky-add-to-bag"]')
      return { targets: buttons.map((button) => button.getBoundingClientRect().height), disabled: sticky.disabled, text: sticky.innerText }
    })()`)
    assert(variantBefore.targets.every((height) => height >= 48) && variantBefore.disabled && variantBefore.text.includes('Select option'), `${viewport.width}px variant targets or required state failed.`)
    await evaluate(`document.querySelector('[data-testid="option-ring-size-7"]').click()`)
    await waitFor(`!document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').disabled`, `${viewport.width}px selected variant`)
    if (viewport.width === 390) captures.push(await capture('390-variant-selected'))
    await evaluate(`document.querySelector('[data-testid="mobile-sticky-add-to-bag"]').click()`)
    await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, `${viewport.width}px add confirmation`)
    await evaluate(`document.querySelector('[data-testid="confirmation-view-bag"]').click()`)
    await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, `${viewport.width}px cart drawer`)
    const cart = await evaluate(`(() => {
      const drawer = document.querySelector('[data-testid="cart-drawer"]')
      const line = document.querySelector('[data-testid="cart-line-wave-station-ring"]')
      const image = line.querySelector('img').closest('a').getBoundingClientRect()
      const controls = [...line.querySelectorAll('button')].map((button) => button.getBoundingClientRect())
      return {
        text: line.innerText,
        drawerHeight: drawer.getBoundingClientRect().height,
        imageWidth: image.width,
        controls: controls.map((rect) => ({ width: rect.width, height: rect.height })),
        priceFontSize: Number.parseFloat(getComputedStyle(line.querySelector('[data-testid="cart-line-total"]')).fontSize),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(cart.text.includes('Wave Station Ring') && cart.text.includes('Ring Size: 7') && cart.text.includes('1,790'), `${viewport.width}px cart product, variant, or price is unreadable.`)
    assert(cart.drawerHeight <= viewport.height * 0.92 + 1 && cart.controls.every((rect) => rect.width >= 44 && rect.height >= 44) && cart.priceFontSize >= 16, `${viewport.width}px cart drawer or touch controls failed: ${JSON.stringify(cart)}`)
    assert((viewport.width !== 360 || cart.imageWidth <= 90) && !cart.pageOverflow, `${viewport.width}px cart line is too cramped or overflows.`)
    captures.push(await capture(`${viewport.width}-cart-drawer`))

    await evaluate(`document.querySelector('[data-testid="cart-drawer"] a[href="/cart"]').click()`)
    await waitFor(`location.pathname === '/cart'`, `${viewport.width}px full cart`)
    const fullCart = await evaluate(`(() => {
      const line = document.querySelector('[data-testid="cart-line-wave-station-ring"]')
      const summary = [...document.querySelectorAll('aside')].find((node) => node.innerText.includes('Order summary'))
      return {
        text: line.innerText,
        summaryVisible: summary.getBoundingClientRect().height > 0,
        checkoutHeight: document.querySelector('[data-testid="cart-checkout"]').getBoundingClientRect().height,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    assert(fullCart.text.includes('Ring Size: 7') && fullCart.summaryVisible && fullCart.checkoutHeight >= 56 && !fullCart.pageOverflow, `${viewport.width}px full cart composition failed.`)
    if (viewport.width === 390) captures.push(await capture('390-full-cart'))

    await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1')`)
    audits.push({
      viewport: `${viewport.width}x${viewport.height}`,
      header: true,
      hero: true,
      categories: true,
      productGrid: true,
      editorial: true,
      pdpAndLightbox: true,
      cart: true,
      businessReveal: true,
      horizontalOverflow: false,
    })
  }

  console.log(JSON.stringify({ passed: true, phoneDesigned: true, audits, captures }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
