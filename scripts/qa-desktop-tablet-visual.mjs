import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-desktop-tablet-visual')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9461
const profileDirectory = join(tmpdir(), `jewellgalleria-desktop-tablet-edge-${process.pid}`)
const viewports = [
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
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
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  })
  await send('Emulation.setTouchEmulationEnabled', { enabled: width === 768, maxTouchPoints: 5 })
}

async function navigate(path) {
  const pathname = path.split('?')[0]
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(pathname)}`, path)
  await waitFor(`document.querySelector('main')`, `${path} content`)
  await sleep(250)
}

async function scrollToSelector(selector, block = 'start') {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: ${JSON.stringify(block)}, behavior: 'instant' })`)
  await sleep(180)
}

async function capture(name) {
  const result = await send('Page.captureScreenshot', { captureBeyondViewport: false, format: 'png', fromSurface: true })
  const path = join(outputDirectory, `${name}.png`)
  await writeFile(path, Buffer.from(result.data, 'base64'))
  return path
}

const report = {}
const captures = []

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })

  for (const viewport of viewports) {
    const key = String(viewport.width)
    report[key] = {}
    await setViewport(viewport.width, viewport.height)
    await navigate('/')
    await evaluate(`localStorage.removeItem('jewellgalleria-demo:v1'); sessionStorage.clear(); location.reload()`)
    await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="home-hero-carousel"]')`, 'clean homepage')
    await sleep(250)

    report[key].homeTop = await evaluate(`(() => {
      const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0
      const header = document.querySelector('header')
      const hero = document.querySelector('[data-testid="home-hero-carousel"]')
      const slide = document.querySelector('[data-testid="hero-active-slide"]')
      const layer = [...slide.children].find((node) => visible(node) && node.querySelector('img'))
      const image = layer.querySelector('img')
      const rect = image.getBoundingClientRect()
      const navLinks = [...header.querySelectorAll('a')].filter(visible).map((node) => node.textContent.trim()).filter(Boolean)
      return {
        headerHeight: Math.round(header.getBoundingClientRect().height),
        headerPosition: getComputedStyle(header).position,
        heroHeight: Math.round(hero.getBoundingClientRect().height),
        heroImage: {
          source: image.getAttribute('src'),
          rendered: [Math.round(rect.width), Math.round(rect.height)],
          natural: [image.naturalWidth, image.naturalHeight],
          objectFit: getComputedStyle(image).objectFit,
          objectPosition: getComputedStyle(image).objectPosition,
        },
        navLinks,
        mobileMenuVisible: visible(document.querySelector('[data-testid="mobile-menu-trigger"]')),
        businessPreviewVisible: visible(document.querySelector('[data-testid="desktop-business-preview"]')),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        containerWidths: [...document.querySelectorAll('main > *')].slice(0, 8).map((node) => Math.round(node.getBoundingClientRect().width)),
      }
    })()`)
    captures.push(await capture(`${key}-home-top`))

    await scrollToSelector('#category-title')
    report[key].catalogue = await evaluate(`(() => {
      const heading = document.querySelector('#category-title')
      const categorySection = heading.closest('section')
      const productHeading = [...document.querySelectorAll('h2')].find((node) => node.textContent.includes('Jewellgalleria highlights'))
      const productSection = productHeading.closest('section')
      const categoryLinks = [...categorySection.querySelectorAll('a')]
      const productLinks = [...productSection.querySelectorAll('a[href^="/product/"]')].filter((node) => node.querySelector('img'))
      const columns = (nodes) => new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().left))).size
      const productImages = productLinks.map((link) => {
        const image = link.querySelector('img')
        const rect = image.getBoundingClientRect()
        return { source: image.getAttribute('src'), rendered: [Math.round(rect.width), Math.round(rect.height)], natural: [image.naturalWidth, image.naturalHeight] }
      })
      return {
        categoryColumns: columns(categoryLinks),
        categoryCardWidth: Math.round(categoryLinks[0].getBoundingClientRect().width),
        productColumns: columns(productLinks),
        productCardWidth: Math.round(productLinks[0].getBoundingClientRect().width),
        productImages,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    captures.push(await capture(`${key}-catalogue`))

    await scrollToSelector('#editorial', 'center')
    report[key].editorial = await evaluate(`(() => {
      const section = document.querySelector('#editorial')
      const visibleImages = [...section.querySelectorAll('img')].filter((image) => getComputedStyle(image).display !== 'none' && image.getBoundingClientRect().width > 0)
      return {
        sectionHeight: Math.round(section.getBoundingClientRect().height),
        images: visibleImages.map((image) => {
          const rect = image.getBoundingClientRect()
          return { source: image.getAttribute('src'), rendered: [Math.round(rect.width), Math.round(rect.height)], natural: [image.naturalWidth, image.naturalHeight], objectFit: getComputedStyle(image).objectFit }
        }),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    captures.push(await capture(`${key}-editorial`))

    await scrollToSelector('[data-testid="business-reveal-section"]', 'center')
    report[key].editorialReveal = await evaluate(`(() => {
      const reveal = document.querySelector('[data-testid="business-reveal-section"]')
      const preview = document.querySelector('[data-testid="business-reveal-preview"]')
      const editorialHeadings = [...document.querySelectorAll('h2')].filter((node) => node.textContent.includes('Jewellery,')).map((node) => ({ text: node.textContent.trim(), display: getComputedStyle(node.closest('div[class*="max-w-360"]') ?? node).display }))
      const rect = reveal.getBoundingClientRect()
      const previewRect = preview.getBoundingClientRect()
      return {
        revealHeight: Math.round(rect.height),
        preview: [Math.round(previewRect.width), Math.round(previewRect.height)],
        columnsAligned: Math.abs(rect.top - previewRect.top) < 180,
        editorialHeadings,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    captures.push(await capture(`${key}-business-reveal`))

    await navigate('/product/pear-drop-statement-necklace')
    report[key].pdp = await evaluate(`(() => {
      const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0
      const mobileTrack = document.querySelector('[data-testid="mobile-gallery-track"]')
      const desktopPrimary = document.querySelector('[data-testid="desktop-gallery-primary"]')
      const gallery = visible(desktopPrimary) ? desktopPrimary : mobileTrack
      const image = gallery.querySelector('img')
      const imageRect = image.getBoundingClientRect()
      const galleryRect = gallery.getBoundingClientRect()
      const title = document.querySelector('h1')
      return {
        layout: visible(desktopPrimary) ? 'desktop' : 'swipe',
        gallery: [Math.round(galleryRect.width), Math.round(galleryRect.height)],
        galleryBottom: Math.round(galleryRect.bottom),
        titleTop: Math.round(title.getBoundingClientRect().top),
        image: { source: image.getAttribute('src'), rendered: [Math.round(imageRect.width), Math.round(imageRect.height)], natural: [image.naturalWidth, image.naturalHeight], objectFit: getComputedStyle(image).objectFit },
        thumbnailCount: [...document.querySelectorAll('[data-testid^="gallery-thumbnail-"]')].filter(visible).length,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    captures.push(await capture(`${key}-pdp`))

    await navigate('/product/wave-station-ring')
    await evaluate(`document.querySelector('[data-testid="option-ring-size-7"]')?.click()`)
    await waitFor(`!document.querySelector('[data-testid="mobile-sticky-add-to-bag"]')?.disabled || !document.querySelector('[data-testid="add-to-bag"]')?.disabled`, 'enabled Add to Bag')
    await evaluate(`(document.querySelector('[data-testid="add-to-bag"]')?.offsetParent ? document.querySelector('[data-testid="add-to-bag"]') : document.querySelector('[data-testid="mobile-sticky-add-to-bag"]')).click()`)
    await waitFor(`document.querySelector('[data-testid="added-to-bag-sheet"]')`, 'Add to Bag confirmation')
    await navigate('/cart')
    report[key].cart = await evaluate(`(() => {
      const main = document.querySelector('main')
      const checkout = document.querySelector('[data-testid="cart-checkout"]')
      const item = [...document.querySelectorAll('a[href^="/product/"]')].find((node) => node.querySelector('img'))?.closest('article') ?? [...main.querySelectorAll('div')].find((node) => node.textContent.includes('Ring Size: 7'))
      const summary = checkout.closest('aside') ?? checkout.parentElement
      const itemRect = item?.getBoundingClientRect()
      const summaryRect = summary.getBoundingClientRect()
      return {
        item: itemRect ? [Math.round(itemRect.width), Math.round(itemRect.height)] : null,
        summary: [Math.round(summaryRect.width), Math.round(summaryRect.height)],
        sideBySide: itemRect ? Math.abs(itemRect.top - summaryRect.top) < 100 : false,
        selectedVariantVisible: main.textContent.includes('Ring Size: 7'),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    captures.push(await capture(`${key}-cart`))

    await navigate('/business')
    await sleep(650)
    report[key].dashboard = await evaluate(`(() => {
      const visible = (node) => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0
      const metrics = document.querySelector('section[aria-label="Business metrics"]')
      const recent = [...document.querySelectorAll('h2')].find((node) => node.textContent.toLowerCase().includes('recent orders'))?.closest('article')
      const cards = [...(metrics?.children ?? [])].filter(visible)
      return {
        metricCount: cards.length,
        metricColumns: new Set(cards.map((node) => Math.round(node.getBoundingClientRect().left))).size,
        metricRows: new Set(cards.map((node) => Math.round(node.getBoundingClientRect().top))).size,
        contentWidth: Math.round(document.querySelector('main > div').getBoundingClientRect().width),
        recentWidth: recent ? Math.round(recent.getBoundingClientRect().width) : null,
        navLabels: [...document.querySelectorAll('nav[aria-label="Business"] a')].filter(visible).map((node) => node.textContent.trim()),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    captures.push(await capture(`${key}-dashboard`))

    await navigate('/business/analytics')
    await sleep(1100)
    report[key].analytics = await evaluate(`(() => {
      const content = document.querySelector('[data-testid="analytics-content"]')
      const metricCards = [...content.children].find((node) => node.classList.contains('grid'))?.children ?? []
      const visibleCards = [...metricCards].filter((node) => getComputedStyle(node).display !== 'none')
      const chart = document.querySelector('[data-testid="revenue-chart"]')
      const funnel = document.querySelector('[data-testid="analytics-funnel"]')
      const chartRect = chart.getBoundingClientRect()
      const funnelRect = funnel.getBoundingClientRect()
      const labels = [...chart.querySelectorAll('.recharts-cartesian-axis-tick-value')].map((node) => node.textContent.trim()).filter(Boolean)
      return {
        metricCount: visibleCards.length,
        metricColumns: new Set(visibleCards.map((node) => Math.round(node.getBoundingClientRect().left))).size,
        metricRows: new Set(visibleCards.map((node) => Math.round(node.getBoundingClientRect().top))).size,
        chart: [Math.round(chartRect.width), Math.round(chartRect.height)],
        chartLayout: chart.dataset.mobileLayout,
        chartLabels: labels,
        chartAndFunnelSideBySide: Math.abs(chartRect.top - funnelRect.top) < 120,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })()`)
    captures.push(await capture(`${key}-analytics`))
  }

  const failures = []
  const imageFitsSource = ({ rendered, natural }) => natural[0] >= rendered[0] && natural[1] >= rendered[1]
  for (const viewport of viewports) {
    const key = String(viewport.width)
    const audit = report[key]
    const screens = [audit.homeTop, audit.catalogue, audit.editorial, audit.editorialReveal, audit.pdp, audit.cart, audit.dashboard, audit.analytics]
    if (screens.some((screen) => screen.pageOverflow)) failures.push(`${key}px has horizontal page overflow.`)
    if (audit.homeTop.headerPosition !== 'sticky') failures.push(`${key}px customer navigation is not sticky.`)
    if (!imageFitsSource(audit.homeTop.heroImage)) failures.push(`${key}px hero exceeds its source resolution.`)
    if (audit.catalogue.productImages.some((image) => !imageFitsSource(image))) failures.push(`${key}px product cards exceed their source resolution.`)
    if (audit.editorial.images.some((image) => !imageFitsSource(image))) failures.push(`${key}px editorial imagery exceeds its source resolution.`)
    if (!imageFitsSource(audit.pdp.image)) failures.push(`${key}px PDP image exceeds its source resolution.`)
    if (!audit.cart.selectedVariantVisible) failures.push(`${key}px cart lost the selected Ring Size: 7 option.`)
    if (audit.dashboard.metricCount !== 5 || audit.dashboard.navLabels.length !== 5) failures.push(`${key}px business dashboard content is incomplete.`)
  }

  if (report['768'].catalogue.productColumns !== 4) failures.push('768px storefront is not using the tablet-density product grid.')
  if (report['768'].pdp.layout !== 'swipe' || report['768'].pdp.gallery[0] > 480) failures.push('768px PDP gallery is still oversized.')
  if (report['768'].analytics.metricColumns !== 4 || report['768'].analytics.metricRows !== 2) failures.push('768px analytics metrics are not balanced for tablet.')
  for (const key of ['1280', '1440']) {
    const audit = report[key]
    if (audit.homeTop.mobileMenuVisible || !audit.homeTop.businessPreviewVisible) failures.push(`${key}px desktop navigation is incorrect.`)
    if (audit.catalogue.productColumns !== 4) failures.push(`${key}px desktop catalogue grid is incorrect.`)
    if (audit.pdp.layout !== 'desktop' || audit.pdp.thumbnailCount !== 4) failures.push(`${key}px desktop PDP gallery is incomplete.`)
    if (!audit.cart.sideBySide) failures.push(`${key}px cart does not use its desktop composition.`)
    if (audit.dashboard.metricColumns !== 5 || audit.dashboard.metricRows !== 1) failures.push(`${key}px dashboard metrics are not in a desktop row.`)
    if (audit.analytics.metricColumns !== 7 || !audit.analytics.chartAndFunnelSideBySide) failures.push(`${key}px analytics is not using its desktop composition.`)
  }

  const reportPath = join(outputDirectory, 'report.json')
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  if (failures.length > 0) throw new Error(`Desktop/tablet visual QA failed:\n${failures.join('\n')}`)
  console.log(JSON.stringify({ passed: true, viewports: viewports.map(({ width, height }) => `${width}x${height}`), outputDirectory, reportPath, captures, report }, null, 2))
} finally {
  try {
    client.socket.close()
    await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`)
  } catch {
    // Browser shutdown is best-effort.
  }
  edgeProcess.kill()
  await rm(profileDirectory, { recursive: true, force: true }).catch(() => {})
}
