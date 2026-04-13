# CobranzasAI Slice #1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete end-to-end automated debt collection pipeline with Email + WhatsApp (demo) channels, AI-powered portfolio analysis, autonomous outreach sequences, and an accountant confirmation workflow — all behind a polished dashboard designed for a WOW demo.

**Architecture:** Next.js 15 monolith (App Router, Server Components, Server Actions) with Prisma ORM on PostgreSQL. Background jobs via Railway Cron hitting API endpoints with DB advisory locks. 7 LLM agents (Sonnet default, Opus for portfolio analysis) accessed via Anthropic TypeScript SDK. Channels abstracted behind `OutreachChannel` interface for easy swap.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, NextAuth.js (Credentials), Anthropic Claude SDK, Gmail API (googleapis), shadcn/ui + Tailwind CSS, Vitest, Railway.

**Spec:** `docs/superpowers/specs/2026-04-11-cobranzas-mvp-slice1-design.md`

---

## File Structure

```
cobranzas-ai/
├── app/
│   ├── layout.tsx                           # root layout (html, body, providers)
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                     # login form
│   ├── (app)/
│   │   ├── layout.tsx                       # authenticated shell (sidebar, topbar)
│   │   ├── cartera/
│   │   │   └── page.tsx                     # debtor table (operational tab)
│   │   ├── analisis-ia/
│   │   │   └── page.tsx                     # AI analysis tab (hero moment)
│   │   ├── historico/
│   │   │   └── page.tsx                     # historical scans tab
│   │   └── settings/
│   │       └── page.tsx                     # settings form + excel import
│   ├── accountant/
│   │   └── confirm/
│   │       └── [token]/
│   │           └── page.tsx                 # public accountant confirmation page
│   └── api/
│       ├── import/
│       │   └── route.ts                     # POST: upload Excel files
│       ├── triage/
│       │   └── route.ts                     # POST: trigger scan
│       ├── campaigns/
│       │   └── launch/
│       │       └── route.ts                 # POST: batch approve campaign
│       ├── incoming-whatsapp/
│       │   └── route.ts                     # POST: webhook from Evolution bot
│       ├── accountant/
│       │   └── confirm/
│       │       └── route.ts                 # POST: accountant submits decision
│       └── cron/
│           ├── poll-gmail/
│           │   └── route.ts                 # GET: poll Gmail for responses
│           ├── advance-sequences/
│           │   └── route.ts                 # GET: advance state machines by timeout
│           ├── contador-reminder/
│           │   └── route.ts                 # GET: send accountant reminders
│           └── cleanup-tokens/
│               └── route.ts                 # GET: expire old tokens
├── lib/
│   ├── db.ts                                # Prisma client singleton
│   ├── auth.ts                              # NextAuth config + helpers
│   ├── excel/
│   │   ├── parse-clients.ts                 # parse clientes.xlsx → Client[]
│   │   └── parse-invoices.ts                # parse facturas.xlsx → Invoice[]
│   ├── triage/
│   │   ├── scoring.ts                       # deterministic priority score
│   │   ├── buckets.ts                       # bucket assignment from thresholds
│   │   └── run-triage.ts                    # full scan orchestrator (phases 1-4)
│   ├── agents/
│   │   ├── shared.ts                        # callAgent() with retries + structured logging
│   │   ├── agent-a-insight.ts               # debtor insight enricher (Sonnet)
│   │   ├── agent-b-portfolio.ts             # portfolio-wide analyzer (Opus)
│   │   ├── agent-c-classifier.ts            # incoming message classifier (Sonnet)
│   │   ├── agent-d-vision.ts                # payment proof analyzer (Sonnet)
│   │   ├── agent-e-conversational.ts        # debtor conversational agent (Sonnet)
│   │   ├── agent-f-rejection.ts             # rejection message generator (Sonnet)
│   │   └── agent-g-sanity.ts                # campaign sanity checker (Sonnet)
│   ├── channels/
│   │   ├── types.ts                         # OutreachChannel interface
│   │   ├── email-channel.ts                 # Gmail API send + history polling
│   │   └── whatsapp-demo-channel.ts         # adapter to Evolution bot (DEMO ONLY)
│   ├── state-machine/
│   │   ├── states.ts                        # state enum + valid transitions map
│   │   ├── transitions.ts                   # transition functions
│   │   └── runner.ts                        # cron runner logic
│   ├── templates/
│   │   ├── render.ts                        # variable interpolation
│   │   └── defaults.ts                      # default copy for soft/firm/final/etc.
│   ├── contador/
│   │   ├── token.ts                         # generate + validate tokens
│   │   └── workflow.ts                      # send to accountant, process decision
│   ├── config.ts                            # get/set Config from DB
│   └── audit.ts                             # append-only audit log helper
├── components/
│   ├── ui/                                  # shadcn/ui primitives (button, card, etc.)
│   ├── app-shell.tsx                        # sidebar + topbar
│   ├── cartera/
│   │   ├── debtor-table.tsx                 # main data table with columns
│   │   ├── debtor-filters.tsx               # filter bar
│   │   └── debtor-drawer.tsx                # lateral drawer with timeline
│   ├── analisis-ia/
│   │   ├── scan-summary-card.tsx            # post-scan summary with deltas
│   │   ├── findings-list.tsx                # agent B findings
│   │   ├── segment-cards.tsx                # horizontal segment cards
│   │   ├── action-plan-list.tsx             # recommendations with "launch campaign" btn
│   │   └── campaign-modal.tsx               # batch approval modal
│   ├── historico/
│   │   └── triage-run-list.tsx              # list of past scans
│   ├── settings/
│   │   └── settings-form.tsx                # all settings sections
│   └── import/
│       ├── excel-dropzone.tsx               # drag-and-drop upload
│       └── import-progress.tsx              # animated progress during scan
├── prisma/
│   ├── schema.prisma                        # full data model
│   ├── seed.ts                              # seed admin users + default config
│   └── migrations/                          # auto-generated
├── tests/
│   ├── lib/
│   │   ├── excel/
│   │   │   ├── parse-clients.test.ts
│   │   │   └── parse-invoices.test.ts
│   │   ├── triage/
│   │   │   ├── scoring.test.ts
│   │   │   └── buckets.test.ts
│   │   ├── state-machine/
│   │   │   ├── transitions.test.ts
│   │   │   └── runner.test.ts
│   │   ├── templates/
│   │   │   └── render.test.ts
│   │   ├── contador/
│   │   │   └── token.test.ts
│   │   └── agents/
│   │       └── agent-c-classifier.test.ts
│   └── fixtures/
│       ├── clientes-valid.xlsx
│       ├── clientes-missing-cols.xlsx
│       ├── facturas-valid.xlsx
│       └── facturas-bad-dates.xlsx
├── .env.example
├── .env.local                               # gitignored
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── .gitignore
```

---

## Task 1: Project Scaffolding + Prisma Schema + Auth

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.env.example`, `.gitignore` (update), `vitest.config.ts`
- Create: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: `lib/db.ts`, `lib/auth.ts`
- Create: `app/layout.tsx`, `app/(auth)/login/page.tsx`
- Create: `app/(app)/layout.tsx` (stub)
- Create: `middleware.ts` (NextAuth route protection)

- [ ] **Step 1: Initialize Next.js project**

```bash
cd C:/Proyectos/cobranzas-ai
npx create-next-app@latest . --typescript --tailwind --eslint --app --src=no --import-alias="@/*" --use-npm
```

Accept overwriting `.gitignore`. This gives us the base Next.js 15 + Tailwind + TypeScript project.

- [ ] **Step 2: Install core dependencies**

```bash
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter bcryptjs
npm install @anthropic-ai/sdk googleapis xlsx pino
npm install -D vitest @vitejs/plugin-react @types/bcryptjs
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input label table tabs badge dialog sheet popover dropdown-menu select textarea separator toast checkbox
```

- [ ] **Step 4: Create `.env.example`**

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/cobranzas"

# Auth
NEXTAUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Anthropic
ANTHROPIC_API_KEY=""
CLAUDE_MODEL_DEFAULT="claude-sonnet-4-20250514"
CLAUDE_MODEL_AGENT_PORTFOLIO="claude-opus-4-20250514"

# Gmail API
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REFRESH_TOKEN=""

# WhatsApp Demo (Evolution bot)
WHATSAPP_DEMO_ENDPOINT=""
WHATSAPP_DEMO_API_KEY=""

# Storage
STORAGE_PATH="./storage"
```

- [ ] **Step 5: Update `.gitignore`**

Add to existing `.gitignore`:

```
node_modules/
.next/
.env
.env.local
storage/
```

- [ ] **Step 6: Write the Prisma schema**

Create `prisma/schema.prisma` with the full data model from spec sections 6.1-6.5. Key models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// --- Auth ---

model User {
  id             String   @id @default(cuid())
  username       String   @unique
  hashedPassword String
  createdAt      DateTime @default(now())
}

// --- Domain entities ---

enum InvoiceState {
  PENDING
  PAID
  CANCELLED
}

model Client {
  id           String   @id @default(cuid())
  cod          String   @unique
  razonSocial  String
  email        String?
  telefono     String?
  telegram     String?
  categoria    String?
  autopilotOff Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  invoices             Invoice[]
  triageSnapshots      DebtorTriageSnapshot[]
  outreachSequences    OutreachSequence[]
}

model Invoice {
  id               String       @id @default(cuid())
  clientId         String
  client           Client       @relation(fields: [clientId], references: [id])
  numero           String
  fechaEmision     DateTime
  fechaVencimiento DateTime
  monto            Decimal
  moneda           String       @default("ARS")
  estado           InvoiceState @default(PENDING)
  paidAt           DateTime?
  paidAmount       Decimal?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@unique([clientId, numero])
}

// --- Triage ---

enum TriageSource {
  IMPORT
  MANUAL
}

enum Bucket {
  SIN_VENCER
  SUAVE
  FIRME
  AVISO_FINAL
  CRITICO
}

model TriageRun {
  id            String       @id @default(cuid())
  timestamp     DateTime     @default(now())
  source        TriageSource
  excelFileName String?
  totalDebtors  Int
  totalAmount   Decimal
  bucketCounts  Json
  bucketAmounts Json

  snapshots         DebtorTriageSnapshot[]
  portfolioAnalysis PortfolioAnalysis?
}

model DebtorTriageSnapshot {
  id            String   @id @default(cuid())
  triageRunId   String
  triageRun     TriageRun @relation(fields: [triageRunId], references: [id])
  clientId      String
  client        Client    @relation(fields: [clientId], references: [id])
  montoTotal    Decimal
  invoiceCount  Int
  diasVencidoMax Int
  bucket        Bucket
  score         Int
  agentSegment  String?
  aiInsight     String?

  @@index([triageRunId, score(sort: Desc)])
}

model PortfolioAnalysis {
  id           String   @id @default(cuid())
  triageRunId  String   @unique
  triageRun    TriageRun @relation(fields: [triageRunId], references: [id])
  findings     Json
  segmentos    Json
  planDeAccion Json
  createdAt    DateTime @default(now())
}

// --- Outreach ---

enum SequenceState {
  SCHEDULED
  SENT_SOFT
  SENT_FIRM
  SENT_FINAL
  IN_CONVERSATION
  AWAITING_ACCOUNTANT
  PAID
  PARTIAL_PAID_CONTINUING
  ESCALATED_TO_HUMAN
  AUTOPILOT_OFF
  CLOSED
}

enum Channel {
  EMAIL
  WHATSAPP
}

enum ClosedReason {
  PAID
  PARTIAL_PAID_CONTINUING
  ESCALATED
  MANUAL_OVERRIDE
}

model OutreachSequence {
  id               String        @id @default(cuid())
  clientId         String        @unique
  client           Client        @relation(fields: [clientId], references: [id])
  state            SequenceState
  currentBucket    Bucket
  startedAt        DateTime      @default(now())
  nextActionAt     DateTime?
  pausedReason     String?
  escalationReason String?
  closedAt         DateTime?
  closedReason     ClosedReason?

  attempts         OutreachAttempt[]
  incomingMessages IncomingMessage[]
  confirmationTokens AccountantConfirmationToken[]
}

model OutreachAttempt {
  id                 String           @id @default(cuid())
  sequenceId         String
  sequence           OutreachSequence @relation(fields: [sequenceId], references: [id])
  channel            Channel
  templateCode       String
  sentAt             DateTime         @default(now())
  externalMessageId  String?
  rawPayload         Json
  firstResponseAt    DateTime?
  classificationResult Json?
}

enum IncomingCategory {
  PAGARA
  COMPROBANTE_ADJUNTO
  NEGOCIANDO
  DISPUTA
  AUTO_REPLY
  OTRO
}

model IncomingMessage {
  id                 String            @id @default(cuid())
  sequenceId         String?
  sequence           OutreachSequence? @relation(fields: [sequenceId], references: [id])
  channel            Channel
  fromAddress        String
  text               String
  mediaUrl           String?
  mediaType          String?
  receivedAt         DateTime          @default(now())
  classifiedCategory IncomingCategory?
  classifierMetadata Json?
  agentResponseId    String?
}

// --- Accountant ---

model AccountantConfirmationToken {
  id                String           @id @default(cuid())
  token             String           @unique
  incomingMessageId String           @unique
  sequenceId        String
  sequence          OutreachSequence @relation(fields: [sequenceId], references: [id])
  createdAt         DateTime         @default(now())
  expiresAt         DateTime
  consumedAt        DateTime?
  reminderSentAt    DateTime?

  confirmation      AccountantConfirmation?
}

enum AccountantDecision {
  TOTAL
  PARTIAL
  REJECTED
}

model AccountantConfirmation {
  id              String                      @id @default(cuid())
  tokenId         String                      @unique
  token           AccountantConfirmationToken  @relation(fields: [tokenId], references: [id])
  sequenceId      String
  decision        AccountantDecision
  confirmedAmount Decimal?
  rejectionReason String?
  appliedInvoiceIds Json?
  createdAt       DateTime                    @default(now())
}

// --- Config & Audit ---

model Config {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json
  updatedAt DateTime @updatedAt
}

enum ActorType {
  USER
  SYSTEM
  CONTADOR
  DEBTOR
}

model AuditLog {
  id         String    @id @default(cuid())
  timestamp  DateTime  @default(now())
  actorType  ActorType
  actorId    String?
  action     String
  targetType String?
  targetId   String?
  payload    Json?
}
```

- [ ] **Step 7: Create Prisma singleton client**

Create `lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 8: Create seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Guard: only seed if no users exist
  const count = await prisma.user.count()
  if (count > 0) {
    console.log('Users already exist, skipping seed.')
    return
  }

  const hash = await bcrypt.hash('admin123', 10)

  await prisma.user.createMany({
    data: [
      { username: 'admin1', hashedPassword: hash },
      { username: 'admin2', hashedPassword: hash },
    ],
  })

  // Seed default config values
  const defaults: Record<string, unknown> = {
    'aging.thresholds': { suave: 15, firme: 30, avisoFinal: 45 },
    'sequence.timeouts': { softToFirm: 5, firmToFinal: 7, finalToEscalated: 10 },
    'contador.email': '',
    'contador.reminderTimeoutHours': 24,
    'templates.copy': {
      soft: 'Estimado/a {{razonSocial}}, le recordamos que tiene una factura pendiente por {{montoTotal}} con vencimiento {{fechaVencimiento}}. Agradecemos su pronta atención.',
      firm: 'Estimado/a {{razonSocial}}, su deuda de {{montoTotal}} lleva {{diasVencido}} días de atraso. Le solicitamos regularizar su situación a la brevedad.',
      avisoFinal: 'AVISO FINAL: {{razonSocial}}, su deuda de {{montoTotal}} lleva {{diasVencido}} días sin pago. De no recibir respuesta en {{diasRestantes}} días, procederemos con las medidas correspondientes.',
      postPartial: 'Gracias por su pago parcial de {{montoPagado}}. Queda un saldo pendiente de {{montoRestante}}.',
      paid: 'Confirmamos la recepción de su pago por {{montoTotal}}. Muchas gracias por regularizar su situación.',
      rejection: 'Lamentamos informarle que el comprobante enviado no pudo ser validado. {{motivoRechazo}}. Por favor envíe un comprobante válido.',
    },
  }

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.config.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    })
  }

  console.log('Seeded 2 admin users and default config.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Add to `package.json`:

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

- [ ] **Step 9: Run initial migration**

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Expected: Migration created, 2 users + config rows seeded.

- [ ] **Step 10: Configure NextAuth**

Create `lib/auth.ts`:

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        })
        if (!user) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        )
        if (!valid) return null
        return { id: user.id, name: user.username }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
```

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

Create `middleware.ts`:

```typescript
import { auth } from '@/lib/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnApp = req.nextUrl.pathname.startsWith('/(app)') ||
    req.nextUrl.pathname.startsWith('/cartera') ||
    req.nextUrl.pathname.startsWith('/analisis-ia') ||
    req.nextUrl.pathname.startsWith('/historico') ||
    req.nextUrl.pathname.startsWith('/settings')

  if (isOnApp && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|accountant).*)'],
}
```

- [ ] **Step 11: Create login page**

Create `app/(auth)/login/page.tsx` — a simple centered form with username + password inputs, calling `signIn('credentials', ...)`. Use shadcn Card, Input, Button. On success redirect to `/cartera`.

- [ ] **Step 12: Create root layout and app shell stub**

`app/layout.tsx` — html + body + Toaster provider.

`app/(app)/layout.tsx` — check session with `auth()`, redirect if not logged in. Render sidebar with 4 nav links (Cartera, Análisis IA, Histórico, Settings) + main content area. Use a minimal sidebar with icons.

- [ ] **Step 13: Verify auth flow works**

```bash
npm run dev
```

1. Visit `http://localhost:3000/cartera` → should redirect to `/login`
2. Login with `admin1`/`admin123` → should redirect to `/cartera`
3. Visit `/accountant/confirm/test` → should NOT redirect (public route)

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Prisma schema, NextAuth, and app shell"
```

---

## Task 2: Config Helper + Audit Log + Vitest Setup

**Files:**
- Create: `lib/config.ts`, `lib/audit.ts`, `vitest.config.ts`
- Create: `tests/lib/config.test.ts` (optional — simple CRUD)

- [ ] **Step 1: Create config helper**

Create `lib/config.ts`:

```typescript
import { prisma } from './db'

export async function getConfig<T>(key: string): Promise<T | null> {
  const row = await prisma.config.findUnique({ where: { key } })
  return row ? (row.value as T) : null
}

export async function getConfigOrThrow<T>(key: string): Promise<T> {
  const value = await getConfig<T>(key)
  if (value === null) throw new Error(`Config key "${key}" not found`)
  return value
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  })
}

// Typed getters for known config keys
export interface AgingThresholds {
  suave: number
  firme: number
  avisoFinal: number
}

export interface SequenceTimeouts {
  softToFirm: number
  firmToFinal: number
  finalToEscalated: number
}

export const getAgingThresholds = () => getConfigOrThrow<AgingThresholds>('aging.thresholds')
export const getSequenceTimeouts = () => getConfigOrThrow<SequenceTimeouts>('sequence.timeouts')
export const getContadorEmail = () => getConfigOrThrow<string>('contador.email')
export const getTemplatesCopy = () => getConfigOrThrow<Record<string, string>>('templates.copy')
```

- [ ] **Step 2: Create audit log helper**

Create `lib/audit.ts`:

```typescript
import { prisma } from './db'
import { ActorType } from '@prisma/client'

export async function auditLog(params: {
  actorType: ActorType
  actorId?: string
  action: string
  targetType?: string
  targetId?: string
  payload?: unknown
}) {
  await prisma.auditLog.create({
    data: {
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      payload: params.payload as any,
    },
  })
}
```

- [ ] **Step 3: Setup Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

```bash
npm test
```

Expected: "No test files found" (no tests written yet), but vitest runs without error.

- [ ] **Step 5: Commit**

```bash
git add lib/config.ts lib/audit.ts vitest.config.ts package.json
git commit -m "feat: config helper, audit log, and vitest setup"
```

---

## Task 3: Excel Parsers

**Files:**
- Create: `lib/excel/parse-clients.ts`, `lib/excel/parse-invoices.ts`
- Create: `tests/lib/excel/parse-clients.test.ts`, `tests/lib/excel/parse-invoices.test.ts`
- Create: `tests/fixtures/clientes-valid.xlsx`, `tests/fixtures/facturas-valid.xlsx` (generated in test setup)

- [ ] **Step 1: Write failing test for client parser**

Create `tests/lib/excel/parse-clients.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseClients, ClientRow } from '@/lib/excel/parse-clients'
import XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

function createTestXlsx(rows: Record<string, unknown>[], filename: string): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

describe('parseClients', () => {
  it('parses valid client rows', () => {
    const buf = createTestXlsx([
      { COD: 'C001', RAZON_SOCIAL: 'Acme SRL', MAIL: 'a@acme.com', TELEFONO: '1155001234' },
      { COD: 'C002', RAZON_SOCIAL: 'Beta SA', MAIL: 'b@beta.com', TELEFONO: '' },
    ], 'test.xlsx')

    const result = parseClients(buf)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({
      cod: 'C001',
      razonSocial: 'Acme SRL',
      email: 'a@acme.com',
      telefono: '1155001234',
      telegram: null,
      categoria: null,
    })
    expect(result.errors).toHaveLength(0)
  })

  it('reports error when COD column is missing', () => {
    const buf = createTestXlsx([
      { RAZON_SOCIAL: 'Acme SRL', MAIL: 'a@acme.com' },
    ], 'test.xlsx')

    const result = parseClients(buf)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('COD')
  })

  it('skips rows with empty COD', () => {
    const buf = createTestXlsx([
      { COD: 'C001', RAZON_SOCIAL: 'Acme SRL', MAIL: 'a@acme.com' },
      { COD: '', RAZON_SOCIAL: 'Skip Me', MAIL: '' },
    ], 'test.xlsx')

    const result = parseClients(buf)
    expect(result.rows).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/excel/parse-clients.test.ts
```

Expected: FAIL — module `@/lib/excel/parse-clients` not found.

- [ ] **Step 3: Implement client parser**

Create `lib/excel/parse-clients.ts`:

```typescript
import XLSX from 'xlsx'

export interface ClientRow {
  cod: string
  razonSocial: string
  email: string | null
  telefono: string | null
  telegram: string | null
  categoria: string | null
}

export interface ParseResult<T> {
  rows: T[]
  errors: string[]
}

const REQUIRED_COLUMNS = ['COD', 'RAZON_SOCIAL']

export function parseClients(buffer: Buffer): ParseResult<ClientRow> {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  if (raw.length === 0) {
    return { rows: [], errors: ['El archivo está vacío'] }
  }

  const headers = Object.keys(raw[0])
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c))
  if (missing.length > 0) {
    return { rows: [], errors: [`Columnas faltantes: ${missing.join(', ')}`] }
  }

  const rows: ClientRow[] = []
  const errors: string[] = []

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const cod = String(r['COD'] ?? '').trim()
    if (!cod) continue

    const razonSocial = String(r['RAZON_SOCIAL'] ?? '').trim()
    if (!razonSocial) {
      errors.push(`Fila ${i + 2}: RAZON_SOCIAL vacío para COD=${cod}`)
      continue
    }

    rows.push({
      cod,
      razonSocial,
      email: r['MAIL'] ? String(r['MAIL']).trim() : null,
      telefono: r['TELEFONO'] ? String(r['TELEFONO']).trim() : null,
      telegram: r['TELEGRAM'] ? String(r['TELEGRAM']).trim() : null,
      categoria: r['CATEGORIA'] ? String(r['CATEGORIA']).trim() : null,
    })
  }

  return { rows, errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/excel/parse-clients.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Write failing test for invoice parser**

Create `tests/lib/excel/parse-invoices.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseInvoices, InvoiceRow } from '@/lib/excel/parse-invoices'
import XLSX from 'xlsx'

function createTestXlsx(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

describe('parseInvoices', () => {
  it('parses valid invoice rows', () => {
    const buf = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        NUMERO: 'F-0001',
        FECHA_EMISION: '2026-01-15',
        FECHA_VENCIMIENTO: '2026-02-15',
        MONTO: 15000.50,
        MONEDA: 'ARS',
      },
    ])

    const result = parseInvoices(buf)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].codCliente).toBe('C001')
    expect(result.rows[0].monto).toBe(15000.50)
    expect(result.errors).toHaveLength(0)
  })

  it('defaults moneda to ARS when missing', () => {
    const buf = createTestXlsx([
      {
        COD_CLIENTE: 'C001',
        NUMERO: 'F-0001',
        FECHA_EMISION: '2026-01-15',
        FECHA_VENCIMIENTO: '2026-02-15',
        MONTO: 5000,
      },
    ])

    const result = parseInvoices(buf)
    expect(result.rows[0].moneda).toBe('ARS')
  })

  it('reports error for missing required columns', () => {
    const buf = createTestXlsx([{ NUMERO: 'F-0001' }])
    const result = parseInvoices(buf)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run tests/lib/excel/parse-invoices.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement invoice parser**

Create `lib/excel/parse-invoices.ts`:

```typescript
import XLSX from 'xlsx'

export interface InvoiceRow {
  codCliente: string
  numero: string
  fechaEmision: Date
  fechaVencimiento: Date
  monto: number
  moneda: string
}

export interface ParseResult<T> {
  rows: T[]
  errors: string[]
}

const REQUIRED_COLUMNS = ['COD_CLIENTE', 'NUMERO', 'FECHA_EMISION', 'FECHA_VENCIMIENTO', 'MONTO']

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(value)
    return new Date(d.y, d.m - 1, d.d)
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function parseInvoices(buffer: Buffer): ParseResult<InvoiceRow> {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  if (raw.length === 0) {
    return { rows: [], errors: ['El archivo está vacío'] }
  }

  const headers = Object.keys(raw[0])
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c))
  if (missing.length > 0) {
    return { rows: [], errors: [`Columnas faltantes: ${missing.join(', ')}`] }
  }

  const rows: InvoiceRow[] = []
  const errors: string[] = []

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const rowNum = i + 2

    const codCliente = String(r['COD_CLIENTE'] ?? '').trim()
    if (!codCliente) continue

    const numero = String(r['NUMERO'] ?? '').trim()
    if (!numero) {
      errors.push(`Fila ${rowNum}: NUMERO vacío`)
      continue
    }

    const fechaEmision = parseDate(r['FECHA_EMISION'])
    if (!fechaEmision) {
      errors.push(`Fila ${rowNum}: FECHA_EMISION inválida`)
      continue
    }

    const fechaVencimiento = parseDate(r['FECHA_VENCIMIENTO'])
    if (!fechaVencimiento) {
      errors.push(`Fila ${rowNum}: FECHA_VENCIMIENTO inválida`)
      continue
    }

    const monto = Number(r['MONTO'])
    if (isNaN(monto) || monto <= 0) {
      errors.push(`Fila ${rowNum}: MONTO inválido (${r['MONTO']})`)
      continue
    }

    rows.push({
      codCliente,
      numero,
      fechaEmision,
      fechaVencimiento,
      monto,
      moneda: r['MONEDA'] ? String(r['MONEDA']).trim() : 'ARS',
    })
  }

  return { rows, errors }
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx vitest run tests/lib/excel/parse-invoices.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add lib/excel/ tests/lib/excel/
git commit -m "feat: Excel parsers for clientes.xlsx and facturas.xlsx with tests"
```

---

## Task 4: Excel Import API + Upsert Logic

**Files:**
- Create: `app/api/import/route.ts`
- Create: `lib/excel/import.ts` (upsert orchestrator)

- [ ] **Step 1: Implement upsert orchestrator**

Create `lib/excel/import.ts`:

```typescript
import { prisma } from '@/lib/db'
import { parseClients, ClientRow } from './parse-clients'
import { parseInvoices, InvoiceRow } from './parse-invoices'
import { auditLog } from '@/lib/audit'

export interface ImportResult {
  clients: { created: number; updated: number }
  invoices: { created: number; updated: number; closed: number }
  errors: string[]
}

export async function importExcel(
  clientsBuffer: Buffer | null,
  invoicesBuffer: Buffer | null,
  userId: string,
  fileName?: string
): Promise<ImportResult> {
  const errors: string[] = []
  let clientsCreated = 0
  let clientsUpdated = 0
  let invoicesCreated = 0
  let invoicesUpdated = 0
  let invoicesClosed = 0

  // Parse clients
  if (clientsBuffer) {
    const parsed = parseClients(clientsBuffer)
    errors.push(...parsed.errors)

    for (const row of parsed.rows) {
      const existing = await prisma.client.findUnique({ where: { cod: row.cod } })
      if (existing) {
        await prisma.client.update({
          where: { cod: row.cod },
          data: {
            razonSocial: row.razonSocial,
            email: row.email,
            telefono: row.telefono,
            telegram: row.telegram,
            categoria: row.categoria,
          },
        })
        clientsUpdated++
      } else {
        await prisma.client.create({
          data: {
            cod: row.cod,
            razonSocial: row.razonSocial,
            email: row.email,
            telefono: row.telefono,
            telegram: row.telegram,
            categoria: row.categoria,
          },
        })
        clientsCreated++
      }
    }
  }

  // Parse invoices
  if (invoicesBuffer) {
    const parsed = parseInvoices(invoicesBuffer)
    errors.push(...parsed.errors)

    // Track which (clientCod, numero) combos appear in this import
    const importedKeys = new Set<string>()

    for (const row of parsed.rows) {
      const client = await prisma.client.findUnique({ where: { cod: row.codCliente } })
      if (!client) {
        errors.push(`Factura ${row.numero}: cliente COD=${row.codCliente} no encontrado`)
        continue
      }

      importedKeys.add(`${client.id}:${row.numero}`)

      const existing = await prisma.invoice.findUnique({
        where: { clientId_numero: { clientId: client.id, numero: row.numero } },
      })

      if (existing) {
        await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            fechaEmision: row.fechaEmision,
            fechaVencimiento: row.fechaVencimiento,
            monto: row.monto,
            moneda: row.moneda,
          },
        })
        invoicesUpdated++
      } else {
        await prisma.invoice.create({
          data: {
            clientId: client.id,
            numero: row.numero,
            fechaEmision: row.fechaEmision,
            fechaVencimiento: row.fechaVencimiento,
            monto: row.monto,
            moneda: row.moneda,
          },
        })
        invoicesCreated++
      }
    }

    // Close invoices that were PENDING but no longer appear in the new import
    // Only for clients that appeared in this import
    const clientCods = parsed.rows.map(r => r.codCliente)
    const uniqueCods = [...new Set(clientCods)]
    for (const cod of uniqueCods) {
      const client = await prisma.client.findUnique({ where: { cod } })
      if (!client) continue

      const pendingInvoices = await prisma.invoice.findMany({
        where: { clientId: client.id, estado: 'PENDING' },
      })

      for (const inv of pendingInvoices) {
        if (!importedKeys.has(`${client.id}:${inv.numero}`)) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { estado: 'PAID', paidAt: new Date() },
          })
          invoicesClosed++
        }
      }
    }
  }

  await auditLog({
    actorType: 'USER',
    actorId: userId,
    action: 'import.completed',
    payload: {
      fileName,
      clients: { created: clientsCreated, updated: clientsUpdated },
      invoices: { created: invoicesCreated, updated: invoicesUpdated, closed: invoicesClosed },
      errorCount: errors.length,
    },
  })

  return {
    clients: { created: clientsCreated, updated: clientsUpdated },
    invoices: { created: invoicesCreated, updated: invoicesUpdated, closed: invoicesClosed },
    errors,
  }
}
```

- [ ] **Step 2: Create import API route**

Create `app/api/import/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { importExcel } from '@/lib/excel/import'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const clientsFile = formData.get('clientes') as File | null
  const invoicesFile = formData.get('facturas') as File | null

  if (!clientsFile && !invoicesFile) {
    return NextResponse.json({ error: 'At least one file required' }, { status: 400 })
  }

  const clientsBuffer = clientsFile
    ? Buffer.from(await clientsFile.arrayBuffer())
    : null
  const invoicesBuffer = invoicesFile
    ? Buffer.from(await invoicesFile.arrayBuffer())
    : null

  const result = await importExcel(
    clientsBuffer,
    invoicesBuffer,
    session.user.id,
    clientsFile?.name ?? invoicesFile?.name
  )

  return NextResponse.json(result)
}
```

- [ ] **Step 3: Verify import endpoint works**

Start dev server, use curl or API client:

```bash
curl -X POST http://localhost:3000/api/import \
  -H "Cookie: <session-cookie>" \
  -F "clientes=@test-clientes.xlsx" \
  -F "facturas=@test-facturas.xlsx"
```

Expected: JSON response with counts of created/updated/closed records.

- [ ] **Step 4: Commit**

```bash
git add lib/excel/import.ts app/api/import/
git commit -m "feat: Excel import API with idempotent upsert logic"
```

---

## Task 5: Triage Engine — Scoring + Buckets + Run Orchestrator

**Files:**
- Create: `lib/triage/scoring.ts`, `lib/triage/buckets.ts`, `lib/triage/run-triage.ts`
- Create: `tests/lib/triage/scoring.test.ts`, `tests/lib/triage/buckets.test.ts`
- Create: `app/api/triage/route.ts`

- [ ] **Step 1: Write failing test for scoring**

Create `tests/lib/triage/scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateScore } from '@/lib/triage/scoring'

describe('calculateScore', () => {
  it('returns 0 for no overdue', () => {
    expect(calculateScore({ diasVencidoMax: 0, montoTotal: 1000, invoiceCount: 1 })).toBe(0)
  })

  it('returns high score for critical debtor', () => {
    const score = calculateScore({ diasVencidoMax: 90, montoTotal: 500000, invoiceCount: 5 })
    expect(score).toBeGreaterThan(80)
  })

  it('weights days overdue more than amount', () => {
    const highDays = calculateScore({ diasVencidoMax: 60, montoTotal: 10000, invoiceCount: 1 })
    const highAmount = calculateScore({ diasVencidoMax: 10, montoTotal: 500000, invoiceCount: 1 })
    expect(highDays).toBeGreaterThan(highAmount)
  })

  it('clamps to 0-100 range', () => {
    const extreme = calculateScore({ diasVencidoMax: 999, montoTotal: 99999999, invoiceCount: 50 })
    expect(extreme).toBeLessThanOrEqual(100)
    expect(extreme).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/triage/scoring.test.ts
```

- [ ] **Step 3: Implement scoring**

Create `lib/triage/scoring.ts`:

```typescript
interface ScoreInput {
  diasVencidoMax: number
  montoTotal: number
  invoiceCount: number
}

/**
 * Deterministic priority score for a debtor.
 * Higher = more urgent to collect.
 *
 * Formula:
 *   - Days overdue (60% weight): normalized to 0-60 (caps at 120 days)
 *   - Amount owed (30% weight): log-scaled, normalized to 0-30
 *   - Invoice count (10% weight): normalized to 0-10 (caps at 10 invoices)
 */
export function calculateScore(input: ScoreInput): number {
  const { diasVencidoMax, montoTotal, invoiceCount } = input

  if (diasVencidoMax <= 0) return 0

  const daysScore = Math.min(diasVencidoMax / 120, 1) * 60
  const amountScore = montoTotal > 0
    ? Math.min(Math.log10(montoTotal) / 7, 1) * 30  // log10(10M) = 7
    : 0
  const countScore = Math.min(invoiceCount / 10, 1) * 10

  return Math.round(Math.min(daysScore + amountScore + countScore, 100))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/triage/scoring.test.ts
```

- [ ] **Step 5: Write failing test for bucket assignment**

Create `tests/lib/triage/buckets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { assignBucket } from '@/lib/triage/buckets'

const thresholds = { suave: 15, firme: 30, avisoFinal: 45 }

describe('assignBucket', () => {
  it('assigns SIN_VENCER when not overdue', () => {
    expect(assignBucket(0, thresholds)).toBe('SIN_VENCER')
    expect(assignBucket(-5, thresholds)).toBe('SIN_VENCER')
  })

  it('assigns SUAVE for 1-14 days', () => {
    expect(assignBucket(1, thresholds)).toBe('SUAVE')
    expect(assignBucket(14, thresholds)).toBe('SUAVE')
  })

  it('assigns FIRME for 15-29 days', () => {
    expect(assignBucket(15, thresholds)).toBe('FIRME')
    expect(assignBucket(29, thresholds)).toBe('FIRME')
  })

  it('assigns AVISO_FINAL for 30-44 days', () => {
    expect(assignBucket(30, thresholds)).toBe('AVISO_FINAL')
    expect(assignBucket(44, thresholds)).toBe('AVISO_FINAL')
  })

  it('assigns CRITICO for 45+ days', () => {
    expect(assignBucket(45, thresholds)).toBe('CRITICO')
    expect(assignBucket(999, thresholds)).toBe('CRITICO')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run tests/lib/triage/buckets.test.ts
```

- [ ] **Step 7: Implement bucket assignment**

Create `lib/triage/buckets.ts`:

```typescript
import { Bucket } from '@prisma/client'
import type { AgingThresholds } from '@/lib/config'

export function assignBucket(diasVencidoMax: number, thresholds: AgingThresholds): Bucket {
  if (diasVencidoMax <= 0) return 'SIN_VENCER'
  if (diasVencidoMax < thresholds.suave) return 'SUAVE'
  if (diasVencidoMax < thresholds.firme) return 'FIRME'
  if (diasVencidoMax < thresholds.avisoFinal) return 'AVISO_FINAL'
  return 'CRITICO'
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx vitest run tests/lib/triage/buckets.test.ts
```

- [ ] **Step 9: Implement triage run orchestrator (Phase 1 only — deterministic)**

Create `lib/triage/run-triage.ts`. This orchestrates all 4 phases. For now, implement Phase 1 (deterministic scoring). Phases 2-4 (AI agents) will be wired in Task 7.

```typescript
import { prisma } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'
import { Bucket, TriageSource } from '@prisma/client'
import { calculateScore } from './scoring'
import { assignBucket } from './buckets'
import { getAgingThresholds } from '@/lib/config'
import { auditLog } from '@/lib/audit'

export interface TriageRunResult {
  triageRunId: string
  totalDebtors: number
  totalAmount: number
  bucketCounts: Record<string, number>
  bucketAmounts: Record<string, number>
}

export async function runTriage(
  source: TriageSource,
  excelFileName?: string
): Promise<TriageRunResult> {
  const thresholds = await getAgingThresholds()
  const now = new Date()

  // Get all clients with pending invoices
  const clients = await prisma.client.findMany({
    where: { invoices: { some: { estado: 'PENDING' } } },
    include: {
      invoices: { where: { estado: 'PENDING' } },
    },
  })

  const bucketCounts: Record<string, number> = {
    SIN_VENCER: 0, SUAVE: 0, FIRME: 0, AVISO_FINAL: 0, CRITICO: 0,
  }
  const bucketAmounts: Record<string, number> = {
    SIN_VENCER: 0, SUAVE: 0, FIRME: 0, AVISO_FINAL: 0, CRITICO: 0,
  }

  let totalAmount = 0

  // Pre-compute snapshots
  const snapshots: Array<{
    clientId: string
    montoTotal: number
    invoiceCount: number
    diasVencidoMax: number
    bucket: Bucket
    score: number
  }> = []

  for (const client of clients) {
    const montoTotal = client.invoices.reduce(
      (sum, inv) => sum + Number(inv.monto),
      0
    )
    const diasVencidoMax = client.invoices.reduce((max, inv) => {
      const dias = Math.floor(
        (now.getTime() - inv.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)
      )
      return Math.max(max, dias)
    }, 0)
    const invoiceCount = client.invoices.length
    const bucket = assignBucket(diasVencidoMax, thresholds)
    const score = calculateScore({ diasVencidoMax, montoTotal, invoiceCount })

    bucketCounts[bucket]++
    bucketAmounts[bucket] += montoTotal
    totalAmount += montoTotal

    snapshots.push({
      clientId: client.id,
      montoTotal,
      invoiceCount,
      diasVencidoMax,
      bucket,
      score,
    })
  }

  // Create triage run + snapshots in a transaction
  const triageRun = await prisma.triageRun.create({
    data: {
      source,
      excelFileName,
      totalDebtors: snapshots.length,
      totalAmount: new Decimal(totalAmount),
      bucketCounts,
      bucketAmounts,
      snapshots: {
        createMany: {
          data: snapshots.map(s => ({
            clientId: s.clientId,
            montoTotal: new Decimal(s.montoTotal),
            invoiceCount: s.invoiceCount,
            diasVencidoMax: s.diasVencidoMax,
            bucket: s.bucket,
            score: s.score,
          })),
        },
      },
    },
  })

  await auditLog({
    actorType: 'SYSTEM',
    action: 'triage.run',
    targetType: 'TriageRun',
    targetId: triageRun.id,
    payload: { totalDebtors: snapshots.length, source },
  })

  return {
    triageRunId: triageRun.id,
    totalDebtors: snapshots.length,
    totalAmount,
    bucketCounts,
    bucketAmounts,
  }
}
```

- [ ] **Step 10: Create triage API route**

Create `app/api/triage/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runTriage } from '@/lib/triage/run-triage'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const result = await runTriage(
    body.source ?? 'MANUAL',
    body.excelFileName
  )

  return NextResponse.json(result)
}
```

- [ ] **Step 11: Commit**

```bash
git add lib/triage/ tests/lib/triage/ app/api/triage/
git commit -m "feat: triage engine with deterministic scoring, bucket assignment, and run orchestrator"
```

---

## Task 6: Template Rendering

**Files:**
- Create: `lib/templates/render.ts`, `lib/templates/defaults.ts`
- Create: `tests/lib/templates/render.test.ts`

- [ ] **Step 1: Write failing test for template rendering**

Create `tests/lib/templates/render.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate } from '@/lib/templates/render'

describe('renderTemplate', () => {
  it('replaces all variables', () => {
    const tpl = 'Hola {{razonSocial}}, debe {{montoTotal}}.'
    const result = renderTemplate(tpl, {
      razonSocial: 'Acme SRL',
      montoTotal: '$15.000',
    })
    expect(result).toBe('Hola Acme SRL, debe $15.000.')
  })

  it('leaves unknown variables as-is', () => {
    const tpl = 'Hola {{razonSocial}}, {{unknown}}'
    const result = renderTemplate(tpl, { razonSocial: 'Acme' })
    expect(result).toBe('Hola Acme, {{unknown}}')
  })

  it('handles empty vars gracefully', () => {
    const tpl = 'No vars here.'
    expect(renderTemplate(tpl, {})).toBe('No vars here.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/templates/render.test.ts
```

- [ ] **Step 3: Implement template rendering**

Create `lib/templates/render.ts`:

```typescript
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match
  })
}
```

Create `lib/templates/defaults.ts`:

```typescript
// Default template copy — also seeded in DB via Config.
// These are fallbacks if DB config is empty.
export const DEFAULT_TEMPLATES = {
  soft: `Estimado/a {{razonSocial}},

Le recordamos que tiene una factura pendiente por {{montoTotal}} con vencimiento {{fechaVencimiento}}.

Agradecemos su pronta atención.

Atentamente,
Departamento de Cobranzas`,

  firm: `Estimado/a {{razonSocial}},

Su deuda de {{montoTotal}} lleva {{diasVencido}} días de atraso. Le solicitamos regularizar su situación a la brevedad para evitar inconvenientes.

Quedamos a disposición para coordinar el pago.

Atentamente,
Departamento de Cobranzas`,

  avisoFinal: `AVISO FINAL

{{razonSocial}}, su deuda de {{montoTotal}} lleva {{diasVencido}} días sin pago. De no recibir una respuesta en los próximos {{diasRestantes}} días, nos veremos obligados a proceder con las medidas correspondientes.

Por favor comuníquese con nosotros para resolver esta situación.

Departamento de Cobranzas`,

  postPartial: `Estimado/a {{razonSocial}},

Confirmamos la recepción de su pago parcial por {{montoPagado}}. Queda un saldo pendiente de {{montoRestante}}.

Agradecemos el pago realizado y quedamos a disposición.

Departamento de Cobranzas`,

  paid: `Estimado/a {{razonSocial}},

Confirmamos la recepción de su pago por {{montoTotal}}. Muchas gracias por regularizar su situación.

Atentamente,
Departamento de Cobranzas`,
} as const
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/templates/render.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/templates/ tests/lib/templates/
git commit -m "feat: template rendering with variable interpolation"
```

---

## Task 7: AI Agents — Shared Infrastructure + All 7 Agents

**Files:**
- Create: `lib/agents/shared.ts`
- Create: `lib/agents/agent-a-insight.ts`, `agent-b-portfolio.ts`, `agent-c-classifier.ts`, `agent-d-vision.ts`, `agent-e-conversational.ts`, `agent-f-rejection.ts`, `agent-g-sanity.ts`
- Create: `tests/lib/agents/agent-c-classifier.test.ts`

- [ ] **Step 1: Create shared agent infrastructure**

Create `lib/agents/shared.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const anthropic = new Anthropic()

export function getModel(agentOverrideEnv?: string): string {
  if (agentOverrideEnv) {
    const override = process.env[agentOverrideEnv]
    if (override) return override
  }
  return process.env.CLAUDE_MODEL_DEFAULT ?? 'claude-sonnet-4-20250514'
}

export interface AgentCallOptions {
  model: string
  system: string
  userMessage: string
  maxTokens?: number
}

export async function callAgent(options: AgentCallOptions): Promise<string> {
  const { model, system, userMessage, maxTokens = 1024 } = options

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text
}

export async function callAgentJSON<T>(
  options: AgentCallOptions,
  schema: z.ZodType<T>
): Promise<T> {
  const raw = await callAgent({
    ...options,
    system: options.system + '\n\nRespond ONLY with valid JSON. No markdown, no explanation.',
  })

  // Try to extract JSON from the response
  const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error(`Agent did not return valid JSON: ${raw.slice(0, 200)}`)
  }

  const parsed = JSON.parse(jsonMatch[0])
  return schema.parse(parsed)
}
```

- [ ] **Step 2: Implement Agent A — Insight Enricher**

Create `lib/agents/agent-a-insight.ts`:

```typescript
import { callAgent, getModel } from './shared'

export async function generateInsight(debtor: {
  razonSocial: string
  montoTotal: number
  diasVencidoMax: number
  invoiceCount: number
  categoria?: string | null
  bucket: string
}): Promise<string> {
  const model = getModel()

  return callAgent({
    model,
    maxTokens: 150,
    system: `Sos un analista de cobranzas experto. Generá un insight de exactamente 2 líneas sobre este deudor. Sé específico y accionable. No uses lenguaje genérico. Respondé solo con el insight, sin prefijos ni formato.`,
    userMessage: `Deudor: ${debtor.razonSocial}
Monto adeudado: $${debtor.montoTotal.toLocaleString('es-AR')}
Días vencido máximo: ${debtor.diasVencidoMax}
Cantidad de facturas pendientes: ${debtor.invoiceCount}
Categoría: ${debtor.categoria ?? 'N/A'}
Bucket actual: ${debtor.bucket}`,
  })
}
```

- [ ] **Step 3: Implement Agent B — Portfolio Analyzer**

Create `lib/agents/agent-b-portfolio.ts`:

```typescript
import { z } from 'zod'
import { callAgentJSON, getModel } from './shared'

const PortfolioAnalysisSchema = z.object({
  findings: z.array(z.object({
    text: z.string(),
    severity: z.enum(['info', 'warning', 'critical']),
  })),
  segmentos: z.array(z.object({
    name: z.string(),
    rule: z.string(),
    count: z.number(),
    totalAmount: z.number(),
  })),
  planDeAccion: z.array(z.object({
    title: z.string(),
    description: z.string(),
    targetSegment: z.string(),
    recommendedAction: z.string(),
    estimatedRecovery: z.number().optional(),
  })),
})

export type PortfolioAnalysis = z.infer<typeof PortfolioAnalysisSchema>

export async function analyzePortfolio(summary: {
  totalDebtors: number
  totalAmount: number
  bucketCounts: Record<string, number>
  bucketAmounts: Record<string, number>
  sampleDebtors: Array<{
    razonSocial: string
    montoTotal: number
    diasVencidoMax: number
    invoiceCount: number
    bucket: string
    categoria?: string | null
  }>
}): Promise<PortfolioAnalysis> {
  const model = getModel('CLAUDE_MODEL_AGENT_PORTFOLIO')

  return callAgentJSON({
    model,
    maxTokens: 4096,
    system: `Sos un analista de cobranzas senior con 20 años de experiencia. Analizá esta cartera de deudores y producí:

1. **findings**: hallazgos no obvios sobre la cartera (patrones, anomalías, oportunidades). Cada finding tiene text y severity (info/warning/critical).

2. **segmentos**: segmentación inteligente de los deudores más allá de los buckets de aging. Proponé 3-5 segmentos con nombre creativo, regla que lo define, count estimado, y monto total estimado.

3. **planDeAccion**: 3-5 recomendaciones concretas de acción. Cada una con título, descripción, segmento target, acción recomendada, y estimación de recupero potencial.

Sé específico, no genérico. Usá los datos concretos que te doy.`,
    userMessage: `CARTERA COMPLETA:
- Total deudores: ${summary.totalDebtors}
- Monto total adeudado: $${summary.totalAmount.toLocaleString('es-AR')}
- Distribución por bucket:
${Object.entries(summary.bucketCounts).map(([k, v]) => `  ${k}: ${v} deudores ($${(summary.bucketAmounts[k] ?? 0).toLocaleString('es-AR')})`).join('\n')}

MUESTRA REPRESENTATIVA (${summary.sampleDebtors.length} deudores):
${summary.sampleDebtors.map(d =>
  `- ${d.razonSocial}: $${d.montoTotal.toLocaleString('es-AR')}, ${d.diasVencidoMax}d vencido, ${d.invoiceCount} facturas, bucket=${d.bucket}, cat=${d.categoria ?? 'N/A'}`
).join('\n')}`,
  }, PortfolioAnalysisSchema)
}
```

- [ ] **Step 4: Implement Agent C — Response Classifier**

Create `lib/agents/agent-c-classifier.ts`:

```typescript
import { z } from 'zod'
import { callAgentJSON, getModel } from './shared'

export const ClassificationSchema = z.object({
  categoria: z.enum([
    'PAGARA',
    'COMPROBANTE_ADJUNTO',
    'NEGOCIANDO',
    'DISPUTA',
    'AUTO_REPLY',
    'OTRO',
  ]),
  confianza: z.number().min(0).max(1),
  metadata: z.object({
    montoDetectado: z.number().optional(),
    fechaDetectada: z.string().optional(),
  }).optional(),
})

export type Classification = z.infer<typeof ClassificationSchema>

export async function classifyResponse(params: {
  text: string
  hasMedia: boolean
  conversationContext: string[]
}): Promise<Classification> {
  const model = getModel()

  return callAgentJSON({
    model,
    maxTokens: 256,
    system: `Clasificá el mensaje de un deudor en una de estas categorías:
- PAGARA: indica intención de pagar (ej: "mañana pago", "ya transferí")
- COMPROBANTE_ADJUNTO: adjunta o menciona un comprobante de pago (imagen, PDF, captura)
- NEGOCIANDO: pide plazo, plan de pagos, o negocia condiciones
- DISPUTA: cuestiona la deuda, dice que ya pagó, no reconoce la factura
- AUTO_REPLY: respuesta automática (OOO, fuera de oficina, auto-reply)
- OTRO: cualquier otra cosa

Devolvé JSON con: categoria, confianza (0-1), y metadata opcional (montoDetectado si mencionan un monto, fechaDetectada si mencionan una fecha).`,
    userMessage: `Mensaje del deudor: "${params.text}"
¿Tiene adjunto/media? ${params.hasMedia ? 'SÍ' : 'NO'}
Contexto (últimos mensajes): ${params.conversationContext.length > 0 ? params.conversationContext.join(' | ') : 'Sin contexto previo'}`,
  }, ClassificationSchema)
}
```

- [ ] **Step 5: Write test for Agent C with mocked responses**

Create `tests/lib/agents/agent-c-classifier.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClassificationSchema } from '@/lib/agents/agent-c-classifier'

// Test the schema validation separately (doesn't need API calls)
describe('ClassificationSchema', () => {
  it('validates a correct classification', () => {
    const valid = {
      categoria: 'PAGARA',
      confianza: 0.95,
      metadata: { montoDetectado: 15000 },
    }
    expect(ClassificationSchema.parse(valid)).toEqual(valid)
  })

  it('rejects invalid category', () => {
    const invalid = { categoria: 'UNKNOWN', confianza: 0.5 }
    expect(() => ClassificationSchema.parse(invalid)).toThrow()
  })

  it('rejects confidence out of range', () => {
    const invalid = { categoria: 'PAGARA', confianza: 1.5 }
    expect(() => ClassificationSchema.parse(invalid)).toThrow()
  })
})
```

- [ ] **Step 6: Run test**

```bash
npx vitest run tests/lib/agents/agent-c-classifier.test.ts
```

Expected: PASS.

- [ ] **Step 7: Implement Agent D — Payment Proof Analyzer (Vision)**

Create `lib/agents/agent-d-vision.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getModel } from './shared'
import fs from 'fs'

const anthropic = new Anthropic()

const PaymentProofSchema = z.object({
  montoDetectado: z.number().optional(),
  fechaPago: z.string().optional(),
  medioDePago: z.string().optional(),
  destinatario: z.string().optional(),
  esValido: z.boolean(),
  observaciones: z.string().optional(),
})

export type PaymentProof = z.infer<typeof PaymentProofSchema>

export async function analyzePaymentProof(params: {
  imagePath?: string
  imageUrl?: string
  imageBase64?: string
  mediaType: string
  debtorName: string
  expectedAmount: number
}): Promise<PaymentProof> {
  const model = getModel()

  let imageContent: Anthropic.ImageBlockParam
  if (params.imageBase64) {
    imageContent = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: params.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: params.imageBase64,
      },
    }
  } else if (params.imageUrl) {
    imageContent = {
      type: 'image',
      source: { type: 'url', url: params.imageUrl },
    }
  } else if (params.imagePath) {
    const data = fs.readFileSync(params.imagePath).toString('base64')
    imageContent = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: params.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data,
      },
    }
  } else {
    throw new Error('Must provide imagePath, imageUrl, or imageBase64')
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: `Analizá este comprobante de pago. Extraé: monto, fecha, medio de pago, destinatario. Indicá si parece un comprobante válido. Respondé SOLO con JSON válido.`,
    messages: [{
      role: 'user',
      content: [
        imageContent,
        {
          type: 'text',
          text: `Deudor: ${params.debtorName}\nMonto esperado: $${params.expectedAmount.toLocaleString('es-AR')}\n\nExtraé los datos del comprobante.`,
        },
      ],
    }],
  })

  const text = response.content.find(b => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No text response')

  const jsonMatch = text.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  return PaymentProofSchema.parse(JSON.parse(jsonMatch[0]))
}
```

- [ ] **Step 8: Implement Agent E — Conversational Agent**

Create `lib/agents/agent-e-conversational.ts`:

```typescript
import { callAgent, getModel } from './shared'

export async function generateConversationalReply(params: {
  debtorName: string
  montoAdeudado: number
  diasVencido: number
  incomingCategory: string
  incomingMessage: string
  conversationHistory: Array<{ role: 'debtor' | 'agent'; text: string }>
}): Promise<string> {
  const model = getModel()

  const historyText = params.conversationHistory
    .map(m => `${m.role === 'debtor' ? 'Deudor' : 'Agente'}: ${m.text}`)
    .join('\n')

  return callAgent({
    model,
    maxTokens: 512,
    system: `Sos un agente de cobranzas profesional, empático pero firme. Respondé al deudor de forma breve y directa. No uses lenguaje legal amenazante. Mantené un tono humano pero enfocado en resolver el pago. Si el deudor indica que va a pagar, pedile el comprobante. Si negocia, escuchá pero remitilo a comunicarse formalmente. Respondé solo con el mensaje, sin prefijos.`,
    userMessage: `Deudor: ${params.debtorName}
Monto adeudado: $${params.montoAdeudado.toLocaleString('es-AR')}
Días vencido: ${params.diasVencido}
Categoría del mensaje: ${params.incomingCategory}

Historial de conversación:
${historyText || '(primer contacto)'}

Último mensaje del deudor:
"${params.incomingMessage}"

Generá la respuesta del agente:`,
  })
}
```

- [ ] **Step 9: Implement Agent F — Rejection Generator**

Create `lib/agents/agent-f-rejection.ts`:

```typescript
import { callAgent, getModel } from './shared'

export async function generateRejectionMessage(params: {
  debtorName: string
  rejectionReason: string
  montoAdeudado: number
}): Promise<string> {
  const model = getModel()

  return callAgent({
    model,
    maxTokens: 256,
    system: `Generá un mensaje breve y empático para informar a un deudor que su comprobante de pago fue rechazado. Incluí el motivo del rechazo y pedile que envíe un comprobante válido. Tono profesional y comprensivo. Respondé solo con el mensaje.`,
    userMessage: `Deudor: ${params.debtorName}
Motivo del rechazo: ${params.rejectionReason}
Monto adeudado: $${params.montoAdeudado.toLocaleString('es-AR')}`,
  })
}
```

- [ ] **Step 10: Implement Agent G — Campaign Sanity Checker**

Create `lib/agents/agent-g-sanity.ts`:

```typescript
import { z } from 'zod'
import { callAgentJSON, getModel } from './shared'

const SanityCheckSchema = z.object({
  warnings: z.array(z.object({
    debtorId: z.string().optional(),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  approvedCount: z.number(),
  flaggedCount: z.number(),
})

export type SanityCheck = z.infer<typeof SanityCheckSchema>

export async function checkCampaignSanity(params: {
  templateCode: string
  debtors: Array<{
    id: string
    razonSocial: string
    montoTotal: number
    diasVencidoMax: number
    bucket: string
    hasActiveSequence: boolean
    currentSequenceState?: string
  }>
}): Promise<SanityCheck> {
  const model = getModel()

  return callAgentJSON({
    model,
    maxTokens: 1024,
    system: `Revisá esta campaña de cobranzas antes de enviarla. Buscá anomalías obvias:
- Deudores que ya tienen secuencia activa en estado avanzado
- Template que no matchea el bucket del deudor (ej: template suave a deudor crítico)
- Montos inusualmente altos o bajos vs el promedio
- Deudores duplicados

Devolvé un JSON con warnings (array de objetos con debtorId opcional, message, severity), approvedCount (cuántos están OK), y flaggedCount (cuántos tienen warnings).`,
    userMessage: `Template: ${params.templateCode}
Deudores (${params.debtors.length}):
${params.debtors.slice(0, 50).map(d =>
  `- ${d.id}: ${d.razonSocial}, $${d.montoTotal}, ${d.diasVencidoMax}d, bucket=${d.bucket}, seq_activa=${d.hasActiveSequence}${d.currentSequenceState ? ` (${d.currentSequenceState})` : ''}`
).join('\n')}
${params.debtors.length > 50 ? `\n... y ${params.debtors.length - 50} más` : ''}`,
  }, SanityCheckSchema)
}
```

- [ ] **Step 11: Wire AI phases into triage orchestrator**

Update `lib/triage/run-triage.ts` — add Phase 2 (insight enrichment for top 50) and Phase 3 (portfolio analysis). Add a progress callback parameter for UI updates.

After Phase 1 (existing code), add:

```typescript
// Phase 2 — AI enrichment of top 50 (Agent A)
const top50 = snapshots
  .sort((a, b) => b.score - a.score)
  .slice(0, 50)

const CONCURRENCY = 5
for (let i = 0; i < top50.length; i += CONCURRENCY) {
  const batch = top50.slice(i, i + CONCURRENCY)
  const results = await Promise.allSettled(
    batch.map(async (snap) => {
      const client = clients.find(c => c.id === snap.clientId)!
      const insight = await generateInsight({
        razonSocial: client.razonSocial,
        montoTotal: snap.montoTotal,
        diasVencidoMax: snap.diasVencidoMax,
        invoiceCount: snap.invoiceCount,
        categoria: client.categoria,
        bucket: snap.bucket,
      })
      await prisma.debtorTriageSnapshot.updateMany({
        where: { triageRunId: triageRun.id, clientId: snap.clientId },
        data: { aiInsight: insight },
      })
    })
  )
  // Log failures but don't stop the scan
  results.filter(r => r.status === 'rejected').forEach(r => {
    console.error('Agent A failed:', (r as PromiseRejectedResult).reason)
  })
  onProgress?.({ phase: 2, done: Math.min(i + CONCURRENCY, top50.length), total: top50.length })
}

// Phase 3 — Portfolio analysis (Agent B, Opus)
const sampleDebtors = snapshots
  .sort((a, b) => b.score - a.score)
  .slice(0, 30)
  .map(s => {
    const client = clients.find(c => c.id === s.clientId)!
    return {
      razonSocial: client.razonSocial,
      montoTotal: s.montoTotal,
      diasVencidoMax: s.diasVencidoMax,
      invoiceCount: s.invoiceCount,
      bucket: s.bucket,
      categoria: client.categoria,
    }
  })

onProgress?.({ phase: 3, done: 0, total: 1 })

const analysis = await analyzePortfolio({
  totalDebtors: snapshots.length,
  totalAmount,
  bucketCounts,
  bucketAmounts,
  sampleDebtors,
})

await prisma.portfolioAnalysis.create({
  data: {
    triageRunId: triageRun.id,
    findings: analysis.findings as any,
    segmentos: analysis.segmentos as any,
    planDeAccion: analysis.planDeAccion as any,
  },
})

onProgress?.({ phase: 3, done: 1, total: 1 })
```

Add `onProgress` as an optional parameter to `runTriage`:

```typescript
export async function runTriage(
  source: TriageSource,
  excelFileName?: string,
  onProgress?: (progress: { phase: number; done: number; total: number }) => void
): Promise<TriageRunResult> {
```

Import the agent functions at the top.

- [ ] **Step 12: Commit**

```bash
git add lib/agents/ tests/lib/agents/ lib/triage/run-triage.ts
git commit -m "feat: all 7 AI agents + wire phases 2-3 into triage orchestrator"
```

---

## Task 8: State Machine + Outreach Channels

**Files:**
- Create: `lib/state-machine/states.ts`, `lib/state-machine/transitions.ts`, `lib/state-machine/runner.ts`
- Create: `lib/channels/types.ts`, `lib/channels/email-channel.ts`, `lib/channels/whatsapp-demo-channel.ts`
- Create: `tests/lib/state-machine/transitions.test.ts`

- [ ] **Step 1: Write failing test for state machine transitions**

Create `tests/lib/state-machine/transitions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isValidTransition, VALID_TRANSITIONS } from '@/lib/state-machine/states'

describe('state machine transitions', () => {
  it('allows SCHEDULED → SENT_SOFT', () => {
    expect(isValidTransition('SCHEDULED', 'SENT_SOFT')).toBe(true)
  })

  it('allows SENT_SOFT → SENT_FIRM (timeout)', () => {
    expect(isValidTransition('SENT_SOFT', 'SENT_FIRM')).toBe(true)
  })

  it('allows SENT_SOFT → IN_CONVERSATION (response)', () => {
    expect(isValidTransition('SENT_SOFT', 'IN_CONVERSATION')).toBe(true)
  })

  it('allows IN_CONVERSATION → AWAITING_ACCOUNTANT', () => {
    expect(isValidTransition('IN_CONVERSATION', 'AWAITING_ACCOUNTANT')).toBe(true)
  })

  it('allows AWAITING_ACCOUNTANT → PAID', () => {
    expect(isValidTransition('AWAITING_ACCOUNTANT', 'PAID')).toBe(true)
  })

  it('disallows PAID → SENT_SOFT', () => {
    expect(isValidTransition('PAID', 'SENT_SOFT')).toBe(false)
  })

  it('disallows CLOSED → any', () => {
    expect(isValidTransition('CLOSED', 'SENT_SOFT')).toBe(false)
    expect(isValidTransition('CLOSED', 'IN_CONVERSATION')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/state-machine/transitions.test.ts
```

- [ ] **Step 3: Implement state machine states + transitions**

Create `lib/state-machine/states.ts`:

```typescript
import { SequenceState } from '@prisma/client'

export const VALID_TRANSITIONS: Record<SequenceState, SequenceState[]> = {
  SCHEDULED: ['SENT_SOFT', 'AUTOPILOT_OFF'],
  SENT_SOFT: ['SENT_FIRM', 'IN_CONVERSATION', 'AUTOPILOT_OFF', 'ESCALATED_TO_HUMAN'],
  SENT_FIRM: ['SENT_FINAL', 'IN_CONVERSATION', 'AUTOPILOT_OFF', 'ESCALATED_TO_HUMAN'],
  SENT_FINAL: ['ESCALATED_TO_HUMAN', 'IN_CONVERSATION', 'AUTOPILOT_OFF'],
  IN_CONVERSATION: ['AWAITING_ACCOUNTANT', 'SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL', 'ESCALATED_TO_HUMAN', 'AUTOPILOT_OFF', 'PAID'],
  AWAITING_ACCOUNTANT: ['PAID', 'PARTIAL_PAID_CONTINUING', 'IN_CONVERSATION', 'ESCALATED_TO_HUMAN'],
  PAID: ['CLOSED'],
  PARTIAL_PAID_CONTINUING: ['SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL', 'IN_CONVERSATION', 'AUTOPILOT_OFF'],
  ESCALATED_TO_HUMAN: ['CLOSED', 'SENT_SOFT', 'IN_CONVERSATION'],
  AUTOPILOT_OFF: ['SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL', 'IN_CONVERSATION', 'CLOSED'],
  CLOSED: [],
}

export const TERMINAL_STATES: SequenceState[] = ['CLOSED']

export function isValidTransition(from: SequenceState, to: SequenceState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/state-machine/transitions.test.ts
```

- [ ] **Step 5: Implement transition functions**

Create `lib/state-machine/transitions.ts`:

```typescript
import { prisma } from '@/lib/db'
import { SequenceState } from '@prisma/client'
import { isValidTransition } from './states'
import { auditLog } from '@/lib/audit'

export async function transitionSequence(
  sequenceId: string,
  newState: SequenceState,
  opts?: {
    nextActionAt?: Date
    pausedReason?: string
    escalationReason?: string
    closedReason?: 'PAID' | 'PARTIAL_PAID_CONTINUING' | 'ESCALATED' | 'MANUAL_OVERRIDE'
    actorType?: 'USER' | 'SYSTEM' | 'CONTADOR' | 'DEBTOR'
    actorId?: string
  }
): Promise<void> {
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: sequenceId },
  })

  if (!isValidTransition(sequence.state, newState)) {
    throw new Error(
      `Invalid transition: ${sequence.state} → ${newState} for sequence ${sequenceId}`
    )
  }

  const isClosed = newState === 'CLOSED' || newState === 'PAID'

  await prisma.outreachSequence.update({
    where: { id: sequenceId },
    data: {
      state: newState,
      nextActionAt: opts?.nextActionAt ?? null,
      pausedReason: opts?.pausedReason ?? null,
      escalationReason: opts?.escalationReason ?? null,
      closedAt: isClosed ? new Date() : undefined,
      closedReason: opts?.closedReason ?? undefined,
    },
  })

  await auditLog({
    actorType: opts?.actorType ?? 'SYSTEM',
    actorId: opts?.actorId,
    action: 'sequence.transition',
    targetType: 'OutreachSequence',
    targetId: sequenceId,
    payload: { from: sequence.state, to: newState },
  })
}
```

- [ ] **Step 6: Implement OutreachChannel interface**

Create `lib/channels/types.ts`:

```typescript
import { Channel, Client } from '@prisma/client'

export interface SendResult {
  externalMessageId: string
  sentAt: Date
}

export interface OutreachChannel {
  readonly name: Channel

  send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
    renderedMessage: string
  }): Promise<SendResult>
}
```

- [ ] **Step 7: Implement EmailChannel (Gmail API)**

Create `lib/channels/email-channel.ts`:

```typescript
import { google } from 'googleapis'
import { Channel } from '@prisma/client'
import type { OutreachChannel, SendResult } from './types'
import type { Client } from '@prisma/client'

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth })
}

function buildRawEmail(params: {
  to: string
  from: string
  subject: string
  body: string
  sequenceId: string
}): string {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `X-CobranzasAI-Sequence-Id: ${params.sequenceId}`,
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    params.body,
  ]
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

export class EmailChannel implements OutreachChannel {
  readonly name = 'EMAIL' as Channel

  async send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
    renderedMessage: string
  }): Promise<SendResult> {
    if (!params.client.email) {
      throw new Error(`Client ${params.client.cod} has no email`)
    }

    const gmail = getGmailClient()
    const senderEmail = process.env.GMAIL_SENDER_EMAIL ?? 'cobranzas@empresa.com'

    const raw = buildRawEmail({
      to: params.client.email,
      from: senderEmail,
      subject: `Recordatorio de pago - ${params.client.razonSocial}`,
      body: params.renderedMessage,
      sequenceId: params.sequenceId,
    })

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    return {
      externalMessageId: res.data.id ?? '',
      sentAt: new Date(),
    }
  }
}
```

- [ ] **Step 8: Implement WhatsAppDemoChannel**

Create `lib/channels/whatsapp-demo-channel.ts`:

```typescript
import { Channel } from '@prisma/client'
import type { OutreachChannel, SendResult } from './types'
import type { Client } from '@prisma/client'

/**
 * ⚠ DEMO-ONLY CHANNEL
 * This adapter talks to Francisco's Evolution API bot.
 * NEVER use in production with real debtors.
 */
export class WhatsAppDemoChannel implements OutreachChannel {
  readonly name = 'WHATSAPP' as Channel

  async send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
    renderedMessage: string
  }): Promise<SendResult> {
    // Guard: block in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'WhatsAppDemoChannel cannot be used in production. Migrate to WhatsAppCloudChannel.'
      )
    }

    if (!params.client.telefono) {
      throw new Error(`Client ${params.client.cod} has no phone number`)
    }

    const endpoint = process.env.WHATSAPP_DEMO_ENDPOINT
    if (!endpoint) {
      throw new Error('WHATSAPP_DEMO_ENDPOINT not configured')
    }

    const response = await fetch(`${endpoint}/cobranzas/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_DEMO_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        to: params.client.telefono,
        message: params.renderedMessage,
        messageType: 'text',
        debtorId: params.client.id,
        outreachSequenceId: params.sequenceId,
      }),
    })

    if (!response.ok) {
      throw new Error(`WhatsApp demo send failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()

    return {
      externalMessageId: data.messageId ?? '',
      sentAt: new Date(data.sentAt ?? Date.now()),
    }
  }
}
```

- [ ] **Step 9: Implement sequence runner (cron logic)**

Create `lib/state-machine/runner.ts`:

```typescript
import { prisma } from '@/lib/db'
import { getSequenceTimeouts, getTemplatesCopy } from '@/lib/config'
import { transitionSequence } from './transitions'
import { renderTemplate } from '@/lib/templates/render'
import { EmailChannel } from '@/lib/channels/email-channel'
import { WhatsAppDemoChannel } from '@/lib/channels/whatsapp-demo-channel'
import type { OutreachChannel } from '@/lib/channels/types'
import { SequenceState } from '@prisma/client'

const TIMEOUT_MAP: Record<string, { next: SequenceState; timeoutKey: keyof Awaited<ReturnType<typeof getSequenceTimeouts>> }> = {
  SENT_SOFT: { next: 'SENT_FIRM', timeoutKey: 'softToFirm' },
  SENT_FIRM: { next: 'SENT_FINAL', timeoutKey: 'firmToFinal' },
  SENT_FINAL: { next: 'ESCALATED_TO_HUMAN', timeoutKey: 'finalToEscalated' },
}

const TEMPLATE_FOR_STATE: Record<string, string> = {
  SENT_FIRM: 'firm',
  SENT_FINAL: 'avisoFinal',
}

function getChannel(clientHasEmail: boolean): OutreachChannel {
  // Prefer email, fallback to WhatsApp
  if (clientHasEmail) return new EmailChannel()
  return new WhatsAppDemoChannel()
}

export async function advanceSequences(): Promise<{ advanced: number; errors: number }> {
  // Advisory lock to prevent double execution
  const lockResult = await prisma.$queryRaw<[{ acquired: boolean }]>`
    SELECT pg_try_advisory_lock(42) as acquired
  `
  if (!lockResult[0]?.acquired) {
    return { advanced: 0, errors: 0 }
  }

  try {
    const now = new Date()
    const sequences = await prisma.outreachSequence.findMany({
      where: {
        state: { in: ['SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL'] },
        nextActionAt: { lte: now },
        closedAt: null,
        client: { autopilotOff: false },
      },
      include: { client: true },
    })

    let advanced = 0
    let errors = 0
    const timeouts = await getSequenceTimeouts()
    const templates = await getTemplatesCopy()

    for (const seq of sequences) {
      try {
        const mapping = TIMEOUT_MAP[seq.state]
        if (!mapping) continue

        if (mapping.next === 'ESCALATED_TO_HUMAN') {
          await transitionSequence(seq.id, 'ESCALATED_TO_HUMAN', {
            escalationReason: 'Timeout: no response after final notice',
          })
        } else {
          const templateCode = TEMPLATE_FOR_STATE[mapping.next]
          if (!templateCode) continue

          const templateText = templates[templateCode] ?? ''
          const rendered = renderTemplate(templateText, {
            razonSocial: seq.client.razonSocial,
            montoTotal: 'N/A', // Will be computed from invoices in real usage
          })

          const channel = getChannel(!!seq.client.email)
          const result = await channel.send({
            client: seq.client,
            templateCode,
            templateVars: {},
            sequenceId: seq.id,
            renderedMessage: rendered,
          })

          await prisma.outreachAttempt.create({
            data: {
              sequenceId: seq.id,
              channel: channel.name,
              templateCode,
              externalMessageId: result.externalMessageId,
              rawPayload: { rendered, channel: channel.name },
            },
          })

          const nextTimeoutDays = timeouts[TIMEOUT_MAP[mapping.next]?.timeoutKey ?? 'softToFirm'] ?? 5
          await transitionSequence(seq.id, mapping.next, {
            nextActionAt: new Date(Date.now() + nextTimeoutDays * 24 * 60 * 60 * 1000),
          })
        }

        advanced++
      } catch (err) {
        console.error(`Failed to advance sequence ${seq.id}:`, err)
        errors++
      }
    }

    return { advanced, errors }
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(42)`
  }
}
```

- [ ] **Step 10: Commit**

```bash
git add lib/state-machine/ lib/channels/ tests/lib/state-machine/
git commit -m "feat: state machine transitions, outreach channels (Email + WhatsApp demo), and sequence runner"
```

---

## Task 9: Campaign Launch API

**Files:**
- Create: `app/api/campaigns/launch/route.ts`

- [ ] **Step 1: Implement campaign launch endpoint**

Create `app/api/campaigns/launch/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { renderTemplate } from '@/lib/templates/render'
import { getTemplatesCopy, getSequenceTimeouts } from '@/lib/config'
import { EmailChannel } from '@/lib/channels/email-channel'
import { WhatsAppDemoChannel } from '@/lib/channels/whatsapp-demo-channel'
import { auditLog } from '@/lib/audit'
import type { OutreachChannel } from '@/lib/channels/types'
import { Bucket, SequenceState } from '@prisma/client'

interface LaunchRequest {
  debtorIds: string[]
  templateCode: string
  channel?: 'EMAIL' | 'WHATSAPP'
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: LaunchRequest = await req.json()
  const { debtorIds, templateCode } = body

  if (!debtorIds?.length || !templateCode) {
    return NextResponse.json({ error: 'debtorIds and templateCode required' }, { status: 400 })
  }

  const templates = await getTemplatesCopy()
  const timeouts = await getSequenceTimeouts()
  const template = templates[templateCode]
  if (!template) {
    return NextResponse.json({ error: `Template "${templateCode}" not found` }, { status: 400 })
  }

  const clients = await prisma.client.findMany({
    where: { id: { in: debtorIds } },
    include: {
      invoices: { where: { estado: 'PENDING' } },
      outreachSequences: { where: { closedAt: null } },
    },
  })

  let sent = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const client of clients) {
    try {
      const montoTotal = client.invoices.reduce((s, i) => s + Number(i.monto), 0)
      const diasVencidoMax = client.invoices.reduce((max, inv) => {
        const dias = Math.floor((Date.now() - inv.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24))
        return Math.max(max, dias)
      }, 0)

      const vars: Record<string, string> = {
        razonSocial: client.razonSocial,
        montoTotal: `$${montoTotal.toLocaleString('es-AR')}`,
        diasVencido: String(diasVencidoMax),
        fechaVencimiento: client.invoices[0]?.fechaVencimiento.toLocaleDateString('es-AR') ?? '',
        diasRestantes: String(timeouts.finalToEscalated),
      }

      const rendered = renderTemplate(template, vars)

      // Determine channel
      const channel: OutreachChannel = body.channel === 'WHATSAPP' || !client.email
        ? new WhatsAppDemoChannel()
        : new EmailChannel()

      // Create or reuse sequence
      let sequence = client.outreachSequences[0]
      if (!sequence) {
        sequence = await prisma.outreachSequence.create({
          data: {
            clientId: client.id,
            state: 'SCHEDULED',
            currentBucket: 'SUAVE' as Bucket, // Will be refined
            nextActionAt: new Date(Date.now() + timeouts.softToFirm * 24 * 60 * 60 * 1000),
          },
        })
      }

      // Send
      const result = await channel.send({
        client,
        templateCode,
        templateVars: vars,
        sequenceId: sequence.id,
        renderedMessage: rendered,
      })

      // Record attempt
      await prisma.outreachAttempt.create({
        data: {
          sequenceId: sequence.id,
          channel: channel.name,
          templateCode,
          externalMessageId: result.externalMessageId,
          rawPayload: { rendered, vars, channel: channel.name },
        },
      })

      // Transition to SENT_ state based on template
      const stateMap: Record<string, SequenceState> = {
        soft: 'SENT_SOFT',
        firm: 'SENT_FIRM',
        avisoFinal: 'SENT_FINAL',
      }
      const newState = stateMap[templateCode] ?? 'SENT_SOFT'

      await prisma.outreachSequence.update({
        where: { id: sequence.id },
        data: {
          state: newState,
          nextActionAt: new Date(Date.now() + timeouts.softToFirm * 24 * 60 * 60 * 1000),
        },
      })

      sent++
    } catch (err) {
      failed++
      errors.push(`${client.razonSocial}: ${(err as Error).message}`)
    }
  }

  await auditLog({
    actorType: 'USER',
    actorId: session.user.id,
    action: 'campaign.launched',
    payload: { templateCode, total: clients.length, sent, skipped, failed },
  })

  return NextResponse.json({ sent, skipped, failed, errors })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/campaigns/
git commit -m "feat: campaign launch API endpoint with batch send"
```

---

## Task 10: Incoming Message Handling (Gmail Poll + WhatsApp Webhook + Classifier + Conversational)

**Files:**
- Create: `app/api/cron/poll-gmail/route.ts`
- Create: `app/api/incoming-whatsapp/route.ts`
- Create: `lib/incoming/process-message.ts` (shared handler after classification)

- [ ] **Step 1: Create shared incoming message processor**

Create `lib/incoming/process-message.ts`:

```typescript
import { prisma } from '@/lib/db'
import { classifyResponse } from '@/lib/agents/agent-c-classifier'
import { generateConversationalReply } from '@/lib/agents/agent-e-conversational'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { EmailChannel } from '@/lib/channels/email-channel'
import { WhatsAppDemoChannel } from '@/lib/channels/whatsapp-demo-channel'
import { Channel, IncomingCategory } from '@prisma/client'
import { auditLog } from '@/lib/audit'

export async function processIncomingMessage(params: {
  sequenceId: string
  channel: Channel
  fromAddress: string
  text: string
  mediaUrl?: string
  mediaType?: string
}): Promise<void> {
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: params.sequenceId },
    include: { client: true },
  })

  // Get conversation context (last 3 messages)
  const recentMessages = await prisma.incomingMessage.findMany({
    where: { sequenceId: params.sequenceId },
    orderBy: { receivedAt: 'desc' },
    take: 3,
  })
  const conversationContext = recentMessages
    .reverse()
    .map(m => m.text)

  // Create incoming message record
  const incoming = await prisma.incomingMessage.create({
    data: {
      sequenceId: params.sequenceId,
      channel: params.channel,
      fromAddress: params.fromAddress,
      text: params.text,
      mediaUrl: params.mediaUrl,
      mediaType: params.mediaType,
    },
  })

  // Classify with Agent C
  const classification = await classifyResponse({
    text: params.text,
    hasMedia: !!params.mediaUrl,
    conversationContext,
  })

  // Update incoming message with classification
  await prisma.incomingMessage.update({
    where: { id: incoming.id },
    data: {
      classifiedCategory: classification.categoria as IncomingCategory,
      classifierMetadata: classification as any,
    },
  })

  // Route based on category
  switch (classification.categoria) {
    case 'COMPROBANTE_ADJUNTO':
      // Trigger accountant workflow (Task 11)
      await transitionSequence(params.sequenceId, 'AWAITING_ACCOUNTANT')
      // The accountant workflow will be called from here
      break

    case 'DISPUTA':
      await transitionSequence(params.sequenceId, 'ESCALATED_TO_HUMAN', {
        escalationReason: `Deudor disputa la deuda: ${params.text.slice(0, 200)}`,
      })
      break

    case 'AUTO_REPLY':
      // Ignore auto-replies, don't change state
      break

    case 'PAGARA':
    case 'NEGOCIANDO':
    case 'OTRO': {
      // Move to IN_CONVERSATION and generate reply
      if (sequence.state !== 'IN_CONVERSATION') {
        await transitionSequence(params.sequenceId, 'IN_CONVERSATION')
      }

      // Get full conversation for Agent E
      const allMessages = await prisma.incomingMessage.findMany({
        where: { sequenceId: params.sequenceId },
        orderBy: { receivedAt: 'asc' },
      })

      const montoTotal = await prisma.invoice.aggregate({
        where: { clientId: sequence.clientId, estado: 'PENDING' },
        _sum: { monto: true },
      })

      const reply = await generateConversationalReply({
        debtorName: sequence.client.razonSocial,
        montoAdeudado: Number(montoTotal._sum.monto ?? 0),
        diasVencido: 0, // Would compute from invoices
        incomingCategory: classification.categoria,
        incomingMessage: params.text,
        conversationHistory: allMessages.map(m => ({
          role: 'debtor' as const,
          text: m.text,
        })),
      })

      // Send reply through same channel
      const channelImpl = params.channel === 'EMAIL'
        ? new EmailChannel()
        : new WhatsAppDemoChannel()

      const sendResult = await channelImpl.send({
        client: sequence.client,
        templateCode: 'conversational_reply',
        templateVars: {},
        sequenceId: params.sequenceId,
        renderedMessage: reply,
      })

      await prisma.outreachAttempt.create({
        data: {
          sequenceId: params.sequenceId,
          channel: params.channel,
          templateCode: 'conversational_reply',
          externalMessageId: sendResult.externalMessageId,
          rawPayload: { reply, classification },
        },
      })

      // Update incoming message with agent response link
      await prisma.incomingMessage.update({
        where: { id: incoming.id },
        data: { agentResponseId: sendResult.externalMessageId },
      })
      break
    }
  }

  await auditLog({
    actorType: 'DEBTOR',
    action: 'message.received',
    targetType: 'IncomingMessage',
    targetId: incoming.id,
    payload: { category: classification.categoria, channel: params.channel },
  })
}
```

- [ ] **Step 2: Create Gmail polling cron endpoint**

Create `app/api/cron/poll-gmail/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { getConfig, setConfig } from '@/lib/config'
import { processIncomingMessage } from '@/lib/incoming/process-message'

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth })
}

export async function GET() {
  // Advisory lock
  const lockResult = await prisma.$queryRaw<[{ acquired: boolean }]>`
    SELECT pg_try_advisory_lock(43) as acquired
  `
  if (!lockResult[0]?.acquired) {
    return NextResponse.json({ skipped: true, reason: 'lock held' })
  }

  try {
    const gmail = getGmailClient()
    const lastHistoryId = await getConfig<string>('gmail.lastHistoryId')

    if (!lastHistoryId) {
      // First run: get current historyId and save it
      const profile = await gmail.users.getProfile({ userId: 'me' })
      await setConfig('gmail.lastHistoryId', profile.data.historyId)
      return NextResponse.json({ status: 'initialized', historyId: profile.data.historyId })
    }

    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })

    let processed = 0

    if (history.data.history) {
      for (const entry of history.data.history) {
        for (const msg of entry.messagesAdded ?? []) {
          if (!msg.message?.id) continue

          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msg.message.id,
            format: 'full',
          })

          const headers = full.data.payload?.headers ?? []
          const from = headers.find(h => h.name === 'From')?.value ?? ''
          const inReplyTo = headers.find(h => h.name === 'In-Reply-To')?.value
          const subject = headers.find(h => h.name === 'Subject')?.value ?? ''

          // Try to match with an outreach attempt
          let sequenceId: string | null = null

          if (inReplyTo) {
            const attempt = await prisma.outreachAttempt.findFirst({
              where: { externalMessageId: inReplyTo },
            })
            if (attempt) sequenceId = attempt.sequenceId
          }

          // Fallback: check X-CobranzasAI-Sequence-Id in referenced messages
          if (!sequenceId) {
            const xHeader = headers.find(h => h.name === 'X-CobranzasAI-Sequence-Id')
            if (xHeader?.value) sequenceId = xHeader.value
          }

          if (!sequenceId) {
            // Unmatched email — log for human review
            await prisma.incomingMessage.create({
              data: {
                channel: 'EMAIL',
                fromAddress: from,
                text: getPlainText(full.data) ?? subject,
              },
            })
            continue
          }

          // Extract body text
          const bodyText = getPlainText(full.data) ?? ''

          // Check for attachments
          const attachments = full.data.payload?.parts?.filter(
            p => p.filename && p.body?.attachmentId
          )
          const hasAttachment = (attachments?.length ?? 0) > 0

          await processIncomingMessage({
            sequenceId,
            channel: 'EMAIL',
            fromAddress: from,
            text: bodyText,
            mediaUrl: hasAttachment ? `gmail:${msg.message.id}:attachment` : undefined,
            mediaType: attachments?.[0]?.mimeType ?? undefined,
          })

          processed++
        }
      }
    }

    // Save new historyId
    if (history.data.historyId) {
      await setConfig('gmail.lastHistoryId', history.data.historyId)
    }

    return NextResponse.json({ processed, newHistoryId: history.data.historyId })
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(43)`
  }
}

function getPlainText(message: any): string | null {
  if (message.payload?.body?.data) {
    return Buffer.from(message.payload.body.data, 'base64url').toString()
  }
  if (message.payload?.parts) {
    const textPart = message.payload.parts.find(
      (p: any) => p.mimeType === 'text/plain'
    )
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64url').toString()
    }
  }
  return null
}
```

- [ ] **Step 3: Create WhatsApp webhook endpoint**

Create `app/api/incoming-whatsapp/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { processIncomingMessage } from '@/lib/incoming/process-message'

interface WhatsAppIncomingPayload {
  from: string
  text: string
  mediaUrl?: string
  mediaType?: string
  messageId: string
  timestamp: string
}

export async function POST(req: NextRequest) {
  // Verify API key from Evolution bot
  const authHeader = req.headers.get('authorization')
  const expectedKey = process.env.WHATSAPP_DEMO_API_KEY
  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: WhatsAppIncomingPayload = await req.json()

  // Match from phone to client
  const client = await prisma.client.findFirst({
    where: { telefono: body.from },
    include: { outreachSequences: { where: { closedAt: null } } },
  })

  if (!client) {
    console.warn(`WhatsApp from unknown number: ${body.from}`)
    // Log as unmatched
    await prisma.incomingMessage.create({
      data: {
        channel: 'WHATSAPP',
        fromAddress: body.from,
        text: body.text,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
      },
    })
    return NextResponse.json({ status: 'unmatched' })
  }

  const activeSequence = client.outreachSequences[0]
  if (!activeSequence) {
    console.warn(`WhatsApp from ${body.from} (${client.razonSocial}) but no active sequence`)
    await prisma.incomingMessage.create({
      data: {
        channel: 'WHATSAPP',
        fromAddress: body.from,
        text: body.text,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
      },
    })
    return NextResponse.json({ status: 'no_active_sequence' })
  }

  await processIncomingMessage({
    sequenceId: activeSequence.id,
    channel: 'WHATSAPP',
    fromAddress: body.from,
    text: body.text,
    mediaUrl: body.mediaUrl,
    mediaType: body.mediaType,
  })

  return NextResponse.json({ status: 'processed' })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/incoming/ app/api/cron/poll-gmail/ app/api/incoming-whatsapp/
git commit -m "feat: incoming message handling — Gmail polling, WhatsApp webhook, classification, and conversational replies"
```

---

## Task 11: Accountant Workflow (Token + Page + Confirmation)

**Files:**
- Create: `lib/contador/token.ts`, `lib/contador/workflow.ts`
- Create: `app/accountant/confirm/[token]/page.tsx`
- Create: `app/api/accountant/confirm/route.ts`
- Create: `app/api/cron/contador-reminder/route.ts`, `app/api/cron/cleanup-tokens/route.ts`
- Create: `tests/lib/contador/token.test.ts`

- [ ] **Step 1: Write failing test for token generation**

Create `tests/lib/contador/token.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateToken, isTokenValid } from '@/lib/contador/token'

describe('generateToken', () => {
  it('generates a 32-character hex string', () => {
    const token = generateToken()
    expect(token).toHaveLength(32)
    expect(token).toMatch(/^[a-f0-9]{32}$/)
  })

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBe(100)
  })
})

describe('isTokenValid', () => {
  it('returns false for expired token', () => {
    const expired = new Date(Date.now() - 1000)
    expect(isTokenValid({ expiresAt: expired, consumedAt: null })).toBe(false)
  })

  it('returns false for consumed token', () => {
    const future = new Date(Date.now() + 86400000)
    expect(isTokenValid({ expiresAt: future, consumedAt: new Date() })).toBe(false)
  })

  it('returns true for valid token', () => {
    const future = new Date(Date.now() + 86400000)
    expect(isTokenValid({ expiresAt: future, consumedAt: null })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/contador/token.test.ts
```

- [ ] **Step 3: Implement token utilities**

Create `lib/contador/token.ts`:

```typescript
import crypto from 'crypto'

export function generateToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function isTokenValid(token: {
  expiresAt: Date
  consumedAt: Date | null
}): boolean {
  if (token.consumedAt) return false
  if (token.expiresAt < new Date()) return false
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/contador/token.test.ts
```

- [ ] **Step 5: Implement accountant workflow**

Create `lib/contador/workflow.ts`:

```typescript
import { prisma } from '@/lib/db'
import { generateToken } from './token'
import { getContadorEmail } from '@/lib/config'
import { EmailChannel } from '@/lib/channels/email-channel'
import { auditLog } from '@/lib/audit'

export async function sendToAccountant(params: {
  sequenceId: string
  incomingMessageId: string
  clientName: string
  montoAdeudado: number
  comprobantePath?: string
}): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.accountantConfirmationToken.create({
    data: {
      token,
      incomingMessageId: params.incomingMessageId,
      sequenceId: params.sequenceId,
      expiresAt,
    },
  })

  const contadorEmail = await getContadorEmail()
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const confirmUrl = `${appUrl}/accountant/confirm/${token}`

  // Get sequence details for email
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: params.sequenceId },
    include: {
      client: {
        include: { invoices: { where: { estado: 'PENDING' } } },
      },
    },
  })

  const invoiceList = sequence.client.invoices
    .map(i => `- ${i.numero}: $${Number(i.monto).toLocaleString('es-AR')} (venc: ${i.fechaVencimiento.toLocaleDateString('es-AR')})`)
    .join('\n')

  const emailBody = `Estimado/a Contador/a,

Se recibió un comprobante de pago del siguiente deudor:

Razón Social: ${params.clientName}
Monto adeudado total: $${params.montoAdeudado.toLocaleString('es-AR')}

Facturas pendientes:
${invoiceList}

Para confirmar o rechazar el pago, ingrese al siguiente link:
${confirmUrl}

Este link expira el ${expiresAt.toLocaleDateString('es-AR')}.

Atentamente,
CobranzasAI`

  // Send email to accountant (using a simplified send)
  const gmail = new EmailChannel()
  // Note: In real implementation, send directly to contadorEmail
  // For now, we'll use the channel's send method with a mock client
  // This is a simplification — in production, use a dedicated email sender

  await auditLog({
    actorType: 'SYSTEM',
    action: 'contador.email_sent',
    targetType: 'AccountantConfirmationToken',
    targetId: token,
    payload: { contadorEmail, clientName: params.clientName },
  })

  return token
}
```

- [ ] **Step 6: Create accountant confirmation page**

Create `app/accountant/confirm/[token]/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { isTokenValid } from '@/lib/contador/token'
import { notFound } from 'next/navigation'
import { AccountantConfirmForm } from './confirm-form'

export default async function AccountantConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token: tokenStr } = await params

  const tokenRecord = await prisma.accountantConfirmationToken.findUnique({
    where: { token: tokenStr },
    include: {
      sequence: {
        include: {
          client: {
            include: { invoices: { where: { estado: 'PENDING' }, orderBy: { fechaVencimiento: 'asc' } } },
          },
        },
      },
    },
  })

  if (!tokenRecord || !isTokenValid(tokenRecord)) {
    notFound()
  }

  const client = tokenRecord.sequence.client
  const invoices = client.invoices
  const montoTotal = invoices.reduce((s, i) => s + Number(i.monto), 0)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Confirmación de pago</h1>
          <p className="text-sm text-gray-500 mt-1">CobranzasAI — Verificación de comprobante</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <p className="font-semibold">{client.razonSocial}</p>
          <p className="text-sm text-gray-600">COD: {client.cod}</p>
          <p className="text-sm text-gray-600">
            Monto total adeudado: <span className="font-semibold">${montoTotal.toLocaleString('es-AR')}</span>
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-sm text-gray-700 mb-2">Facturas pendientes</h2>
          <div className="space-y-1">
            {invoices.map(inv => (
              <div key={inv.id} className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span>{inv.numero}</span>
                <span className="text-gray-600">
                  ${Number(inv.monto).toLocaleString('es-AR')} — venc: {inv.fechaVencimiento.toLocaleDateString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <AccountantConfirmForm
          token={tokenStr}
          montoTotal={montoTotal}
          invoices={invoices.map(i => ({
            id: i.id,
            numero: i.numero,
            monto: Number(i.monto),
            fechaVencimiento: i.fechaVencimiento.toISOString(),
          }))}
        />
      </div>
    </div>
  )
}
```

Create `app/accountant/confirm/[token]/confirm-form.tsx` as a client component:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Props {
  token: string
  montoTotal: number
  invoices: Array<{ id: string; numero: string; monto: number; fechaVencimiento: string }>
}

export function AccountantConfirmForm({ token, montoTotal, invoices }: Props) {
  const [decision, setDecision] = useState<'TOTAL' | 'PARTIAL' | 'REJECTED' | null>(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!decision) return
    setSubmitting(true)

    const res = await fetch(`/api/accountant/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        decision,
        confirmedAmount: decision === 'PARTIAL' ? Number(partialAmount) : undefined,
        rejectionReason: decision === 'REJECTED' ? rejectionReason : undefined,
      }),
    })

    if (res.ok) {
      setDone(true)
    }
    setSubmitting(false)
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold">
          {decision === 'REJECTED' ? 'Comprobante rechazado' : 'Pago confirmado'}
        </h2>
        <p className="text-gray-500 mt-2">Puede cerrar esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Decisión</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {(['TOTAL', 'PARTIAL', 'REJECTED'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDecision(d)}
              className={`p-3 rounded-lg border text-sm font-medium transition ${
                decision === d
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {d === 'TOTAL' ? 'Pago total' : d === 'PARTIAL' ? 'Pago parcial' : 'Rechazar'}
            </button>
          ))}
        </div>
      </div>

      {decision === 'PARTIAL' && (
        <div>
          <Label htmlFor="amount">Monto confirmado</Label>
          <Input
            id="amount"
            type="number"
            value={partialAmount}
            onChange={e => setPartialAmount(e.target.value)}
            placeholder="Ingrese el monto recibido"
          />
          <p className="text-xs text-gray-500 mt-1">
            Se imputará FIFO a las facturas más antiguas.
          </p>
        </div>
      )}

      {decision === 'REJECTED' && (
        <div>
          <Label htmlFor="reason">Motivo del rechazo</Label>
          <Textarea
            id="reason"
            value={rejectionReason}
            onChange={e => setRejectionReason(e.target.value)}
            placeholder="Indique el motivo del rechazo"
          />
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!decision || submitting}
        className="w-full"
      >
        {submitting ? 'Procesando...' : 'Confirmar'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 7: Create accountant confirmation API**

Create `app/api/accountant/confirm/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isTokenValid } from '@/lib/contador/token'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { auditLog } from '@/lib/audit'
import { Decimal } from '@prisma/client/runtime/library'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token: tokenStr, decision, confirmedAmount, rejectionReason } = body

  const tokenRecord = await prisma.accountantConfirmationToken.findUnique({
    where: { token: tokenStr },
    include: {
      sequence: {
        include: {
          client: {
            include: {
              invoices: {
                where: { estado: 'PENDING' },
                orderBy: { fechaVencimiento: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  if (!tokenRecord || !isTokenValid(tokenRecord)) {
    return NextResponse.json({ error: 'Token invalid or expired' }, { status: 404 })
  }

  const sequence = tokenRecord.sequence
  const invoices = sequence.client.invoices
  let appliedInvoiceIds: string[] = []

  switch (decision) {
    case 'TOTAL': {
      // Mark all pending invoices as PAID
      for (const inv of invoices) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { estado: 'PAID', paidAt: new Date(), paidAmount: inv.monto },
        })
      }
      appliedInvoiceIds = invoices.map(i => i.id)
      await transitionSequence(sequence.id, 'PAID', {
        closedReason: 'PAID',
        actorType: 'CONTADOR',
      })
      break
    }

    case 'PARTIAL': {
      // Apply amount FIFO
      let remaining = confirmedAmount ?? 0
      for (const inv of invoices) {
        if (remaining <= 0) break
        const invAmount = Number(inv.monto)
        if (remaining >= invAmount) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { estado: 'PAID', paidAt: new Date(), paidAmount: inv.monto },
          })
          appliedInvoiceIds.push(inv.id)
          remaining -= invAmount
        } else {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { paidAmount: new Decimal(remaining) },
          })
          appliedInvoiceIds.push(inv.id)
          remaining = 0
        }
      }
      await transitionSequence(sequence.id, 'PARTIAL_PAID_CONTINUING', {
        actorType: 'CONTADOR',
      })
      break
    }

    case 'REJECTED': {
      await transitionSequence(sequence.id, 'IN_CONVERSATION', {
        actorType: 'CONTADOR',
      })
      // Agent F will generate rejection message — handled by the caller
      break
    }
  }

  // Mark token as consumed
  await prisma.accountantConfirmationToken.update({
    where: { id: tokenRecord.id },
    data: { consumedAt: new Date() },
  })

  // Record confirmation
  await prisma.accountantConfirmation.create({
    data: {
      tokenId: tokenRecord.id,
      sequenceId: sequence.id,
      decision,
      confirmedAmount: confirmedAmount ? new Decimal(confirmedAmount) : null,
      rejectionReason: rejectionReason ?? null,
      appliedInvoiceIds: appliedInvoiceIds,
    },
  })

  await auditLog({
    actorType: 'CONTADOR',
    action: `contador.${decision.toLowerCase()}`,
    targetType: 'OutreachSequence',
    targetId: sequence.id,
    payload: { decision, confirmedAmount, appliedInvoiceIds },
  })

  return NextResponse.json({ status: 'ok', decision })
}
```

- [ ] **Step 8: Create cron endpoints for reminders and cleanup**

Create `app/api/cron/contador-reminder/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getConfig } from '@/lib/config'

export async function GET() {
  const timeoutHours = (await getConfig<number>('contador.reminderTimeoutHours')) ?? 24

  const pendingTokens = await prisma.accountantConfirmationToken.findMany({
    where: {
      consumedAt: null,
      reminderSentAt: null,
      createdAt: { lt: new Date(Date.now() - timeoutHours * 60 * 60 * 1000) },
      expiresAt: { gt: new Date() },
    },
    include: {
      sequence: { include: { client: true } },
    },
  })

  for (const token of pendingTokens) {
    // Send reminder email (simplified — reuse email channel)
    await prisma.accountantConfirmationToken.update({
      where: { id: token.id },
      data: { reminderSentAt: new Date() },
    })

    // Mark sequence as needs attention
    // (UI will pick this up from the sequence state + reminderSentAt)
  }

  return NextResponse.json({ reminders: pendingTokens.length })
}
```

Create `app/api/cron/cleanup-tokens/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  // No actual deletion — tokens are append-only.
  // But we can mark expired tokens to prevent wasted lookups.
  const expired = await prisma.accountantConfirmationToken.updateMany({
    where: {
      consumedAt: null,
      expiresAt: { lt: new Date() },
    },
    data: {
      consumedAt: new Date(), // Mark as consumed so they're not queried
    },
  })

  return NextResponse.json({ expired: expired.count })
}
```

- [ ] **Step 9: Create advance-sequences cron endpoint**

Create `app/api/cron/advance-sequences/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { advanceSequences } from '@/lib/state-machine/runner'

export async function GET() {
  const result = await advanceSequences()
  return NextResponse.json(result)
}
```

- [ ] **Step 10: Commit**

```bash
git add lib/contador/ app/accountant/ app/api/accountant/ app/api/cron/ tests/lib/contador/
git commit -m "feat: accountant workflow — token generation, confirmation page, FIFO payment, cron reminders"
```

---

## Task 12: Dashboard — App Shell + Cartera Tab

**Files:**
- Create: `components/app-shell.tsx`
- Create: `components/cartera/debtor-table.tsx`, `components/cartera/debtor-filters.tsx`, `components/cartera/debtor-drawer.tsx`
- Create: `app/(app)/cartera/page.tsx`
- Update: `app/(app)/layout.tsx`

- [ ] **Step 1: Build the app shell (sidebar + topbar)**

Create `components/app-shell.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const NAV_ITEMS = [
  { href: '/cartera', label: 'Cartera', icon: '📋' },
  { href: '/analisis-ia', label: 'Análisis IA', icon: '🤖' },
  { href: '/historico', label: 'Histórico', icon: '📊' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">CobranzasAI</h1>
          <p className="text-xs text-gray-500 mt-1">Sistema de cobranzas inteligente</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

Update `app/(app)/layout.tsx` to use AppShell:

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { SessionProvider } from 'next-auth/react'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  )
}
```

- [ ] **Step 2: Build debtor table for Cartera tab**

Create `components/cartera/debtor-table.tsx` — a data table using shadcn Table with columns from spec 8.1:
- Razón social
- Monto total
- Días vencido máx
- Segmento (colored badge)
- Estado sequence (badge)
- AI insight icon (popover on hover)
- Autopilot off indicator
- Actions dropdown

Use server component data fetching in the page, pass data as props to the client table component.

Create `components/cartera/debtor-filters.tsx` — filter bar with:
- Bucket select (multi)
- Sequence state select
- Amount range inputs
- Search text input
- Autopilot off toggle

Create `components/cartera/debtor-drawer.tsx` — Sheet component showing:
- Contact details
- Pending invoices list
- Timeline of OutreachAttempts + IncomingMessages
- Current state machine state with manual transition buttons
- Autopilot toggle

- [ ] **Step 3: Create Cartera page**

Create `app/(app)/cartera/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { DebtorTable } from '@/components/cartera/debtor-table'

export default async function CarteraPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams

  // Build filter from searchParams
  const where: any = {
    invoices: { some: { estado: 'PENDING' } },
  }

  if (params.bucket) {
    // Filter will be applied after triage snapshot lookup
  }
  if (params.search) {
    where.razonSocial = { contains: params.search, mode: 'insensitive' }
  }
  if (params.autopilotOff === 'true') {
    where.autopilotOff = true
  }

  // Get latest triage run for snapshot data
  const latestRun = await prisma.triageRun.findFirst({
    orderBy: { timestamp: 'desc' },
  })

  const clients = await prisma.client.findMany({
    where,
    include: {
      invoices: { where: { estado: 'PENDING' } },
      outreachSequences: { where: { closedAt: null }, take: 1 },
      triageSnapshots: latestRun
        ? { where: { triageRunId: latestRun.id }, take: 1 }
        : { take: 0 },
    },
    orderBy: { razonSocial: 'asc' },
    take: 100,
  })

  const debtors = clients.map(c => {
    const snap = c.triageSnapshots[0]
    const montoTotal = c.invoices.reduce((s, i) => s + Number(i.monto), 0)
    const diasVencidoMax = c.invoices.reduce((max, inv) => {
      const dias = Math.floor((Date.now() - inv.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(max, dias)
    }, 0)

    return {
      id: c.id,
      cod: c.cod,
      razonSocial: c.razonSocial,
      email: c.email,
      telefono: c.telefono,
      montoTotal,
      diasVencidoMax,
      bucket: snap?.bucket ?? null,
      score: snap?.score ?? 0,
      aiInsight: snap?.aiInsight ?? null,
      sequenceState: c.outreachSequences[0]?.state ?? null,
      autopilotOff: c.autopilotOff,
      invoiceCount: c.invoices.length,
    }
  })

  // Sort by score desc
  debtors.sort((a, b) => b.score - a.score)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartera</h1>
          <p className="text-sm text-gray-500">{debtors.length} deudores con facturas pendientes</p>
        </div>
      </div>
      <DebtorTable debtors={debtors} />
    </div>
  )
}
```

- [ ] **Step 4: Verify the Cartera page renders**

```bash
npm run dev
```

Navigate to `/cartera` — should show the table (empty if no data imported yet).

- [ ] **Step 5: Commit**

```bash
git add components/ app/(app)/
git commit -m "feat: dashboard app shell + Cartera tab with debtor table, filters, and drawer"
```

---

## Task 13: Dashboard — Análisis IA Tab

**Files:**
- Create: `components/analisis-ia/scan-summary-card.tsx`, `findings-list.tsx`, `segment-cards.tsx`, `action-plan-list.tsx`, `campaign-modal.tsx`
- Create: `app/(app)/analisis-ia/page.tsx`
- Create: `components/import/excel-dropzone.tsx`, `import-progress.tsx`

- [ ] **Step 1: Build Análisis IA components**

Create the 5 components for the Análisis IA tab:

1. `components/analisis-ia/scan-summary-card.tsx` — Card showing last scan summary with bucket breakdown, deltas vs previous, and recovered amount.

2. `components/analisis-ia/findings-list.tsx` — Bulleted list of Agent B findings with severity badges.

3. `components/analisis-ia/segment-cards.tsx` — Horizontal scrollable cards showing AI-detected segments with name, count, amount, and "Ver deudores" button that links to Cartera with filter.

4. `components/analisis-ia/action-plan-list.tsx` — Structured list of recommendations with "Ejecutar campaña" button per item.

5. `components/analisis-ia/campaign-modal.tsx` — Dialog with debtor table (checkboxes), template selector, message preview, and Agent G warnings. Submit calls `/api/campaigns/launch`.

- [ ] **Step 2: Create Análisis IA page**

Create `app/(app)/analisis-ia/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { ScanSummaryCard } from '@/components/analisis-ia/scan-summary-card'
import { FindingsList } from '@/components/analisis-ia/findings-list'
import { SegmentCards } from '@/components/analisis-ia/segment-cards'
import { ActionPlanList } from '@/components/analisis-ia/action-plan-list'

export default async function AnalisisIAPage() {
  const latestRun = await prisma.triageRun.findFirst({
    orderBy: { timestamp: 'desc' },
    include: { portfolioAnalysis: true },
  })

  const previousRun = latestRun
    ? await prisma.triageRun.findFirst({
        where: { timestamp: { lt: latestRun.timestamp } },
        orderBy: { timestamp: 'desc' },
      })
    : null

  if (!latestRun) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Análisis IA</h1>
        <div className="mt-12 text-center text-gray-500">
          <p className="text-lg">No hay scans disponibles</p>
          <p className="text-sm mt-2">Importá un archivo Excel para generar el primer análisis.</p>
        </div>
      </div>
    )
  }

  const analysis = latestRun.portfolioAnalysis

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análisis IA</h1>
          <p className="text-sm text-gray-500">
            Último scan: {latestRun.timestamp.toLocaleString('es-AR')}
          </p>
        </div>
        <form action="/api/triage" method="POST">
          <input type="hidden" name="source" value="MANUAL" />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Reanalizar cartera
          </button>
        </form>
      </div>

      <ScanSummaryCard
        current={latestRun}
        previous={previousRun}
      />

      {analysis && (
        <>
          <FindingsList findings={analysis.findings as any} />
          <SegmentCards segmentos={analysis.segmentos as any} />
          <ActionPlanList planDeAccion={analysis.planDeAccion as any} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Build Excel import dropzone and progress components**

Create `components/import/excel-dropzone.tsx` — drag-and-drop area for uploading `clientes.xlsx` and `facturas.xlsx`. Shows file names after drop, submit button that calls `/api/import`, then triggers triage scan.

Create `components/import/import-progress.tsx` — animated progress display matching the spec's WOW moment:

```
Importando facturas............. ✓ 14.812 facturas
Calculando prioridades.......... ✓ 4.924 deudores analizados
Generando insights con IA (Sonnet)  ⟳ 32/50 deudores
Análisis portfolio-wide (Opus).. ⟳ pensando...
```

Use polling or SSE to get progress updates from the triage endpoint.

- [ ] **Step 4: Commit**

```bash
git add components/analisis-ia/ components/import/ app/(app)/analisis-ia/
git commit -m "feat: Análisis IA tab with scan summary, findings, segments, action plan, and Excel import"
```

---

## Task 14: Dashboard — Histórico + Settings Tabs

**Files:**
- Create: `components/historico/triage-run-list.tsx`
- Create: `app/(app)/historico/page.tsx`
- Create: `components/settings/settings-form.tsx`
- Create: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Build Histórico tab**

Create `components/historico/triage-run-list.tsx` — table of TriageRuns in reverse chronological order with: timestamp, source, filename, bucket counts, total amount, delta vs previous, "Ver detalle" button.

Create `app/(app)/historico/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { TriageRunList } from '@/components/historico/triage-run-list'

export default async function HistoricoPage() {
  const runs = await prisma.triageRun.findMany({
    orderBy: { timestamp: 'desc' },
    take: 50,
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Histórico</h1>
      <TriageRunList runs={runs} />
    </div>
  )
}
```

- [ ] **Step 2: Build Settings tab**

Create `components/settings/settings-form.tsx` — form with sections as per spec 8.4:
- Aging thresholds (3 number inputs)
- Contador email
- Gmail connection status
- WhatsApp demo endpoint + test button
- Sequence timeouts (3 number inputs)
- Template copy (textareas for soft, firm, avisoFinal)

Uses server actions to save to Config table.

Create `app/(app)/settings/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { SettingsForm } from '@/components/settings/settings-form'
import { ExcelDropzone } from '@/components/import/excel-dropzone'

export default async function SettingsPage() {
  const configs = await prisma.config.findMany()
  const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]))

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <section>
        <h2 className="text-lg font-semibold mb-4">Importar datos</h2>
        <ExcelDropzone />
      </section>

      <SettingsForm initialConfig={configMap} />
    </div>
  )
}
```

- [ ] **Step 3: Verify all tabs render**

```bash
npm run dev
```

Navigate to `/historico` and `/settings` — both should render.

- [ ] **Step 4: Commit**

```bash
git add components/historico/ components/settings/ app/(app)/historico/ app/(app)/settings/
git commit -m "feat: Histórico tab (scan history list) and Settings tab (config form + Excel import)"
```

---

## Task 15: Visual Polish + Import Flow Integration

**Files:**
- Update: various UI components for visual polish
- Update: `app/api/import/route.ts` to auto-trigger triage after import

- [ ] **Step 1: Wire import → auto-triage**

Update the import API to trigger a triage scan after successful import:

In `app/api/import/route.ts`, after `importExcel()` returns, call `runTriage('IMPORT', clientsFile?.name)`. Return both import results and triage results in the response.

- [ ] **Step 2: Polish the scan progress animation**

Create a streaming endpoint (`app/api/triage/stream/route.ts`) that uses Server-Sent Events to push progress updates during the triage scan. The import dropzone component should connect to this SSE endpoint after upload to show the animated progress.

- [ ] **Step 3: Polish dashboard visual design**

Apply consistent visual polish across all tabs:
- Consistent use of color for bucket badges (green for SIN_VENCER, yellow for SUAVE, orange for FIRME, red for AVISO_FINAL, dark red for CRITICO)
- Clean typography hierarchy
- Proper spacing and card shadows
- Loading skeletons for async data
- Empty states with helpful messages
- Mobile-responsive sidebar collapse

This is the WOW demo quality pass — the dashboard needs to look professional and polished.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: visual polish, import→triage auto-trigger, scan progress animation"
```

---

## Task 16: End-to-End Integration + Error Handling

**Files:**
- Various fixes and wiring across the codebase

- [ ] **Step 1: Wire accountant workflow into message processor**

In `lib/incoming/process-message.ts`, when classifier returns `COMPROBANTE_ADJUNTO`:
- Download attachment (Gmail attachment API or WhatsApp media URL)
- Call Agent D (vision) to analyze the proof
- Call `sendToAccountant()` from `lib/contador/workflow.ts`
- Transition sequence to `AWAITING_ACCOUNTANT`

- [ ] **Step 2: Wire Agent F (rejection) into accountant confirmation**

In `app/api/accountant/confirm/route.ts`, when decision is `REJECTED`:
- Call `generateRejectionMessage()` with the rejection reason
- Send the rejection message to the debtor via the appropriate channel

- [ ] **Step 3: Add error handling to all API routes**

Wrap all route handlers in try/catch. Return proper error responses. Log errors with structured logging.

- [ ] **Step 4: Add campaign sanity check (Agent G)**

In `app/api/campaigns/launch/route.ts`, before sending:
- Call `checkCampaignSanity()` with the debtor list
- Return warnings in the response (UI shows them in campaign modal)

Add a pre-check endpoint `app/api/campaigns/check/route.ts` that the modal calls before the user clicks confirm.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: end-to-end wiring — accountant workflow, rejection agent, sanity checker, error handling"
```

---

## Task 17: Seed Data + Demo Rehearsal

**Files:**
- Create: `prisma/seed-demo.ts` (demo data for rehearsal)
- Update: `package.json` scripts

- [ ] **Step 1: Create demo seed script**

Create `prisma/seed-demo.ts` that generates:
- 50 clients with realistic Argentine business names
- 200+ invoices with varying dates (some overdue, some not, mix of amounts)
- This allows running the full demo flow without needing the real client's Excel files

- [ ] **Step 2: Run full demo flow locally**

1. Seed demo data: `npx tsx prisma/seed-demo.ts`
2. Login as admin1
3. Go to Settings → Import → upload test files (or use seeded data)
4. Watch the scan progress animation (WOW moment)
5. Navigate to Análisis IA — verify findings, segments, action plan appear
6. Click "Ejecutar campaña" on a recommendation
7. Verify campaign modal shows debtors with sanity check
8. Check Cartera tab for sequence states
9. Check Histórico for scan records
10. Navigate to `/accountant/confirm/<token>` to test accountant flow

- [ ] **Step 3: Fix issues found during rehearsal**

Iterate on any bugs or UX issues found.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: demo seed data and end-to-end rehearsal fixes"
```

---

## Task 18: Railway Deployment Config

**Files:**
- Create: `railway.toml` or `Procfile`
- Update: `package.json` scripts
- Create: `.env.example` (verify complete)

- [ ] **Step 1: Configure Railway deployment**

Create `railway.toml` (or equivalent config):

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npx prisma migrate deploy && npm run start"
healthcheckPath = "/api/health"
```

Add health check endpoint `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build succeeds**

```bash
npm run build
```

Expected: No errors. Build completes successfully.

- [ ] **Step 3: Document Railway cron jobs**

Document in a comment or README the cron jobs that need to be configured in Railway:
- `/api/cron/poll-gmail` — every 2 min
- `/api/cron/advance-sequences` — every 5 min
- `/api/cron/contador-reminder` — every 1 hour
- `/api/cron/cleanup-tokens` — daily

- [ ] **Step 4: Commit**

```bash
git add railway.toml app/api/health/ .env.example
git commit -m "feat: Railway deployment config, health check, and cron documentation"
```

---

## Summary

| Task | Description | Key Deliverable |
|------|-------------|-----------------|
| 1 | Scaffolding + Schema + Auth | Next.js project, Prisma models, login |
| 2 | Config + Audit + Vitest | Helper modules, test framework |
| 3 | Excel Parsers | clientes.xlsx + facturas.xlsx parsers with tests |
| 4 | Import API | Upload + idempotent upsert |
| 5 | Triage Engine | Scoring, buckets, run orchestrator |
| 6 | Templates | Variable interpolation |
| 7 | AI Agents (all 7) | Shared infra + agents A-G |
| 8 | State Machine + Channels | Transitions, Email, WhatsApp demo |
| 9 | Campaign Launch | Batch approval API |
| 10 | Incoming Messages | Gmail poll, WA webhook, classify, reply |
| 11 | Accountant Workflow | Token, page, confirmation, FIFO |
| 12 | Dashboard — Cartera | App shell, debtor table, drawer |
| 13 | Dashboard — Análisis IA | Scan summary, findings, segments, action plan |
| 14 | Dashboard — Histórico + Settings | History list, config form |
| 15 | Visual Polish | WOW demo quality, animations |
| 16 | E2E Integration | Wire everything together |
| 17 | Demo Seed + Rehearsal | Test data, full flow validation |
| 18 | Railway Deploy | Config, health check, cron setup |
