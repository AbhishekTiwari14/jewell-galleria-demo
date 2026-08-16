import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const debugPort = process.env.OVIA_CDP_PORT ?? '9222'
const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4173'
const outputDirectory = process.env.OVIA_QA_OUTPUT ?? process.cwd()

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function getDebugTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then(
        (response) => response.json(),
      )
      const target = targets.find((item) => item.type === 'page')
      if (target) return target
    } catch {
      // The browser may still be starting.
    }
    await sleep(250)
  }

  throw new Error('Could not connect to the Edge debugging target')
}

const target = await getDebugTarget()
const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let messageId = 0

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id) return
  const request = pending.get(message.id)
  if (!request) return

  pending.delete(message.id)
  if (message.error) {
    request.reject(new Error(message.error.message))
  } else {
    request.resolve(message.result)
  }
})

function send(method, params = {}) {
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })

  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text)
  }

  return response.result.value
}

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function navigate(path) {
  await send('Page.navigate', { url: `${appUrl}${path}` })
  await waitFor(
    `document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`,
    path,
  )
  await sleep(350)
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 500,
  })
}

async function capture(name) {
  const response = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })
  const path = join(outputDirectory, `${name}.png`)
  await writeFile(path, Buffer.from(response.data, 'base64'))
  return path
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function runJourney(size, viewport, prefix) {
  await setViewport(viewport.width, viewport.height)
  await navigate('/')
  await evaluate(`localStorage.removeItem('ovia-demo:v1'); location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 'storefront reload')
  await sleep(350)

  const homeAudit = await evaluate(`({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    sections: ['New Arrivals', 'Dresses', 'Tops', 'One shoulder', 'Kurtis'].every(
      (label) => document.body.innerText.toLowerCase().includes(label.toLowerCase())
    ),
    brownDressLinks: document.querySelectorAll('a[href="/product/brown-off-shoulder-dress"]').length,
  })`)
  assert(homeAudit.width === viewport.width, `${prefix}: incorrect viewport width`)
  assert(homeAudit.scrollWidth === viewport.width, `${prefix}: home has horizontal overflow`)
  assert(homeAudit.sections, `${prefix}: a required home section is missing`)
  assert(homeAudit.brownDressLinks > 0, `${prefix}: Brown Dress link missing`)
  await capture(`${prefix}-home`)

  await evaluate(
    `document.querySelector('a[href="/product/brown-off-shoulder-dress"]').click()`,
  )
  await waitFor(
    `location.pathname === '/product/brown-off-shoulder-dress'`,
    'Brown Dress PDP',
  )
  await sleep(300)

  const initialState = await evaluate(`({
    addDisabled: document.querySelector('[data-testid="add-to-bag"]').disabled,
    sPressed: document.querySelector('[data-testid="size-S"]').getAttribute('aria-pressed'),
    mPressed: document.querySelector('[data-testid="size-M"]').getAttribute('aria-pressed'),
    bodyText: document.body.innerText,
    scrollWidth: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  })`)
  assert(initialState.addDisabled, `${prefix}: Add to Bag was initially enabled`)
  assert(initialState.sPressed === 'false', `${prefix}: S was initially selected`)
  assert(initialState.mPressed === 'false', `${prefix}: M was initially selected`)
  assert(
    initialState.bodyText.includes('Brown Off Shoulder Dress') &&
      initialState.bodyText.includes('₹1,199'),
    `${prefix}: authoritative PDP content is missing`,
  )
  assert(initialState.scrollWidth === initialState.width, `${prefix}: PDP has horizontal overflow`)

  await evaluate(`document.querySelector('[data-testid="size-${size}"]').click()`)
  await sleep(350)
  const selectedState = await evaluate(`(() => {
    const selected = document.querySelector('[data-testid="size-${size}"]')
    const other = document.querySelector('[data-testid="size-${size === 'S' ? 'M' : 'S'}"]')
    const styles = getComputedStyle(selected)
    return {
      selectedPressed: selected.getAttribute('aria-pressed'),
      otherPressed: other.getAttribute('aria-pressed'),
      background: styles.backgroundColor,
      color: styles.color,
      addDisabled: document.querySelector('[data-testid="add-to-bag"]').disabled,
    }
  })()`)
  assert(selectedState.selectedPressed === 'true', `${prefix}: ${size} was not selected`)
  assert(selectedState.otherPressed === 'false', `${prefix}: other size remained selected`)
  const selectedColorAudit = await evaluate(`(() => {
    const selected = document.querySelector('[data-testid="size-${size}"]')
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-ovia-primary)'
    document.body.appendChild(probe)
    const token = getComputedStyle(probe).color
    probe.remove()
    return {
      token,
      hasPrimaryClass: selected.classList.contains('bg-ovia-primary'),
      hasWhiteTextClass: selected.classList.contains('text-white'),
    }
  })()`)
  assert(selectedColorAudit.hasPrimaryClass, `${prefix}: selected size is not using the Ovia mauve token (${selectedState.background}; token ${selectedColorAudit.token})`)
  assert(selectedColorAudit.hasWhiteTextClass, `${prefix}: selected size text is not using white (${selectedState.color})`)
  assert(!selectedState.addDisabled, `${prefix}: Add to Bag did not enable`)
  await evaluate(`document.querySelector('[data-testid="size-${size}"]').scrollIntoView({ block: 'center' })`)
  await sleep(200)
  await capture(`${prefix}-pdp-${size.toLowerCase()}-selected`)

  await evaluate(`document.querySelector('[data-testid="add-to-bag"]').click()`)
  await waitFor(
    `document.querySelector('[data-testid="added-to-bag-sheet"]')`,
    'added-to-bag sheet',
  )
  await sleep(350)
  const confirmationState = await evaluate(`({
    size: document.querySelector('[data-testid="confirmation-size"]').textContent.trim(),
    text: document.querySelector('[data-testid="added-to-bag-sheet"]').innerText,
    badge: document.querySelector('[data-testid="cart-badge"]').textContent.trim(),
  })`)
  assert(confirmationState.size === size, `${prefix}: confirmation has wrong size`)
  assert(confirmationState.text.includes('Brown Off Shoulder Dress'), `${prefix}: confirmation has wrong product`)
  assert(confirmationState.text.includes('₹1,199'), `${prefix}: confirmation has wrong price`)
  assert(confirmationState.badge === '1', `${prefix}: cart badge did not update to 1`)
  await capture(`${prefix}-added-sheet-${size.toLowerCase()}`)

  await evaluate(`document.querySelector('[data-testid="confirmation-checkout"]').click()`)
  await waitFor(`location.pathname === '/checkout'`, 'checkout route')
  await sleep(350)
  const checkoutState = await evaluate(`({
    text: document.body.innerText,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  })`)
  assert(checkoutState.text.includes('Complete your details'), `${prefix}: checkout did not render`)
  assert(checkoutState.text.includes(`Size ${size}`), `${prefix}: checkout has wrong size`)
  assert(checkoutState.text.includes('₹1,199'), `${prefix}: checkout has wrong price`)
  assert(checkoutState.scrollWidth === checkoutState.width, `${prefix}: checkout has horizontal overflow`)
  await capture(`${prefix}-checkout-${size.toLowerCase()}`)

  await evaluate(`document.querySelector('[data-testid="header-bag-button"]').click()`)
  await waitFor(`document.querySelector('[data-testid="cart-drawer"]')`, 'cart drawer')
  await sleep(250)
  const drawerState = await evaluate(`({
    text: document.querySelector('[data-testid="cart-drawer"]').innerText,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  })`)
  assert(drawerState.text.includes('Brown Off Shoulder Dress'), `${prefix}: drawer has wrong product`)
  assert(drawerState.text.includes(`Size ${size}`), `${prefix}: drawer has wrong size`)
  assert(drawerState.text.includes('₹1,199'), `${prefix}: drawer has wrong price`)
  assert(drawerState.scrollWidth === drawerState.width, `${prefix}: drawer causes horizontal overflow`)
  await capture(`${prefix}-cart-drawer-${size.toLowerCase()}`)
  await evaluate(`document.querySelector('[aria-label="Close bag"]').click()`)
  await waitFor(`!document.querySelector('[data-testid="cart-drawer"]')`, 'cart drawer close')

  await navigate('/cart')
  const cartPageState = await evaluate(`({
    text: document.body.innerText,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  })`)
  assert(cartPageState.text.includes('Shopping bag'), `${prefix}: cart page did not render`)
  assert(cartPageState.text.includes(`Size ${size}`), `${prefix}: cart page has wrong size`)
  assert(cartPageState.scrollWidth === cartPageState.width, `${prefix}: cart page has horizontal overflow`)
  await capture(`${prefix}-cart-page-${size.toLowerCase()}`)

  await navigate('/checkout')

  return {
    size,
    viewport,
    selectedBackground: selectedState.background,
    selectedColor: selectedState.color,
    badge: confirmationState.badge,
    confirmationSize: confirmationState.size,
    checkoutPath: '/checkout',
    drawerVerified: true,
    cartPageVerified: true,
  }
}

async function completeMockCheckout() {
  await navigate('/checkout')
  await evaluate(`(() => {
    const values = {
      email: 'demo@ovia.test',
      'first-name': 'Aisha',
      'last-name': 'Demo',
      address: '12 Ovia Lane',
      city: 'Mumbai',
      'postal-code': '400001',
      phone: '9999999999',
    }
    for (const [id, value] of Object.entries(values)) {
      const input = document.getElementById(id)
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    return {
      formValid: document.getElementById('checkout-form').checkValidity(),
      invalidFields: [...document.getElementById('checkout-form').elements]
        .filter((element) => element.willValidate && !element.checkValidity())
        .map((element) => element.id || element.name),
    }
  })()`)
  const formAudit = await evaluate(`(() => ({
    formValid: document.getElementById('checkout-form').checkValidity(),
    invalidFields: [...document.getElementById('checkout-form').elements]
      .filter((element) => element.willValidate && !element.checkValidity())
      .map((element) => element.id || element.name),
  }))()`)
  assert(formAudit.formValid, `mock checkout form is invalid: ${formAudit.invalidFields.join(', ')}`)
  await evaluate(`document.querySelector('[data-testid="place-demo-order"]').click()`)
  await sleep(500)
  const postClickAudit = await evaluate(`({
    path: location.pathname,
    hasForm: Boolean(document.getElementById('checkout-form')),
    hasConfirmation: document.body.innerText.toLowerCase().includes('demo order confirmed'),
    cartStorage: localStorage.getItem('ovia-demo:v1'),
    bodyStart: document.body.innerText.slice(0, 240),
  })`)
  assert(postClickAudit.hasConfirmation, `visible checkout button did not complete: ${JSON.stringify(postClickAudit)}`)
  await waitFor(`document.body.innerText.toLowerCase().includes('demo order confirmed')`, 'mock order confirmation')
  const completionState = await evaluate(`({
    text: document.body.innerText,
    cartBadge: document.querySelector('[data-testid="cart-badge"]')?.textContent ?? null,
  })`)
  assert(completionState.text.includes('No order was submitted and no payment was taken.'), 'completion disclosure missing')
  assert(completionState.cartBadge === null, 'cart was not cleared after mock checkout')
  await capture('desktop-checkout-complete')
  return true
}

await send('Page.enable')
await send('Runtime.enable')

const results = []
results.push(await runJourney('S', { width: 390, height: 844 }, 'mobile'))
results.push(await runJourney('M', { width: 1440, height: 1000 }, 'desktop'))
const checkoutCompletionVerified = await completeMockCheckout()

console.log(JSON.stringify({ passed: true, checkoutCompletionVerified, results }, null, 2))
socket.close()
