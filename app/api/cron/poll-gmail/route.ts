import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { getConfig, setConfig } from '@/lib/config'
import { processIncomingMessage } from '@/lib/incoming/process-message'

// NOTE: the previous advisory-lock implementation (pg_try_advisory_lock +
// pg_advisory_unlock) didn't play well with Prisma's connection pool —
// session-level locks can end up on a different pooled connection than the
// unlock query, leaving the lock "stuck" forever. Removed for now; dedupe
// relies on Gmail's historyId advancing. Concurrent runs are rare (every 2min)
// and worst case produce a duplicate send to contador, which is acceptable
// during MVP. Proper DB-TTL lock is TODO.

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
  const gmail = getGmailClient()

  let lastHistoryId = await getConfig<string>('gmail.lastHistoryId')
  console.log(`[poll-gmail] tick. lastHistoryId=${lastHistoryId ?? 'null'}`)

  // Initialize history ID from profile if not set
  if (!lastHistoryId) {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    lastHistoryId = profile.data.historyId ?? null
    if (lastHistoryId) {
      await setConfig('gmail.lastHistoryId', lastHistoryId)
    }
    console.log(`[poll-gmail] initialized with historyId=${lastHistoryId}`)
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
  const matchingDetails: Array<{ msgId: string; matched: boolean; strategy?: string; category?: string }> = []
  let newHistoryId = historyResponse.data.historyId ?? lastHistoryId

  console.log(
    `[poll-gmail] historyRecords=${history.length} messagesToCheck=${history.reduce((n, r) => n + (r.messagesAdded?.length ?? 0), 0)}`
  )

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
        let strategy: string | undefined

        if (sequenceHeader) {
          const seq = await prisma.outreachSequence.findUnique({
            where: { id: sequenceHeader },
          })
          if (seq) {
            matchedSequenceId = seq.id
            strategy = 'X-CobranzasAI-Sequence-Id'
          }
        }

        if (!matchedSequenceId && inReplyTo) {
          const attempt = await prisma.outreachAttempt.findFirst({
            where: { externalMessageId: inReplyTo },
          })
          if (attempt) {
            matchedSequenceId = attempt.sequenceId
            strategy = 'In-Reply-To'
          }
        }

        if (!matchedSequenceId) {
          const attempt = await prisma.outreachAttempt.findFirst({
            where: { externalMessageId: msgId },
          })
          if (attempt) {
            matchedSequenceId = attempt.sequenceId
            strategy = 'gmailMsgId'
          }
        }

        console.log(
          `[poll-gmail] msgId=${msgId} from="${from.slice(0, 60)}" subject="${subject.slice(0, 60)}" inReplyTo=${inReplyTo ? 'yes' : 'no'} seqHeader=${sequenceHeader ? 'yes' : 'no'} matched=${matchedSequenceId ? `via ${strategy}` : 'NO'}`
        )

        if (matchedSequenceId) {
          await processIncomingMessage({
            sequenceId: matchedSequenceId,
            channel: 'EMAIL',
            fromAddress: from,
            text: bodyText,
          })
          processed++
          matchingDetails.push({ msgId, matched: true, strategy })
        } else {
          await prisma.incomingMessage.create({
            data: {
              channel: 'EMAIL',
              fromAddress: from,
              text: bodyText || `[Subject: ${subject}]`,
            },
          })
          unmatched++
          matchingDetails.push({ msgId, matched: false })
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

  console.log(`[poll-gmail] done. processed=${processed} unmatched=${unmatched}`)

  return NextResponse.json({
    status: 'ok',
    processed,
    unmatched,
    newHistoryId,
    matchingDetails,
  })
}
