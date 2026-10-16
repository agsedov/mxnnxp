import { serializeGraph, tryDeserializeGraph } from './graph/serialize'
import type { Graph } from './graph/types'

/**
 * Shareable-link plumbing: a graph rides in the URL **fragment** as
 * `#g=<base64url>` (see `serializeGraph`). The fragment is used rather than a
 * query parameter so a large graph neither hits query-length limits nor reaches
 * the server. The functions here are pure string/URL work — the UI decides when
 * to read and write them.
 */

/** Fragment key that carries a serialized graph. */
export const GRAPH_HASH_KEY = 'g'

/**
 * Reads the shared graph out of a URL hash (`#g=<base64url>`).
 *
 * Returns `null` when the hash carries no graph or the payload is not one, so a
 * broken or stale link quietly falls back to the default scene instead of
 * failing to start.
 */
export function graphFromHash(hash: string): Graph | null {
  const payload = new URLSearchParams(hash.replace(/^#/, '')).get(GRAPH_HASH_KEY)
  return payload === null ? null : tryDeserializeGraph(payload)
}

/** The shareable link for `graph`: `href` with its fragment replaced by the graph. */
export function shareUrl(href: string, graph: Graph): string {
  const url = new URL(href)
  url.hash = new URLSearchParams({ [GRAPH_HASH_KEY]: serializeGraph(graph) }).toString()
  return url.toString()
}
