/**
 * Format a number as ARS currency: $ 1.234,56
 */
export function formatARS(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value
  return (
    "$ " +
    n.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

/**
 * Format a number with Argentine locale (dot thousands separator)
 */
export function formatNumber(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value
  return n.toLocaleString("es-AR")
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Format a date with time for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
