import type { BusinessHours } from './config'

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

/**
 * Returns true if `now` falls inside the configured business-hours window,
 * evaluated in the window's own timezone (e.g. the sender-side business clock).
 *
 * Fails open: if the timezone or weekday name can't be parsed we return true
 * so that an ambiguous config never silently blocks all sends.
 */
export function isWithinBusinessHours(now: Date, hours: BusinessHours): boolean {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: hours.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long',
    }).formatToParts(now)
  } catch {
    return true
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = WEEKDAY_INDEX[get('weekday')]
  if (weekday === undefined) return true
  if (!hours.weekdays.includes(weekday)) return false

  // en-US with hour12:false sometimes returns "24" at the stroke of midnight — normalize.
  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0
  const minute = parseInt(get('minute'), 10)

  const nowMinutes = hour * 60 + minute
  const [sH, sM] = hours.start.split(':').map((n) => parseInt(n, 10))
  const [eH, eM] = hours.end.split(':').map((n) => parseInt(n, 10))
  const startMinutes = sH * 60 + sM
  const endMinutes = eH * 60 + eM

  return nowMinutes >= startMinutes && nowMinutes < endMinutes
}
