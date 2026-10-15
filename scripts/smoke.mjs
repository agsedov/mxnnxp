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

/** Drags from one slot (or header) to another with the given pointer. */
async function dragBetween(from, to) {
  const a = await from.boundingBox()
  const b = await to.boundingBox()
  if (!a || !b) return false
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
  return true
}

/** Clicks the exact middle of an SVG path (where the wire actually is). */
async function clickPath(path) {
  const point = await path.evaluate(node => {
    const svgPath = /** @type {SVGPathElement} */ (node)
    const p = svgPath.getPointAtLength(svgPath.getTotalLength() / 2)
    const m = svgPath.getScreenCTM()
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
  })
  await page.mouse.click(point.x, point.y)
}

const edgeCount = () => page.locator('.react-flow__edge').count()
const gridText = async node => (await node.locator('.result-grid').textContent()).trim()

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.react-flow__node', { timeout: 15000 })
await page.waitForSelector('.result-grid', { timeout: 15000 })

const nodeCount = await page.locator('.react-flow__node').count()
const initialEdges = await edgeCount()
const resultBefore = (await gridText(page.locator('.react-flow__node').nth(2))).trim()

// Edit A's top-left cell to "1/2" — the result must follow with exact fractions.
const matrixA = page.locator('.react-flow__node').nth(0)
const matrixB = page.locator('.react-flow__node').nth(1)
await matrixA.locator('.cell').first().fill('1/2')
await page.waitForTimeout(300)
const resultAfter = (await gridText(page.locator('.react-flow__node').nth(2))).trim()

// Editing a cell must not blank the wires for even one frame.
const errorsBeforeEdit = errors.length
await matrixB.locator('.cell').first().fill('3')
const editSamples = await sampleEdgeVisibility(300)
const editErrors = errors.slice(errorsBeforeEdit)

// --- Matrix input slot: connecting it drives the widget (read-only pass-through).
const errorsBeforeLink = errors.length
const linked = await dragBetween(
  matrixA.locator('.react-flow__handle-right').first(),
  matrixB.locator('.react-flow__handle-left').first(),
)
await page.waitForTimeout(300)
const passThrough = {
  linked,
  edgeAdded: (await edgeCount()) === initialEdges + 1,
  cellsHidden: (await matrixB.locator('.cell').count()) === 0,
  drivenLabel: (await matrixB.locator('.slot-label').textContent()).trim(),
  showsUpstream: (await gridText(matrixB)) === '1/2001',
}

// The driven widget follows its upstream live.
await matrixA.locator('.cell').first().fill('1/3')
await page.waitForTimeout(250)
passThrough.followsUpstream = (await gridText(matrixB)) === '1/3001'

// Removing the wire makes the widget editable again, with its own values intact.
await clickPath(page.locator('.react-flow__edge-path').last())
await page.waitForTimeout(250)
passThrough.editableAgain =
  (await matrixB.locator('.cell').count()) === 4 && (await matrixB.locator('.cell').first().inputValue()) === '3'
passThrough.errors = errors.slice(errorsBeforeLink)

// --- Slot dragging onto a freshly added widget connects it.
const edgesBeforeConnect = await edgeCount()
await page.click('text=+ Multiply')
await page.waitForTimeout(300)
const dragged = await dragBetween(
  page.locator('.react-flow__handle-right').first(),
  page.locator('.react-flow__node').last().locator('.react-flow__handle-left').first(),
)
await page.waitForTimeout(300)
const connectOk = dragged && (await edgeCount()) === edgesBeforeConnect + 1

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
  initialEdges,
  resultBefore,
  resultAfter,
  connectOk,
  cellEdit: {
    samples: editSamples.length,
    allFramesVisible: editSamples.length > 0 && editSamples.every(Boolean),
    errors: editErrors,
  },
  matrixInput: passThrough,
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
  initialEdges < 2 ||
  resultAfter !== '1/2001' ||
  !connectOk ||
  editSamples.length === 0 ||
  !editSamples.every(Boolean) ||
  editErrors.length > 0 ||
  !passThrough.linked ||
  !passThrough.edgeAdded ||
  !passThrough.cellsHidden ||
  !passThrough.showsUpstream ||
  !passThrough.followsUpstream ||
  !passThrough.editableAgain ||
  passThrough.errors.length > 0 ||
  !followedMidway ||
  !followedTarget ||
  !dragMoved ||
  !midNodesVisible ||
  !midEdgesVisible ||
  !postEdgesVisible ||
  dragErrors.length > 0 ||
  errors.length > 0
process.exit(failed ? 1 : 0)
