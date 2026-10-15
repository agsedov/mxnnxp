import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${msg.type()}: ${msg.text()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.react-flow__node', { timeout: 15000 })
await page.waitForSelector('.result-grid', { timeout: 15000 })

const nodeCount = await page.locator('.react-flow__node').count()
const edgeCount = await page.locator('.react-flow__edge').count()
const resultBefore = (await page.locator('.result-grid').first().textContent()).trim()

// Edit A's top-left cell to "1/2" — result must update to exact fraction math.
const firstCell = page.locator('.react-flow__node').first().locator('.cell').first()
await firstCell.fill('1/2')
await page.waitForTimeout(300)
const resultAfter = (await page.locator('.result-grid').first().textContent()).trim()

// Best-effort interaction test: add a widget and connect a slot by dragging.
let dragOk = false
try {
  await page.click('text=+ Multiply')
  await page.waitForTimeout(200)
  const source = page.locator('.react-flow__handle-right').first()
  const target = page.locator('.react-flow__node').last().locator('.react-flow__handle-left').first()
  const s = await source.boundingBox()
  const t = await target.boundingBox()
  if (s && t) {
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
    await page.mouse.down()
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    dragOk = (await page.locator('.react-flow__edge').count()) >= 3
  }
} catch {
  dragOk = false
}

const finalNodeCount = await page.locator('.react-flow__node').count()
await page.screenshot({ path: '/tmp/opencode/smoke.png' })
await browser.close()

console.log(
  JSON.stringify(
    { nodeCount, edgeCount, resultBefore, resultAfter, dragOk, finalNodeCount, errors },
    null,
    2,
  ),
)
