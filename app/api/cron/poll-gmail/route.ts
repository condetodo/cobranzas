import { NextResponse } from 'next/server'
import { google, gmail_v1 } from 'googleapis'
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

/**
 * Parses a "Name <email@host>" or bare "email@host" From header to just the
 * email address, lowercased.
 */
function parseFromEmail(from: string): string | null {
  const bracket = from.match(/<([^>]+)>/)
  if (bracket?.[1]) return bracket[1].trim().toLowerCase()
  const bare = from.match(/[\w.+-]+@[\w.-]+\.[\w-]+/)
  return bare?.[0]?.toLowerCase() ?? null
}

type MatchOutcome =
  | { matched: true; strategy: string }
  | { matched: false }
  | { auto: true }

/**
 * Detects bounces (delivery-status notifications) and auto-replies (out-of-office,
 * vacation responders) deterministically from headers — BEFORE any matching or
 * agent classification.
 *
 * Critical: a Gmail DSN bounce echoes the failed message's Message-ID in its
 * In-Reply-To, so it matches the originating sequence via In-Reply-To and gets
 * treated as a debtor reply. That runs Agent C on every bounce (cost) and, if
 * misclassified as a real reply, makes Agent E "answer" the mailer-daemon — which
 * is sent to the same dead mailbox, bounces again, and loops. We never want the
 * agent pipeline to see these, so we short-circuit here.
 */
function isAutoOrBounce(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  from: string
): boolean {
  const fromLower = from.toLowerCase()
  if (
    fromLower.includes('mailer-daemon@') ||
    fromLower.includes('postmaster@')
  ) {
    return true
  }
  // RFC 3834: any value other than "no" marks an automatically generated message
  // (covers DSNs, vacation responders, and most auto-replies).
  const autoSubmitted = extractHeader(headers, 'Auto-Submitted')
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== 'no') {
    return true
  }
  // Gmail/most MTAs stamp bounces with this header listing the failed address.
  if (extractHeader(headers, 'X-Failed-Recipients')) {
    return true
  }
  // Delivery-status reports use a multipart/report content type.
  const contentType = extractHeader(headers, 'Content-Type')?.toLowerCase() ?? ''
  if (
    contentType.includes('multipart/report') &&
    contentType.includes('delivery-status')
  ) {
    return true
  }
  return false
}

/**
 * Fetches a single Gmail message, matches it to an OutreachSequence and either
 * routes it through processIncomingMessage or records it as unmatched.
 *
 * Shared by the normal history-based path and the 404 recovery scan so both
 * behave identically.
 */
async function processGmailMessage(
  gmail: gmail_v1.Gmail,
  msgId: string
): Promise<MatchOutcome> {
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: msgId,
    format: 'full',
  })

  const headers = msg.data.payload?.headers
  const from = extractHeader(headers, 'From') ?? ''
  const inReplyTo = extractHeader(headers, 'In-Reply-To')
  const subject = extractHeader(headers, 'Subject') ?? ''
  const sequenceHeader = extractHeader(headers, 'X-CobranzasAI-Sequence-Id')

  // Short-circuit bounces / auto-replies before matching or classifying. A DSN
  // bounce matches its origin sequence via In-Reply-To and would otherwise be
  // processed as a debtor reply (Agent C cost + potential reply-to-deadbox loop).
  if (isAutoOrBounce(headers, from)) {
    console.log(
      `[poll-gmail] msgId=${msgId} from="${from.slice(0, 60)}" subject="${subject.slice(0, 60)}" -> AUTO/BOUNCE, skipped (no matching, no agent)`
    )
    return { auto: true }
  }

  // Extract body text
  let bodyText = ''
  const payload = msg.data.payload
  if (payload?.body?.data) {
    bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8')
  } else if (payload?.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain')
    if (textPart?.body?.data) {
      bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
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

  // Fallback: match by sender email against any active sequence's client
  if (!matchedSequenceId) {
    const fromEmail = parseFromEmail(from)
    if (fromEmail) {
      const client = await prisma.client.findFirst({
        where: { email: { equals: fromEmail, mode: 'insensitive' } },
        include: {
          outreachSequences: {
            where: { state: { notIn: ['CLOSED', 'PAID'] } },
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
      })
      const seq = client?.outreachSequences[0]
      if (seq) {
        matchedSequenceId = seq.id
        strategy = 'fromAddress'
      }
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
    return { matched: true, strategy: strategy! }
  }

  await prisma.incomingMessage.create({
    data: {
      channel: 'EMAIL',
      fromAddress: from,
      text: bodyText || `[Subject: ${subject}]`,
    },
  })
  return { matched: false }
}

function errorStatus(err: unknown): number | undefined {
  return (
    (err as { code?: number })?.code ??
    (err as { response?: { status?: number } })?.response?.status
  )
}

/**
 * Recovery path for when the stored historyId has expired (Gmail returns 404
 * from history.list — history IDs are only retained for a limited window).
 *
 * Without this, history.list throws, the whole tick 500s, the cursor never
 * advances, and EVERY subsequent tick fails the same way — silently dropping
 * all incoming replies until someone manually resets the cursor.
 *
 * Instead we scan recent INBOX messages directly so in-flight replies aren't
 * lost, then re-anchor lastHistoryId to the current profile so the cheap
 * history-diff path resumes next tick.
 */
async function recoverFromExpiredHistory(gmail: gmail_v1.Gmail) {
  const listed = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    q: 'newer_than:2d',
    maxResults: 50,
  })
  const ids = (listed.data.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => !!id)

  let processed = 0
  let unmatched = 0
  let autoSkipped = 0
  let errors = 0
  for (const id of ids) {
    try {
      const outcome = await processGmailMessage(gmail, id)
      if ('auto' in outcome) autoSkipped++
      else if (outcome.matched) processed++
      else unmatched++
    } catch (err) {
      // 404 here = message expunged between list and get; safe to skip.
      if (errorStatus(err) === 404) continue
      console.error(`[poll-gmail] recovery error on msgId=${id}:`, err)
      errors++
    }
  }

  // Re-anchor the cursor to "now" so the next tick uses the cheap history diff.
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const historyId = profile.data.historyId ?? null
  if (historyId) await setConfig('gmail.lastHistoryId', historyId)

  console.log(
    `[poll-gmail] recovered from expired historyId. scanned=${ids.length} processed=${processed} unmatched=${unmatched} autoSkipped=${autoSkipped} errors=${errors} newHistoryId=${historyId}`
  )

  return NextResponse.json({
    status: 'recovered',
    scanned: ids.length,
    processed,
    unmatched,
    autoSkipped,
    errors,
    newHistoryId: historyId,
  })
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
  let historyResponse
  try {
    historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })
  } catch (err) {
    // An expired/invalid startHistoryId returns 404 ("Requested entity was not
    // found"). Recover by scanning recent messages instead of crashing the
    // whole tick forever.
    if (errorStatus(err) === 404) {
      console.warn(
        `[poll-gmail] historyId ${lastHistoryId} expired (404). Recovering via message scan.`
      )
      return await recoverFromExpiredHistory(gmail)
    }
    throw err
  }

  const history = historyResponse.data.history ?? []
  let processed = 0
  let unmatched = 0
  let autoSkipped = 0
  let errors = 0
  let skipped = 0
  const matchingDetails: Array<{ msgId: string; matched: boolean; auto?: boolean; strategy?: string; category?: string }> = []
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
        const outcome = await processGmailMessage(gmail, msgId)
        if ('auto' in outcome) {
          autoSkipped++
          matchingDetails.push({ msgId, matched: false, auto: true })
        } else if (outcome.matched) {
          processed++
          matchingDetails.push({ msgId, matched: true, strategy: outcome.strategy })
        } else {
          unmatched++
          matchingDetails.push({ msgId, matched: false })
        }
      } catch (err) {
        // Classify: permanent errors (Gmail 404 — message deleted/expunged
        // after history.list returned it; "Invalid transition" — defensive,
        // process-message now short-circuits terminal states) shouldn't block
        // historyId advance. Transient errors (Anthropic timeout, DB blip)
        // do, so the failed message is retried on the next tick.
        const status = errorStatus(err)
        const message = (err as Error)?.message ?? ''
        const isPermanent = status === 404 || message.startsWith('Invalid transition:')
        if (isPermanent) {
          const reason = status === 404 ? '404 Not Found' : message
          console.warn(`[poll-gmail] msgId=${msgId} skipped (permanent): ${reason}`)
          skipped++
        } else {
          console.error(`[poll-gmail] Error processing message ${msgId}:`, err)
          errors++
        }
      }
    }
  }

  // Only block historyId advance for *transient* errors. Permanent errors
  // (404 from Gmail, etc) will fail forever; retrying creates an infinite
  // loop and makes 'unmatched' IncomingMessages duplicate every tick.
  // Trade-off (acknowledged): processIncomingMessage is NOT idempotent — on
  // a transient recovery the message is reprocessed, duplicating the
  // IncomingMessage row, re-charging Agent C, and possibly resending the
  // conversational reply. In demo volumes this is rare and recoverable;
  // silent message loss is not. TODO: dedupe by gmailMsgId (schema migration).
  if (errors === 0 && newHistoryId !== lastHistoryId) {
    await setConfig('gmail.lastHistoryId', newHistoryId)
  }

  console.log(
    `[poll-gmail] done. processed=${processed} unmatched=${unmatched} autoSkipped=${autoSkipped} skipped=${skipped} errors=${errors} historyAdvanced=${errors === 0}`
  )

  return NextResponse.json({
    status: 'ok',
    processed,
    unmatched,
    autoSkipped,
    skipped,
    errors,
    newHistoryId: errors === 0 ? newHistoryId : lastHistoryId,
    historyAdvanced: errors === 0,
    matchingDetails,
  })
}
