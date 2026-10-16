import type { Connection, Graph, GraphNode, MatrixNodeData, PortDirection, PortRef } from './types'
import { WIDGET_SPECS } from './widgets'

/**
 * Graph serialization: the editable document — every widget with its content
 * and position, plus the wires between them — as one string fit for a link.
 *
 * The payload is a versioned JSON envelope, UTF-8 encoded and written as
 * **unpadded base64url** (RFC 4648 §5), so it can be dropped into a URL
 * (`#g=<payload>`, the fragment keeps it out of server logs) or into
 * `localStorage` with no further escaping.
 *
 * Only the document travels: values are recomputed on load, so the widgets and
 * their wires reappear exactly as they were — and re-evaluate to the same
 * results. Node and connection ids are preserved so the wiring survives.
 */

/** Bumped whenever the payload shape changes; `deserializeGraph` rejects others. */
export const GRAPH_FORMAT_VERSION = 1

/** Thrown when a payload cannot be decoded or does not describe a valid graph. */
export class GraphSerializationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphSerializationError'
  }
}

/** Serializes a graph into a URL-safe base64url string. */
export function serializeGraph(graph: Graph): string {
  const payload = { v: GRAPH_FORMAT_VERSION, nodes: graph.nodes, connections: graph.connections }
  return toBase64Url(JSON.stringify(payload))
}

/**
 * Decodes and validates a graph previously produced by {@link serializeGraph}.
 *
 * Strict on purpose: a shareable link must either restore the graph it was
 * created from or fail loudly — silently dropping widgets or wires would make
 * the same link mean different things. Throws {@link GraphSerializationError}.
 */
export function deserializeGraph(encoded: string): Graph {
  const text = fromBase64Url(encoded)
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new GraphSerializationError('The decoded payload is not valid JSON')
  }
  return parsePayload(value)
}

/** Like {@link deserializeGraph}, but returns `null` instead of throwing. */
export function tryDeserializeGraph(encoded: string): Graph | null {
  try {
    return deserializeGraph(encoded)
  } catch {
    return null
  }
}

// ---------- payload validation ----------

function fail(message: string): never {
  throw new GraphSerializationError(message)
}

function parsePayload(value: unknown): Graph {
  const root = asRecord(value, 'the payload')
  if (root.v !== GRAPH_FORMAT_VERSION) {
    fail(`Unsupported graph format version: ${String(root.v)}`)
  }
  const nodes = parseNodes(root.nodes)
  const byId = new Map(nodes.map(node => [node.id, node]))
  return { nodes, connections: parseConnections(root.connections, byId) }
}

function parseNodes(value: unknown): GraphNode[] {
  const nodes = asArray(value, 'nodes').map((entry, index) => parseNode(entry, `nodes[${index}]`))
  const ids = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) fail(`Duplicate widget id "${node.id}"`)
    ids.add(node.id)
  }
  return nodes
}

function parseNode(value: unknown, where: string): GraphNode {
  const record = asRecord(value, where)
  const id = asString(record.id, `${where}.id`)
  const x = asNumber(record.x, `${where}.x`)
  const y = asNumber(record.y, `${where}.y`)
  const kind = asString(record.kind, `${where}.kind`)
  if (!(kind in WIDGET_SPECS)) fail(`${where}.kind is not a known widget kind: "${kind}"`)
  const widgetKind = kind as GraphNode['kind']
  switch (widgetKind) {
    case 'matrix':
      return { id, kind: widgetKind, x, y, data: parseMatrixData(record.data, `${where}.data`) }
    case 'scalar': {
      const data = asRecord(record.data, `${where}.data`)
      return { id, kind: widgetKind, x, y, data: { value: asString(data.value, `${where}.data.value`) } }
    }
    case 'vectorCanvas': {
      const mode = asString(asRecord(record.data, `${where}.data`).mode, `${where}.data.mode`)
      if (mode !== 'rows' && mode !== 'cols') fail(`${where}.data.mode is neither "rows" nor "cols"`)
      return { id, kind: widgetKind, x, y, data: { mode } }
    }
    case 'rotation': {
      const data = asRecord(record.data, `${where}.data`)
      return { id, kind: widgetKind, x, y, data: { angle: asString(data.angle, `${where}.data.angle`) } }
    }
    case 'matrixMultiply':
    case 'scalarMultiply':
      return { id, kind: widgetKind, x, y }
  }
}

function parseMatrixData(value: unknown, where: string): MatrixNodeData {
  const record = asRecord(value, where)
  const rows = asInteger(record.rows, `${where}.rows`)
  const cols = asInteger(record.cols, `${where}.cols`)
  if (rows < 1 || cols < 1) fail(`${where} has a non-positive size`)
  const cells = asArray(record.cells, `${where}.cells`).map((row, r) => {
    const values = asArray(row, `${where}.cells[${r}]`).map((cell, c) =>
      asString(cell, `${where}.cells[${r}][${c}]`),
    )
    if (values.length !== cols) fail(`${where}.cells[${r}] holds ${values.length} cells, expected ${cols}`)
    return values
  })
  if (cells.length !== rows) fail(`${where}.cells holds ${cells.length} rows, expected ${rows}`)
  return { rows, cols, cells }
}

function parseConnections(value: unknown, nodes: Map<string, GraphNode>): Connection[] {
  const connections = asArray(value, 'connections').map((entry, index) => {
    const where = `connections[${index}]`
    const record = asRecord(entry, where)
    const id = asString(record.id, `${where}.id`)
    const from = parsePortRef(record.from, `${where}.from`, nodes, 'output')
    const to = parsePortRef(record.to, `${where}.to`, nodes, 'input')
    if (from.node === to.node) fail(`${where} connects a widget to itself`)
    return { id, from, to }
  })
  const ids = new Set<string>()
  for (const connection of connections) {
    if (ids.has(connection.id)) fail(`Duplicate connection id "${connection.id}"`)
    ids.add(connection.id)
  }
  return connections
}

function parsePortRef(
  value: unknown,
  where: string,
  nodes: Map<string, GraphNode>,
  direction: PortDirection,
): PortRef {
  const record = asRecord(value, where)
  const node = asString(record.node, `${where}.node`)
  const port = asString(record.port, `${where}.port`)
  const target = nodes.get(node)
  if (!target) fail(`${where} refers to an unknown widget "${node}"`)
  const spec = WIDGET_SPECS[target.kind]
  const ports = direction === 'output' ? spec.outputs : spec.inputs
  if (!ports.some(candidate => candidate.id === port)) {
    fail(`Widget "${target.kind}" has no ${direction} slot "${port}"`)
  }
  return { node, port }
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${where} is not an object`)
  return value as Record<string, unknown>
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) fail(`${where} is not an array`)
  return value
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string') fail(`${where} is not a string`)
  return value
}

function asNumber(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${where} is not a finite number`)
  return value
}

function asInteger(value: unknown, where: string): number {
  const number = asNumber(value, where)
  if (!Number.isInteger(number)) fail(`${where} is not an integer`)
  return number
}

// ---------- base64url (RFC 4648 §5, no padding) ----------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let encoded = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const remaining = bytes.length - index
    const first = bytes[index]
    const second = remaining > 1 ? bytes[index + 1] : 0
    const third = remaining > 2 ? bytes[index + 2] : 0
    encoded += ALPHABET[first >> 2]
    encoded += ALPHABET[((first & 0b11) << 4) | (second >> 4)]
    if (remaining === 1) break
    encoded += ALPHABET[((second & 0b1111) << 2) | (third >> 6)]
    if (remaining === 2) break
    encoded += ALPHABET[third & 0b111111]
  }
  return encoded
}

function fromBase64Url(encoded: string): string {
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const character of encoded) {
    const value = ALPHABET.indexOf(character)
    if (value < 0) throw new GraphSerializationError(`Not valid base64url: unexpected character "${character}"`)
    buffer = (buffer << 6) | value
    bits += 6
    while (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
    buffer &= (1 << bits) - 1
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes))
  } catch {
    throw new GraphSerializationError('Not valid base64url: the bytes are not UTF-8')
  }
}
