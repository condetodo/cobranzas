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

export interface SequenceTimeouts {
  softToFirm: number
  firmToFinal: number
  finalToEscalated: number
}

export const getAgingThresholds = () => getConfigOrThrow<AgingThresholds>('aging.thresholds')
export const getSequenceTimeouts = () => getConfigOrThrow<SequenceTimeouts>('sequence.timeouts')
export const getContadorEmail = () => getConfigOrThrow<string>('contador.email')
export const getTemplatesCopy = () => getConfigOrThrow<Record<string, string>>('templates.copy')
