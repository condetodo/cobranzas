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

  // --- Seed default config values (idempotent) ---
  const defaults: Record<string, Prisma.InputJsonValue> = {
    aging_thresholds: {
      SIN_VENCER: { minDays: null, maxDays: 0 },
      SUAVE: { minDays: 1, maxDays: 15 },
      FIRME: { minDays: 16, maxDays: 30 },
      AVISO_FINAL: { minDays: 31, maxDays: 60 },
      CRITICO: { minDays: 61, maxDays: null },
    },
    sequence_timeouts: {
      soft_to_firm_days: 5,
      firm_to_final_days: 5,
      final_to_escalation_days: 5,
      accountant_reminder_hours: 24,
    },
    templates: {
      email_soft: {
        subject:
          "Recordatorio de pago - Factura(s) pendiente(s) - {{razonSocial}}",
        body: "Estimado/a cliente,\n\nLe recordamos que tiene facturas pendientes de pago. Agradecemos su pronta atención.\n\nSaludos cordiales.",
      },
      email_firm: {
        subject: "Aviso importante - Facturas vencidas - {{razonSocial}}",
        body: "Estimado/a cliente,\n\nSus facturas se encuentran vencidas. Le solicitamos regularizar su situación a la brevedad.\n\nSaludos cordiales.",
      },
      email_final: {
        subject: "AVISO FINAL - Acción requerida - {{razonSocial}}",
        body: "Estimado/a cliente,\n\nEste es un aviso final respecto a sus facturas vencidas. De no recibir respuesta, procederemos con las acciones correspondientes.\n\nSaludos cordiales.",
      },
    },
  };

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
