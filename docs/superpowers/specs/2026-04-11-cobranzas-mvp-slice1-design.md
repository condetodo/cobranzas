# CobranzasAI — Slice #1 — Diseño del MVP

**Proyecto:** CobranzasAI
**Slice:** #1 — Pipeline end-to-end de cobranzas automatizadas (Email + WhatsApp demo)
**Fecha:** 2026-04-11
**Autor:** Francisco (con asistencia de Claude)
**Estado:** Diseño — pendiente revisión del usuario
**Supersede:** `2026-04-10-cobranzas-mvp-brainstorming-wip.md`

---

## 1. Resumen ejecutivo

CobranzasAI es una plataforma de cobranzas automatizadas construida como **producto single-tenant** para un cliente específico (una PyME concreta). El Slice #1 entrega un pipeline completo end-to-end donde:

1. El cliente sube sus planillas de clientes y facturas (Excel).
2. Un motor de scoring determinista ordena los ~5000 deudores por prioridad.
3. Un agente de IA analiza la cartera entera y propone un plan de acción con insights no obvios.
4. El operador humano aprueba campañas en lotes con un click.
5. El sistema ejecuta secuencias de outreach autónomas por Email y WhatsApp.
6. Detecta respuestas, conversa con deudores vía Claude, identifica comprobantes de pago.
7. Orquesta la confirmación con un contador externo (vía email + página tokenizada).
8. Mantiene histórico de cada scan para mostrar evolución y performance del producto.

El MVP se construye especulativamente para generar un **efecto WOW** en la reunión de demo con el dueño de la PyME — no hay consulta previa con el cliente. La calidad visual del dashboard y la sensación de "el sistema piensa por vos" son prioridades de diseño explícitas.

El Slice #1 NO incluye: canal telefónico (VAPI/Twilio), router multicanal automático, integración con software contable, OCR automático de comprobantes, ni multi-tenant. Esos son slices posteriores.

---

## 2. Contexto y framing del producto

### 2.1. Qué es CobranzasAI en esta fase

CobranzasAI es, en esta fase, una **plataforma para una organización**. Puede evolucionar a SaaS multi-tenant en el futuro, pero el MVP se construye para un solo cliente PyME piloto. Decisiones de diseño que optimizan para "escalar a miles de clientes" se postergan explícitamente — el salto a SaaS es un refactor consciente posterior, no un requisito del MVP.

### 2.2. El cliente y la oportunidad

El cliente piloto es una PyME argentina que hoy gestiona ~5.000 clientes comerciales en planillas de Excel exportadas de su software de gestión. El seguimiento de deudores se hace manualmente: el dueño o su asistente mira la lista, decide a quién contactar, le escribe un email o le manda un WhatsApp, marca en un cuaderno. No hay automatización, no hay métricas de recupero, no hay trazabilidad.

El producto apunta exactamente a ese gap: **automatizar todo el proceso de cobranza desde la detección de deudores hasta la confirmación del pago**, con el operador humano solo en los puntos donde su decisión agrega valor real.

### 2.3. Modo de trabajo del MVP: construcción a ciegas para WOW demo

El dueño de la PyME no es consultado durante el diseño del MVP. Francisco construye el producto especulativamente con supuestos razonables y lo presenta terminado en una reunión de demostración. El objetivo de esa reunión es generar un efecto WOW suficiente para que el dueño apruebe un piloto pago.

**Implicancias para el diseño:**
- La calidad visual del dashboard y la primera impresión importan más de lo habitual en un MVP técnico.
- El flujo de la demo tiene que poder correrse en vivo, con datos reales del cliente, y mostrar el loop completo funcionando.
- Las asunciones sobre formato de datos, perfil del contador, preferencias de copy, etc., quedan como "puntos a validar con el cliente en la demo" — no bloquean el diseño.

### 2.4. Decomposición del producto en slices

El producto completo de CobranzasAI es demasiado grande para un solo spec. La decomposición es:

| Slice | Alcance | Estado |
|---|---|---|
| **#1** | **Pipeline end-to-end de cobranzas automatizadas por Email + WhatsApp (demo)** | **Este documento** |
| #2 | Canal WhatsApp en WhatsApp Cloud API oficial (reemplaza al adapter de demo) + OCR de comprobantes + conciliación bancaria | Pendiente |
| #3 | Canal telefónico (VAPI + Telnyx/Twilio) | Pendiente |
| #4 | Router multicanal con Claude (decide canal por deudor) + integración con software contable | Pendiente |
| #5+ | Multi-tenant SaaS, analytics avanzados, modelos predictivos de recupero, etc. | Futuro |

---

## 3. Alcance del Slice #1

### 3.1. Lo que entra

**Ingesta:**
- Subida de `clientes.xlsx` y `facturas.xlsx` vía UI drag-and-drop.
- Parser con validación de columnas y tipos.
- Upsert idempotente en la base de datos (re-subir el mismo archivo no duplica).

**Análisis de cartera:**
- Scoring determinista de prioridad sobre todos los deudores.
- Segmentación en 5 buckets (Sin vencer / Suave / Firme / Aviso final / Crítico) con umbrales configurables.
- Enriquecimiento con IA del top 50 por score (insight de 2 líneas por deudor).
- Análisis portfolio-wide con IA (findings, segmentos propuestos, plan de acción recomendado).

**Dashboard:**
- Pestaña Cartera (tabla operativa de deudores).
- Pestaña Análisis IA (insights, segmentos, plan de acción).
- Pestaña Histórico (lista de scans anteriores, comparación entre scans).
- Pantalla de Settings (thresholds, emails de configuración, endpoints, timeouts).

**Outreach autónomo:**
- Aprobación de campañas por batch (el operador aprueba lotes de N deudores con un click).
- State machine de secuencias: soft → firm → final → escalated.
- Runner de secuencias programadas (background job) que avanza el estado según timeouts configurables.
- Envío por Email (Gmail API).
- Envío por WhatsApp vía adapter de demo que apunta a un bot Evolution API existente de Francisco.
- Plantillas de mensajes parametrizables.

**Detección y conversación:**
- Polling de respuestas en Gmail (cron).
- Recepción de respuestas WhatsApp vía webhook del bot Evolution.
- Clasificación de respuestas con Claude (categoría, extracción de metadata).
- Agente conversacional (Claude) que responde al deudor dentro de la ventana activa.
- Detección de comprobantes de pago (adjunto + clasificación semántica).

**Workflow del contador:**
- Email estructurado al contador con comprobante adjunto + link tokenizado.
- Página pública de confirmación (sin login, token unguessable).
- Tres caminos: pago total, pago parcial con imputación FIFO, rechazo con motivo.
- Pausa del state machine mientras espera confirmación.
- Recordatorio al contador a las 24h si no confirma.

**Histórico y métricas:**
- Append-only de snapshots por scan (`TriageRun` + `DebtorTriageSnapshot`).
- Tarjeta de resumen post-scan con deltas vs scan anterior.
- Pestaña Histórico con lista de scans pasados.

**Auth y deploy:**
- NextAuth Credentials provider con dos usuarios seedeados (`admin1`, `admin2`, password `admin123`).
- Deploy en Railway (Next.js + Postgres en el mismo proyecto).

### 3.2. Lo que NO entra

| # | Feature | Por qué afuera | Roadmap |
|---|---|---|---|
| 1 | Canal telefónico (VAPI, Twilio) | Complejidad alta, riesgo técnico alto. Francisco armará demo standalone de VAPI aparte como material de venta. | Slice #3 |
| 2 | Router multicanal automático (Claude decide canal) | Requiere histórico de response-rate por canal, lógica de escalación inter-canal. | Slice #4 |
| 3 | WhatsApp Cloud API oficial en producción | En Slice #1 se usa adapter de demo sobre Evolution API existente. Migración a Cloud API oficial requiere verificación de business de Meta + aprobación de templates + setup de número dedicado (5-10 días calendario). | Slice #2 |
| 4 | OCR + validación automática del comprobante | Haiku/Sonnet "lee" el comprobante pero el contador humano es el oráculo final. Automatizar requiere matching con cuentas bancarias y conciliación. | Slice #2 (alta prioridad) |
| 5 | Conciliación bancaria automática | Requiere importar extractos del banco y matchear. | Slice #2 (alta prioridad) |
| 6 | Integración con software contable (Tango, Bejerman, Contabilium) | Cada software tiene su propia API/formato. Integración por-cliente. | Slice #3-4 |
| 7 | Múltiples contadores con reglas de asignación | Un solo contador en Slice #1 alcanza. | Slice #3+ |
| 8 | Historial consultable por el contador | El contador ve solo el pago actual en el link tokenizado. | Post-MVP lujo |
| 9 | Multi-tenant / multi-cliente | Producto es single-client en esta fase. | Slice #5+ |
| 10 | Analytics avanzados / dashboards de recupero | Las métricas de la tarjeta resumen alcanzan para la demo. | Post-MVP |
| 11 | Modelos predictivos de probabilidad de recupero | No hay histórico suficiente para entrenar. | Post-MVP |
| 12 | Aprobación granular debtor-por-debtor del outreach | La granularidad es batch por campaña. Para saltarse el batch existe el flag `autopilot_off` por deudor. | N/A |

### 3.3. Principios de diseño del Slice #1

1. **Intelligence vive en CobranzasAI. Los canales son transportes tontos.** El agente conversacional, el clasificador, el state machine, todo vive en el backend de CobranzasAI. Los canales (Email, WhatsApp) son adapters que solo envían y reciben — no tienen lógica propia.

2. **Canales son swap-ables.** La interfaz `OutreachChannel` está diseñada para que migrar del adapter de demo de WhatsApp al Cloud API oficial sea cambiar una clase, sin tocar state machine, classifier, agente conversacional, ni nada más.

3. **Append-only para auditoría.** Todos los scans, todos los intentos de outreach, todas las confirmaciones del contador, todas las transiciones del state machine, se escriben en tablas append-only con timestamp. Nada se sobreescribe.

4. **Autopilot por default, opt-out por deudor.** El default es que todos los deudores siguen la secuencia automática completa. Existe un flag `autopilot_off` por deudor para excluir casos específicos del autopilot y manejarlos manualmente.

5. **Una sola fuente de verdad de aging.** Los 3 umbrales editables en Settings (default: 15d / 30d / 45d) definen los 5 buckets del producto. Los mismos buckets se usan en: segmentación visual, selección de template, agregaciones del resumen, comparación histórica.

6. **Sonnet como modelo default en todos los agentes.** Consistencia operacional, consistencia de tono customer-facing, costo delta despreciable vs ROI del recupero. Opus se usa en el agente B (análisis portfolio-wide) porque es el hero moment.

7. **Demo-grade ≠ production-grade.** Varios atajos conscientes (credentials hardcoded, adapter WhatsApp de demo, contador sin auth) son explícitamente demo-only. Cada uno está marcado en el código con un comentario visible y/o un guard de entorno.

---

## 4. Usuarios y actores del sistema

| Actor | Cómo accede | Qué puede hacer | Auth |
|---|---|---|---|
| **`admin1`, `admin2`** (operadores) | Dashboard web (NextAuth Credentials) | Importar Excel, correr scans, aprobar campañas, ver histórico, tocar settings, marcar deudores `autopilot_off` | Email + password (seed en DB) |
| **Contador** (externo) | Email + link tokenizado (sin login) | Ver el comprobante de un pago específico, confirmar pago total/parcial, rechazar con motivo | Token de 32 chars unguessable con expiración 7 días |
| **Deudor** (cliente moroso de la PyME) | Recibe mensajes por Email y/o WhatsApp | Responder a los mensajes (abre ventana conversacional con el agente) | N/A — no interactúa con la UI |
| **Sistema** (cron / background jobs) | N/A | Avanzar state machines, pollear Gmail, ejecutar secuencias programadas | N/A |

---

## 5. Arquitectura de alto nivel

### 5.1. Stack

- **Frontend + Backend:** Next.js 15 (App Router, Server Components, Server Actions).
- **ORM:** Prisma.
- **Base de datos:** PostgreSQL (Railway).
- **Auth:** NextAuth.js (Credentials provider).
- **Background jobs / cron:** Railway Cron (scheduled HTTP endpoints), con lock en DB para evitar doble ejecución.
- **LLM:** Anthropic Claude API (Sonnet default, Opus para análisis portfolio).
- **Email:** Gmail API (ya configurado en el entorno de Francisco).
- **WhatsApp (Slice #1):** Adapter HTTP contra el bot Evolution API existente.
- **Storage de comprobantes:** Railway volume o servicio de object storage compatible (S3-compatible).
- **Deploy:** Railway (Next.js service + Postgres service + cron service, todo en el mismo proyecto).

### 5.2. Por qué monolito Next.js

Alternativas consideradas:
- **Microservicios (Next.js frontend + Node/Fastify backend separado):** descartado. No hay beneficio operacional en esta escala. Complica deploy, observabilidad, y compartir tipos.
- **Next.js + servicio Python para IA:** descartado. El SDK de Anthropic en TypeScript cubre todo lo que necesitamos. Python agrega superficie sin ganancia.
- **Arquitectura event-driven con cola de mensajes (BullMQ/Redis):** descartado en Slice #1. Se puede agregar después si volume lo requiere. En Slice #1 un job runner simple con cron + DB locks alcanza.

El monolito Next.js en Railway es la opción de menor fricción: un solo proyecto, un solo deploy, un solo set de tipos compartidos frontend-backend vía TypeScript, server actions para mutaciones sin necesidad de escribir endpoints REST a mano.

### 5.3. Estructura de módulos

```
app/                             # Next.js App Router
  (auth)/
    login/
  (app)/                         # protegido por middleware de auth
    cartera/
    analisis-ia/
    historico/
    settings/
  accountant/
    confirm/[token]/             # página pública del contador
  api/
    incoming-email/              # webhook/polling callback
    incoming-whatsapp/           # webhook del bot Evolution
    cron/
      poll-gmail/
      advance-sequences/
      cleanup-tokens/

lib/
  db/                            # Prisma client + helpers
  auth/                          # NextAuth config
  excel/                         # parsers de clientes.xlsx y facturas.xlsx
  triage/                        # scoring determinista + ejecución del scan
  agents/                        # los 7 agentes LLM (insight, portfolio, classifier, ...)
  channels/
    OutreachChannel.ts           # interface común
    EmailChannel.ts              # Gmail API
    WhatsAppChannel.ts           # interface con swap A/B
    WhatsAppDemoChannel.ts       # adapter a bot Evolution (SLICE #1)
    WhatsAppCloudChannel.ts      # stub para futuro slice (NO usado en prod)
  stateMachine/                  # transiciones de outreach
  templates/                     # copy de los templates, parametrizado
  contador/                      # workflow del contador (email + tokens + página)
  audit/                         # AuditLog writes

prisma/
  schema.prisma
  migrations/
  seed.ts                        # crea admin1/admin2

docs/
  superpowers/specs/
```

---

## 6. Modelo de datos (Prisma schema)

Tablas principales del Slice #1. Las notaciones son simplificadas — en el schema real Prisma se agregan `createdAt`, `updatedAt`, relaciones inversas, índices, etc.

### 6.1. Entidades de dominio

```
Client {
  id              String   @id @default(cuid())
  cod             String   @unique           // COD del Excel
  razonSocial     String
  email           String?
  telefono        String?
  telegram        String?                    // por si se agrega canal Telegram después
  categoria       String?                    // A/B/C/D opcional del Excel
  autopilotOff    Boolean  @default(false)   // flag opt-out del autopilot
  createdAt       DateTime @default(now())
}

Invoice {
  id              String   @id @default(cuid())
  clientId        String
  client          Client   @relation(...)
  numero          String
  fechaEmision    DateTime
  fechaVencimiento DateTime
  monto           Decimal
  moneda          String   // ARS/USD/...
  estado          InvoiceState  // PENDING/PAID/CANCELLED
  paidAt          DateTime?
  paidAmount      Decimal?       // para pagos parciales
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([clientId, numero])
}
```

### 6.2. Scans y triage

```
TriageRun {
  id              String   @id @default(cuid())
  timestamp       DateTime @default(now())
  source          TriageSource      // IMPORT / MANUAL
  excelFileName   String?           // si vino de un import
  totalDebtors    Int
  totalAmount     Decimal
  bucketCounts    Json              // {sinVencer: N, suave: N, firme: N, avisoFinal: N, critico: N}
  bucketAmounts   Json              // mismo breakdown pero en monto
}

DebtorTriageSnapshot {
  id              String   @id @default(cuid())
  triageRunId     String
  triageRun       TriageRun @relation(...)
  clientId        String
  client          Client   @relation(...)
  montoTotal      Decimal
  invoiceCount    Int
  diasVencidoMax  Int
  bucket          Bucket            // SIN_VENCER/SUAVE/FIRME/AVISO_FINAL/CRITICO
  score           Int               // 0-100 determinista
  agentSegment    String?           // ej: "Olvidado Crítico"
  aiInsight       String?           // texto generado por Claude (top 50)

  @@index([triageRunId, score(sort: Desc)])
}

PortfolioAnalysis {
  id              String   @id @default(cuid())
  triageRunId     String   @unique
  findings        Json     // [{ text, severity }, ...]
  segmentos       Json     // [{ name, rule, count, totalAmount }, ...]
  planDeAccion    Json     // [{ title, description, targetSegment, recommendedAction, estimatedRecovery }, ...]
  createdAt       DateTime @default(now())
}
```

### 6.3. Outreach y secuencias

```
OutreachSequence {
  id              String   @id @default(cuid())
  clientId        String   @unique  // una sola sequence activa por cliente
  client          Client   @relation(...)
  state           SequenceState  // enum con todos los estados del state machine
  currentBucket   Bucket
  startedAt       DateTime @default(now())
  nextActionAt    DateTime?       // cuándo el runner debe avanzar
  pausedReason    String?
  escalationReason String?
  closedAt        DateTime?
  closedReason    ClosedReason?   // PAID, PARTIAL_PAID_CONTINUING, ESCALATED, MANUAL_OVERRIDE
}

OutreachAttempt {
  id                   String   @id @default(cuid())
  sequenceId           String
  sequence             OutreachSequence @relation(...)
  channel              Channel           // EMAIL / WHATSAPP
  templateCode         String            // "suave" / "firme" / "aviso_final" / "post_partial" / ...
  sentAt               DateTime @default(now())
  externalMessageId    String?           // message-id de Gmail, o id de WA del bot Evolution
  rawPayload           Json              // payload completo enviado (for audit)
  firstResponseAt      DateTime?
  classificationResult Json?             // resultado del classifier LLM
}

IncomingMessage {
  id                   String   @id @default(cuid())
  sequenceId           String?           // matcheado por thread/phone
  sequence             OutreachSequence? @relation(...)
  channel              Channel
  from                 String            // email o phone
  text                 String
  mediaUrl             String?
  mediaType            String?
  receivedAt           DateTime @default(now())
  classifiedCategory   IncomingCategory? // PAGARA / COMPROBANTE_ADJUNTO / NEGOCIANDO / DISPUTA / OTRO / AUTO_REPLY
  classifierMetadata   Json?
  agentResponseId      String?           // OutreachAttempt que fue generado como respuesta conversacional
}
```

### 6.4. Contador y confirmaciones

```
AccountantConfirmationToken {
  id                   String   @id @default(cuid())
  token                String   @unique   // 32-char unguessable
  incomingMessageId    String   @unique
  sequenceId           String
  createdAt            DateTime @default(now())
  expiresAt            DateTime           // 7 días después
  consumedAt           DateTime?
}

AccountantConfirmation {
  id                   String   @id @default(cuid())
  tokenId              String   @unique
  sequenceId           String
  decision             AccountantDecision  // TOTAL / PARTIAL / REJECTED
  confirmedAmount      Decimal?             // null si REJECTED
  rejectionReason      String?              // null si no REJECTED
  appliedInvoiceIds    Json?                // array de IDs de facturas que se marcan pagadas (FIFO)
  createdAt            DateTime @default(now())
}
```

### 6.5. Configuración y auditoría

```
Config {
  id                   String   @id @default(cuid())
  key                  String   @unique
  value                Json
  updatedAt            DateTime @updatedAt
}

// Claves conocidas:
// "aging.thresholds"         → { suave: 15, firme: 30, avisoFinal: 45 }
// "sequence.timeouts"        → { softToFirm: 5, firmToFinal: 7, finalToEscalated: 10 } (días)
// "contador.email"           → "contador@cliente.com"
// "gmail.senderEmail"        → "cobranzas@cliente.com"
// "whatsapp.demoEndpoint"    → "https://mi-bot.com/cobranzas/send"
// "templates.copy"           → { suave: "...", firme: "...", avisoFinal: "...", ... }

AuditLog {
  id                   String   @id @default(cuid())
  timestamp            DateTime @default(now())
  actorType            ActorType      // USER / SYSTEM / CONTADOR / DEBTOR
  actorId              String?
  action               String          // ej: "outreach.sent", "triage.run", "contador.confirmed"
  targetType           String?
  targetId             String?
  payload              Json?
}
```

---

## 7. Flujos end-to-end

### 7.1. Flujo 1 — Ingesta de Excel

```
Usuario en /settings/import
  ↓ drag & drop clientes.xlsx + facturas.xlsx
UI sube ambos archivos a /api/import
  ↓
Parser valida columnas esperadas (fail-fast si falta algo)
  ↓
Upsert idempotente:
  - Clientes: por COD (update si existe, create si no)
  - Facturas: por (clientId, numero) — update si existe, create si no,
    marca como PAID si antes estaba PENDING y ya no aparece en el nuevo import
  ↓
Retorna resumen del import: N clientes nuevos, N actualizados,
                            N facturas nuevas, N cerradas, N pendientes
  ↓
Trigger automático del Flujo 2 (scan completo)
```

### 7.2. Flujo 2 — Scan + análisis IA + tarjeta resumen

```
Trigger (auto post-import o manual vía botón "Reanalizar cartera")
  ↓
Crea nuevo TriageRun (timestamp, source, file_name)
  ↓
FASE 1 — Scoring determinista (sin LLM)
  Para cada cliente con invoices PENDING:
    - Calcula montoTotal, diasVencidoMax, invoiceCount
    - Score = f(diasVencidoMax, montoTotal, invoiceCount)
    - Bucket según thresholds de Config
    - Insert DebtorTriageSnapshot
  ~3-5 segundos para 5000 deudores
  ↓
FASE 2 — Enriquecimiento IA top 50 (Agente A, Sonnet)
  Selecciona top 50 deudores por score del scan actual
  Para cada uno, en paralelo con concurrency limit:
    - Llama a Claude con datos del deudor + contexto corto
    - Recibe 2 líneas de insight natural
    - Update DebtorTriageSnapshot.aiInsight
  ~30-60 segundos con concurrencia
  ↓
FASE 3 — Análisis portfolio-wide (Agente B, Opus)
  Arma resumen agregado + sample representativo (~20-30 deudores)
  Una sola llamada a Claude con prompt estructurado
  Parsea respuesta JSON con findings + segmentos + plan_de_accion
  Persiste en PortfolioAnalysis
  ~10-30 segundos
  ↓
FASE 4 — Cálculo de tarjeta resumen
  Compara con TriageRun anterior (si existe):
    - Deltas de counts y amounts por bucket
    - Recupero detectado (invoices que pasaron de PENDING a PAID)
    - Nuevos deudores en buckets críticos
  ↓
Redirect a /analisis-ia con la tarjeta resumen visible arriba
```

**UI del scan (momento WOW):**

```
Importando facturas............. ✓ 14.812 facturas
Calculando prioridades.......... ✓ 4.924 deudores analizados
Generando insights con IA (Sonnet)  ⟳ 32/50 deudores
Análisis portfolio-wide (Opus).. ⟳ pensando...
```

### 7.3. Flujo 3 — Batch approval de campaña

```
Usuario en /analisis-ia mira el bloque "Plan de acción recomendado"
  ↓
Click en "Ejecutar campaña" de un ítem del plan (ej: "Suave a 1847 deudores")
  ↓
Abre modal preview con tabla de los 1847 deudores:
  - Checkbox por deudor (todos tildados por default)
  - Template pre-seleccionado (suave), editable desde dropdown
  - Vista previa del mensaje con las variables renderizadas
  - Advertencias del agente G (sanity checker): "3 de estos deudores están
    en estado `paid` en otro sistema, ¿seguro?"
  ↓
Usuario revisa, destilda los que no quiere, confirma
  ↓
POST /api/campaigns/launch
  Para cada deudor seleccionado:
    - Si ya tiene OutreachSequence activa → agrega OutreachAttempt a la existente
    - Si no → crea nueva OutreachSequence
    - Set state según template: soft → SENT_SOFT
    - Set nextActionAt = now() + timeout
    - Push a job queue el envío real (async)
  ↓
Job runner (cron corto / inline) procesa cada envío:
  - Llama a channel.send()
  - Graba OutreachAttempt con externalMessageId
  - Si falla: retry con backoff; si sigue fallando, marca como FAILED
  ↓
UI muestra progreso en vivo: "847/1847 enviados..."
```

### 7.4. Flujo 4 — Runner de secuencias autónomas

```
Railway Cron dispara /api/cron/advance-sequences cada 5 minutos
  ↓
Lock de advisory en Postgres para evitar doble ejecución
  ↓
Query: SELECT * FROM OutreachSequence
        WHERE state IN (SENT_SOFT, SENT_FIRM, SENT_FINAL)
          AND nextActionAt <= NOW()
          AND client.autopilotOff = false
          AND closedAt IS NULL
  ↓
Para cada sequence que califica:
  - Si está en SENT_SOFT y pasó timeout → mandar firm template → state SENT_FIRM
  - Si está en SENT_FIRM y pasó timeout → mandar final template → state SENT_FINAL
  - Si está en SENT_FINAL y pasó timeout → marcar ESCALATED_TO_HUMAN
  - En todos los casos: set nextActionAt = now() + next timeout
  ↓
Release lock
```

**Importante:** el runner solo avanza secuencias que están **esperando timeout**. Las secuencias en otros estados (`IN_CONVERSATION`, `AWAITING_ACCOUNTANT`, etc.) no se tocan acá.

### 7.5. Flujo 5 — Recepción de respuesta del deudor (Email)

```
Railway Cron dispara /api/cron/poll-gmail cada 2 minutos
  ↓
Usa el último `historyId` guardado para llamar a users.history.list
  ↓
Para cada mensaje nuevo tipo INBOX:
  - Lee headers (In-Reply-To, References, Subject, From)
  - Intenta matchear con OutreachAttempt.externalMessageId (In-Reply-To)
  - Si hay match:
    - Crea IncomingMessage ligado a la sequence
    - Dispara Flujo 7 (clasificación)
  - Si no hay match: almacena como unmatched (revisión humana)
  ↓
Guarda el nuevo historyId
```

### 7.6. Flujo 6 — Recepción de respuesta del deudor (WhatsApp demo)

```
Deudor envía mensaje por WhatsApp al número de demo
  ↓
Evolution API recibe → webhook a bot de Francisco
  ↓
Bot chequea: "este `from` está en la lista forwardeada de CobranzasAI?"
  - Sí → forward a POST /api/incoming-whatsapp de CobranzasAI
  - No → flujo normal de bot (assistant personal de Francisco)
  ↓
CobranzasAI /api/incoming-whatsapp:
  - Matchea `from` con Client.telefono
  - Si hay sequence activa → IncomingMessage ligado
  - Si no hay sequence → log como "WA inesperado", no actúa
  - Dispara Flujo 7 (clasificación)
```

### 7.7. Flujo 7 — Clasificación y respuesta conversacional

```
IncomingMessage creado (vía Email poll o WhatsApp webhook)
  ↓
Agente C (Classifier, Sonnet) recibe:
  - Texto del mensaje
  - Flag de mediaUrl presente
  - Contexto corto (últimos 3 mensajes de la conversación)
  ↓
Retorna JSON:
  {
    categoria: "PAGARA" | "COMPROBANTE_ADJUNTO" | "NEGOCIANDO" |
               "DISPUTA" | "AUTO_REPLY" | "OTRO",
    confianza: 0.0-1.0,
    metadata: { montoDetectado?, fechaDetectada?, ... }
  }
  ↓
Routing según categoria:
  - COMPROBANTE_ADJUNTO → Flujo 8 (workflow contador)
  - PAGARA → Agente E responde confirmando y pidiendo comprobante
  - NEGOCIANDO → Agente E responde según contexto (puede ofrecer planes
    configurables, no en Slice #1 más allá de responder conversacionalmente)
  - DISPUTA → marca sequence como AWAITING_HUMAN y notifica al operador
  - AUTO_REPLY → ignora (OOO, fuera de oficina, etc.)
  - OTRO → Agente E responde genéricamente
  ↓
Si corresponde respuesta:
  Agente E (Conversational, Sonnet, streaming) genera respuesta
  channel.send() la manda por el mismo canal
  Graba OutreachAttempt con tipo "conversational_reply"
  Sequence pasa a estado IN_CONVERSATION
```

### 7.8. Flujo 8 — Detección de comprobante + workflow del contador

```
Classifier retorna COMPROBANTE_ADJUNTO
  ↓
CobranzasAI:
  - Descarga el attachment (imagen/PDF) de Gmail o Evolution a storage local
  - Agente D (Vision, Sonnet) analiza la imagen:
    - Extrae monto, fecha, medio de pago, destinatario
    - Retorna JSON con metadata
  - Sequence pasa a estado AWAITING_ACCOUNTANT_CONFIRMATION
  ↓
Genera AccountantConfirmationToken:
  - token = crypto.randomBytes(16).toString('hex')  // 32 chars
  - expiresAt = now() + 7 días
  - Persiste
  ↓
Envía email al contador (configurado en Config "contador.email") usando EmailChannel:
  - Subject estructurado
  - Body con toda la info del deudor, facturas, monto detectado
  - Attachment del comprobante
  - Link tokenizado https://cobranzas.../accountant/confirm/<token>
  ↓
Sequence se queda en AWAITING_ACCOUNTANT_CONFIRMATION.
El runner de secuencias NO la avanza mientras esté en este estado.
```

**Página pública del contador** (`/accountant/confirm/[token]`):

```
Next.js page con getServerSideProps (o equivalente en App Router)
  ↓
Lookup del token:
  - Si no existe o expiresAt < now() o consumedAt != null → 404
  - Si OK → carga los datos de la confirmación (sequence, client, invoices, monto)
  ↓
Render minimalista, mobile-friendly:
  - Info del deudor y las facturas
  - Preview inline del comprobante
  - Radios: TOTAL / PARCIAL / RECHAZO
  - Input de monto si PARCIAL, textarea si RECHAZO
  - Botón Confirmar
  ↓
Al confirmar: POST /accountant/confirm/<token>
  - Valida token otra vez
  - Según decision:
    * TOTAL → marca invoices como PAID (todas las PENDING del deudor),
              sequence → PAID, dispara mensaje de "gracias" al deudor
    * PARCIAL → aplica monto FIFO sobre invoices más viejas,
                sequence sigue con deuda reducida, template "gracias parcial"
    * RECHAZO → Agente F (Rejection, Sonnet) genera mensaje polite,
                sequence vuelve a IN_CONVERSATION
  - Marca token.consumedAt = now()
  - Graba AccountantConfirmation
  - Responde con página "Gracias, pago confirmado/rechazado"
```

**Timeout del contador** (`/api/cron/contador-reminder` cada 1h):

```
Query: AccountantConfirmationToken
       WHERE consumedAt IS NULL AND createdAt < NOW() - INTERVAL '24 hours'
       AND reminderSentAt IS NULL
  ↓
Para cada:
  - Envía email de recordatorio al contador
  - Marca sequence como needs_attention en el dashboard
  - Set reminderSentAt = now()
```

---

## 8. Pestañas del dashboard

### 8.1. Cartera (operativa)

Tabla plana de todos los deudores con facturas pendientes, ordenada por score descendente. Diseño **Opción 4**: tabla limpia con un ícono "🤖" en la fila cuando hay insight del agente (top 50) que abre un popover con el insight completo.

Columnas:
- Razón social (link al drawer con detalle)
- Monto total
- Días vencido máx
- Segmento (chip coloreado)
- Estado actual de la sequence (chip)
- Ícono de insight del agente (cuando aplique)
- Ícono de autopilot off (cuando aplique)
- Acciones: Enviar recordatorio manual / Abrir drawer / Marcar autopilot off

Filtros:
- Por bucket
- Por estado de sequence
- Por rango de monto
- Por búsqueda de texto (razón social)
- Solo autopilot off

**Drawer lateral** al clickear un deudor:
- Datos de contacto
- Lista de facturas pendientes
- Timeline de OutreachAttempts + IncomingMessages
- Estado actual del state machine con botones de transición manual (para casos de excepción)
- Toggle "autopilot on/off"

### 8.2. Análisis IA

Pestaña donde vive la magia del agente portfolio-wide.

Contenido (layout vertical scroll):

1. **Tarjeta de resumen del último scan** (ver sección 11).
2. **Findings del agente** — lista de bullets con los hallazgos que generó el Agente B (Opus) en el scan más reciente.
3. **Segmentos propuestos** — cards horizontales con los segmentos detectados (name, count, totalAmount, descripción breve). Cada card tiene botón "Ver deudores" que filtra la pestaña Cartera.
4. **Plan de acción** — lista de recomendaciones estructuradas (ver mockup del brainstorming). Cada una tiene botón "Ejecutar campaña" que abre el modal de batch approval (Flujo 3).
5. **Botón "Reanalizar cartera"** (ejecuta el scan manualmente sin re-import).

### 8.3. Histórico

Lista simple de `TriageRun` en orden cronológico descendente. Cada fila tiene:
- Timestamp, source (IMPORT/MANUAL)
- Nombre del archivo (si aplica)
- Contadores por bucket
- Total adeudado
- Delta vs el anterior
- Botón "Ver detalle" que abre la tarjeta de resumen de ese scan

### 8.4. Settings

Formulario simple con secciones:
- **Thresholds de aging** — tres inputs numéricos (suave, firme, aviso final) con preview del efecto.
- **Email del contador** — un input de email.
- **Credenciales de Gmail** — muestra el email conectado y un botón "Reconectar" (OAuth flow).
- **Endpoint del bot WhatsApp demo** — input URL + botón "Probar conexión".
- **Timeouts del state machine** — tres inputs numéricos en días (soft→firm, firm→final, final→escalated).
- **Copy de los templates** — tres textareas grandes (soft, firm, final) con preview de variables disponibles.

---

## 9. Inventario de agentes LLM (los 7)

Configuración global: `CLAUDE_MODEL_DEFAULT = claude-sonnet-<last-version>`. Overrides por agente opcionales vía env vars.

| # | Agente | Función | Volumen | Modelo default | Override |
|---|---|---|---|---|---|
| A | **Insight enricher** | Genera 2 líneas de justificación por deudor del top 50 | 50/scan | Sonnet | — |
| B | **Portfolio analyzer** | Analiza la cartera agregada y propone findings + segmentos + plan | 1/scan | **Opus** | `CLAUDE_MODEL_AGENT_PORTFOLIO=opus-<last>` |
| C | **Response classifier** | Clasifica respuestas entrantes en 6 categorías | ~5k/día | Sonnet | — |
| D | **Payment proof analyzer** | Vision: extrae monto/fecha/medio de comprobante | ~200/día | Sonnet | — |
| E | **Conversational agent** | Responde al deudor dentro de la ventana activa | ~5k/día | Sonnet (streaming) | — |
| F | **Rejection generator** | Genera mensaje polite de rechazo cuando contador rechaza comprobante | ~10/día | Sonnet | — |
| G | **Campaign sanity checker** | Revisa el batch antes de ejecutarlo, flagea anomalías obvias | 1-3/campaña | Sonnet | — |

Cada agente tiene en `lib/agents/<agent>.ts` su propio:
- Prompt template (con variables claras)
- Input schema (Zod)
- Output schema (Zod)
- Función de llamada con retries + logging estructurado

---

## 10. Canales de outreach

### 10.1. Interface común

```typescript
interface OutreachChannel {
  readonly name: Channel  // EMAIL | WHATSAPP

  send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
  }): Promise<{ externalMessageId: string; sentAt: Date }>

  // Cada canal tiene su propia forma de recibir respuestas:
  // - EmailChannel: polling programado
  // - WhatsAppDemoChannel: webhook
  // Pero el resultado de la recepción es siempre un IncomingMessage
  // insertado en la DB, así que la interface no expone un método común
  // para "receive" — cada canal lo implementa por su lado.
}
```

### 10.2. EmailChannel (Gmail API)

- Usa la cuenta de Gmail del cliente (OAuth), ya configurada en el entorno de Francisco.
- `send()` usa `gmail.users.messages.send` con el template renderizado en HTML + texto plano.
- El `Message-ID` del email enviado se guarda como `externalMessageId`.
- Responses se pollean vía `users.history.list` con el `historyId` persistido en Config.
- Cada email saliente incluye un header `X-CobranzasAI-Sequence-Id` para matching defensivo si `In-Reply-To` falla.

### 10.3. WhatsAppChannel (demo via Evolution)

**Importante: este adapter es EXCLUSIVAMENTE para demo. Guard de entorno:**

```typescript
if (process.env.NODE_ENV === 'production' && channel instanceof WhatsAppDemoChannel) {
  throw new Error('WhatsAppDemoChannel no se puede usar en producción. Migrar a WhatsAppCloudChannel.')
}
```

**Flujo de `send()`:**
```
CobranzasAI → POST {WHATSAPP_DEMO_ENDPOINT}/cobranzas/send
  Body: { to, message, messageType?, debtorId, outreachAttemptId }
  ↓
Bot Evolution de Francisco:
  - Recibe el POST
  - Llama Evolution API sendText({to, message})
  - Retorna { ok, messageId, sentAt }
  ↓
CobranzasAI persiste externalMessageId = messageId
```

**Flujo de recepción:**
```
Deudor envía WA al número del bot
  ↓
Evolution webhook → bot de Francisco
  ↓
Bot chequea lista de números forwardeados
  - Si está → POST {COBRANZAS_URL}/api/incoming-whatsapp con payload estructurado
  - Si no está → flujo normal del bot (asistente personal)
  ↓
CobranzasAI /api/incoming-whatsapp:
  - Matchea from con Client.telefono
  - Crea IncomingMessage
  - Dispara Agente C (classifier)
```

**Modificación concreta que Francisco hará en su bot** (~2-3h):
1. Agregar endpoint `POST /cobranzas/send` que recibe el payload y lo manda por Evolution.
2. Agregar chequeo de "número forwardeado" al handler de mensajes entrantes, que forwardee el mensaje a CobranzasAI.
3. Config (env var o archivo) con la lista de números forwardeados y la URL de CobranzasAI.

### 10.4. Migración futura a WA Cloud API oficial (NO en Slice #1)

Cuando se migre a producción real, se reemplaza `WhatsAppDemoChannel` por `WhatsAppCloudChannel` que:
- Usa el Meta Graph API directamente (`/messages` endpoint).
- Maneja templates pre-aprobados para primer contacto en frío (fuera de la ventana de 24h).
- Recibe webhooks de Meta directamente en `/api/incoming-whatsapp-cloud`.
- Los templates (soft, firm, final) deben estar pre-aprobados en Meta Business antes de usarse.

**El resto del sistema no cambia.** El state machine, el classifier, el agente conversacional, el workflow del contador — todo es idéntico.

---

## 11. State machine de outreach

### 11.1. Estados

```
SCHEDULED              — aprobado en batch, aún no enviado
SENT_SOFT              — template suave enviado, esperando respuesta o timeout
SENT_FIRM              — template firme enviado, esperando respuesta o timeout
SENT_FINAL             — template aviso final enviado, esperando respuesta o timeout
IN_CONVERSATION        — deudor respondió, conversación activa con agente
AWAITING_ACCOUNTANT    — comprobante recibido, pendiente de contador
PAID                   — pago confirmado por contador, sequence cerrada
PARTIAL_PAID_CONTINUING — pago parcial confirmado, sequence sigue con deuda reducida
ESCALATED_TO_HUMAN     — sequence terminó sin resolución, necesita operador
AUTOPILOT_OFF          — el deudor fue marcado opt-out, no se mueve automáticamente
CLOSED                 — estado terminal (paid, escalated, etc.)
```

### 11.2. Transiciones principales

```
SCHEDULED
  ↓ (enviado)
SENT_SOFT
  ↓ timeout (soft→firm días)              ↓ respuesta
SENT_FIRM                                  IN_CONVERSATION
  ↓ timeout (firm→final días)              ↓
SENT_FINAL                                 ↓ (classifier:
  ↓ timeout (final→escalated días)         ↓  COMPROBANTE_ADJUNTO)
ESCALATED_TO_HUMAN                         AWAITING_ACCOUNTANT
                                           ↓
                                           ├── TOTAL   → PAID → CLOSED
                                           ├── PARTIAL → PARTIAL_PAID_CONTINUING
                                           │             (vuelve al bucket correspondiente
                                           │              de la deuda restante)
                                           └── REJECT  → IN_CONVERSATION (vuelve al loop)

En cualquier estado no terminal:
  Client.autopilotOff = true → sequence pausa (no avanza hasta que el operador
                                actúe manualmente desde el drawer)
```

### 11.3. Responsabilidades de transición

- **Runner de secuencias (cron)**: avanza `SENT_SOFT → SENT_FIRM → SENT_FINAL → ESCALATED_TO_HUMAN` según timeouts. NO toca otros estados.
- **Classifier (Agente C)**: mueve a `IN_CONVERSATION`, `AWAITING_ACCOUNTANT`, o mantiene estado según categoría.
- **Workflow del contador**: mueve de `AWAITING_ACCOUNTANT` a `PAID`, `PARTIAL_PAID_CONTINUING`, o `IN_CONVERSATION` (rechazo).
- **Operador humano (drawer)**: puede forzar cualquier transición manualmente (con confirmación).

---

## 12. Tarjeta de resumen post-scan

Generada al final del Flujo 2 (scan completo), visible arriba de la pestaña Análisis IA y también archivada para consulta histórica.

**Contenido:**
- Timestamp del scan
- Source (import filename o manual)
- Total deudores analizados
- Total adeudado
- Breakdown por bucket: count + monto (5 columnas)
- **Delta vs scan anterior** por bucket (si hay scan anterior)
- Recupero detectado: monto total de facturas que pasaron de PENDING a PAID desde el último scan
- Nuevos deudores críticos (entraron al bucket CRITICO)
- Botón "Ver dashboard"

---

## 13. Settings configurables

| Clave Config | Tipo | Default | Efecto |
|---|---|---|---|
| `aging.thresholds` | `{suave, firme, avisoFinal}` en días | `{15, 30, 45}` | Buckets del scoring y resumen |
| `sequence.timeouts` | `{softToFirm, firmToFinal, finalToEscalated}` en días | `{5, 7, 10}` | Runner de secuencias |
| `contador.email` | email | vacío (obligatorio en prod) | Destinatario del workflow contador |
| `contador.reminderTimeoutHours` | int | `24` | Cuándo mandar recordatorio al contador |
| `gmail.senderEmail` | email | conectado vía OAuth | From de los emails salientes |
| `whatsapp.demoEndpoint` | URL | — | URL del bot Evolution de Francisco |
| `whatsapp.forwardedNumbers` | array de strings | `[]` | Lista de números que el bot tiene que forwardear |
| `templates.copy` | `{soft, firm, avisoFinal, postPartial, rejection, paid, conversationalFallback}` | copy default en seed | Templates de mensajes |
| `llm.models` | `{default, portfolio, ...}` | `{default: "sonnet-X"}` | Overrides por agente |

---

## 14. Auth y seguridad

### 14.1. Auth del dashboard (admin1, admin2)

**NextAuth.js con Credentials provider.** Dos usuarios seedeados:

```
admin1 / admin123
admin2 / admin123
```

Las contraseñas se hashean con bcrypt en la tabla `User` al correr `prisma db seed`. Las rutas bajo `app/(app)/` están protegidas por middleware que chequea sesión.

**⚠ Esto es DEMO-grade.** El upgrade path a producción es migrar a NextAuth Google OAuth con allowlist de emails autorizados. Documentado en roadmap.

### 14.2. Auth del contador (tokenizado)

El contador NO tiene cuenta. Acceso vía `AccountantConfirmationToken`:
- Token de 32 bytes hex, unguessable (2^128 possibilities).
- Expira a 7 días.
- Consumible una sola vez (`consumedAt`).
- La página `/accountant/confirm/[token]` valida el token en server-side antes de renderizar.

### 14.3. Variables de entorno sensibles

```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
ANTHROPIC_API_KEY
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN  # Gmail API
WHATSAPP_DEMO_ENDPOINT
WHATSAPP_DEMO_API_KEY                                           # auth contra el bot
STORAGE_PATH o S3_*                                             # para adjuntos
CLAUDE_MODEL_DEFAULT
CLAUDE_MODEL_AGENT_PORTFOLIO                                    # opcional
```

---

## 15. Deployment (Railway)

### 15.1. Estructura del proyecto Railway

- **Service: web** — Next.js app (`npm run start`).
- **Service: postgres** — Postgres gestionado.
- **Service: cron** — endpoints HTTP llamados por Railway Cron:
  - `/api/cron/poll-gmail` — cada 2 min
  - `/api/cron/advance-sequences` — cada 5 min
  - `/api/cron/contador-reminder` — cada 1 h
  - `/api/cron/cleanup-tokens` — diario

### 15.2. Migraciones y seed

- `prisma migrate deploy` en el build step.
- `prisma db seed` corre solo si la tabla `User` está vacía (guard de idempotencia).

### 15.3. Observabilidad mínima

- Logs estructurados (JSON) vía `pino` o similar.
- Campos comunes: `requestId`, `userId?`, `sequenceId?`, `agent?`, `model?`, `latencyMs`, `tokensIn`, `tokensOut`.
- Railway captura stdout.
- Post-MVP: integración con Sentry o similar.

---

## 16. Testing strategy (alto nivel)

### 16.1. Unit

- Parsers de Excel (feeding con fixtures de .xlsx).
- Scoring determinista (input controlado, output esperado).
- Transiciones del state machine (matriz de transiciones válidas/inválidas).
- Templates rendering (variables se aplican, fallbacks de variables faltantes).

### 16.2. Integration

- Flujo completo de scan con fixture de Excel → verificar DB estado.
- Flujo completo de campaign launch → verificar OutreachAttempts creados.
- Classifier con respuestas mockeadas de Claude (golden set de 30 respuestas de ejemplo).
- Workflow contador end-to-end con token mockeado.

### 16.3. Manual (pre-demo)

- Rehearsal completo con data real del cliente (o mock similar en tamaño).
- Verificación de que los mensajes llegan al teléfono de testing.
- Verificación del workflow del contador con Francisco/partner actuando como contador.

---

## 17. Arquitecturas alternativas consideradas

| Decisión | Elegido | Alternativas consideradas | Razón |
|---|---|---|---|
| Stack frontend/backend | Next.js 15 monolito | Microservicios, Next.js + backend Node separado | Menor fricción, tipos compartidos, un solo deploy |
| Job runner / cron | Railway Cron + DB locks | BullMQ/Redis, Temporal, cron manual | YAGNI — el volumen del Slice #1 no justifica infra adicional |
| State machine | Implícito (enum + queries + cron) | XState, Temporal, state machine library explícita | Simplicidad. Las transiciones son pocas y claras. Migración futura a XState posible. |
| Detección respuestas Email | Polling (`users.history.list`) cada 2 min | Gmail push notifications vía Pub/Sub | Polling es más simple, latencia de 2 min es aceptable para cobranzas |
| Auth contador | Tokenizado sin login | NextAuth separado, magic link, OAuth | Cero fricción para el contador, seguridad suficiente con tokens largos |
| Modelo LLM | Sonnet default, Opus para portfolio | Haiku en A/C/G, Sonnet en resto | Consistencia operacional y de tono, costo delta despreciable |
| Canal WhatsApp | Adapter demo via Evolution (Slice #1) | WA Cloud API directo, evolución API directa, Telegram | WA Cloud API requiere 5-10 días de setup con Meta. Evolution en número controlado es seguro para demo. Cloud API es Slice #2. |
| Auth dashboard | Credentials hardcoded seed | Google OAuth + allowlist | Pragmatismo demo. OAuth upgrade planeado. |

---

## 18. Roadmap post-Slice-1

Items diferidos explícitamente, con prioridad:

| Prioridad | Item | Slice estimado |
|---|---|---|
| **Alta** | Migración de WhatsApp demo adapter a WA Cloud API oficial | #2 |
| **Alta** | OCR + validación automática de comprobantes | #2 |
| **Alta** | Conciliación bancaria (import de extractos + auto-match) | #2-3 |
| Media | Canal telefónico (VAPI + Telnyx/Twilio) | #3 |
| Media | Integración con software contable (Tango/Bejerman/Contabilium) | #3-4 |
| Media | Router multicanal con Claude (decide canal por deudor) | #4 |
| Media | Múltiples contadores con reglas de asignación | #3+ |
| Media | Auth con Google OAuth + allowlist (reemplaza credentials) | Cualquier slice post-demo |
| Baja | Historial consultable por el contador | Post-MVP lujo |
| Futuro | Multi-tenant / SaaS | #5+ |
| Futuro | Modelos predictivos de probabilidad de recupero | Post-MVP |
| Futuro | Analytics avanzados / dashboards de recupero | Post-MVP |

---

## 19. Glosario

- **Scan**: ejecución completa de scoring + análisis IA + generación de tarjeta resumen sobre el estado actual de la cartera.
- **Bucket**: una de las 5 categorías de aging (Sin vencer / Suave / Firme / Aviso final / Crítico).
- **Sequence**: la máquina de estados de outreach activa para un deudor.
- **OutreachAttempt**: un envío individual (email o WA) dentro de una sequence.
- **Template**: copy pre-definido de mensajes (soft, firm, final, etc.) con variables.
- **Insight**: texto corto generado por Claude que justifica por qué un deudor está en el top 50.
- **Finding**: hallazgo agregado del Agente B (portfolio analyzer) — no aplica a un deudor individual sino a la cartera.
- **Workflow del contador**: flujo de validación humana de comprobantes recibidos.
- **Ventana de 24h** (WhatsApp): período post-respuesta del deudor durante el cual se pueden enviar mensajes libres (no templates).
- **Autopilot off**: flag por deudor que saca a ese deudor del runner automático de secuencias. Útil para casos de excepción que el operador prefiere manejar a mano.

---

## 20. Decisiones tomadas durante el brainstorming (apéndice histórico)

Registro cronológico de las decisiones y su justificación, para referencia futura.

| # | Decisión | Razón |
|---|---|---|
| 1 | Alcance: vertical slice con pipeline end-to-end de cobranzas | Alternativa (8 slices independientes) dejaba demo sin un flujo completo |
| 2 | Framing: plataforma single-tenant, no SaaS | Corrección explícita de Francisco al retomar |
| 3 | Dos archivos Excel separados: clientes + facturas | Frecuencias de actualización distintas, modelo 1:N natural |
| 4 | Aging calculado en vivo, no guardado | Los buckets se desactualizan al día siguiente |
| 5 | Usuarios: admin1/admin2 con `admin123` | Pragmatismo demo. OAuth post-demo. |
| 6 | Deploy: Railway | Coincide con el plan original, Next.js + Postgres en un proyecto |
| 7 | Templates: 3 por aging (soft/firm/aviso final) auto-seleccionados | Efecto de "el sistema elige el tono correcto" sin router IA |
| 8 | Thresholds configurables desde el dashboard | Flexibilidad del operador sin deploy |
| 9 | Agente de scoring: determinista + IA enrich top 50 | Balance entre costo, velocidad, y efecto WOW |
| 10 | Análisis IA en pestaña separada (no mezclado con Cartera) | Pestaña Cartera es operativa, Análisis IA es insight strategy |
| 11 | Histórico: append-only de snapshots | Clave para demo con múltiples scans mostrando evolución |
| 12 | Comparación entre scans: tarjeta resumen con deltas | El momento WOW real de la demo |
| 13 | Buckets unificados (5 niveles) para aging, templates y resumen | Una sola fuente de verdad |
| 14 | Dashboard Cartera = Opción 4 (tabla limpia + popover) | Operativa, no saturada |
| 15 | Agente IA portfolio-wide (Agente B) con Opus | Hero moment, 1 call/scan, costo trivial |
| 16 | Automatización de outreach = grade B (secuencias autónomas) | Francisco: "si vendo automatización, tiene que funcionar" |
| 17 | Canal WhatsApp en Slice #1: adapter demo via Evolution existente | Cero riesgo legal, cero esperas de Meta, indistinguible en demo |
| 18 | Telegram descartado del Slice #1 | Opt-in limitation (`/start`) + WhatsApp domina Argentina |
| 19 | Contador: sin login, email + token tokenizado | Cero fricción, seguridad suficiente |
| 20 | Timeout contador: 24h (no 3d) | Francisco corrigió a algo más responsivo |
| 21 | Imputación FIFO de pagos parciales | Simplicidad + convención contable común |
| 22 | Todos los agentes en Sonnet default | Consistencia + costo delta despreciable vs Haiku |
| 23 | Agente B (portfolio) en Opus | Hero moment del producto |
| 24 | `autopilot_off` por deudor (no global) | Flexibilidad sin romper el default de automatización |

---

**Fin del documento.**
