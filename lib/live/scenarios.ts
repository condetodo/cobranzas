import type { LiveEvent, LiveSource } from './types'

/**
 * Pre-built demo timelines. Same event shapes as the live stream — only the
 * SOURCE of events differs (these are local, zero-backend). Used by the "🎬
 * Demo" mode so presentations work even if the backend is down.
 */
export interface TimelineEntry {
  /** Delay (ms) AFTER the previous entry before dispatching this event. */
  delayMs: number
  event: LiveEvent
}

export interface DemoScenario {
  id: string
  title: string
  description: string
  source: LiveSource
  timeline: TimelineEntry[]
}

/** Distributive Omit so the helper keeps each union variant's own fields. */
type DistribOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

/** Build a timeline injecting `source`/`traceId` into every event. */
function build(
  source: LiveSource,
  traceId: string,
  steps: Array<{ d: number; e: DistribOmit<LiveEvent, 'source' | 'traceId'> }>
): TimelineEntry[] {
  return steps.map(({ d, e }) => ({
    delayMs: d,
    event: { ...e, source, traceId } as LiveEvent,
  }))
}

const CONVERSACIONAL: DemoScenario = {
  id: 'conversacional',
  title: 'Deudor confirma pago',
  description: 'WhatsApp · el deudor avisa que paga — Agent E responde',
  source: 'incoming',
  timeline: build('incoming', 'demo-conv', [
    {
      d: 200,
      e: {
        kind: 'received',
        channel: 'WHATSAPP',
        sender: 'Comercial Andina SA',
        preview: 'Disculpá la demora, te confirmo que pago el viernes sin falta',
      },
    },
    { d: 400, e: { kind: 'step_started', step: 'Clasificar (Agent C)' } },
    { d: 900, e: { kind: 'step_finished', step: 'Clasificar (Agent C)', ok: true } },
    { d: 150, e: { kind: 'classified', category: 'PAGARA', confidence: 0.88 } },
    { d: 400, e: { kind: 'routed', route: 'conversacional' } },
    { d: 200, e: { kind: 'started', stage: 'Conversacional (Agent E)' } },
    { d: 300, e: { kind: 'step_started', step: 'Generar respuesta (Agent E)' } },
    { d: 1200, e: { kind: 'step_finished', step: 'Generar respuesta (Agent E)', ok: true } },
    { d: 200, e: { kind: 'step_started', step: 'Enviar respuesta' } },
    { d: 700, e: { kind: 'step_finished', step: 'Enviar respuesta', ok: true } },
    {
      d: 300,
      e: {
        kind: 'finished',
        route: 'conversacional',
        latencyMs: 3400,
        steps: 2,
        preview:
          '¡Gracias Comercial Andina! Quedamos a la espera del pago el viernes. Cualquier cosa, avisanos.',
      },
    },
  ]),
}

const COMPROBANTE: DemoScenario = {
  id: 'comprobante',
  title: 'Llega un comprobante',
  description: 'WhatsApp · adjunta comprobante — deriva al contador',
  source: 'incoming',
  timeline: build('incoming', 'demo-comp', [
    {
      d: 200,
      e: {
        kind: 'received',
        channel: 'WHATSAPP',
        sender: 'Distribuidora del Sur SA',
        preview: 'Hola, ya pagué la factura, les paso el comprobante 📎',
      },
    },
    { d: 400, e: { kind: 'step_started', step: 'Clasificar (Agent C)' } },
    { d: 900, e: { kind: 'step_finished', step: 'Clasificar (Agent C)', ok: true } },
    { d: 150, e: { kind: 'classified', category: 'COMPROBANTE_ADJUNTO', confidence: 0.96 } },
    { d: 400, e: { kind: 'routed', route: 'contador' } },
    { d: 200, e: { kind: 'started', stage: 'Contador' } },
    { d: 300, e: { kind: 'step_started', step: 'Transición → AWAITING_ACCOUNTANT' } },
    { d: 500, e: { kind: 'step_finished', step: 'Transición → AWAITING_ACCOUNTANT', ok: true } },
    { d: 200, e: { kind: 'step_started', step: 'Enviar al contador' } },
    { d: 800, e: { kind: 'step_finished', step: 'Enviar al contador', ok: true } },
    {
      d: 300,
      e: {
        kind: 'finished',
        route: 'contador',
        latencyMs: 3150,
        steps: 3,
        preview: 'Comprobante enviado al contador para confirmación.',
      },
    },
  ]),
}

const TRIAGE: DemoScenario = {
  id: 'triage',
  title: 'Scan de cartera (A + B)',
  description: 'Análisis completo de cartera — scoring, Agent A y Agent B',
  source: 'triage',
  timeline: build('triage', 'demo-triage', [
    { d: 200, e: { kind: 'received', label: 'Scan de cartera', preview: 'Origen: MANUAL' } },
    { d: 300, e: { kind: 'started', stage: 'Fase 1: Scoring' } },
    { d: 100, e: { kind: 'step_started', step: 'Scoring + buckets' } },
    { d: 1200, e: { kind: 'step_finished', step: 'Scoring + buckets', ok: true, detail: '142 deudores' } },
    { d: 200, e: { kind: 'started', stage: 'Fase 2: Insights (Agent A)' } },
    { d: 100, e: { kind: 'step_started', step: 'Insights por deudor (Agent A)' } },
    {
      d: 2500,
      e: {
        kind: 'step_finished',
        step: 'Insights por deudor (Agent A)',
        ok: true,
        detail: '50 deudores enriquecidos',
      },
    },
    { d: 200, e: { kind: 'started', stage: 'Fase 3: Análisis de cartera (Agent B)' } },
    { d: 100, e: { kind: 'step_started', step: 'Análisis de cartera (Agent B)' } },
    { d: 2200, e: { kind: 'step_finished', step: 'Análisis de cartera (Agent B)', ok: true } },
    {
      d: 300,
      e: {
        kind: 'finished',
        route: 'triage',
        latencyMs: 9000,
        steps: 3,
        preview: '142 deudores · $4.820.000',
      },
    },
  ]),
}

export const DEMO_SCENARIOS: DemoScenario[] = [CONVERSACIONAL, COMPROBANTE, TRIAGE]
