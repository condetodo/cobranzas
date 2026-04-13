/**
 * Replaces {{variable}} placeholders in a template string.
 * Unknown variables are left as-is (the original {{variable}} text).
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match
  })
}
