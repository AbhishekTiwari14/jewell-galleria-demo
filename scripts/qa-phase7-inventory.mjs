import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase7-inventory')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const remotePort = 9456
const profileDirectory = join(tmpdir(), `jewellgalleria-inventory-edge-${process.pid}`)
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
  for (let attempt = 0; attempt < 150; attempt += 1) {
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
  await waitFor(`document.querySelector('main h1')`, `${path} heading`)
  await sleep(250)
}

async function setQuantity(value) {
  await evaluate(`(() => {
    const input = document.querySelector('[data-testid="inventory-quantity"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(String(value))})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
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

  await navigate('/business')
  const initialLowStock = Number(await evaluate(`document.querySelector('[data-testid="low-stock-count"]').textContent.trim()`))
  assert(Number.isInteger(initialLowStock) && initialLowStock > 0, 'Initial low-stock metric is invalid.')

  await navigate('/business/inventory?product=jg-real-001')
  const nonVariantInitial = await evaluate(`(() => ({
    product: document.querySelector('[data-testid="inventory-editor"] h2').textContent,
    quantity: Number(document.querySelector('[data-testid="inventory-quantity"]').value),
    labels: [...document.querySelectorAll('[data-testid^="inventory-variant-"]')].map((button) => button.innerText),
    selectionCount: document.querySelectorAll('[data-testid^="inventory-variant-"]').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    controlHeights: ['inventory-minus', 'inventory-quantity', 'inventory-plus'].map((id) => document.querySelector('[data-testid="' + id + '"]').getBoundingClientRect().height),
    clothingTerms: ['Size S', 'Size M', 'Size L', 'Color / Size', 'clothing'].some((term) => document.body.innerText.toLocaleLowerCase().includes(term.toLocaleLowerCase())),
  }))()`)
  assert(nonVariantInitial.product.includes('Floral Drop Necklace') && nonVariantInitial.selectionCount === 1 && nonVariantInitial.labels[0].includes('Default'), 'Non-variant product did not use one Default stock record.')
  assert(!nonVariantInitial.overflow && nonVariantInitial.controlHeights.every((height) => height >= 44) && !nonVariantInitial.clothingTerms, 'Mobile inventory controls overflow or retain clothing assumptions.')
  const originalDefaultQuantity = nonVariantInitial.quantity

  await setQuantity(8)
  assert((await evaluate(`document.querySelector('[data-testid="inventory-quantity"]').value`)) === '8', 'Direct numeric edit to 8 failed.')
  await evaluate(`document.querySelector('[data-testid="inventory-plus"]').click()`)
  await waitFor(`document.querySelector('[data-testid="inventory-quantity"]').value === '9'`, 'plus change from 8 to 9')
  await setQuantity(14)
  const unsavedSummary = await evaluate(`document.querySelector('[data-testid="inventory-change-summary"]').textContent.trim()`)
  assert(unsavedSummary === `${originalDefaultQuantity} → 14 units`, 'Unsaved inventory summary is incorrect.')
  const nonVariantDraftCapture = await capture('mobile-default-stock-14-unsaved')
  await evaluate(`document.querySelector('[data-testid="save-inventory"]').click()`)
  await waitFor(`document.querySelector('[data-testid="inventory-success-toast"]')`, 'inventory success confirmation')
  const nonVariantSaved = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state
    return {
      persisted: state.inventoryByVariant['jg-real-001:base'],
      savedText: document.querySelector('[data-testid="saved-stock-jg-real-001:base"]').innerText,
      total: document.querySelector('[data-testid="inventory-product-total"]').textContent,
      toast: document.querySelector('[data-testid="inventory-success-toast"]').innerText,
    }
  })()`)
  assert(nonVariantSaved.persisted === 14 && nonVariantSaved.savedText.includes('Default') && nonVariantSaved.savedText.includes('14 units'), 'Default stock did not update actual application state.')
  assert(nonVariantSaved.total.includes('14 units') && nonVariantSaved.toast.includes('Inventory saved'), 'Saved total or confirmation is incorrect.')
  const nonVariantSavedCapture = await capture('mobile-default-stock-saved')

  await send('Page.reload')
  await waitFor(`document.readyState === 'complete' && document.querySelector('[data-testid="inventory-quantity"]')?.value === '14'`, 'default stock persistence after refresh')
  assert(await evaluate(`document.querySelector('[data-testid="inventory-change-summary"]').textContent.includes('No unsaved changes')`), 'Refresh did not restore the saved inventory as the current value.')

  await navigate('/business')
  const lowStockAfterDefault = Number(await evaluate(`document.querySelector('[data-testid="low-stock-count"]').textContent.trim()`))
  assert(lowStockAfterDefault === initialLowStock - 1, 'Dashboard low-stock count did not respond after replenishing Default stock.')

  await navigate('/business/inventory?product=jg-demo-001')
  const variantInitial = await evaluate(`(() => ({
    product: document.querySelector('[data-testid="inventory-editor"] h2').textContent,
    labels: [...document.querySelectorAll('[data-testid^="inventory-variant-"]')].map((button) => button.innerText),
    quantities: [...document.querySelectorAll('[data-testid^="inventory-variant-"]')].map((button) => Number(button.lastElementChild.textContent.trim().split(' ')[0])),
    heights: [...document.querySelectorAll('[data-testid^="inventory-variant-"]')].map((button) => button.getBoundingClientRect().height),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))()`)
  assert(variantInitial.product.includes('Wave Station Ring') && variantInitial.labels.length === 3, 'Ring inventory did not expose all three sizes.')
  assert(variantInitial.labels.some((label) => label.includes('Ring Size: 6')) && variantInitial.labels.some((label) => label.includes('Ring Size: 7')) && variantInitial.labels.some((label) => label.includes('Ring Size: 8')), 'Ring Size labels are incorrect.')
  assert(variantInitial.heights.every((height) => height >= 64) && !variantInitial.overflow, 'Variant cards are not mobile-safe.')
  const originalRingQuantities = variantInitial.quantities
  await evaluate(`[...document.querySelectorAll('[data-testid^="inventory-variant-"]')].find((button) => button.innerText.includes('Ring Size: 7')).click()`)
  await waitFor(`document.querySelector('[data-testid="inventory-quantity"]').value === ${JSON.stringify(String(originalRingQuantities[1]))}`, 'Ring Size 7 selection')
  await setQuantity(4)
  await evaluate(`document.querySelector('[data-testid="save-inventory"]').click()`)
  await waitFor(`document.querySelector('[data-testid="inventory-success-toast"]')`, 'variant inventory success confirmation')
  const variantSaved = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state
    const entries = Object.entries(state.inventoryByVariant).filter(([key]) => key.startsWith('jg-demo-001:'))
    return Object.fromEntries(entries)
  })()`)
  const size6Key = Object.keys(variantSaved).find((key) => key.includes('ring-size=6'))
  const size7Key = Object.keys(variantSaved).find((key) => key.includes('ring-size=7'))
  const size8Key = Object.keys(variantSaved).find((key) => key.includes('ring-size=8'))
  assert(variantSaved[size6Key] === originalRingQuantities[0] && variantSaved[size7Key] === 4 && variantSaved[size8Key] === originalRingQuantities[2], 'Saving Size 7 incorrectly changed another ring variant.')
  const variantCapture = await capture('mobile-ring-variant-stock')

  await send('Page.reload')
  await waitFor(`document.readyState === 'complete' && [...document.querySelectorAll('[data-testid^="inventory-variant-"]')].some((button) => button.innerText.includes('Ring Size: 7') && button.innerText.includes('4 units'))`, 'variant stock persistence after refresh')

  await navigate('/business')
  const lowStockAfterVariant = Number(await evaluate(`document.querySelector('[data-testid="low-stock-count"]').textContent.trim()`))
  assert(lowStockAfterVariant === initialLowStock, 'Dashboard low-stock count did not respond to the newly low Size 7 variant.')
  const dashboardCapture = await capture('mobile-dashboard-inventory-response')

  await setViewport(1440, 1000)
  await navigate('/business/inventory?product=jg-demo-001')
  const desktopAudit = await evaluate(`(() => {
    const list = document.querySelector('section[aria-label="Inventory list"]')
    const editor = document.querySelector('[data-testid="inventory-editor"]')
    return {
      listVisible: getComputedStyle(list).display !== 'none' && list.getBoundingClientRect().width > 250,
      editorWidth: editor.getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  assert(desktopAudit.listVisible && desktopAudit.editorWidth > 500 && !desktopAudit.overflow, 'Desktop inventory split layout is incorrect.')
  const desktopCapture = await capture('desktop-ring-inventory', true)

  await evaluate(`document.querySelector('[aria-label="Reset all simulated business data"]').click()`)
  await waitFor(`JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.inventoryByVariant['jg-real-001:base'] === ${originalDefaultQuantity}`, 'Default stock reset')
  const resetState = await evaluate(`(() => {
    const inventory = JSON.parse(localStorage.getItem('jewellgalleria-demo:v1')).state.inventoryByVariant
    return {
      defaultQuantity: inventory['jg-real-001:base'],
      ringQuantities: Object.entries(inventory)
        .filter(([key]) => key.startsWith('jg-demo-001:'))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, quantity]) => quantity),
      editorQuantity: Number(document.querySelector('[data-testid="inventory-quantity"]').value),
    }
  })()`)
  assert(resetState.defaultQuantity === originalDefaultQuantity && JSON.stringify(resetState.ringQuantities) === JSON.stringify(originalRingQuantities), 'Reset Demo did not restore original quantities.')

  await navigate('/business')
  assert(Number(await evaluate(`document.querySelector('[data-testid="low-stock-count"]').textContent.trim()`)) === initialLowStock, 'Reset Demo did not restore the original dashboard low-stock count.')

  console.log(JSON.stringify({
    passed: true,
    nonVariant: {
      product: 'Floral Drop Necklace',
      label: 'Default',
      sequence: [8, 9, 14],
      persistedAfterRefresh: 14,
    },
    variant: {
      product: 'Wave Station Ring',
      option: 'Ring Size',
      records: 3,
      editedSize: '7',
      persistedAfterRefresh: 4,
      isolatedUpdate: true,
    },
    dashboardLowStockReactive: true,
    resetRestoredOriginals: true,
    mobileViewport: '390x844',
    desktopViewport: '1440x1000',
    captures: [nonVariantDraftCapture, nonVariantSavedCapture, variantCapture, dashboardCapture, desktopCapture],
  }, null, 2))
} finally {
  client.socket.close()
  await fetch(`http://127.0.0.1:${remotePort}/json/close/${client.target.id}`, { method: 'PUT' }).catch(() => undefined)
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
