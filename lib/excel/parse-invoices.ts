import XLSX from 'xlsx'
import type { ParseResult } from './parse-clients'

export type { ParseResult }

export interface InvoiceRow {
  codCliente: string
  numero: string
  fechaEmision: Date
  fechaVencimiento: Date
  monto: number
  moneda: string
}

const REQUIRED_COLUMNS = [
  'COD_CLIENTE',
  'NUMERO',
  'FECHA_EMISION',
  'FECHA_VENCIMIENTO',
  'MONTO',
] as const

function toStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/**
 * Parse a date value that may be:
 * - An Excel serial number (integer or float)
 * - A JS Date object (xlsx can parse dates natively)
 * - A date string like "2024-01-15" or "15/01/2024"
 */
function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null

  // xlsx may already have converted it to a Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }

  // Excel serial number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) return null
    return new Date(date.y, date.m - 1, date.d)
  }

  // String date
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null

    // Try ISO first
    const iso = new Date(trimmed)
    if (!isNaN(iso.getTime())) return iso

    // Try DD/MM/YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy
      return new Date(Number(y), Number(m) - 1, Number(d))
    }
  }

  return null
}

export function parseInvoices(buffer: Buffer): ParseResult<InvoiceRow> {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  })

  const errors: string[] = []
  const rows: InvoiceRow[] = []

  if (raw.length === 0) {
    return { rows, errors }
  }

  // Check required columns exist
  const firstRow = raw[0]
  const missingCols = REQUIRED_COLUMNS.filter((col) => !(col in firstRow))
  if (missingCols.length > 0) {
    errors.push(
      `Missing required columns: ${missingCols.join(', ')}`
    )
    return { rows, errors }
  }

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    const rowNum = i + 2 // 1-indexed + header row

    const codCliente = toStr(row['COD_CLIENTE'])
    if (codCliente === '') {
      // Skip rows with empty COD_CLIENTE silently
      continue
    }

    const numero = toStr(row['NUMERO'])
    if (numero === '') {
      errors.push(`Row ${rowNum}: NUMERO is required but empty`)
      continue
    }

    const fechaEmision = parseDate(row['FECHA_EMISION'])
    if (!fechaEmision) {
      errors.push(`Row ${rowNum}: FECHA_EMISION is invalid or empty`)
      continue
    }

    const fechaVencimiento = parseDate(row['FECHA_VENCIMIENTO'])
    if (!fechaVencimiento) {
      errors.push(`Row ${rowNum}: FECHA_VENCIMIENTO is invalid or empty`)
      continue
    }

    const rawMonto = row['MONTO']
    const monto = typeof rawMonto === 'number' ? rawMonto : parseFloat(toStr(rawMonto))
    if (isNaN(monto) || monto <= 0) {
      errors.push(`Row ${rowNum}: monto must be a positive number (got ${rawMonto})`)
      continue
    }

    const monedaRaw = toStr(row['MONEDA'])
    const moneda = monedaRaw === '' ? 'ARS' : monedaRaw

    rows.push({
      codCliente,
      numero,
      fechaEmision,
      fechaVencimiento,
      monto,
      moneda,
    })
  }

  return { rows, errors }
}
