import { describe, it, expect } from 'vitest'
import XLSX from 'xlsx'
import { parseInvoices } from '@/lib/excel/parse-invoices'

function createTestXlsx(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

describe('parseInvoices', () => {
  it('parses valid invoice rows', () => {
    const buffer = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        NUMERO: 'FAC-0001',
        FECHA_EMISION: '2024-01-15',
        FECHA_VENCIMIENTO: '2024-02-15',
        MONTO: 15000.5,
        MONEDA: 'ARS',
      },
    ])

    const result = parseInvoices(buffer)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)

    const row = result.rows[0]
    expect(row.codCliente).toBe('C001')
    expect(row.numero).toBe('FAC-0001')
    expect(row.fechaEmision).toBeInstanceOf(Date)
    expect(row.fechaVencimiento).toBeInstanceOf(Date)
    expect(row.monto).toBe(15000.5)
    expect(row.moneda).toBe('ARS')
  })

  it('defaults moneda to ARS when missing', () => {
    const buffer = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        NUMERO: 'FAC-0002',
        FECHA_EMISION: '2024-03-01',
        FECHA_VENCIMIENTO: '2024-04-01',
        MONTO: 5000,
      },
    ])

    const result = parseInvoices(buffer)

    expect(result.errors).toHaveLength(0)
    expect(result.rows[0].moneda).toBe('ARS')
  })

  it('reports error for missing required columns', () => {
    // Missing NUMERO and MONTO
    const buffer = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        FECHA_EMISION: '2024-01-01',
        FECHA_VENCIMIENTO: '2024-02-01',
      },
    ])

    const result = parseInvoices(buffer)

    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('skips rows with empty COD_CLIENTE', () => {
    const buffer = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        NUMERO: 'FAC-0003',
        FECHA_EMISION: '2024-01-01',
        FECHA_VENCIMIENTO: '2024-02-01',
        MONTO: 1000,
      },
      {
        COD_CLIENTE: '',
        NUMERO: 'FAC-0004',
        FECHA_EMISION: '2024-01-01',
        FECHA_VENCIMIENTO: '2024-02-01',
        MONTO: 2000,
      },
    ])

    const result = parseInvoices(buffer)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].codCliente).toBe('C001')
  })

  it('handles Excel serial dates', () => {
    // Excel serial date 45306 = 2024-01-15
    const buffer = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        NUMERO: 'FAC-0005',
        FECHA_EMISION: 45306,
        FECHA_VENCIMIENTO: 45337,
        MONTO: 3000,
        MONEDA: 'USD',
      },
    ])

    const result = parseInvoices(buffer)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].fechaEmision).toBeInstanceOf(Date)
    expect(result.rows[0].moneda).toBe('USD')
  })

  it('reports error for invalid monto', () => {
    const buffer = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        NUMERO: 'FAC-0006',
        FECHA_EMISION: '2024-01-01',
        FECHA_VENCIMIENTO: '2024-02-01',
        MONTO: -500,
      },
    ])

    const result = parseInvoices(buffer)

    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toMatch(/monto/i)
  })
})
