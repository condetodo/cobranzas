import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { parseClients } from '@/lib/excel/parse-clients'
import { parseInvoices } from '@/lib/excel/parse-invoices'
import { InvoiceState } from '@prisma/client'
import { transitionSequence } from '@/lib/state-machine/transitions'

export interface ImportResult {
  clients: { created: number; updated: number }
  invoices: { created: number; updated: number; closed: number }
  sequencesClosed: number
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
    sequencesClosed: 0,
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

      // --- Auto-close sequences for clients left without PENDING invoices ---
      // Si un cliente pagó todas sus facturas (vía re-import del Excel, no vía
      // el workflow del contador), su secuencia activa sigue en SENT_SOFT/FIRM/FINAL
      // y el cron runner le seguirá mandando mensajes al infinito. Acá la cerramos.
      for (const clientId of importedClientIds) {
        const remainingPending = await prisma.invoice.count({
          where: { clientId, estado: InvoiceState.PENDING },
        })
        if (remainingPending > 0) continue

        const activeSeq = await prisma.outreachSequence.findFirst({
          where: { clientId, closedAt: null },
        })
        if (!activeSeq) continue

        try {
          await transitionSequence(activeSeq.id, 'PAID', {
            closedReason: 'MANUAL_OVERRIDE',
            actorType: 'USER',
            actorId: userId,
          })
          result.sequencesClosed++
        } catch (err: any) {
          result.errors.push(
            `No se pudo cerrar la secuencia del cliente ${clientId} tras pago externo: ${err?.message ?? 'error'}`
          )
        }
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
      sequencesClosed: result.sequencesClosed,
      errorCount: result.errors.length,
    },
  })

  return result
}
