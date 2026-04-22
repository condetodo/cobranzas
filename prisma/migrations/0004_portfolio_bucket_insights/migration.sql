-- Rename PortfolioAnalysis.segmentos to bucketInsights.
-- El shape del JSON cambia: antes era [{ name, rule, count, totalAmount }] (segmentos inventados
-- por Agent B), ahora es [{ bucket, insight }] (un insight específico por cada bucket activo
-- usando los 5 enums del sistema). Data vieja queda en la columna renombrada pero el frontend
-- la va a reanalizar con el prompt nuevo la próxima vez que se corra triage.
ALTER TABLE "PortfolioAnalysis" RENAME COLUMN "segmentos" TO "bucketInsights";
