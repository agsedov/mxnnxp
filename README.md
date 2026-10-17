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
- **Vector canvas widget** — takes a matrix and draws its rows (or its columns)
  as 2D vectors from the origin, labelled with their exact components and
  auto-scaled to fit. A switch inside the widget flips the reading mode; a shape
  that does not fit the mode, or a component with an imaginary part, is reported
  as an error.
- **Rotation source** — a source widget with a dropdown of the basic angles
  (`0`, `π/6`, `π/4`, …). Picking one emits the exact 2D rotation matrix
  `[[cos, -sin], [sin, cos]]` for it, read from a lookup table of exact cos/sin
  pairs — no approximation enters the value path.
- **Row echelon form widget** — takes a matrix and emits its row echelon form:
  exact Gaussian elimination over the exact number tower, with row swaps where
  the pivot position holds a zero and the pivots kept unscaled. Connect the
  output to a matrix widget to display the result.
- **Reduced row echelon form widget** — takes a matrix and emits its reduced row
  echelon form (RREF): exact Gauss–Jordan elimination, normalizing each pivot to
  1 and clearing its column above and below, so the result is the unique reduced
  form. Connect the output to a matrix widget to display the result.
- **Inverse matrix widget** — takes a square matrix and emits its inverse, again
  by exact Gauss–Jordan elimination over the exact number tower, so fractional
  and radical entries stay exact. A non-square matrix and a singular matrix are
  reported as errors rather than producing a value.
- **Transpose widget** — takes a matrix and emits its transpose (m×n becomes
  n×m): a pure reshuffle of the entries, so it is exact for any field and never
  errors on content. Connect the output to a matrix widget to display the result.
- **Comment widget** — a passive rectangle that carries a bilingual note (no
  slots, never wired, never errors). Only the note in the active language is
  shown and edited; switching the language flips to the other side, and the
  border turns red while that other side is still empty — a translation that
  has not been written yet. The body renders inline TeX (`$…$`), so a note can
  typeset a formula as well as say something about it; drag the corner gripper
  to set the box width (kept in the saved/shared document).
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
- **Presets** — the toolbar's *Presets* dropdown lists ready-made scenes from
  `presets/index.json` (names in the active language); picking one fetches that
  preset's static file — the same payload a share link carries — and replaces
  the canvas with it. Both the catalog and the presets are plain static files
  under `/presets/`, fetched lazily, so any file server can host them. To add
  one: build the scene, press *Share link*, and save what follows `#g=` in the
  copied URL as `presets/<name>.txt`, listed in `presets/index.json`.
- **Shareable links** — *Share link* copies a URL that reopens the canvas with
  the same widgets, their content, positions and wires. The graph rides in the
  URL fragment (`#g=<base64url>`), so opening such a link rebuilds the scene and
  recomputes every value exactly; a link with no valid graph falls back to the
  demo scene. See `src/graph/serialize.ts`.
- **Hidden hotkey** — `Ctrl + Shift + G` (`⌘ + Shift + G` on macOS) copies the
  current scene as the bare `g=<base64url>` fragment itself — the string a
  share link carries after its `#` — ready to paste onto any link to the app or
  into `presets/<name>.txt`. It is intentionally not shown anywhere in the UI
  and stays silent if the clipboard is unavailable.

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
npm run bundle   # production build + zip for the deploy server
```

With the dev server running, `npm run smoke` renders the app headlessly
(Playwright), checks that values flow, that slot-dragging connects widgets, that
read-only matrices are typeset with TeX, that the vector canvas draws the
input's rows/columns and switches mode (including its shape and complex-value
errors), that dragging a widget redraws continuously without blanking the
canvas, that the language switch works, and writes a screenshot to
`/tmp/opencode/smoke.png`.

## Deploy

`npm run bundle` runs the production build with Vite's `base` set to
`/mxnnxp/` (so the page requests `/mxnnxp/assets/…`), then zips the result to
`release/mxnnxp-<date>-<sha>.zip` — a zip whose entries start with the
`mxnnxp/` directory, i.e. the layout below `/var/www/html/`.

```bash
scp release/mxnnxp-*.zip user@server:/tmp/
ssh user@server "sudo unzip -o /tmp/mxnnxp-*.zip -d /var/www/html/ && \
  sudo chown -R www-data:www-data /var/www/html/mxnnxp"
```

Apache on Ubuntu then serves it at `https://<host>/mxnnxp/` from the default
`DocumentRoot`. No modules or rewrites are involved: the canvas state lives in
the URL's hash fragment, so every request names a real file. Build with
`BASE_PATH=/ npm run bundle` instead if the app is served from a host root.

## Layout

```
src/math/        the exact/ number tower and the generic Matrix<T> over it — pure, immutable, tested
src/graph/       widget specs, connection rules, topological evaluation, structured errors, graph serialization — pure, tested
src/i18n/        English/Russian catalogue, provider + useI18n, label and error text
src/components/  React Flow canvas, widget components, TeX rendering, graph ⇄ canvas sync
src/share.ts     URL fragment plumbing for shareable links (graph ↔ `#g=`)
src/presets.ts   lazy loading of the preset catalog and preset files (`presets/`, static)
presets/         the presets themselves: `index.json` (catalog, en/ru names) + one file per scene
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
