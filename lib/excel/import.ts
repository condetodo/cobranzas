import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { parseClients } from '@/lib/excel/parse-clients'
import { parseInvoices } from '@/lib/excel/parse-invoices'
import { InvoiceState } from '@prisma/client'

export interface ImportResult {
  clients: { created: number; updated: number }
  invoices: { created: number; updated: number; closed: number }
  errors: string[]
}

export async function importExcel(
  clientsBuffer: Buffer | null,
  invoicesBuffer: Buffer | null,
  userId: string,
  fileName?: string
): Promise<ImportResult> {
  const result: ImportResult = {
    clients: { created: 0, updated: 0 },
    invoices: { created: 0, updated: 0, closed: 0 },
    errors: [],
  }

  // Track which clientIds appeared in the invoices import (for closing disappeared invoices)
  const importedClientIds = new Set<string>()
  // Track which (clientId, numero) pairs appeared in this import
  const importedInvoiceKeys = new Set<string>()

  // --- Clients ---
  if (clientsBuffer) {
    const parsed = parseClients(clientsBuffer)
    result.errors.push(...parsed.errors)

    for (const row of parsed.rows) {
      const existing = await prisma.client.findUnique({ where: { cod: row.cod } })

      if (existing) {
        await prisma.client.update({
          where: { cod: row.cod },
          data: {
            razonSocial: row.razonSocial,
            email: row.email,
            telefono: row.telefono,
            telegram: row.telegram,
            categoria: row.categoria,
          },
        })
        result.clients.updated++
      } else {
        await prisma.client.create({
          data: {
            cod: row.cod,
            razonSocial: row.razonSocial,
            email: row.email,
            telefono: row.telefono,
            telegram: row.telegram,
            categoria: row.categoria,
          },
        })
        result.clients.created++
      }
    }
  }

  // --- Invoices ---
  if (invoicesBuffer) {
    const parsed = parseInvoices(invoicesBuffer)
    result.errors.push(...parsed.errors)

    for (const row of parsed.rows) {
      // Look up client by cod
      const client = await prisma.client.findUnique({ where: { cod: row.codCliente } })
      if (!client) {
        result.errors.push(`Invoice ${row.numero}: client with cod="${row.codCliente}" not found`)
        continue
      }

      importedClientIds.add(client.id)
      importedInvoiceKeys.add(`${client.id}::${row.numero}`)

      const existing = await prisma.invoice.findUnique({
        where: { clientId_numero: { clientId: client.id, numero: row.numero } },
      })

      if (existing) {
        await prisma.invoice.update({
          where: { clientId_numero: { clientId: client.id, numero: row.numero } },
          data: {
            fechaEmision: row.fechaEmision,
            fechaVencimiento: row.fechaVencimiento,
            monto: row.monto,
            moneda: row.moneda,
          },
        })
        result.invoices.updated++
      } else {
        await prisma.invoice.create({
          data: {
            clientId: client.id,
            numero: row.numero,
            fechaEmision: row.fechaEmision,
            fechaVencimiento: row.fechaVencimiento,
            monto: row.monto,
            moneda: row.moneda,
            estado: InvoiceState.PENDING,
          },
        })
        result.invoices.created++
      }
    }

    // --- Close invoices that disappeared ---
    // For each client that appeared in this import, find PENDING invoices
    // whose numero is NOT in the imported set → mark as PAID
    if (importedClientIds.size > 0) {
      const now = new Date()
      const pendingInvoices = await prisma.invoice.findMany({
        where: {
          clientId: { in: Array.from(importedClientIds) },
          estado: InvoiceState.PENDING,
        },
        select: { id: true, clientId: true, numero: true },
      })

      const toClose = pendingInvoices.filter(
        (inv) => !importedInvoiceKeys.has(`${inv.clientId}::${inv.numero}`)
      )

      if (toClose.length > 0) {
        await prisma.invoice.updateMany({
          where: { id: { in: toClose.map((inv) => inv.id) } },
          data: { estado: InvoiceState.PAID, paidAt: now },
        })
        result.invoices.closed += toClose.length
      }
    }
  }

  // --- Audit log ---
  await auditLog({
    actorType: 'USER',
    actorId: userId,
    action: 'EXCEL_IMPORT',
    targetType: 'IMPORT',
    payload: {
      fileName,
      clients: result.clients,
      invoices: result.invoices,
      errorCount: result.errors.length,
    },
  })

  return result
}
