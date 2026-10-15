# mxnnxp — Requirements

## Overview

mxnnxp is a browser SPA: a visual dataflow canvas for linear-algebra
computations. The user places widgets on an infinite canvas, drags them around,
and connects the **output slots** of one widget to the **input slots** of
another. Values flow through the wires; every widget recomputes automatically
whenever anything upstream changes.

Start set: **Matrix** widget and **Matrix multiply** widget.

---

## R1 — Canvas and interaction

- The canvas is an infinite, pannable, zoomable 2D surface with a grid
  background (provided by React Flow).
- Widgets can be dragged to any position with the pointer.
- Slots (ports) are connectable: press on a slot, drag to a compatible slot of
  another widget, release. A live wire follows the pointer during the drag.
- Only **output → input** connections are valid; a widget cannot be connected
  to itself.
- Each **input slot holds at most one connection**; making a new connection to
  an occupied input slot replaces the existing one.
- Connections are removed by clicking the wire or by selecting it and pressing
  ⌫/Backspace. Widgets are removed with their ✕ button or by selection + ⌫.
- Compatibility of slots is structural (does the slot exist on that widget
  kind?). Arithmetic compatibility (matrix dimensions) is **not** a connection
  rule — it is surfaced as a visible error state on the widget instead.

## R2 — Numbers (core requirement)

> **All numeric values in the system are of the exact rational `Fraction`
> type, modeled after Python's `fractions.Fraction`.**

Concrete rules:

- A `Fraction` is a pair of safe integers `numerator/denominator` kept in
  **canonical form**: denominator > 0 (the sign lives in the numerator) and the
  pair fully reduced (gcd = 1).
- **All arithmetic is exact.** IEEE floating point must never be used to
  compute values in the math layer — `0.1 + 0.2` is exactly `3/10`, and
  matrix products like `1/3 × 1/3` are exactly `1/9`.
- Accepted input syntax: integers (`42`, `-7`), ratios (`3/4`, `6/8` is
  normalized to `3/4`), and decimals (`0.25`, `-.5`) — decimals are converted
  to exact ratios, not floats.
- Invalid text in a cell is a **per-cell error** naming the row and column;
  the widget then produces no value.
- Display format: `n` when the denominator is 1, otherwise `n/d` (e.g.
  `-3/4`). Results on widgets are shown in this exact form.
- Range: safe-integer bounds (`|value| ≤ 2^53`). Operations that would leave
  that range throw; a future BigInt-backed variant is listed under Future.
- The `Fraction` type is the *only* numeric type exposed by widgets, slots,
  and evaluation results. Matrix entries are always `Fraction`s.

## R3 — Matrix widget

- Editable `rows × cols` grid of fraction strings; size adjustable from 1×1 to
  6×6 with stepper buttons (existing values are preserved on resize).
- Default content: the 2×2 identity matrix.
- One **input slot** (`in`) and one **output slot** (`matrix`).
- **Driven mode**: while the input slot is connected, the widget is read-only.
  It shows — and passes on — the incoming matrix; its own grid and steppers are
  replaced by a read-only view, and its own cells are ignored even if invalid.
  Removing the connection restores the editable grid with the previous values.
- While the input slot is connected but carries no value, the widget waits
  (calm state, no error) and produces no output.
- Driven display is typeset with TeX (see R6): a matrix of fractions in round
  parentheses.
- Invalid cell (while not driven) → cell highlighted red and widget error
  message; output value is withheld until all cells parse.

## R4 — Matrix multiply widget

- Two **input slots**: `Left` and `Right` (the left factor and the right factor).
  One **output slot**: the product.
- Computes the exact matrix product over `Fraction`s whenever both inputs
  carry a value.
- Unconnected / upstream-unavailable inputs → widget shows a calm
  "waiting for …" state (not an error).
- Dimension mismatch (`left.cols ≠ right.rows`) → error message with both shapes
  on the widget; no output value.
- The widget shows the shape of the result and its own status; the values
  themselves are shown by whatever widget the product is connected to (e.g. a
  matrix widget driven by it).

## R5 — Graph semantics

- The graph is a DAG of widgets. Evaluation is in topological order; a widget
  sees the values of all its inputs in the same pass.
- Connections into slots that do not exist, dangling connections, and
  self-connections are ignored/rejected.
- Cycles are allowed to be drawn but every widget involved reports
  `Cycle detected`.
- Errors do not cascade further than the widget itself: downstream widgets
  simply receive *no value* on that slot and wait.

## R6 — TeX rendering (read-only values)

- Values a widget did not produce itself (a matrix driven by its input) are
  typeset with TeX instead of being drawn as plain DOM cells: a `pmatrix` —
  exact fractions in round parentheses — with `\frac{1}{2}` for fractions, bare
  integers, and the sign written in front (`-\frac{3}{4}`), rendered by
  [KaTeX](https://katex.org).
- LaTeX is produced by the math layer (`Fraction.toLatex`, `Matrix.toLatex`) and
  is unit-tested there; `src/components/Tex.tsx` only turns that string into
  HTML.
- TeX is a **display** format only: it never parses or computes values, and the
  plain `toString()` form stays authoritative (tests, errors, debug).
- KaTeX is used because it is *synchronous* — `renderToString` returns finished
  HTML with no queued typesetting pass, so there is no asynchronous render
  cycle to keep in step with React state.

### Development policy — the TeX update cycle

If typeset values stop keeping up with the graph (stale formulas, flicker,
remount storms, a matrix that no longer follows its input), the answer *during
development* is to **temporarily stop updating** rather than to debug the
renderer in the middle of another feature:

- flip `FREEZE_TEX_UPDATES` in `src/components/Tex.tsx` to `true`, so every TeX
  block keeps showing the first value it rendered and ignores later ones;
- carry on with the feature at hand;
- treat the update-cycle problem as its own follow-up task, fixed (or
  re-designed) later, with the freeze reverted.

Freezing is deliberately a one-line, revertible measure for development speed:
values may look stale on screen while it is on, but the graph itself is
unaffected.

---

## Architecture

| Layer | Where | Notes |
|---|---|---|
| Math | `src/math/` | `Fraction`, `Matrix` — pure, immutable, unit-tested (incl. LaTeX) |
| Graph | `src/graph/` | widget specs, connection rules, topological evaluation — pure, unit-tested |
| UI | `src/components/` | React Flow (`@xyflow/react`) canvas, custom widget components, graph ⇄ canvas sync (`flowSync.ts`), TeX rendering (`Tex.tsx`) |

React Flow provides only the interaction/geometry mechanics (dragging, slot
hit-testing, wire rendering, pan/zoom). All domain logic — fractions, matrix
arithmetic, connection validity, evaluation — lives in the dependency-free
engine and is covered by Vitest.

State ownership follows React Flow's contract:

- React Flow owns the canvas interaction state — widget positions, measured
  sizes, selection, dragging — and is the only writer of the node/edge arrays,
  which are updated by applying the changes it emits verbatim.
- The domain graph stays the source of truth for widget data, connections and
  values. It is projected onto the canvas with identity-preserving reconciliation
  (`src/components/flowSync.ts`), so objects whose data did not change are handed
  back untouched and React Flow can keep its cached measurements.
- Widget positions re-enter the domain graph when a drag settles
  (`onNodeDragStop`), so the graph remains serializable.

## Future

- More widgets: transpose, inverse, determinant, scalar multiply, sum.
- Serialization of graphs (localStorage / shareable URLs).
- BigInt-backed fractions for values beyond 2^53.
- Pan/zoom-aware port markers, keyboard graph navigation.
