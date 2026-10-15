# mxnnxp

A browser SPA: a visual dataflow canvas for linear algebra. Drag widgets on an
infinite canvas, connect their slots, and watch exact arithmetic flow through
the graph.

## What it does

- **Matrix widget** — edit an `n×m` grid of fractions (1×1 … 6×6), one input
  slot and one output slot. Connect something to its input and it becomes a
  read-only display (and relay) of that incoming matrix.
- **Matrix multiply widget** — two input slots (Left, Right), one output; shows
  the result shape and dimension errors. Connect the output to a matrix widget
  to display the product.
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
(Playwright), checks that values flow, that slot-dragging connects widgets, and
that dragging a widget redraws continuously without blanking the canvas, and
writes a screenshot to `/tmp/opencode/smoke.png`.

## Layout

```
src/math/        Fraction, Matrix — pure, immutable, tested
src/graph/       widget specs, connection rules, topological evaluation — pure, tested
src/components/  React Flow canvas, widget components, graph ⇄ canvas sync
docs/            requirements
```

The graph engine is UI-agnostic. React Flow owns the canvas interaction state
(widget positions, measured sizes, selection) and is the only writer of it; the
domain graph is projected onto its nodes and edges by
`src/components/flowSync.ts`, which reuses objects whose data did not change so
React Flow can keep its cached measurement. Settled positions are written back
into the domain graph, keeping it serializable (see `docs/requirements.md`).
