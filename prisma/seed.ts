import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Seed users (idempotent) ---
  const users = [
    { username: "admin1", password: "admin123" },
    { username: "admin2", password: "admin123" },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({
      where: { username: u.username },
    });
    if (existing) {
      console.log(`User "${u.username}" already exists, skipping.`);
      continue;
    }
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: { username: u.username, hashedPassword },
    });
    console.log(`Created user "${u.username}".`);
  }

  // --- Seed default config values (upsert for re-runnability) ---
  const defaults: Record<string, Prisma.InputJsonValue> = {
    "aging.thresholds": { suave: 15, firme: 30, avisoFinal: 45 },
    "sequence.timeouts": { softToFirm: 5, firmToFinal: 7, finalToEscalated: 10, inConversation: 3 },
    "sequence.channels": { soft: "EMAIL", firm: "EMAIL", final: "EMAIL" },
    "sequence.maxSendFailures": 3,
    "business.hours": {
      start: "09:00",
      end: "18:00",
      weekdays: [1, 2, 3, 4, 5],
      timezone: "America/Argentina/Buenos_Aires",
    },
    "demo.fastMode": false,
    "contador.email": "",
    "contador.reminderTimeoutHours": 24,
    "templates.copy": {
      soft: "Estimado/a {{razonSocial}},\n\nLe recordamos que tiene una factura pendiente por {{montoTotal}} con vencimiento {{fechaVencimiento}}.\n\nAgradecemos su pronta atención.\n\nAtentamente,\nDepartamento de Cobranzas",
      firm: "Estimado/a {{razonSocial}},\n\nSu deuda de {{montoTotal}} lleva {{diasVencido}} días de atraso. Le solicitamos regularizar su situación a la brevedad.\n\nQuedamos a disposición para coordinar el pago.\n\nAtentamente,\nDepartamento de Cobranzas",
      avisoFinal: "AVISO FINAL\n\n{{razonSocial}}, su deuda de {{montoTotal}} lleva {{diasVencido}} días sin pago. De no recibir una respuesta en los próximos {{diasRestantes}} días, procederemos con las medidas correspondientes.\n\nDepartamento de Cobranzas",
      postPartial: "Estimado/a {{razonSocial}},\n\nConfirmamos la recepción de su pago parcial por {{montoPagado}}. Queda un saldo pendiente de {{montoRestante}}.\n\nDepartamento de Cobranzas",
      paid: "Estimado/a {{razonSocial}},\n\nConfirmamos la recepción de su pago por {{montoTotal}}. Muchas gracias por regularizar su situación.\n\nAtentamente,\nDepartamento de Cobranzas",
      rejection: "Lamentamos informarle que el comprobante enviado no pudo ser validado. {{motivoRechazo}}. Por favor envíe un comprobante válido.",
    },
  };

  // Create-only: never overwrite a config the user has already customized via Settings.
  // Seed runs on every Railway deploy; upserting would silently reset things like
  // contador.email, business.hours, templates.copy, etc.
  //
  // When a new sub-field is added to an existing object config (e.g. adding
  // "inConversation" to sequence.timeouts), either write a one-off migration script
  // or add a fallback in the reader — don't rely on seed to migrate.
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await prisma.config.findUnique({ where: { key } });
    if (existing) {
      console.log(`Config "${key}" already exists, skipping.`);
      continue;
    }
    await prisma.config.create({ data: { key, value } });
    console.log(`Created config "${key}".`);
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
