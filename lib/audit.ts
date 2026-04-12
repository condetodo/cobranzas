import { prisma } from './db'
import { ActorType } from '@prisma/client'

export async function auditLog(params: {
  actorType: ActorType
  actorId?: string
  action: string
  targetType?: string
  targetId?: string
  payload?: unknown
}) {
  await prisma.auditLog.create({
    data: {
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      payload: params.payload as any,
    },
  })
}
