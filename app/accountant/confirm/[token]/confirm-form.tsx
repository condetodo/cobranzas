'use client'

import { useState } from 'react'

type Decision = 'TOTAL' | 'PARTIAL' | 'REJECTED'

interface ConfirmFormProps {
  token: string
  montoTotal: number
}

export function ConfirmForm({ token, montoTotal }: ConfirmFormProps) {
  const [decision, setDecision] = useState<Decision | null>(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!decision) return

    setSubmitting(true)
    setError(null)

    try {
      const body: Record<string, unknown> = { token, decision }
      if (decision === 'PARTIAL') {
        body.amount = parseFloat(partialAmount)
      }
      if (decision === 'REJECTED') {
        body.rejectionReason = rejectionReason
      }

      const res = await fetch('/api/accountant/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al confirmar')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 text-xl font-semibold mb-2">
          Confirmacion registrada
        </div>
        <p className="text-gray-500">
          Gracias. La decision fue procesada correctamente.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-semibold text-gray-800 mb-3">Decision</h3>

      <div className="space-y-3 mb-6">
        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="decision"
            value="TOTAL"
            onChange={() => setDecision('TOTAL')}
            checked={decision === 'TOTAL'}
          />
          <div>
            <div className="font-medium">Pago Total</div>
            <div className="text-sm text-gray-500">
              Se pago el total de $
              {montoTotal.toLocaleString('es-AR', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="decision"
            value="PARTIAL"
            onChange={() => setDecision('PARTIAL')}
            checked={decision === 'PARTIAL'}
          />
          <div>
            <div className="font-medium">Pago Parcial</div>
            <div className="text-sm text-gray-500">
              Se pago una parte del monto adeudado
            </div>
          </div>
        </label>

        {decision === 'PARTIAL' && (
          <div className="ml-8">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto recibido
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={montoTotal}
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="0.00"
              required
            />
          </div>
        )}

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="decision"
            value="REJECTED"
            onChange={() => setDecision('REJECTED')}
            checked={decision === 'REJECTED'}
          />
          <div>
            <div className="font-medium">Rechazado</div>
            <div className="text-sm text-gray-500">
              El comprobante no es valido o no se confirma el pago
            </div>
          </div>
        </label>

        {decision === 'REJECTED' && (
          <div className="ml-8">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del rechazo
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
              placeholder="Explica el motivo..."
              required
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!decision || submitting}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Procesando...' : 'Confirmar Decision'}
      </button>
    </form>
  )
}
