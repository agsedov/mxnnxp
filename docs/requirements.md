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
- One **output slot** (`matrix`) carrying the exact matrix.
- Invalid cell → cell highlighted red and widget error message; output value
  is withheld until all cells parse.

## R4 — Matrix multiply widget

- Two **input slots**: `A` and `B`. One **output slot**: `A × B`.
- Computes the exact matrix product over `Fraction`s whenever both inputs
  carry a value.
- Unconnected / upstream-unavailable inputs → widget shows a calm
  "waiting for …" state (not an error).
- Dimension mismatch (`A.cols ≠ B.rows`) → error message with both shapes on
  the widget; no output value.
- The widget shows the result shape and a read-only grid of the result in
  `n/d` form.

## R5 — Graph semantics

- The graph is a DAG of widgets. Evaluation is in topological order; a widget
  sees the values of all its inputs in the same pass.
- Connections into slots that do not exist, dangling connections, and
  self-connections are ignored/rejected.
- Cycles are allowed to be drawn but every widget involved reports
  `Cycle detected`.
- Errors do not cascade further than the widget itself: downstream widgets
  simply receive *no value* on that slot and wait.

---

## Architecture

| Layer | Where | Notes |
|---|---|---|
| Math | `src/math/` | `Fraction`, `Matrix` — pure, immutable, unit-tested |
| Graph | `src/graph/` | widget specs, connection rules, topological evaluation — pure, unit-tested |
| UI | `src/components/` | React Flow (`@xyflow/react`) canvas, custom widget components |

React Flow provides only the interaction/geometry mechanics (dragging, slot
hit-testing, wire rendering, pan/zoom). All domain logic — fractions, matrix
arithmetic, connection validity, evaluation — lives in the dependency-free
engine and is covered by Vitest.

## Future

- More widgets: transpose, inverse, determinant, scalar multiply, sum.
- Serialization of graphs (localStorage / shareable URLs).
- BigInt-backed fractions for values beyond 2^53.
- Pan/zoom-aware port markers, keyboard graph navigation.
