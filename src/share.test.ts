import { describe, expect, it } from 'vitest'
import { addNode, createGraph, updateMatrixData } from './graph/engine'
import type { Graph } from './graph/types'
import { graphFragment, graphFromHash, hasGraphHash, shareUrl } from './share'

function smallGraph(): Graph {
  let graph = addNode(createGraph(), 'matrix', 60, 80)
  graph = updateMatrixData(graph, graph.nodes[0].id, { rows: 1, cols: 2, cells: [['1/2', '√2']] })
  return graph
}

describe('shareUrl', () => {
  it('round-trips a graph through the fragment', async () => {
    const graph = smallGraph()
    expect(await graphFromHash(new URL(await shareUrl('https://example.test/app', graph)).hash)).toEqual(graph)
  })

  it('keeps the path and query, and replaces only the fragment', async () => {
    const url = await shareUrl('https://example.test/app?lang=ru#old', smallGraph())
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/app')
    expect(parsed.search).toBe('?lang=ru')
    expect(parsed.hash.startsWith('#g=')).toBe(true)
  })

  it('produces a fragment that needs no percent-escaping beyond the payload alphabet', async () => {
    const hash = new URL(await shareUrl('https://example.test/', smallGraph())).hash
    expect(hash).toMatch(/^#g=[A-Za-z0-9_-]+$/)
  })
})

describe('graphFragment', () => {
  it('produces the bare `g=…` string a share link carries after its `#`', async () => {
    const graph = smallGraph()
    const fragment = await graphFragment(graph)
    expect(fragment).toMatch(/^g=[A-Za-z0-9_-]+$/)
    expect(`#${fragment}`).toBe(new URL(await shareUrl('https://example.test/', graph)).hash)
  })

  it('decodes back into the same graph via graphFromHash', async () => {
    const graph = smallGraph()
    expect(await graphFromHash(`#${await graphFragment(graph)}`)).toEqual(graph)
  })
})

describe('graphFromHash', () => {
  it('reads a graph from a bare hash', async () => {
    const graph = smallGraph()
    const hash = new URL(await shareUrl('https://example.test/', graph)).hash
    expect(await graphFromHash(hash)).toEqual(graph)
  })

  it('returns null when there is no graph in the hash', async () => {
    expect(await graphFromHash('')).toBeNull()
    expect(await graphFromHash('#')).toBeNull()
    expect(await graphFromHash('#other=1')).toBeNull()
    expect(await graphFromHash('?lang=ru')).toBeNull()
  })

  it('returns null for a corrupt payload instead of throwing', async () => {
    expect(await graphFromHash('#g=not-a-graph')).toBeNull()
    expect(await graphFromHash('#g=!!!')).toBeNull()
  })
})

describe('hasGraphHash', () => {
  it('reports whether a hash carries a graph payload, without decoding it', async () => {
    expect(hasGraphHash(new URL(await shareUrl('https://example.test/', smallGraph())).hash)).toBe(true)
    expect(hasGraphHash('#g=whatever')).toBe(true)
    expect(hasGraphHash('#other=1')).toBe(false)
    expect(hasGraphHash('?lang=ru')).toBe(false)
    expect(hasGraphHash('')).toBe(false)
  })
})
