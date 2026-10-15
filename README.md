# mxnnxp

A browser SPA: a visual dataflow canvas for linear algebra. Drag widgets on an
infinite canvas, connect their slots, and watch exact arithmetic flow through
the graph.

## What it does

- **Matrix widget** — edit an `n×m` grid of fractions (1×1 … 6×6), one output slot.
- **Matrix multiply widget** — two input slots (A, B), one output; shows the
  result shape, dimension errors, and a read-only result grid.
- **Exact numbers** — every value is a `Fraction` (Python `fractions.Fraction`
  style): normalized, immutable, and computed without floating point.
  See [docs/requirements.md](docs/requirements.md).

## Stack

- [Vite](https://vite.dev) + React 19 + TypeScript (strict)
- [React Flow](https://reactflow.dev) (`@xyflow/react`) — canvas, widget
  dragging, slot connections, wire rendering
- [Vitest](https://vitest.dev) — tests for the math and graph engines

## Scripts

```bash
npm install
npm run dev      # start dev server
npm test         # run engine/math tests
npm run build    # type-check + production build
npm run lint     # oxlint
```

With the dev server running, `npm run smoke` renders the app headlessly
(Playwright), checks that values flow and slot-dragging connects widgets, and
writes a screenshot to `/tmp/opencode/smoke.png`.

## Layout

```
src/math/        Fraction, Matrix — pure, immutable, tested
src/graph/       widget specs, connection rules, topological evaluation — pure, tested
src/components/  React Flow canvas + custom widget components
docs/            requirements
```

The graph engine is UI-agnostic: React Flow only renders it.
