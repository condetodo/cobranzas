# CobranzasAI — Slice #1 — Brainstorming WIP

> **⚠ DOCUMENTO SUPERSEDED (2026-04-11).**
>
> Este archivo es el WIP histórico del brainstorming. El diseño completo del Slice #1
> ya está consolidado en el spec definitivo:
>
> **→ `2026-04-11-cobranzas-mvp-slice1-design.md`** (+ PDF en el mismo directorio)
>
> Este WIP se conserva únicamente como registro histórico de cómo se llegó a las
> decisiones. Para trabajar en el Slice #1, leer el spec definitivo.

**Estado:** CERRADO — superseded por el spec definitivo.
**Dueño:** Francisco.
**Próximo paso (global):** revisión humana del spec definitivo por Francisco. Después, invocar `superpowers:writing-plans` para armar el plan de implementación.

---

## Contexto del producto

CobranzasAI (en esta fase) es una **plataforma single-tenant para UN cliente específico** (una PyME concreta) que hoy gestiona deudores en planillas y hace seguimiento manual. Puede evolucionar a SaaS en el futuro, pero el MVP se construye para una sola organización. La visión del producto contempla agentes multicanal (email, WhatsApp/Telegram, teléfono) orquestados por un router con Claude API, secuencias de escalación con fallback humano, y analytics de recupero.

**Modo de trabajo:** el MVP se construye a ciegas, sin consultar previamente al dueño de la PyME. Francisco lo presenta terminado para generar un **efecto WOW** en la reunión de demo. La calidad visual del dashboard importa más de lo habitual porque es una demo de ventas, no solo un piloto técnico.

**Stack objetivo (visión completa):** Next.js 15 + Prisma + PostgreSQL en Railway, NextAuth.js, Evolution API (WhatsApp), Gmail API (email, ya configurado), VAPI + Telnyx/Twilio (teléfono), Claude API (router).

---

## Decisión de alcance: decomposición en slices

El producto completo es demasiado grande para un único spec. Se decompuso en ~8 subsistemas independientes:

1. Sistema de ingesta (parser Excel, validación, importación idempotente)
2. Dashboard + auth
3. Motor de outreach Telegram (reemplazó WhatsApp en MVP por simplicidad de setup)
4. Motor de outreach Email (Gmail API)
5. Motor de outreach telefónico (VAPI + Telnyx/Twilio)
6. Router de agentes (Claude API)
7. Sistema de secuencias / escalación (state machine, timeouts 48/72h, fallback humano)
8. Analytics / métricas

**Cada uno merece su propio ciclo spec → plan → implementación.** Brainstormeamos solo el primer slice.

---

## Slice #1 — MVP vertical (definido)

> **Ingesta de Excel (2 archivos: `clientes.xlsx` + `facturas.xlsx`) → Dashboard con deudores categorizados por antigüedad calculada en vivo → Envío manual de recordatorio por Email (Gmail API) con templates → Registro del intento en `OutreachAttempts` → vista de historial por deudor.**

**Principios del slice:**
- Vertical slice mínimo end-to-end (ingesta → DB → envío → registro → UI).
- El operador decide qué deudor contactar. **Sin router automático, sin secuencias, sin IA en el mensaje**.
- El loop completo se debe poder validar en ~1 semana con un cliente piloto.
- Todo lo demás (router, secuencias, otros canales) es aditivo sobre esta base sin reescritura.

### Canal elegido: Email (Gmail API)

Se descartaron las otras opciones porque:
- **Telegram como canal principal** tiene un bloqueante técnico serio: los bots solo pueden mensajear a usuarios que previamente iniciaron la conversación (`/start`). Exige onboarding manual previo de cada deudor, que agrega semanas al time-to-value. Queda para un slice posterior como canal secundario.
- **WhatsApp via Evolution API** permite outreach en frío pero agrega setup externo (sesión de WhatsApp Web, fragilidad). Más riesgo técnico. Queda para slice #2.
- **Email** gana porque: (a) Gmail API ya está configurado → cero riesgo técnico nuevo, (b) cero fricción de onboarding para el deudor, (c) el loop completo se valida en ~1 semana, (d) los templates, la tabla `OutreachAttempts` y el router futuro se diseñan correctamente desde el primer día y se reutilizan sin cambios cuando entren los otros canales.

### Formato del Excel de entrada (decidido)

**Dos archivos separados** (no uno plano), porque tienen frecuencias de actualización distintas y modelo 1:N natural:

**`clientes.xlsx`** — se actualiza poco (~1 vez/semana)
```
COD | RAZON_SOCIAL | TELEFONO | MAIL | CATEGORIA (A/B/C/D, opcional)
```

**`facturas.xlsx`** — se re-sube frecuentemente (diaria)
```
COD | Nº FC | FECHA_EMISION | FECHA_VENCIMIENTO | MONTO | MONEDA | ESTADO
```

**Reglas:**
- El parser asume columnas fijas (el sistema de gestión de la PyME exporta con schema consistente — no necesita wizard de mapeo).
- `COD` es la FK de `clientes` ↔ `facturas`.
- **La categorización por antigüedad (`<15d`, `16-30d`, `+30d` o lo que se acuerde) se calcula en vivo al renderear el dashboard, NO se guarda en la DB.** Los buckets pre-calculados se desactualizan al día siguiente.
- Plan B mental: si el ERP del cliente piloto solo exporta un archivo plano con contacto + factura juntos, el parser separa en memoria y persiste en las dos tablas igual.

### Bloqueantes del Excel real: resueltos por asunción para la demo

El archivo real del cliente (`CONDICIONES_DE_PAGOS_NUEVO DEFINITIVA.xlsx`, 6 hojas, 4.924 clientes, 14.818 instrumentos de pago) tenía dos huecos: (1) no había columnas de contacto — teléfono/email — y (2) no había facturas individuales con fecha de vencimiento, solo `SALDO CC` agregado.

**Decisión 2026-04-11:** como el MVP se construye a ciegas para un efecto WOW demo, Francisco va a **agregar manualmente** al Excel mockup las columnas de contacto (`MAIL`, `TELEFONO`, `TELEGRAM`) en `clientes.xlsx` y va a usar `facturas.xlsx` asumiendo que tiene el breakdown completo por factura con fecha de vencimiento. No se valida nada con el dueño antes de la demo — las asunciones se confirman al presentar.

Si en la reunión de demo el dueño dice "mi sistema no exporta esto así", el schema sigue siendo correcto y el gap pasa a ser un problema de adaptador de import, no de diseño del MVP.

---

## Decisiones tomadas hasta ahora

| # | Tema | Decisión |
|---|---|---|
| 1 | Alcance | Vertical slice #1: ingesta + dashboard + envío manual. Sin router, sin secuencias, sin IA en mensaje. |
| 2 | Canal del slice #1 | **Email** (Gmail API). Telegram y WhatsApp quedan para slices posteriores. |
| 3 | Formato del Excel | **Dos archivos separados** (`clientes.xlsx` + `facturas.xlsx`). |
| 4 | Categorización por antigüedad | Se calcula **en vivo** en el dashboard, no se guarda en la DB. |
| 5 | Modelo de datos del Excel | Una fila por factura en `facturas.xlsx`, FK por `COD` a `clientes.xlsx`. |
| 6 | Compañero visual de brainstorming | Activado. URL cambia entre sesiones (el servidor se apaga por inactividad). |
| 7 | Framing del producto | Plataforma single-tenant para UN cliente. SaaS multi-tenant es evolución futura, no un requisito del MVP. |
| 8 | Modo de trabajo del MVP | Se construye a ciegas para efecto WOW demo. El dueño de la PyME no se consulta antes. |
| 9 | Bloqueantes del Excel real | Resueltos por asunción (mock del Excel con `MAIL`/`TELEFONO`/`TELEGRAM` agregados a mano). |
| 10 | Usuarios | Dos usuarios hardcodeados: `admin1` / `admin2`, ambos con password `admin123`. |
| 11 | Auth | NextAuth **Credentials provider** (email+password) con 2 users seedeados en la DB. Google OAuth queda como upgrade post-demo (Francisco validó que es lo ideal pero no quiere gastar tiempo ahora). |
| 12 | Deploy | Railway (Next.js + Postgres en el mismo proyecto). |

---

## Preguntas pendientes (en orden)

### Pregunta 6 — Templates de email (visual)
Cuántos templates, con qué variables, cómo se seleccionan al enviar. Se va a presentar con mockups en el compañero visual.

### Pregunta 7 — Recepción de respuestas y estado del deudor
Cómo detectamos que un deudor respondió (watch de Gmail, polling, webhook). Cómo se actualiza el estado del `OutreachAttempt`. ¿El dueño marca manualmente "este pagó" o se infiere por el próximo import de `facturas.xlsx` (si la factura ya no aparece → cobrada)?

### Pregunta 8 — Layout del dashboard (visual)
Cómo se ve la tabla de deudores, qué filtros, qué acciones inline, qué pasa al clickear un deudor (drawer lateral con historial vs página aparte). Se va a presentar con 2-3 mockups side-by-side.

---

## Siguientes fases del proceso (después de cerrar preguntas)

1. **Proponer 2-3 enfoques de arquitectura** con trade-offs (patrones de importación idempotente, estructura de módulos, sync vs async del envío de mail, etc.).
2. **Presentar diseño por secciones**: arquitectura, modelo de datos (Prisma schema), componentes del frontend, flujo de ingesta, flujo de envío, manejo de errores, estrategia de testing. Aprobación después de cada sección.
3. **Escribir el spec definitivo** en `docs/superpowers/specs/2026-04-10-cobranzas-mvp-slice1-design.md` y commitearlo.
4. **Self-review** del spec (placeholders, consistencia interna, scope, ambigüedad).
5. **Revisión del usuario** del spec escrito.
6. **Invocar writing-plans** para generar el plan de implementación.

**IMPORTANTE:** no tocar código hasta que el spec esté aprobado y el plan de implementación escrito.

---

## Cómo retomar mañana

1. Abrir Claude Code en `C:\Proyectos\cobranzas-ai`.
2. Decirle algo tipo: *"Retomemos el brainstorming de CobranzasAI donde lo dejamos. Leé `docs/superpowers/specs/2026-04-10-cobranzas-mvp-brainstorming-wip.md`"*.
3. Responder la Pregunta 5 (auth + usuarios + deploy).
4. Seguir con Preguntas 6, 7, 8.
5. Presentar el diseño por secciones.
6. Escribir el spec definitivo.
