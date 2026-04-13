import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const REMINDER_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET() {
  const threshold = new Date(Date.now() - REMINDER_THRESHOLD_MS)

  // Find tokens older than 24h that haven't received a reminder and are still valid
  const tokens = await prisma.accountantConfirmationToken.findMany({
    where: {
      createdAt: { lte: threshold },
      reminderSentAt: null,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      sequence: {
        include: {
          client: true,
        },
      },
    },
  })

  let reminded = 0
  for (const token of tokens) {
    await prisma.accountantConfirmationToken.update({
      where: { id: token.id },
      data: { reminderSentAt: new Date() },
    })
    reminded++
  }

  return NextResponse.json({ reminded })
}
