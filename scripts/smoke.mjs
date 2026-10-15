import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${msg.type()}: ${msg.text()}`)
})

/** Samples whether every wire is drawn, repeatedly, over a time window. */
async function sampleEdgeVisibility(durationMs, stepMs = 20) {
  const samples = []
  const started = Date.now()
  while (Date.now() - started < durationMs) {
    const visible = await page.locator('.react-flow__edge-path').evaluateAll(els =>
      els.map(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }),
    )
    samples.push(visible.length >= 2 && visible.every(Boolean))
    await page.waitForTimeout(stepMs)
  }
  return samples
}

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

// Editing a cell must not blank the wires for even one frame.
const errorsBeforeEdit = errors.length
await page.locator('.react-flow__node').nth(1).locator('.cell').first().fill('3')
const editSamples = await sampleEdgeVisibility(300)
const editErrors = errors.slice(errorsBeforeEdit)

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

// --- Regression test: dragging a widget header must redraw continuously while
// the pointer moves and must never blank the graph (React Flow error 015).
const errorsBeforeDrag = errors.length
const widget = page.locator('.react-flow__node').first()
const header = widget.locator('.widget-header')
const before = await widget.boundingBox()
const hb = await header.boundingBox()
const startX = hb.x + hb.width / 2
const startY = hb.y + hb.height / 2

await page.mouse.move(startX, startY)
await page.mouse.down()

// Halfway, with the button still held: the widget must already be at the cursor.
await page.mouse.move(startX + 60, startY + 40, { steps: 8 })
const midway = await widget.boundingBox()
const followedMidway = Math.abs(midway.x - (before.x + 60)) < 15 && Math.abs(midway.y - (before.y + 40)) < 15

await page.mouse.move(startX + 150, startY + 90, { steps: 8 })
const atTarget = await widget.boundingBox()
const followedTarget =
  Math.abs(atTarget.x - (before.x + 150)) < 15 && Math.abs(atTarget.y - (before.y + 90)) < 15

// Still holding the button: every node and wire must be visible right now.
const midNodeBoxes = await page.locator('.react-flow__node').evaluateAll(els =>
  els.map(el => {
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }),
)
const midEdgeBoxes = await page.locator('.react-flow__edge-path').evaluateAll(els =>
  els.map(el => {
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }),
)
await page.mouse.up()
await page.waitForTimeout(500)

const after = await widget.boundingBox()
const postEdgeBoxes = await page.locator('.react-flow__edge-path').evaluateAll(els =>
  els.map(el => {
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }),
)
const dragErrors = errors
  .slice(errorsBeforeDrag)
  .filter(e => e.includes('015') || e.includes('not initialized'))

const dragMoved = before && after ? Math.abs(after.x - (before.x + 150)) < 15 : false
const midNodesVisible = midNodeBoxes.length > 0 && midNodeBoxes.every(b => b.w > 0 && b.h > 0)
const midEdgesVisible = midEdgeBoxes.length >= 2 && midEdgeBoxes.every(b => b.w > 0 && b.h > 0)
const postEdgesVisible = postEdgeBoxes.length >= 2 && postEdgeBoxes.every(b => b.w > 0 && b.h > 0)

await page.screenshot({ path: '/tmp/opencode/smoke.png' })
await browser.close()

const report = {
  nodeCount,
  edgeCount,
  resultBefore,
  resultAfter,
  dragOk,
  cellEdit: {
    samples: editSamples.length,
    allFramesVisible: editSamples.length > 0 && editSamples.every(Boolean),
    errors: editErrors,
  },
  nodeDrag: {
    followedMidway,
    followedTarget,
    dragMoved,
    midNodesVisible,
    midEdgesVisible,
    postEdgesVisible,
    dragErrors,
  },
  errors,
}
console.log(JSON.stringify(report, null, 2))

const failed =
  nodeCount < 3 ||
  edgeCount < 2 ||
  resultAfter !== '1/2001' ||
  !dragOk ||
  editSamples.length === 0 ||
  !editSamples.every(Boolean) ||
  editErrors.length > 0 ||
  !followedMidway ||
  !followedTarget ||
  !dragMoved ||
  !midNodesVisible ||
  !midEdgesVisible ||
  !postEdgesVisible ||
  dragErrors.length > 0 ||
  errors.length > 0
process.exit(failed ? 1 : 0)
