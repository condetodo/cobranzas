import type { LiveEvent, LiveSource } from '@/lib/live/types'

/**
 * Static description of each backend flow as a diagram. Out of scope to make
 * this configurable from the UI (YAGNI) — workers/stages live here as a const.
 */
export interface FlowNode {
  key: string
  label: string
  /** Accent color for this worker/stage (hex). */
  accent: string
  /** Branch nodes hang off the router; rendered as a fan-out. */
  branch?: boolean
}

export interface FlowDef {
  source: LiveSource
  title: string
  /** Linear spine of the diagram. */
  spine: FlowNode[]
  /** Branches that fan out after the spine (incoming only). */
  branches: FlowNode[]
}

const INCOMING: FlowDef = {
  source: 'incoming',
  title: 'Mensaje entrante',
  spine: [
    { key: 'reception', label: 'Recepción', accent: '#38bdf8' },
    { key: 'classifier', label: 'Agent C · Clasificador', accent: '#a78bfa' },
    { key: 'router', label: 'Router', accent: '#f472b6' },
  ],
  branches: [
    { key: 'conversacional', label: 'Conversacional · Agent E', accent: '#34d399', branch: true },
    { key: 'contador', label: 'Contador', accent: '#fbbf24', branch: true },
    { key: 'escalamiento', label: 'Escalamiento', accent: '#f87171', branch: true },
    { key: 'auto_reply', label: 'Auto-reply · ignorado', accent: '#94a3b8', branch: true },
  ],
}

const TRIAGE: FlowDef = {
  source: 'triage',
  title: 'Triage de cartera',
  spine: [
    { key: 'reception', label: 'Recepción · Scan', accent: '#38bdf8' },
    { key: 'scoring', label: 'Scoring + Buckets', accent: '#a78bfa' },
    { key: 'agentA', label: 'Agent A · Insights', accent: '#34d399' },
    { key: 'agentB', label: 'Agent B · Cartera', accent: '#fbbf24' },
    { key: 'result', label: 'Resultado', accent: '#f472b6' },
  ],
  branches: [],
}

export const FLOWS: Record<LiveSource, FlowDef> = {
  incoming: INCOMING,
  triage: TRIAGE,
}

export function getFlow(source: LiveSource): FlowDef {
  return FLOWS[source]
}

/** All nodes (spine + branches) of a flow. */
export function allNodes(flow: FlowDef): FlowNode[] {
  return [...flow.spine, ...flow.branches]
}

/** Map an `incoming` route value to its branch node key. */
const ROUTE_TO_NODE: Record<string, string> = {
  conversacional: 'conversacional',
  contador: 'contador',
  escalamiento: 'escalamiento',
  auto_reply: 'auto_reply',
  ignored: 'router',
}

/** Map a triage `started.stage` string to a spine node key. */
const STAGE_TO_NODE: Record<string, string> = {
  // incoming stages
  'Conversacional (Agent E)': 'conversacional',
  Contador: 'contador',
  Escalamiento: 'escalamiento',
  // triage stages
  'Fase 1: Scoring': 'scoring',
  'Fase 2: Insights (Agent A)': 'agentA',
  'Fase 3: Análisis de cartera (Agent B)': 'agentB',
}

/**
 * Given an event, which diagram node should be highlighted? Returns null to
 * leave the current highlight untouched (e.g. step events).
 */
export function nodeForEvent(event: LiveEvent): string | null {
  switch (event.kind) {
    case 'received':
      return 'reception'
    case 'classified':
      return 'classifier'
    case 'routed':
      return ROUTE_TO_NODE[event.route] ?? 'router'
    case 'started':
      return STAGE_TO_NODE[event.stage] ?? null
    case 'finished':
      return event.source === 'triage' ? 'result' : null
    default:
      return null
  }
}
