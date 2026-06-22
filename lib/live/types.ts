/**
 * Live activity event model — EPHEMERAL, fire-and-forget.
 *
 * These events describe the lifecycle of a unit of work flowing through the
 * backend (an incoming debtor message, or a full portfolio triage run). They
 * are emitted in-process over an EventEmitter bus and streamed to the "En Vivo"
 * dashboard via SSE. They are NEVER persisted and carry NO timestamp — the
 * frontend stamps the arrival time. A failure anywhere in this layer must never
 * affect real processing.
 *
 * This module is isomorphic: it must NOT import anything server-only so the
 * frontend hook and demo scenarios can share the exact same types.
 */

/** Which backend flow produced the event. Drives which diagram lights up. */
export type LiveSource = 'incoming' | 'triage'

/**
 * Lifecycle union. Every event carries a `traceId` correlating all events of a
 * single run, plus the `source` so the UI knows which flow it belongs to.
 */
export type LiveEvent =
  /** Something entered the system (a message arrived / a scan started). */
  | {
      kind: 'received'
      source: LiveSource
      traceId: string
      /** EMAIL | WHATSAPP for messages; omitted for triage. */
      channel?: string
      /** Display name of the sender (razón social) or address. */
      sender?: string
      /** Short text preview of what came in. */
      preview?: string
      /** Free-form label for non-message sources (e.g. "Scan de cartera"). */
      label?: string
    }
  /** A routing decision was made (Agent C classified the message). */
  | {
      kind: 'classified'
      source: LiveSource
      traceId: string
      category: string
      /** 0..1 confidence, when the classifier reports it. */
      confidence?: number
    }
  /** The branch / path was chosen. */
  | {
      kind: 'routed'
      source: LiveSource
      traceId: string
      /** Branch key — must match a node in the frontend flow constant. */
      route: string
    }
  /** A worker / stage began. */
  | {
      kind: 'started'
      source: LiveSource
      traceId: string
      stage: string
    }
  /** A sub-step began. */
  | {
      kind: 'step_started'
      source: LiveSource
      traceId: string
      step: string
    }
  /** A sub-step finished, ok or with error. */
  | {
      kind: 'step_finished'
      source: LiveSource
      traceId: string
      step: string
      ok: boolean
      detail?: string
    }
  /** The run finished — final result + metrics. */
  | {
      kind: 'finished'
      source: LiveSource
      traceId: string
      /** Final branch taken, when applicable. */
      route?: string
      /** End-to-end latency in milliseconds. */
      latencyMs?: number
      /** How many sub-steps ran. */
      steps?: number
      /** Preview of what was produced (e.g. the reply text). */
      preview?: string
    }

export type LiveEventKind = LiveEvent['kind']

/** Shape returned by GET /api/live/recent to seed the feed on connect. */
export interface LiveRecentItem {
  source: string
  sender: string
  preview: string
  /** ISO timestamp. */
  at: string
}

export interface LiveRecentResponse {
  feed: LiveRecentItem[]
}
