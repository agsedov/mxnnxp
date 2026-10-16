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

/** Drags from one slot (or header) to another. */
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
const nodeById = id => page.locator(`.react-flow__node[data-id="${id}"]`)
const nodeIds = () =>
  page.locator('.react-flow__node').evaluateAll(els => els.map(el => el.getAttribute('data-id')))

// Read-only values are typeset with KaTeX, which keeps the LaTeX source in the
// MathML annotation — the stable thing to assert on.
const texSource = node =>
  node.locator('annotation[encoding="application/x-tex"]').textContent().then(text => text.trim())
const pmatrix = rows => `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`
const rendered = async node => {
  const box = await node.locator('.katex').first().boundingBox()
  const errorCount = await node.locator('.katex-error').count()
  return !!box && box.width > 0 && box.height > 0 && errorCount === 0
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.react-flow__node', { timeout: 15000 })
await page.waitForSelector('.cell', { timeout: 15000 })

const initialIds = await nodeIds()
const nodeCount = initialIds.length
const initialEdges = await edgeCount()

// Nodes are addressed by id: their DOM order can change as widgets are dragged.
const [matrixA, matrixB, multiply] = initialIds.map(nodeById)

// --- The multiply widget shows no values of its own: display them by driving a
// matrix widget with the product (added fresh, then parked clear of the others).
await page.click('text=+ Matrix')
await page.waitForTimeout(300)
const displayId = (await nodeIds()).find(id => !initialIds.includes(id))
const display = nodeById(displayId)

const edgesBeforeConnect = await edgeCount()
const connected = await dragBetween(
  multiply.locator('.react-flow__handle-right').first(),
  display.locator('.react-flow__handle-left').first(),
)
await page.waitForTimeout(250)
const connection = {
  connected,
  edgeAdded: (await edgeCount()) === edgesBeforeConnect + 1,
  rendered: await rendered(display),
  identityProduct: await texSource(display),
}

// Exact fractions must survive multiply → driven matrix.
await matrixA.locator('.cell').first().fill('1/2')
await page.waitForTimeout(250)
connection.halfProduct = await texSource(display)
await matrixB.locator('.cell').first().fill('3')
await page.waitForTimeout(250)
connection.threeHalvesProduct = await texSource(display)

// Editing a cell must not blank the wires for even one frame.
const errorsBeforeEdit = errors.length
await matrixA.locator('.cell').nth(2).fill('0/5')
const editSamples = await sampleEdgeVisibility(300)
const editErrors = errors.slice(errorsBeforeEdit)

// --- Matrix input slot: connecting it drives the widget (read-only pass-through).
const errorsBeforeLink = errors.length
const linked = await dragBetween(
  matrixA.locator('.react-flow__handle-right').first(),
  matrixB.locator('.react-flow__handle-left').first(),
)
await page.waitForTimeout(300)
const matrixInput = {
  linked,
  edgeAdded: (await edgeCount()) === initialEdges + 2,
  cellsHidden: (await matrixB.locator('.cell').count()) === 0,
  label: (await matrixB.locator('.slot-label').textContent()).trim(),
  rendered: await rendered(matrixB),
  showsUpstream: (await texSource(matrixB)) === pmatrix(['\\frac{1}{2} & 0', '0 & 1']),
}

// The driven widget follows its upstream live.
await matrixA.locator('.cell').first().fill('1/3')
await page.waitForTimeout(250)
matrixInput.followsUpstream = (await texSource(matrixB)) === pmatrix(['\\frac{1}{3} & 0', '0 & 1'])

// Irrational and complex cells are exact too, and typeset as such.
await matrixA.locator('.cell').first().fill('sqrt(2)/2')
await page.waitForTimeout(250)
matrixInput.showsRadical = (await texSource(matrixB)) === pmatrix(['\\frac{\\sqrt{2}}{2} & 0', '0 & 1'])
await matrixA.locator('.cell').first().fill('1 - i')
await page.waitForTimeout(250)
matrixInput.showsComplex = (await texSource(matrixB)) === pmatrix(['1 - i & 0', '0 & 1'])

// Removing the wire makes the widget editable again, with its own values intact.
await clickPath(page.locator('.react-flow__edge-path').last())
await page.waitForTimeout(250)
matrixInput.editableAgain =
  (await matrixB.locator('.cell').count()) === 4 && (await matrixB.locator('.cell').first().inputValue()) === '3'
matrixInput.errors = errors.slice(errorsBeforeLink)

// --- Vector canvas: draws the input matrix's rows (or columns) as arrows from
// the origin; the reading mode is switched from inside the widget.
const errorsBeforeCanvas = errors.length
for (const [index, value] of ['1', '2', '3', '4'].entries()) {
  await matrixA.locator('.cell').nth(index).fill(value)
}
await page.click('text=+ Vector Canvas')
await page.waitForTimeout(300)
const canvasId = (await nodeIds()).find(id => !initialIds.includes(id) && id !== displayId)
const canvas = nodeById(canvasId)

const canvasLinked = await dragBetween(
  matrixA.locator('.react-flow__handle-right').first(),
  canvas.locator('.react-flow__handle-left').first(),
)
await page.waitForTimeout(300)
const arrowLabels = () =>
  canvas.locator('.vector-plot-label').evaluateAll(els => els.map(el => (el.textContent ?? '').trim()))

const vectorCanvas = {
  linked: canvasLinked,
  arrowCount: await canvas.locator('.vector-plot-shaft').count(),
  rowsLabels: await arrowLabels(),
}
await canvas.getByRole('button', { name: 'Columns', exact: true }).click()
await page.waitForTimeout(250)
vectorCanvas.colsLabels = await arrowLabels()

// A shape that does not fit the active mode is an error naming the shape.
await canvas.getByRole('button', { name: 'Rows', exact: true }).click()
await page.waitForTimeout(150)
await matrixA.getByTitle('More columns').click()
await page.waitForTimeout(250)
vectorCanvas.shapeError = (await canvas.locator('.widget-message.error').textContent()).trim()

// The same 2×3 matrix fits the other reading mode.
await canvas.getByRole('button', { name: 'Columns', exact: true }).click()
await page.waitForTimeout(250)
vectorCanvas.colsAfterGrow = (await arrowLabels()).length
vectorCanvas.errorCleared = (await canvas.locator('.widget-message.error').count()) === 0

// The plane is real: an imaginary component is an error, not an approximation.
await matrixA.locator('.cell').nth(0).fill('i')
await page.waitForTimeout(250)
vectorCanvas.complexError = (await canvas.locator('.widget-message.error').textContent()).trim()
vectorCanvas.errors = errors.slice(errorsBeforeCanvas)

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

const midNodesVisible = await page
  .locator('.react-flow__node')
  .evaluateAll(els => els.every(el => el.getBoundingClientRect().width > 0))
const midEdges = await page
  .locator('.react-flow__edge-path')
  .evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }),
  )
await page.mouse.up()
await page.waitForTimeout(250)

const after = await widget.boundingBox()
const postEdges = await page
  .locator('.react-flow__edge-path')
  .evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }),
  )
const moved = before && after ? Math.abs(after.x - (before.x + 150)) < 15 : false
const midEdgesVisible = midEdges.length >= 2 && midEdges.every(Boolean)
const postEdgesVisible = postEdges.length >= 2 && postEdges.every(Boolean)
const dragErrors = errors.slice(errorsBeforeDrag).filter(e => e.includes('015'))

// --- Language switching: the interface is bilingual (English / Russian) and the
// choice is remembered. Exercised last so it cannot disturb the graph checks.
const errorsBeforeLocale = errors.length
const englishBtn = page.getByRole('button', { name: 'EN', exact: true })
const russianBtn = page.getByRole('button', { name: 'RU', exact: true })
await russianBtn.click()
await page.waitForTimeout(200)
const locale = {
  htmlLang: await page.evaluate(() => document.documentElement.lang),
  addMatrix: (await page.locator('.toolbar .btn').first().textContent()).trim(),
  multiplyTitle: (await multiply.locator('.widget-title').textContent()).trim(),
  leftSlot: (await multiply.locator('.slot-label').first().textContent()).trim(),
  stored: await page.evaluate(() => localStorage.getItem('mxnnxp.locale')),
}
await matrixA.locator('.cell').first().fill('x')
await page.waitForTimeout(250)
locale.cellError = (await matrixA.locator('.widget-message.error').textContent()).trim()
locale.cellErrorDetail = await matrixA.locator('.widget-message.error').getAttribute('title')
await englishBtn.click()
await page.waitForTimeout(200)
locale.backToEnglish = (await page.locator('.toolbar .btn').first().textContent()).trim()
locale.htmlLangAfter = await page.evaluate(() => document.documentElement.lang)
locale.errors = errors.slice(errorsBeforeLocale)

await page.screenshot({ path: '/tmp/opencode/smoke.png' })

// --- Forcing the language with ?lang=…: the query parameter overrides the saved
// preference (here 'en') and is not written back to storage.
await page.goto(`${BASE}/?lang=ru`, { waitUntil: 'networkidle' })
await page.waitForSelector('.react-flow__node', { timeout: 15000 })
const forced = {
  htmlLang: await page.evaluate(() => document.documentElement.lang),
  addMatrix: (await page.locator('.toolbar .btn').first().textContent()).trim(),
  activeBtn: (await page.locator('.lang-btn-active').textContent()).trim(),
  stored: await page.evaluate(() => localStorage.getItem('mxnnxp.locale')),
}

// An unknown value is ignored, falling back to the saved preference.
await page.goto(`${BASE}/?lang=de`, { waitUntil: 'networkidle' })
await page.waitForSelector('.react-flow__node', { timeout: 15000 })
forced.invalidParamLang = await page.evaluate(() => document.documentElement.lang)
forced.errors = errors.slice(errorsBeforeLocale)

await page.goto(`${BASE}/?lang=ru`, { waitUntil: 'networkidle' })
await page.waitForSelector('.react-flow__node', { timeout: 15000 })
await page.screenshot({ path: '/tmp/opencode/smoke.png' })

await browser.close()

const report = {
  nodeCount,
  initialEdges,
  connection,
  cellEdit: {
    samples: editSamples.length,
    allFramesVisible: editSamples.every(Boolean),
    errors: editErrors,
  },
  matrixInput,
  vectorCanvas,
  nodeDrag: {
    followedMidway,
    followedTarget,
    moved,
    midNodesVisible,
    midEdgesVisible,
    postEdgesVisible,
    errors: dragErrors,
  },
  locale,
  forced,
  errors,
}
console.log(JSON.stringify(report, null, 2))

const failed =
  nodeCount !== 3 ||
  initialEdges !== 2 ||
  !connection.connected ||
  !connection.edgeAdded ||
  !connection.rendered ||
  connection.identityProduct !== pmatrix(['1 & 0', '0 & 1']) ||
  connection.halfProduct !== pmatrix(['\\frac{1}{2} & 0', '0 & 1']) ||
  connection.threeHalvesProduct !== pmatrix(['\\frac{3}{2} & 0', '0 & 1']) ||
  editSamples.length === 0 ||
  !editSamples.every(Boolean) ||
  editErrors.length > 0 ||
  !matrixInput.linked ||
  !matrixInput.edgeAdded ||
  !matrixInput.cellsHidden ||
  matrixInput.label !== 'in' ||
  !matrixInput.rendered ||
  !matrixInput.showsUpstream ||
  !matrixInput.followsUpstream ||
  !matrixInput.showsRadical ||
  !matrixInput.showsComplex ||
  !matrixInput.editableAgain ||
  matrixInput.errors.length > 0 ||
  !vectorCanvas.linked ||
  vectorCanvas.arrowCount !== 2 ||
  JSON.stringify(vectorCanvas.rowsLabels) !== JSON.stringify(['(1, 2)', '(3, 4)']) ||
  JSON.stringify(vectorCanvas.colsLabels) !== JSON.stringify(['(1, 3)', '(2, 4)']) ||
  vectorCanvas.shapeError !== 'Vector canvas needs 2 columns (or 2 rows), got 2×3' ||
  vectorCanvas.colsAfterGrow !== 3 ||
  !vectorCanvas.errorCleared ||
  vectorCanvas.complexError !== 'Row 1, column 1: complex numbers cannot be plotted' ||
  vectorCanvas.errors.length > 0 ||
  !followedMidway ||
  !followedTarget ||
  !moved ||
  !midNodesVisible ||
  !midEdgesVisible ||
  !postEdgesVisible ||
  dragErrors.length > 0 ||
  locale.htmlLang !== 'ru' ||
  locale.addMatrix !== '+ Матрица' ||
  locale.multiplyTitle !== 'Умножение матриц' ||
  locale.leftSlot !== 'Левая' ||
  locale.stored !== 'ru' ||
  locale.cellError !== 'Строка 1, столбец 1: недопустимое точное число' ||
  locale.cellErrorDetail !== 'Unknown name "x"' ||
  locale.backToEnglish !== '+ Matrix' ||
  locale.htmlLangAfter !== 'en' ||
  locale.errors.length > 0 ||
  forced.htmlLang !== 'ru' ||
  forced.addMatrix !== '+ Матрица' ||
  forced.activeBtn !== 'RU' ||
  forced.stored !== 'en' ||
  forced.invalidParamLang !== 'en' ||
  forced.errors.length > 0 ||
  errors.length > 0
process.exit(failed ? 1 : 0)
