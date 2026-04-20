-- Permitir múltiples secuencias históricas por cliente.
-- Antes: un cliente → una única OutreachSequence en toda la vida.
-- Ahora: un cliente → N secuencias (una activa + las cerradas históricas).
-- El invariante "máximo una activa" se mantiene por código, no por DB.

-- Quitar el índice único sobre clientId
DROP INDEX "OutreachSequence_clientId_key";

-- Crear índice regular (no único) sobre (clientId, closedAt) para que las
-- queries frecuentes sigan siendo rápidas ("traeme la secuencia activa del cliente").
CREATE INDEX "OutreachSequence_clientId_closedAt_idx" ON "OutreachSequence"("clientId", "closedAt");
