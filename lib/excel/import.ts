import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { parseClients } from '@/lib/excel/parse-clients'
import { parseInvoices } from '@/lib/excel/parse-invoices'
import { InvoiceState } from '@prisma/client'

export interface ImportResult {
  clients: { created: number; updated: number }
  invoices: { created: number; updated: number }
  errors: string[]
}

/**
 * Pure upsert: crea/actualiza clientes y facturas a partir del Excel.
 *
 * IMPORTANTE — semántica de cierre:
 * Antes este import tenía una lógica de "cerrar las facturas que desaparecieron"
 * asumiendo que el Excel era un snapshot completo de la cartera. Se removió
 * porque el Excel de facturación es una fuente de datos (qué facturas existen),
 * no un comando de baja. El cierre es manual vía `/api/invoices/:id/mark-paid`
 * o vía el workflow del contador, y se cruza con otro archivo del sistema
 * contable que indique qué está cobrado.
 */
export async function importExcel(
  clientsBuffer: Buffer | null,
  invoicesBuffer: Buffer | null,
  userId: string,
  fileName?: string
): Promise<ImportResult> {
  const result: ImportResult = {
    clients: { created: 0, updated: 0 },
    invoices: { created: 0, updated: 0 },
    errors: [],
  }

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
      const client = await prisma.client.findUnique({ where: { cod: row.codCliente } })
      if (!client) {
        result.errors.push(
          `Invoice ${row.numero}: client with cod="${row.codCliente}" not found`
        )
        continue
      }

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
