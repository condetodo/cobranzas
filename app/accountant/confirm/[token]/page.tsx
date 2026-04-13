import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { isTokenValid } from '@/lib/contador/token'
import { ConfirmForm } from './confirm-form'

interface Props {
  params: Promise<{ token: string }>
}

export default async function AccountantConfirmPage({ params }: Props) {
  const { token: tokenValue } = await params

  // Look up token record with all relations
  const tokenRecord = await prisma.accountantConfirmationToken.findUnique({
    where: { token: tokenValue },
    include: {
      sequence: {
        include: {
          client: {
            include: {
              invoices: { where: { estado: 'PENDING' }, orderBy: { fechaVencimiento: 'asc' } },
            },
          },
        },
      },
    },
  })

  if (!tokenRecord || !isTokenValid(tokenRecord)) {
    notFound()
  }

  const { client } = tokenRecord.sequence
  const invoices = client.invoices
  const montoTotal = invoices.reduce((sum, inv) => sum + Number(inv.monto), 0)

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Confirmacion de Pago
          </h1>
          <p className="text-gray-600 mb-6">
            Confirma el estado de pago para el siguiente cliente.
          </p>

          {/* Client info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-gray-800">
              {client.razonSocial}
            </h2>
            <p className="text-sm text-gray-500">Codigo: {client.cod}</p>
            {client.email && (
              <p className="text-sm text-gray-500">Email: {client.email}</p>
            )}
          </div>

          {/* Pending invoices */}
          <h3 className="font-semibold text-gray-800 mb-3">
            Facturas pendientes
          </h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Numero</th>
                  <th className="text-left py-2 px-2">Vencimiento</th>
                  <th className="text-right py-2 px-2">Monto</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b">
                    <td className="py-2 px-2">{inv.numero}</td>
                    <td className="py-2 px-2">
                      {new Date(inv.fechaVencimiento).toLocaleDateString(
                        'es-AR'
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      ${Number(inv.monto).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 px-2" colSpan={2}>
                    Total
                  </td>
                  <td className="py-2 px-2 text-right">
                    $
                    {montoTotal.toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Confirmation form */}
          <ConfirmForm token={tokenValue} montoTotal={montoTotal} />
        </div>
      </div>
    </main>
  )
}
