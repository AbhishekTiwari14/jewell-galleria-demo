import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const previewUrl = process.argv[2] ?? 'http://127.0.0.1:4173/'
const outputDirectory = process.argv[3] ?? join(tmpdir(), 'jewellgalleria-phase2-captures')
const remotePort = 9333
const profileDirectory = join(tmpdir(), `jewellgalleria-edge-${process.pid}`)

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]

await mkdir(outputDirectory, { recursive: true })
await mkdir(profileDirectory, { recursive: true })

const edgeProcess = spawn(
  edgePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${profileDirectory}`,
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
)

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForBrowser() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${remotePort}/json/version`)
      if (response.ok) return
    } catch {
      // The browser is still starting.
    }
    await wait(100)
  }
  throw new Error('Edge DevTools did not become ready.')
}

async function createTarget() {
  const response = await fetch(
    `http://127.0.0.1:${remotePort}/json/new?about:blank`,
    { method: 'PUT' },
  )
  if (!response.ok) throw new Error(`Unable to create browser target: ${response.status}`)
  return response.json()
}

async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl)
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

  return {
    close: () => socket.close(),
    send(method, params = {}) {
      const id = nextId
      nextId += 1
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
  }
}

async function captureViewport(viewport) {
  const target = await createTarget()
  const client = await connect(target.webSocketDebuggerUrl)
  const { width, height } = viewport

  try {
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
      screenWidth: width,
      screenHeight: height,
    })
    await client.send('Emulation.setTouchEmulationEnabled', {
      enabled: width < 768,
      maxTouchPoints: 5,
    })
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    await client.send('Page.navigate', { url: previewUrl })
    await wait(900)
    await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
        for (let y = 0; y < document.documentElement.scrollHeight; y += ${Math.max(500, Math.floor(height * 0.8))}) {
          window.scrollTo(0, y);
          await delay(70);
        }
        window.scrollTo(0, 0);
        await document.fonts.ready;
        await Promise.race([
          Promise.all(Array.from(document.images, (image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          }))),
          delay(2500)
        ]);
        await delay(120);
      })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    await wait(150)

    const viewportCapture = await client.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
      fromSurface: true,
    })
    const viewportPath = join(outputDirectory, `home-${width}x${height}.png`)
    await writeFile(viewportPath, Buffer.from(viewportCapture.data, 'base64'))

    if (width === 390 || width === 1440) {
      const metrics = await client.send('Page.getLayoutMetrics')
      const contentHeight = Math.ceil(metrics.cssContentSize.height)
      const fullCapture = await client.send('Page.captureScreenshot', {
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height: contentHeight, scale: 1 },
        format: 'png',
        fromSurface: true,
      })
      const fullPath = join(outputDirectory, `home-${width}-full.png`)
      await writeFile(fullPath, Buffer.from(fullCapture.data, 'base64'))
    }

    return viewportPath
  } finally {
    client.close()
    await fetch(`http://127.0.0.1:${remotePort}/json/close/${target.id}`, {
      method: 'PUT',
    }).catch(() => undefined)
  }
}

try {
  await waitForBrowser()
  for (const viewport of viewports) {
    const outputPath = await captureViewport(viewport)
    process.stdout.write(`${outputPath}\n`)
  }
} finally {
  edgeProcess.kill()
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => undefined)
}
