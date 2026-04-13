/**
 * Default template copy — mirrors the seeded values in prisma/seed.ts.
 * Used as fallbacks when the DB config key `templates.copy` is unavailable.
 */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  soft:
    'Estimado/a {{razonSocial}},\n\n' +
    'Le recordamos que tiene una factura pendiente por {{montoTotal}} con vencimiento {{fechaVencimiento}}.\n\n' +
    'Agradecemos su pronta atención.\n\n' +
    'Atentamente,\nDepartamento de Cobranzas',

  firm:
    'Estimado/a {{razonSocial}},\n\n' +
    'Su deuda de {{montoTotal}} lleva {{diasVencido}} días de atraso. ' +
    'Le solicitamos regularizar su situación a la brevedad.\n\n' +
    'Quedamos a disposición para coordinar el pago.\n\n' +
    'Atentamente,\nDepartamento de Cobranzas',

  avisoFinal:
    'AVISO FINAL\n\n' +
    '{{razonSocial}}, su deuda de {{montoTotal}} lleva {{diasVencido}} días sin pago. ' +
    'De no recibir una respuesta en los próximos {{diasRestantes}} días, ' +
    'procederemos con las medidas correspondientes.\n\n' +
    'Departamento de Cobranzas',

  postPartial:
    'Estimado/a {{razonSocial}},\n\n' +
    'Confirmamos la recepción de su pago parcial por {{montoPagado}}. ' +
    'Queda un saldo pendiente de {{montoRestante}}.\n\n' +
    'Departamento de Cobranzas',

  paid:
    'Estimado/a {{razonSocial}},\n\n' +
    'Confirmamos la recepción de su pago por {{montoTotal}}. ' +
    'Muchas gracias por regularizar su situación.\n\n' +
    'Atentamente,\nDepartamento de Cobranzas',

  rejection:
    'Lamentamos informarle que el comprobante enviado no pudo ser validado. ' +
    '{{motivoRechazo}}. Por favor envíe un comprobante válido.',
}
