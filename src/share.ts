import { serializeGraph, tryDeserializeGraph } from './graph/serialize'
import type { Graph } from './graph/types'

/**
 * Shareable-link plumbing: a graph rides in the URL **fragment** as
 * `#g=<deflated base64url>` (see `serializeGraph`). The fragment is used rather
 * than a query parameter so a large graph neither hits query-length limits nor
 * reaches the server. The functions here are pure string/URL work — the UI
 * decides when to read and write them.
 */

/** Fragment key that carries a serialized graph. */
export const GRAPH_HASH_KEY = 'g'

/** The raw payload a hash carries, or `null` when it carries none. */
function payloadFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(GRAPH_HASH_KEY)
}

/**
 * Whether a hash carries a graph payload. Synchronous on purpose: the UI uses
 * this to tell a shared link apart from a plain visit *before* the (async)
 * decode resolves, so the default scene never flashes under a shared one.
 */
export function hasGraphHash(hash: string): boolean {
  return payloadFromHash(hash) !== null
}

/**
 * Reads the shared graph out of a URL hash (`#g=<deflated base64url>`).
 *
 * Returns `null` when the hash carries no graph or the payload is not one, so a
 * broken or stale link quietly falls back to the default scene instead of
 * failing to start.
 */
export async function graphFromHash(hash: string): Promise<Graph | null> {
  const payload = payloadFromHash(hash)
  return payload === null ? null : tryDeserializeGraph(payload)
}

/**
 * The bare fragment for `graph`, e.g. `g=<deflated base64url>` — the exact string
 * a share link carries after its `#`. Useful on its own: it can be pasted after
 * any link to the app without having to strip a full URL apart first.
 */
export async function graphFragment(graph: Graph): Promise<string> {
  return new URLSearchParams({ [GRAPH_HASH_KEY]: await serializeGraph(graph) }).toString()
}

/** The shareable link for `graph`: `href` with its fragment replaced by the graph. */
export async function shareUrl(href: string, graph: Graph): Promise<string> {
  const url = new URL(href)
  url.hash = await graphFragment(graph)
  return url.toString()
}
