import { describe, expect, it } from 'vitest'
import { addNode, createGraph, updateMatrixData } from './graph/engine'
import type { Graph } from './graph/types'
import { graphFromHash, shareUrl } from './share'

function smallGraph(): Graph {
  let graph = addNode(createGraph(), 'matrix', 60, 80)
  graph = updateMatrixData(graph, graph.nodes[0].id, { rows: 1, cols: 2, cells: [['1/2', '√2']] })
  return graph
}

describe('shareUrl', () => {
  it('round-trips a graph through the fragment', () => {
    const graph = smallGraph()
    expect(graphFromHash(new URL(shareUrl('https://example.test/app', graph)).hash)).toEqual(graph)
  })

  it('keeps the path and query, and replaces only the fragment', () => {
    const url = shareUrl('https://example.test/app?lang=ru#old', smallGraph())
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/app')
    expect(parsed.search).toBe('?lang=ru')
    expect(parsed.hash.startsWith('#g=')).toBe(true)
  })

  it('produces a fragment that needs no percent-escaping beyond the payload alphabet', () => {
    const hash = new URL(shareUrl('https://example.test/', smallGraph())).hash
    expect(hash).toMatch(/^#g=[A-Za-z0-9_-]+$/)
  })
})

describe('graphFromHash', () => {
  it('reads a graph from a bare hash', () => {
    const graph = smallGraph()
    const hash = new URL(shareUrl('https://example.test/', graph)).hash
    expect(graphFromHash(hash)).toEqual(graph)
  })

  it('returns null when there is no graph in the hash', () => {
    expect(graphFromHash('')).toBeNull()
    expect(graphFromHash('#')).toBeNull()
    expect(graphFromHash('#other=1')).toBeNull()
    expect(graphFromHash('?lang=ru')).toBeNull()
  })

  it('returns null for a corrupt payload instead of throwing', () => {
    expect(graphFromHash('#g=not-a-graph')).toBeNull()
    expect(graphFromHash('#g=!!!')).toBeNull()
  })
})
