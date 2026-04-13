import { describe, it, expect } from 'vitest'
import XLSX from 'xlsx'
import { parseClients } from '@/lib/excel/parse-clients'

function createTestXlsx(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

describe('parseClients', () => {
  it('parses valid client rows correctly', () => {
    const buffer = createTestXlsx([
      {
        COD: 'C001',
        RAZON_SOCIAL: 'Empresa Uno S.A.',
        MAIL: 'contacto@empresa.com',
        TELEFONO: '1122334455',
        TELEGRAM: '@empresa_uno',
        CATEGORIA: 'A',
      },
      {
        COD: 'C002',
        RAZON_SOCIAL: '  Empresa Dos  ',
        MAIL: '',
        TELEFONO: '',
        TELEGRAM: '',
        CATEGORIA: '',
      },
    ])

    const result = parseClients(buffer)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)

    expect(result.rows[0]).toEqual({
      cod: 'C001',
      razonSocial: 'Empresa Uno S.A.',
      email: 'contacto@empresa.com',
      telefono: '1122334455',
      telegram: '@empresa_uno',
      categoria: 'A',
    })

    expect(result.rows[1]).toEqual({
      cod: 'C002',
      razonSocial: 'Empresa Dos',
      email: null,
      telefono: null,
      telegram: null,
      categoria: null,
    })
  })

  it('reports error when COD column is missing', () => {
    const buffer = createTestXlsx([
      { RAZON_SOCIAL: 'Empresa Sin Cod', MAIL: 'a@b.com' },
    ])

    const result = parseClients(buffer)

    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toMatch(/COD/i)
  })

  it('skips rows with empty COD', () => {
    const buffer = createTestXlsx([
      { COD: 'C001', RAZON_SOCIAL: 'Empresa Válida' },
      { COD: '', RAZON_SOCIAL: 'Empresa Sin Código' },
      { COD: '   ', RAZON_SOCIAL: 'Empresa Espacios' },
    ])

    const result = parseClients(buffer)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].cod).toBe('C001')
  })

  it('reports error for rows with empty RAZON_SOCIAL', () => {
    const buffer = createTestXlsx([
      { COD: 'C001', RAZON_SOCIAL: '' },
      { COD: 'C002', RAZON_SOCIAL: 'Válida' },
    ])

    const result = parseClients(buffer)

    expect(result.rows).toHaveLength(1)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toMatch(/RAZON_SOCIAL|razon/i)
  })

  it('returns nulls for optional columns when absent from sheet', () => {
    const buffer = createTestXlsx([
      { COD: 'C003', RAZON_SOCIAL: 'Solo Requeridos' },
    ])

    const result = parseClients(buffer)

    expect(result.errors).toHaveLength(0)
    expect(result.rows[0]).toEqual({
      cod: 'C003',
      razonSocial: 'Solo Requeridos',
      email: null,
      telefono: null,
      telegram: null,
      categoria: null,
    })
  })
})
