import { EventEmitter } from 'node:events'
import type { LiveEvent } from './types'

/**
 * In-memory pub/sub bus for ephemeral live-activity events.
 *
 * Design constraints (see lib/live/types.ts):
 *  - Fire-and-forget: emit() is wrapped in try/catch and NEVER throws, so a bug
 *    here can never break real message/triage processing.
 *  - Listeners MUST be synchronous. An async listener would run its body outside
 *    the emit() try/catch, so a rejection there would NOT be caught here. The
 *    SSE route keeps its listener sync (it only calls res.write).
 *  - Not persisted, no timestamps — the frontend stamps arrival time.
 *
 * Single-process only. On Railway (`next start`, one Node process) every route
 * handler shares this module instance, so events emitted from the
 * incoming-message / triage code reach SSE subscribers. If the app is ever
 * scaled to multiple instances this would need an external pub/sub (Redis), but
 * that's explicitly out of scope for the demo dashboard.
 */
const EVENT = 'activity'

export class LiveActivityBus {
  private readonly emitter = new EventEmitter()

  constructor() {
    // Many concurrent SSE clients (dashboard tabs) + heartbeats. Raise the
    // default cap of 10 so we don't get spurious MaxListeners warnings.
    this.emitter.setMaxListeners(50)
  }

  /** Publish an event. Swallows any error so processing is never affected. */
  emit(event: LiveEvent): void {
    try {
      this.emitter.emit(EVENT, event)
    } catch (err) {
      // Never rethrow — this is observability only.
      console.error('[liveActivity] emit failed:', err)
    }
  }

  /**
   * Subscribe a SYNCHRONOUS listener. Returns an unsubscribe function.
   */
  subscribe(listener: (event: LiveEvent) => void): () => void {
    this.emitter.on(EVENT, listener)
    return () => {
      this.emitter.off(EVENT, listener)
    }
  }

  /** Current number of subscribers (SSE clients). */
  listenerCount(): number {
    return this.emitter.listenerCount(EVENT)
  }
}

/**
 * Singleton. Stored on globalThis so the instance survives Turbopack/HMR module
 * reloads in dev — otherwise emitters and subscribers could end up on different
 * module instances and events would silently not flow.
 */
const globalForLive = globalThis as unknown as {
  liveActivityBus?: LiveActivityBus
}

export const liveActivity =
  globalForLive.liveActivityBus ?? new LiveActivityBus()

if (process.env.NODE_ENV !== 'production') {
  globalForLive.liveActivityBus = liveActivity
}
