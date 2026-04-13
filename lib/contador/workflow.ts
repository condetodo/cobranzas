import { prisma } from '@/lib/db'
import { generateToken } from './token'
import { auditLog } from '@/lib/audit'

const TOKEN_EXPIRY_DAYS = 7

export async function sendToAccountant(params: {
  sequenceId: string
  incomingMessageId: string
}): Promise<{ token: string; confirmationUrl: string }> {
  // 1. Generate token
  const token = generateToken()

  // 2. Create token record in DB
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

  await prisma.accountantConfirmationToken.create({
    data: {
      token,
      sequenceId: params.sequenceId,
      incomingMessageId: params.incomingMessageId,
      expiresAt,
    },
  })

  // 3. Build confirmation URL
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const confirmationUrl = `${baseUrl}/accountant/confirm/${token}`

  // 4. Load sequence + client + invoices for context
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: params.sequenceId },
    include: {
      client: {
        include: {
          invoices: { where: { estado: 'PENDING' } },
        },
      },
    },
  })

  // 5. Audit log
  await auditLog({
    actorType: 'SYSTEM',
    action: 'accountant.tokenCreated',
    targetType: 'AccountantConfirmationToken',
    targetId: token,
    payload: {
      sequenceId: params.sequenceId,
      incomingMessageId: params.incomingMessageId,
      clientCod: sequence.client.cod,
      clientName: sequence.client.razonSocial,
      pendingInvoiceCount: sequence.client.invoices.length,
      confirmationUrl,
      expiresAt: expiresAt.toISOString(),
    },
  })

  return { token, confirmationUrl }
}
