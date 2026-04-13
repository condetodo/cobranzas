import * as XLSX from 'xlsx'

export interface ClientRow {
  cod: string
  razonSocial: string
  email: string | null
  telefono: string | null
  telegram: string | null
  categoria: string | null
}

export interface ParseResult<T> {
  rows: T[]
  errors: string[]
}

const REQUIRED_COLUMNS = ['COD', 'RAZON_SOCIAL'] as const

function toStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNullableStr(value: unknown): string | null {
  const s = toStr(value)
  return s === '' ? null : s
}

export function parseClients(buffer: Buffer): ParseResult<ClientRow> {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  })

  const errors: string[] = []
  const rows: ClientRow[] = []

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

    const cod = toStr(row['COD'])
    if (cod === '') {
      // Skip rows with empty COD silently
      continue
    }

    const razonSocial = toStr(row['RAZON_SOCIAL'])
    if (razonSocial === '') {
      errors.push(`Row ${rowNum}: RAZON_SOCIAL is required but empty (COD=${cod})`)
      continue
    }

    rows.push({
      cod,
      razonSocial,
      email: toNullableStr(row['MAIL']),
      telefono: toNullableStr(row['TELEFONO']),
      telegram: toNullableStr(row['TELEGRAM']),
      categoria: toNullableStr(row['CATEGORIA']),
    })
  }

  return { rows, errors }
}
