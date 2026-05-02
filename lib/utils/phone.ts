/**
 * Strip everything that is not a digit.
 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Returns the last N digits of a phone number, ignoring formatting.
 * Used to match WhatsApp JIDs (which include country/area code) against
 * Client.telefono values from the imported Excel (which may omit them).
 *
 * Default 10 covers Argentina mobile numbers without country/9 prefix
 * (e.g. JID 5491158404881 → 1158404881).
 */
export function lastDigits(value: string, n = 10): string {
  return digitsOnly(value).slice(-n)
}

/**
 * Extracts the bare phone digits from a WhatsApp JID.
 * `5491158404881@s.whatsapp.net` → `5491158404881`
 * `5491158404881` → `5491158404881`
 */
export function jidToPhone(jid: string): string {
  return jid.split('@')[0] ?? jid
}

/**
 * Normalizes a local Argentine phone number to the JID-friendly form
 * Evolution expects (full international, without +).
 *
 * Applied when sending: turns the stored `1158404881` into `5491158404881`
 * so Evolution can route to the WhatsApp JID.
 *
 * If the input already starts with `54`, it is returned untouched (digits only).
 */
export function toEvolutionNumber(value: string): string {
  const digits = digitsOnly(value)
  if (digits.startsWith('54')) return digits
  return `549${digits}`
}
