import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { getConfig, setConfig } from '@/lib/config'
import { processIncomingMessage } from '@/lib/incoming/process-message'

const ADVISORY_LOCK_KEY = 43

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

function extractHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
    ?.value ?? undefined
}

export async function GET() {
  // Advisory lock to prevent concurrent polling
  const lockResult = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}::bigint)
  `
  const acquired = lockResult[0]?.pg_try_advisory_lock ?? false
  if (!acquired) {
    return NextResponse.json({ status: 'skipped', reason: 'lock_held' })
  }

  try {
    const gmail = getGmailClient()

    let lastHistoryId = await getConfig<string>('gmail.lastHistoryId')

    // Initialize history ID from profile if not set
    if (!lastHistoryId) {
      const profile = await gmail.users.getProfile({ userId: 'me' })
      lastHistoryId = profile.data.historyId ?? null
      if (lastHistoryId) {
        await setConfig('gmail.lastHistoryId', lastHistoryId)
      }
      return NextResponse.json({ status: 'initialized', historyId: lastHistoryId })
    }

    // Fetch history since last known ID
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })

    const history = historyResponse.data.history ?? []
    let processed = 0
    let unmatched = 0
    let newHistoryId = historyResponse.data.historyId ?? lastHistoryId

    for (const record of history) {
      const messages = record.messagesAdded ?? []
      for (const added of messages) {
        const msgId = added.message?.id
        if (!msgId) continue

        try {
          // Fetch full message
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'full',
          })

          const headers = msg.data.payload?.headers
          const from = extractHeader(headers, 'From') ?? ''
          const inReplyTo = extractHeader(headers, 'In-Reply-To')
          const subject = extractHeader(headers, 'Subject') ?? ''
          const sequenceHeader = extractHeader(
            headers,
            'X-CobranzasAI-Sequence-Id'
          )

          // Extract body text
          let bodyText = ''
          const payload = msg.data.payload
          if (payload?.body?.data) {
            bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8')
          } else if (payload?.parts) {
            const textPart = payload.parts.find(
              (p) => p.mimeType === 'text/plain'
            )
            if (textPart?.body?.data) {
              bodyText = Buffer.from(textPart.body.data, 'base64').toString(
                'utf-8'
              )
            }
          }

          // Try to match with an OutreachAttempt
          let matchedSequenceId: string | null = null

          if (sequenceHeader) {
            // Direct match via custom header
            const seq = await prisma.outreachSequence.findUnique({
              where: { id: sequenceHeader },
            })
            if (seq) matchedSequenceId = seq.id
          }

          if (!matchedSequenceId && inReplyTo) {
            // Match by In-Reply-To header against externalMessageId
            const attempt = await prisma.outreachAttempt.findFirst({
              where: { externalMessageId: inReplyTo },
            })
            if (attempt) matchedSequenceId = attempt.sequenceId
          }

          if (!matchedSequenceId) {
            // Try matching by Gmail message ID reference
            const attempt = await prisma.outreachAttempt.findFirst({
              where: { externalMessageId: msgId },
            })
            if (attempt) matchedSequenceId = attempt.sequenceId
          }

          if (matchedSequenceId) {
            await processIncomingMessage({
              sequenceId: matchedSequenceId,
              channel: 'EMAIL',
              fromAddress: from,
              text: bodyText,
            })
            processed++
          } else {
            // Store as unmatched
            await prisma.incomingMessage.create({
              data: {
                channel: 'EMAIL',
                fromAddress: from,
                text: bodyText || `[Subject: ${subject}]`,
              },
            })
            unmatched++
          }
        } catch (err) {
          console.error(`[poll-gmail] Error processing message ${msgId}:`, err)
        }
      }
    }

    // Save new history ID
    if (newHistoryId !== lastHistoryId) {
      await setConfig('gmail.lastHistoryId', newHistoryId)
    }

    return NextResponse.json({ status: 'ok', processed, unmatched, newHistoryId })
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY}::bigint)`
  }
}
