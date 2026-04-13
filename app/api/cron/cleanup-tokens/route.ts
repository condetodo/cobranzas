import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  // Mark expired unconsumed tokens as consumed
  const result = await prisma.accountantConfirmationToken.updateMany({
    where: {
      consumedAt: null,
      expiresAt: { lt: new Date() },
    },
    data: {
      consumedAt: new Date(),
    },
  })

  return NextResponse.json({ expired: result.count })
}
