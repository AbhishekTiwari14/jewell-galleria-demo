import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9467
const profileDirectory = join(tmpdir(), `jewellgalleria-gallery-audit-${process.pid}`)
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const products = [
  ['floral-drop-necklace', false],
  ['heritage-jhumka-earrings', false],
  ['pear-drop-statement-necklace', false],
  ['cascading-chandelier-earring', false],
  ['pearl-floral-ear-climber', false],
  ['two-row-statement-ring', false],
  ['solitaire-fan-earring', false],
  ['toggle-pendant-necklace', false],
  ['multicolour-oval-bracelet', false],
  ['oval-marquise-bracelet', false],
  ['wave-station-ring', true],
  ['asymmetric-stone-huggies', true],
  ['seven-station-anklet', true],
].map(([slug, isDemoProduct]) => ({
  slug,
  isDemoProduct,
  expectedImages: isDemoProduct
    ? ['hero.jpg', 'detail-01.jpg', 'detail-02.jpg', 'editorial.jpg']
    : ['hero.jpg', 'detail-01.jpg', 'editorial.jpg'],
}))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

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
  if (!response.ok) throw new Error(`Unable to create browser target: ${response.status}`)
  const target = await response.json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const handler = pending.get(message.id)
    if (!handler) return
    pending.delete(message.id)
    if (message.error) handler.reject(new Error(message.error.message))
    else handler.resolve(message.result)
  })

  function send(method, params = {}) {
    const id = nextId
    nextId += 1
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }

  return { send, socket, target }
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed.')
  }
  return result.result.value
}

async function waitFor(send, expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(send, expression)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}.`)
}

let client
try {
  await waitForBrowser()
  client = await createClient()
  const { send } = client
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  })

  const results = []
  for (const product of products) {
    await send('Page.navigate', { url: `${appUrl}/product/${product.slug}` })
    await waitFor(
      send,
      `document.querySelectorAll('[data-testid^="gallery-thumbnail-"]').length === ${product.expectedImages.length}`,
      `${product.slug} PDP gallery`,
    )

    const result = await evaluate(send, `(async () => {
      const expectedCount = ${product.expectedImages.length};
      const thumbnails = [...document.querySelectorAll('[data-testid^="gallery-thumbnail-"]')];
      const views = [];
      for (let index = 0; index < thumbnails.length; index += 1) {
        thumbnails[index].click();
        await new Promise((resolve) => setTimeout(resolve, 240));
        const image = document.querySelector('[data-testid="desktop-gallery-primary"] img');
        if (!image.complete) {
          await new Promise((resolve) => image.addEventListener('load', resolve, { once: true }));
        }
        views.push({
          fileName: new URL(image.currentSrc || image.src).pathname.split('/').pop(),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          renderedWidth: Math.round(image.getBoundingClientRect().width),
          renderedHeight: Math.round(image.getBoundingClientRect().height),
        });
      }
      document.querySelector('[data-testid="desktop-gallery-primary"]').click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const lightboxImages = [...document.querySelectorAll('[data-testid="product-lightbox"] img')];
      const lightbox = {
        count: lightboxImages.length,
        allLoaded: lightboxImages.every((image) => image.complete && image.naturalWidth > 0),
      };
      document.querySelector('[data-testid="lightbox-close"]').click();
      return {
        title: document.querySelector('h1')?.textContent?.trim() ?? '',
        demoMarker: document.body.innerText.toLowerCase().includes('fictional demo product'),
        thumbnailCount: thumbnails.length,
        expectedCount,
        views,
        lightbox,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    })()`)

    assert(result.thumbnailCount === product.expectedImages.length, `${product.slug} has an unexpected thumbnail count.`)
    assert(result.demoMarker === product.isDemoProduct, `${product.slug} demo-product marker does not match catalogue data.`)
    assert(
      JSON.stringify(result.views.map((view) => view.fileName)) === JSON.stringify(product.expectedImages),
      `${product.slug} gallery order does not match product data.`,
    )
    assert(result.views.every((view) => view.naturalWidth === 1200 && view.naturalHeight === 1500), `${product.slug} has an unloaded or malformed gallery image.`)
    assert(result.lightbox.count === product.expectedImages.length && result.lightbox.allLoaded, `${product.slug} lightbox did not load every gallery image.`)
    assert(!result.pageOverflow, `${product.slug} PDP has horizontal overflow.`)
    results.push({
      slug: product.slug,
      isDemoProduct: product.isDemoProduct,
      title: result.title,
      galleryImages: result.thumbnailCount,
      files: result.views.map((view) => view.fileName),
      lightboxLoaded: result.lightbox.allLoaded,
    })
  }

  process.stdout.write(`${JSON.stringify({ passed: true, products: results }, null, 2)}\n`)
} finally {
  if (client) {
    await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
    client.socket.close()
  }
  edgeProcess.kill()
  await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined)
}
