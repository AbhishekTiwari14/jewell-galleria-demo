import { readFile } from 'node:fs/promises'

const appUrl = process.env.OVIA_APP_URL ?? 'http://127.0.0.1:4177'
const routes = [
  '/',
  '/product/brown-off-shoulder-dress',
  '/cart',
  '/checkout',
  '/business',
  '/business/products',
  '/business/inventory',
  '/business/orders',
  '/business/analytics',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const results = []
for (const route of routes) {
  const response = await fetch(`${appUrl}${route}`)
  const html = await response.text()
  assert(response.ok, `${route} returned ${response.status}`)
  assert(html.includes('<div id="root"></div>'), `${route} did not receive the SPA entry document`)
  assert(html.includes('<meta name="robots" content="noindex,nofollow"'), `${route} is missing noindex,nofollow`)
  results.push({ route, status: response.status, spaEntry: true })
}

const robotsResponse = await fetch(`${appUrl}/robots.txt`)
const robots = await robotsResponse.text()
assert(robotsResponse.ok && robots.includes('Disallow: /'), 'robots.txt does not block crawling')

const redirects = await readFile('dist/_redirects', 'utf8')
assert(redirects.trim() === '/* /index.html 200', 'Netlify SPA fallback is missing from production output')

const vercel = JSON.parse(await readFile('vercel.json', 'utf8'))
assert(
  Array.isArray(vercel.rewrites)
    && vercel.rewrites[0]?.source === '/(.*)'
    && vercel.rewrites[0]?.destination === '/index.html',
  'Vercel SPA rewrite is invalid',
)

console.log(JSON.stringify({ passed: true, routes: results, robotsBlocked: true, netlifyFallback: true, vercelFallback: true }, null, 2))
