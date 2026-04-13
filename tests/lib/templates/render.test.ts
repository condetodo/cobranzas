import { describe, it, expect } from 'vitest'
import { renderTemplate } from '@/lib/templates/render'

describe('renderTemplate', () => {
  it('replaces all variables in a template', () => {
    const template = 'Hola {{nombre}}, su deuda es {{monto}}.'
    const result = renderTemplate(template, { nombre: 'Juan', monto: '$1000' })
    expect(result).toBe('Hola Juan, su deuda es $1000.')
  })

  it('leaves unknown variables as-is (unchanged placeholder)', () => {
    const template = 'Hola {{nombre}}, su estado es {{desconocido}}.'
    const result = renderTemplate(template, { nombre: 'Ana' })
    expect(result).toBe('Hola Ana, su estado es {{desconocido}}.')
  })

  it('handles empty vars object gracefully (all placeholders untouched)', () => {
    const template = 'Hola {{nombre}}, debe {{monto}}.'
    const result = renderTemplate(template, {})
    expect(result).toBe('Hola {{nombre}}, debe {{monto}}.')
  })

  it('handles template with no placeholders', () => {
    const template = 'Mensaje sin variables.'
    const result = renderTemplate(template, { nombre: 'Carlos' })
    expect(result).toBe('Mensaje sin variables.')
  })

  it('replaces the same placeholder multiple times', () => {
    const template = '{{x}} y {{x}}'
    const result = renderTemplate(template, { x: 'valor' })
    expect(result).toBe('valor y valor')
  })
})
