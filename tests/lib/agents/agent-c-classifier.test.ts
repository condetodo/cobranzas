import { describe, it, expect } from 'vitest'
import { ClassificationSchema } from '@/lib/agents/agent-c-classifier'

describe('ClassificationSchema', () => {
  it('validates a correct classification', () => {
    const valid = { categoria: 'PAGARA', confianza: 0.95, metadata: { montoDetectado: 15000 } }
    expect(ClassificationSchema.parse(valid)).toEqual(valid)
  })

  it('rejects invalid category', () => {
    expect(() =>
      ClassificationSchema.parse({ categoria: 'UNKNOWN', confianza: 0.5 })
    ).toThrow()
  })

  it('rejects confidence out of range', () => {
    expect(() =>
      ClassificationSchema.parse({ categoria: 'PAGARA', confianza: 1.5 })
    ).toThrow()
  })

  it('validates without metadata', () => {
    const valid = { categoria: 'DISPUTA', confianza: 0.8 }
    expect(ClassificationSchema.parse(valid)).toEqual(valid)
  })

  it('validates all valid categories', () => {
    const categories = ['PAGARA', 'COMPROBANTE_ADJUNTO', 'NEGOCIANDO', 'DISPUTA', 'AUTO_REPLY', 'OTRO'] as const
    for (const categoria of categories) {
      expect(() => ClassificationSchema.parse({ categoria, confianza: 0.5 })).not.toThrow()
    }
  })

  it('rejects negative confidence', () => {
    expect(() =>
      ClassificationSchema.parse({ categoria: 'OTRO', confianza: -0.1 })
    ).toThrow()
  })

  it('validates metadata with fecha', () => {
    const valid = {
      categoria: 'NEGOCIANDO',
      confianza: 0.7,
      metadata: { fechaDetectada: '2026-04-20' },
    }
    expect(ClassificationSchema.parse(valid)).toEqual(valid)
  })
})
