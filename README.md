# mxnnxp

A browser SPA: a visual dataflow canvas for linear algebra. Drag widgets on an
infinite canvas, connect their slots, and watch exact arithmetic flow through
the graph.

## What it does

- **Matrix widget** — edit an `n×m` grid of exact numbers (1×1 … 6×6), one input
  slot and one output slot. Connect something to its input and it becomes a
  read-only display (and relay) of that incoming matrix, typeset with TeX
  (KaTeX).
- **Matrix multiply widget** — two input slots (Left, Right), one output; shows
  the result shape and dimension errors. Connect the output to a matrix widget
  to display the product.
- **Exact numbers** — all values are exact, never floating point. The math layer
  implements a number tower in `src/math/exact/`: `Rational` (exact rationals on
  `BigInt`, so no 2^53 ceiling) and `Algebraic` (exact algebraic numbers such as
  `sqrt(2)`, `(1+sqrt(5))/2`, and complex `1 - i`), with an exact input parser
  (`sqrt(2)/2`, `2i`, `8^(1/3)`, …) and exact ordering. Matrix cells parse with
  `parseExact` and the whole value path (cells, wires, results) computes over the
  tower — type `sqrt(2)/2` or `1 - i` into a cell and it flows through the graph
  and renders as TeX. See [docs/requirements.md](docs/requirements.md).
- **English / Russian interface** — a toolbar switch flips the whole UI between
  the two languages at once, remembers the choice, and keeps `<html lang>` in
  step. A `?lang=ru` (or `?lang=en`) query parameter forces the language for that
  load. Translations live in `src/i18n/`; the graph engine itself stays
  locale-free and reports structured errors the UI renders per language.

## Stack

- [Vite](https://vite.dev) + React 19 + TypeScript (strict)
- [React Flow](https://reactflow.dev) (`@xyflow/react`) — canvas, widget
  dragging, slot connections, wire rendering
- [KaTeX](https://katex.org) — typesetting read-only values (synchronous, no
  async render cycle)
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
(Playwright), checks that values flow, that slot-dragging connects widgets, that
read-only matrices are typeset with TeX, that dragging a widget redraws
continuously without blanking the canvas, that the language switch works, and
writes a screenshot to `/tmp/opencode/smoke.png`.

## Layout

```
src/math/        the exact/ number tower and the generic Matrix<T> over it — pure, immutable, tested
src/graph/       widget specs, connection rules, topological evaluation, structured errors — pure, tested
src/i18n/        English/Russian catalogue, provider + useI18n, label and error text
src/components/  React Flow canvas, widget components, TeX rendering, graph ⇄ canvas sync
docs/            requirements (incl. the TeX update-cycle policy)
```

The graph engine is UI-agnostic. React Flow owns the canvas interaction state
(widget positions, measured sizes, selection) and is the only writer of it; the
domain graph is projected onto its nodes and edges by
`src/components/flowSync.ts`, which reuses objects whose data did not change so
React Flow can keep its cached measurement. Settled positions are written back
into the domain graph, keeping it serializable (see `docs/requirements.md`).

TeX follows the same split: `toLatex()` is math, KaTeX output is UI. If the TeX
update cycle ever misbehaves during development, freeze it
(`FREEZE_TEX_UPDATES` in `src/components/Tex.tsx`) and deal with it later — see
the TeX policy in [docs/requirements.md](docs/requirements.md).
