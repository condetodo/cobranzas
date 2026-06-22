'use client'

import { Activity, Check, Loader2, Play, Radio, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFlow, type FlowDef, type FlowNode } from './flow'
import { useActivityStream, type FeedItem, type SubStep } from './use-activity-stream'

export function LiveDashboard() {
  const { state, mode, setMode, connected, playing, scenarios, playScenario } =
    useActivityStream()

  const flow: FlowDef = getFlow(state.source ?? 'incoming')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Activity className="h-6 w-6 text-emerald-400" />
              En Vivo
            </h1>
            <p className="text-sm text-slate-400">
              El sistema por dentro, en tiempo real
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-sm">
              <button
                onClick={() => setMode('live')}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition-colors',
                  mode === 'live'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                🟢 En vivo
              </button>
              <button
                onClick={() => setMode('demo')}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition-colors',
                  mode === 'demo'
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                🎬 Demo
              </button>
            </div>

            {/* Connection status (live only) */}
            {mode === 'live' && (
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                  connected
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'bg-rose-500/10 text-rose-300'
                )}
              >
                <Radio className="h-3.5 w-3.5" />
                {connected ? 'Conectado' : 'Desconectado'}
              </span>
            )}
          </div>
        </div>

        {/* Demo controls */}
        {mode === 'demo' && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => playScenario(s)}
                disabled={playing}
                title={s.description}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-violet-500/50 hover:bg-slate-800 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5 text-violet-400" />
                {s.title}
              </button>
            ))}
            {playing && (
              <span className="flex items-center gap-1.5 text-xs text-violet-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reproduciendo…
              </span>
            )}
          </div>
        )}

        {/* Live disconnected hint */}
        {mode === 'live' && !connected && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            No se pudo conectar al stream. Reintentando automáticamente… mientras
            tanto podés usar el <strong>modo Demo</strong>.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: diagram + steps */}
          <div className="space-y-4 lg:col-span-2">
            <FlowDiagram flow={flow} activeKey={state.activeNodeKey} />
            <StatusPanel
              steps={state.steps}
              result={state.result}
              running={state.running}
              activeLabel={
                flow.spine.concat(flow.branches).find((n) => n.key === state.activeNodeKey)
                  ?.label ?? '—'
              }
            />
          </div>

          {/* Right: active item + feed */}
          <div className="space-y-4">
            <ActiveItemCard state={state} />
            <Feed feed={state.feed} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────── Flow diagram ────────────────────────── */

function nodeStatus(
  flow: FlowDef,
  node: FlowNode,
  activeKey: string | null
): 'active' | 'done' | 'idle' {
  if (node.key === activeKey) return 'active'
  const spineKeys = flow.spine.map((n) => n.key)
  const activeIndex = spineKeys.indexOf(activeKey ?? '')
  const nodeIndex = spineKeys.indexOf(node.key)
  // Active node is on a branch → whole spine has been traversed.
  const activeIsBranch = activeKey != null && activeIndex === -1
  if (nodeIndex !== -1 && (activeIsBranch || (activeIndex !== -1 && nodeIndex < activeIndex))) {
    return 'done'
  }
  return 'idle'
}

function FlowDiagram({ flow, activeKey }: { flow: FlowDef; activeKey: string | null }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {flow.title}
      </h2>

      {/* Spine */}
      <div className="flex flex-wrap items-center gap-2">
        {flow.spine.map((node, i) => (
          <div key={node.key} className="flex items-center gap-2">
            <DiagramNode node={node} status={nodeStatus(flow, node, activeKey)} />
            {i < flow.spine.length - 1 && (
              <span className="text-slate-600">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Branches */}
      {flow.branches.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-600">
            Ramas del router
          </p>
          <div className="flex flex-wrap gap-2">
            {flow.branches.map((node) => (
              <DiagramNode
                key={node.key}
                node={node}
                status={nodeStatus(flow, node, activeKey)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DiagramNode({
  node,
  status,
}: {
  node: FlowNode
  status: 'active' | 'done' | 'idle'
}) {
  const active = status === 'active'
  const done = status === 'done'
  return (
    <div
      style={
        active
          ? {
              borderColor: node.accent,
              boxShadow: `0 0 0 1px ${node.accent}, 0 0 22px ${node.accent}55`,
            }
          : done
            ? { borderColor: `${node.accent}66` }
            : undefined
      }
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-300',
        active
          ? 'scale-105 bg-slate-800'
          : done
            ? 'bg-slate-900/80 text-slate-300'
            : 'border-slate-800 bg-slate-900/40 text-slate-500'
      )}
    >
      <span
        className="flex items-center gap-1.5"
        style={active ? { color: node.accent } : undefined}
      >
        {active && (
          <span
            className="h-2 w-2 animate-pulse rounded-full"
            style={{ backgroundColor: node.accent }}
          />
        )}
        {node.label}
      </span>
    </div>
  )
}

/* ────────────────────────── Status panel ────────────────────────── */

function StatusPanel({
  steps,
  result,
  running,
  activeLabel,
}: {
  steps: SubStep[]
  result: LiveState_Result
  running: boolean
  activeLabel: string
}) {
  const done = steps.filter((s) => s.status === 'done').length
  const total = steps.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Procesamiento
        </h2>
        <span className="text-xs text-slate-400">
          Etapa: <span className="text-slate-200">{activeLabel}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>
            {done}/{total || 0} pasos
          </span>
          <span>{result?.latencyMs != null ? `${result.latencyMs} ms` : running ? '…' : ''}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Sub-steps */}
      {steps.length === 0 ? (
        <p className="text-sm text-slate-500">
          {running ? 'Iniciando…' : 'Esperando actividad…'}
        </p>
      ) : (
        <ul className="space-y-2">
          {steps.map((s, i) => (
            <li key={`${s.step}-${i}`} className="flex items-center gap-2 text-sm">
              <StepIcon status={s.status} />
              <span
                className={cn(
                  s.status === 'done'
                    ? 'text-slate-300'
                    : s.status === 'error'
                      ? 'text-rose-300'
                      : 'text-slate-100'
                )}
              >
                {s.step}
              </span>
              {s.detail && <span className="text-xs text-slate-500">· {s.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {result?.preview && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-600">
            Resultado
          </p>
          {result.preview}
        </div>
      )}
    </div>
  )
}

type LiveState_Result = {
  latencyMs?: number
  steps?: number
  preview?: string
  route?: string
} | null

function StepIcon({ status }: { status: SubStep['status'] }) {
  if (status === 'done') return <Check className="h-4 w-4 shrink-0 text-emerald-400" />
  if (status === 'error') return <X className="h-4 w-4 shrink-0 text-rose-400" />
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-400" />
}

/* ────────────────────────── Active item ────────────────────────── */

function ActiveItemCard({
  state,
}: {
  state: ReturnType<typeof useActivityStream>['state']
}) {
  const item = state.item
  if (!item) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-500">
        Sin actividad por ahora.
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        En proceso
      </h2>
      <p className="font-semibold text-slate-100">{item.sender ?? '—'}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        {item.channel && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
            {item.channel}
          </span>
        )}
        {item.category && (
          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-violet-300">
            {item.category}
            {item.confidence != null && ` · ${Math.round(item.confidence * 100)}%`}
          </span>
        )}
      </div>
      {item.preview && (
        <p className="mt-3 text-sm italic text-slate-400">“{item.preview}”</p>
      )}
    </div>
  )
}

/* ────────────────────────── Feed ────────────────────────── */

function Feed({ feed }: { feed: FeedItem[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Entrantes
      </h2>
      {feed.length === 0 ? (
        <p className="text-sm text-slate-500">Sin entrantes recientes.</p>
      ) : (
        <ul className="space-y-2">
          {feed.map((f) => (
            <li
              key={f.id}
              className={cn(
                'rounded-lg border px-3 py-2 transition-colors',
                f.active
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/40'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-200">
                  {f.sender}
                </span>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {formatTime(f.at)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                  {f.source}
                </span>
                {f.category && <span className="text-violet-300">{f.category}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
