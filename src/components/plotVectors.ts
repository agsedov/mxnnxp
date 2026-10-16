import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'
import type { VectorCanvasMode } from '../graph/types'
import { vectorComponents, vectorCount } from '../graph/vectorCanvas'

/**
 * A vector ready to draw: the exact components (for the label) plus finite
 * display coordinates. The coordinates are a drawing approximation only — the
 * tower's exact `toString()` stays authoritative (see R2 and R8 in
 * docs/requirements.md), and the SVG is never a computed value.
 */
export interface PlotVector {
  readonly components: readonly [Algebraic, Algebraic]
  readonly x: number
  readonly y: number
}

/** Reads an input matrix as plottable vectors, in the given mode. */
export function buildPlotVectors(matrix: Matrix<Algebraic>, mode: VectorCanvasMode): PlotVector[] {
  return Array.from({ length: vectorCount(matrix, mode) }, (_, index) => {
    const components = vectorComponents(matrix, mode, index)
    return { components, x: plotNumber(components[0]), y: plotNumber(components[1]) }
  })
}

/**
 * Display-only approximation of an exact component. Extreme values clamp to a
 * finite magnitude so every SVG coordinate stays valid.
 */
function plotNumber(component: Algebraic): number {
  const value = component.toNumber()
  if (Number.isFinite(value)) return value
  return value < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE
}
