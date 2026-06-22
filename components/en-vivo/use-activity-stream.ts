'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { LiveEvent, LiveSource, LiveRecentResponse } from '@/lib/live/types'
import { nodeForEvent } from './flow'
import { DEMO_SCENARIOS, type DemoScenario } from '@/lib/live/scenarios'

export type Mode = 'live' | 'demo'

export interface SubStep {
  step: string
  status: 'running' | 'done' | 'error'
  detail?: string
}

export interface FeedItem {
  id: string
  sender: string
  source: string
  preview?: string
  category?: string
  at: number
  active: boolean
}

export interface ActiveItem {
  sender?: string
  preview?: string
  channel?: string
  category?: string
  confidence?: number
  route?: string
}

export interface LiveState {
  source: LiveSource | null
  traceId: string | null
  activeNodeKey: string | null
  item: ActiveItem | null
  steps: SubStep[]
  result: { latencyMs?: number; steps?: number; preview?: string; route?: string } | null
  running: boolean
  feed: FeedItem[]
}

type Action =
  | LiveEvent
  | { kind: 'seed'; feed: FeedItem[] }
  | { kind: 'reset' }

const MAX_FEED = 8

const initialState: LiveState = {
  source: null,
  traceId: null,
  activeNodeKey: null,
  item: null,
  steps: [],
  result: null,
  running: false,
  feed: [],
}

function reduce(state: LiveState, action: Action): LiveState {
  switch (action.kind) {
    case 'reset':
      return { ...initialState, feed: state.feed.map((f) => ({ ...f, active: false })) }

    case 'seed':
      // Only seed when we don't already have a populated feed.
      return state.feed.length ? state : { ...state, feed: action.feed }

    case 'received': {
      const sender = action.sender ?? action.label ?? '—'
      const feedItem: FeedItem = {
        id: action.traceId,
        sender,
        source: action.channel ?? action.source,
        preview: action.preview,
        at: Date.now(),
        active: true,
      }
      const feed = [feedItem, ...state.feed.map((f) => ({ ...f, active: false }))].slice(
        0,
        MAX_FEED
      )
      return {
        source: action.source,
        traceId: action.traceId,
        activeNodeKey: 'reception',
        item: { sender: action.sender ?? action.label, preview: action.preview, channel: action.channel },
        steps: [],
        result: null,
        running: true,
        feed,
      }
    }

    case 'classified':
      if (action.traceId !== state.traceId) return state
      return {
        ...state,
        activeNodeKey: 'classifier',
        item: { ...state.item, category: action.category, confidence: action.confidence },
        feed: state.feed.map((f) =>
          f.id === action.traceId ? { ...f, category: action.category } : f
        ),
      }

    case 'routed':
      if (action.traceId !== state.traceId) return state
      return {
        ...state,
        activeNodeKey: nodeForEvent(action) ?? state.activeNodeKey,
        item: { ...state.item, route: action.route },
      }

    case 'started': {
      if (action.traceId !== state.traceId) return state
      const node = nodeForEvent(action)
      return node ? { ...state, activeNodeKey: node } : state
    }

    case 'step_started':
      if (action.traceId !== state.traceId) return state
      return { ...state, steps: [...state.steps, { step: action.step, status: 'running' }] }

    case 'step_finished':
      if (action.traceId !== state.traceId) return state
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.step === action.step && s.status === 'running'
            ? { ...s, status: action.ok ? 'done' : 'error', detail: action.detail }
            : s
        ),
      }

    case 'finished':
      if (action.traceId !== state.traceId) return state
      return {
        ...state,
        running: false,
        activeNodeKey: nodeForEvent(action) ?? state.activeNodeKey,
        result: {
          latencyMs: action.latencyMs,
          steps: action.steps,
          preview: action.preview,
          route: action.route,
        },
        feed: state.feed.map((f) => (f.id === action.traceId ? { ...f, active: false } : f)),
      }

    default:
      return state
  }
}

export function useActivityStream() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [mode, setModeState] = useState<Mode>('live')
  const [connected, setConnected] = useState(false)
  const [playing, setPlaying] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  // LIVE mode: seed the feed, then open the SSE stream. EventSource auto-retries
  // on its own; we just track the connected flag.
  useEffect(() => {
    if (mode !== 'live') return

    let cancelled = false
    dispatch({ kind: 'reset' })

    fetch('/api/live/recent', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<LiveRecentResponse>) : null))
      .then((data) => {
        if (cancelled || !data?.feed) return
        const seed: FeedItem[] = data.feed.map((it, i) => ({
          id: `seed_${i}`,
          sender: it.sender,
          source: it.source,
          preview: it.preview,
          at: Date.parse(it.at) || Date.now(),
          active: false,
        }))
        dispatch({ kind: 'seed', feed: seed })
      })
      .catch(() => {
        /* feed seeding is best-effort */
      })

    const es = new EventSource('/api/live/stream')
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      try {
        dispatch(JSON.parse(e.data) as LiveEvent)
      } catch {
        // Non-JSON payload (e.g. a stray ping) — ignore.
      }
    }

    return () => {
      cancelled = true
      es.close()
      setConnected(false)
    }
  }, [mode])

  // Always tear down demo timers on unmount.
  useEffect(() => clearTimers, [clearTimers])

  const setMode = useCallback(
    (m: Mode) => {
      clearTimers()
      setPlaying(false)
      dispatch({ kind: 'reset' })
      setModeState(m)
    },
    [clearTimers]
  )

  const playScenario = useCallback(
    (scenario: DemoScenario) => {
      clearTimers()
      dispatch({ kind: 'reset' })
      setPlaying(true)
      let acc = 0
      scenario.timeline.forEach(({ delayMs, event }, idx) => {
        acc += delayMs
        const t = setTimeout(() => {
          dispatch(event)
          if (idx === scenario.timeline.length - 1) setPlaying(false)
        }, acc)
        timersRef.current.push(t)
      })
    },
    [clearTimers]
  )

  return {
    state,
    mode,
    setMode,
    connected,
    playing,
    scenarios: DEMO_SCENARIOS,
    playScenario,
  }
}
