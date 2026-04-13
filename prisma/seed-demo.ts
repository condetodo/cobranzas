import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Argentine business names for realistic demo
const BUSINESSES = [
  { name: 'Distribuidora Norte SRL', cat: 'distribucion' },
  { name: 'Metalurgica Pampeana SA', cat: 'industria' },
  { name: 'Alimentos del Sur SA', cat: 'alimentos' },
  { name: 'Transporte Patagonico SRL', cat: 'transporte' },
  { name: 'Constructora Andina SA', cat: 'construccion' },
  { name: 'Ceramicas del Litoral SRL', cat: 'construccion' },
  { name: 'Frigorifico La Pradera SA', cat: 'alimentos' },
  { name: 'Textil Cordobesa SRL', cat: 'textil' },
  { name: 'Maderera Entrerriana SA', cat: 'industria' },
  { name: 'Agroquimicos Rosario SRL', cat: 'agro' },
  { name: 'Plasticos San Martin SA', cat: 'industria' },
  { name: 'Electronica Federal SRL', cat: 'tecnologia' },
  { name: 'Papelera del Plata SA', cat: 'industria' },
  { name: 'Ferreteria Industrial BsAs SRL', cat: 'ferreteria' },
  { name: 'Laboratorios Tucuman SA', cat: 'salud' },
  { name: 'Grafica Mendocina SRL', cat: 'servicios' },
  { name: 'Automotores del Centro SA', cat: 'automotriz' },
  { name: 'Quimica Santafesina SRL', cat: 'industria' },
  { name: 'Envases Salta SA', cat: 'industria' },
  { name: 'Curtiembre La Riojana SRL', cat: 'industria' },
  { name: 'Software Austral SA', cat: 'tecnologia' },
  { name: 'Ganaderia del Chaco SRL', cat: 'agro' },
  { name: 'Vitivinicola Cuyana SA', cat: 'alimentos' },
  { name: 'Sanitarios del NOA SRL', cat: 'construccion' },
  { name: 'Muebleria Formosena SA', cat: 'industria' },
  { name: 'Harinas La Bonaerense SRL', cat: 'alimentos' },
  { name: 'Petrolera Neuquina SA', cat: 'energia' },
  { name: 'Telecomunicaciones Jujuy SRL', cat: 'tecnologia' },
  { name: 'Aceites Misiones SA', cat: 'alimentos' },
  { name: 'Cementos Catamarca SRL', cat: 'construccion' },
  { name: 'Logistica Express Buenos Aires SA', cat: 'transporte' },
  { name: 'Panificadora San Luis SRL', cat: 'alimentos' },
  { name: 'Vidrieria Artesanal Cordoba SA', cat: 'industria' },
  { name: 'Herramientas del Parana SRL', cat: 'ferreteria' },
  { name: 'Lacteos La Serenisima del Sur SA', cat: 'alimentos' },
  { name: 'Imprenta Platense SRL', cat: 'servicios' },
  { name: 'Repuestos Industriales Bahia SA', cat: 'automotriz' },
  { name: 'Cooperativa Agricola Pergamino', cat: 'agro' },
  { name: 'Frigorifica Entre Rios SA', cat: 'alimentos' },
  { name: 'Materiales Electricos Rosario SRL', cat: 'industria' },
  { name: 'Farmacia Mayorista Patagonia SA', cat: 'salud' },
  { name: 'Servicios Mineros Catamarca SRL', cat: 'mineria' },
  { name: 'Astilleros del Delta SA', cat: 'industria' },
  { name: 'Dulces Regionales Salta SRL', cat: 'alimentos' },
  { name: 'Telecable Corrientes SA', cat: 'tecnologia' },
  { name: 'Hilanderia Santiago SRL', cat: 'textil' },
  { name: 'Fundicion La Matanza SA', cat: 'industria' },
  { name: 'Olivicola San Juan SRL', cat: 'alimentos' },
  { name: 'Informatica Litoral SA', cat: 'tecnologia' },
  { name: 'Carnes Premium Pampas SRL', cat: 'alimentos' },
]

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 15)
  const domains = ['gmail.com', 'outlook.com', 'empresa.com.ar', 'yahoo.com.ar']
  return `admin@${slug}.com.ar`
}

function randomPhone(): string {
  const area = randomBetween(11, 388)
  const num = randomBetween(1000000, 9999999)
  return `+549${area}${num}`
}

function randomAmount(): number {
  // Between $5,000 and $500,000 ARS with realistic distribution
  const ranges = [
    { min: 5000, max: 25000, weight: 30 },
    { min: 25000, max: 80000, weight: 35 },
    { min: 80000, max: 200000, weight: 25 },
    { min: 200000, max: 500000, weight: 10 },
  ]
  const roll = Math.random() * 100
  let cumulative = 0
  for (const range of ranges) {
    cumulative += range.weight
    if (roll < cumulative) {
      return randomBetween(range.min, range.max)
    }
  }
  return randomBetween(5000, 50000)
}

function randomDaysOffset(): number {
  // Weighted distribution: some future, some recently overdue, some very overdue
  const roll = Math.random() * 100
  if (roll < 12) return randomBetween(-15, -1) // SIN_VENCER (future)
  if (roll < 35) return randomBetween(5, 20) // SUAVE
  if (roll < 60) return randomBetween(20, 40) // FIRME
  if (roll < 80) return randomBetween(40, 60) // AVISO_FINAL
  return randomBetween(60, 120) // CRITICO
}

async function main() {
  console.log('Cleaning existing demo data...')
  // Clean in dependency order
  await prisma.accountantConfirmation.deleteMany()
  await prisma.accountantConfirmationToken.deleteMany()
  await prisma.incomingMessage.deleteMany()
  await prisma.outreachAttempt.deleteMany()
  await prisma.outreachSequence.deleteMany()
  await prisma.debtorTriageSnapshot.deleteMany()
  await prisma.portfolioAnalysis.deleteMany()
  await prisma.triageRun.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.client.deleteMany()
  await prisma.auditLog.deleteMany()

  console.log('Creating 50 clients with invoices...')

  const now = new Date()
  let totalInvoices = 0

  for (let i = 0; i < BUSINESSES.length; i++) {
    const biz = BUSINESSES[i]
    const cod = `CLI-${String(i + 1).padStart(4, '0')}`
    const hasEmail = Math.random() > 0.15
    const hasPhone = Math.random() > 0.3

    const client = await prisma.client.create({
      data: {
        cod,
        razonSocial: biz.name,
        email: hasEmail ? randomEmail(biz.name) : null,
        telefono: hasPhone ? randomPhone() : null,
        categoria: biz.cat,
      },
    })

    // Each client gets 2-8 invoices
    const invoiceCount = randomBetween(2, 8)

    for (let j = 0; j < invoiceCount; j++) {
      const daysOverdue = randomDaysOffset()
      const fechaVencimiento = new Date(now)
      fechaVencimiento.setDate(fechaVencimiento.getDate() - daysOverdue)

      // Emission date is 30-60 days before due date
      const fechaEmision = new Date(fechaVencimiento)
      fechaEmision.setDate(fechaEmision.getDate() - randomBetween(30, 60))

      const numero = `FAC-${cod.replace('CLI-', '')}/${String(j + 1).padStart(3, '0')}`

      await prisma.invoice.create({
        data: {
          clientId: client.id,
          numero,
          fechaEmision,
          fechaVencimiento,
          monto: randomAmount(),
          moneda: 'ARS',
          estado: 'PENDING',
        },
      })
      totalInvoices++
    }
  }

  console.log(`Created ${BUSINESSES.length} clients and ${totalInvoices} invoices`)
  console.log('Demo seed complete. Run triage to analyze the portfolio.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
