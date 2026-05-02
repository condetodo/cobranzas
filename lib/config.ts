import { prisma } from './db'

export async function getConfig<T>(key: string): Promise<T | null> {
  const row = await prisma.config.findUnique({ where: { key } })
  return row ? (row.value as T) : null
}

export async function getConfigOrThrow<T>(key: string): Promise<T> {
  const value = await getConfig<T>(key)
  if (value === null) throw new Error(`Config key "${key}" not found`)
  return value
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  })
}

// Typed getters for known config keys
export interface AgingThresholds {
  suave: number
  firme: number
  avisoFinal: number
}

// Values are in DAYS by default. When demo.fastMode is true the runner
// interprets them as SECONDS — see getTimeoutMs below.
export interface SequenceTimeouts {
  softToFirm: number
  firmToFinal: number
  finalToEscalated: number
  inConversation: number
}

export type StageChannel = 'EMAIL' | 'WHATSAPP'

export interface SequenceChannels {
  soft: StageChannel
  firm: StageChannel
  final: StageChannel
}

export interface EvolutionConfig {
  url: string           // base URL of Evolution API, e.g. http://165.227.91.139:8080
  instance: string      // instance name, e.g. asistente-atla
  apiKey: string        // Evolution API key (header `apikey`)
  webhookSecret: string // shared secret validated as ?key= on incoming webhook
}

export interface BusinessHours {
  start: string       // "HH:MM" 24h
  end: string         // "HH:MM" 24h
  weekdays: number[]  // 0=Sun, 1=Mon, ..., 6=Sat
  timezone: string    // IANA tz, e.g. "America/Argentina/Buenos_Aires"
}

export const getAgingThresholds = () => getConfigOrThrow<AgingThresholds>('aging.thresholds')
export const getSequenceTimeouts = () => getConfigOrThrow<SequenceTimeouts>('sequence.timeouts')
export const getSequenceChannels = async () =>
  (await getConfig<SequenceChannels>('sequence.channels')) ?? {
    soft: 'EMAIL',
    firm: 'EMAIL',
    final: 'EMAIL',
  }
export const getMaxSendFailures = async () =>
  (await getConfig<number>('sequence.maxSendFailures')) ?? 3
export const getBusinessHours = async () =>
  (await getConfig<BusinessHours>('business.hours')) ?? {
    start: '09:00',
    end: '18:00',
    weekdays: [1, 2, 3, 4, 5],
    timezone: 'America/Argentina/Buenos_Aires',
  }
export const getDemoFastMode = async () => (await getConfig<boolean>('demo.fastMode')) ?? false
export const getDemoEnabled = async () => (await getConfig<boolean>('demo.enabled')) ?? false
export const getContadorEmail = () => getConfigOrThrow<string>('contador.email')
export const getEvolutionConfig = async () =>
  (await getConfig<EvolutionConfig>('whatsapp.evolution')) ?? {
    url: '',
    instance: '',
    apiKey: '',
    webhookSecret: '',
  }
export const getTemplatesCopy = () => getConfigOrThrow<Record<string, string>>('templates.copy')

/**
 * Converts a timeout value to milliseconds.
 * Default semantics = days. In demo fast mode the same value is treated as seconds,
 * so Francisco can flip one checkbox to run the full sequence flow live in a meeting.
 */
export function getTimeoutMs(value: number, fastMode: boolean): number {
  const msPerUnit = fastMode ? 1000 : 86_400_000
  return value * msPerUnit
}
