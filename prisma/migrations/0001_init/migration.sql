-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InvoiceState" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TriageSource" AS ENUM ('IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "Bucket" AS ENUM ('SIN_VENCER', 'SUAVE', 'FIRME', 'AVISO_FINAL', 'CRITICO');

-- CreateEnum
CREATE TYPE "SequenceState" AS ENUM ('SCHEDULED', 'SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL', 'IN_CONVERSATION', 'AWAITING_ACCOUNTANT', 'PAID', 'PARTIAL_PAID_CONTINUING', 'ESCALATED_TO_HUMAN', 'AUTOPILOT_OFF', 'CLOSED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ClosedReason" AS ENUM ('PAID', 'PARTIAL_PAID_CONTINUING', 'ESCALATED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "IncomingCategory" AS ENUM ('PAGARA', 'COMPROBANTE_ADJUNTO', 'NEGOCIANDO', 'DISPUTA', 'AUTO_REPLY', 'OTRO');

-- CreateEnum
CREATE TYPE "AccountantDecision" AS ENUM ('TOTAL', 'PARTIAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'CONTADOR', 'DEBTOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "cod" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "telegram" TEXT,
    "categoria" TEXT,
    "autopilotOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "estado" "InvoiceState" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageRun" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "TriageSource" NOT NULL,
    "excelFileName" TEXT,
    "totalDebtors" INTEGER NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "bucketCounts" JSONB NOT NULL,
    "bucketAmounts" JSONB NOT NULL,

    CONSTRAINT "TriageRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtorTriageSnapshot" (
    "id" TEXT NOT NULL,
    "triageRunId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "montoTotal" DECIMAL(65,30) NOT NULL,
    "invoiceCount" INTEGER NOT NULL,
    "diasVencidoMax" INTEGER NOT NULL,
    "bucket" "Bucket" NOT NULL,
    "score" INTEGER NOT NULL,
    "agentSegment" TEXT,
    "aiInsight" TEXT,

    CONSTRAINT "DebtorTriageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioAnalysis" (
    "id" TEXT NOT NULL,
    "triageRunId" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "segmentos" JSONB NOT NULL,
    "planDeAccion" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSequence" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "state" "SequenceState" NOT NULL,
    "currentBucket" "Bucket" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActionAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "escalationReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedReason" "ClosedReason",

    CONSTRAINT "OutreachSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAttempt" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "templateCode" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalMessageId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "firstResponseAt" TIMESTAMP(3),
    "classificationResult" JSONB,

    CONSTRAINT "OutreachAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingMessage" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT,
    "channel" "Channel" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classifiedCategory" "IncomingCategory",
    "classifierMetadata" JSONB,
    "agentResponseId" TEXT,

    CONSTRAINT "IncomingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantConfirmationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "incomingMessageId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "AccountantConfirmationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantConfirmation" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "decision" "AccountantDecision" NOT NULL,
    "confirmedAmount" DECIMAL(65,30),
    "rejectionReason" TEXT,
    "appliedInvoiceIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountantConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "payload" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Client_cod_key" ON "Client"("cod");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_clientId_numero_key" ON "Invoice"("clientId", "numero");

-- CreateIndex
CREATE INDEX "DebtorTriageSnapshot_triageRunId_score_idx" ON "DebtorTriageSnapshot"("triageRunId", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioAnalysis_triageRunId_key" ON "PortfolioAnalysis"("triageRunId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSequence_clientId_key" ON "OutreachSequence"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountantConfirmationToken_token_key" ON "AccountantConfirmationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AccountantConfirmationToken_incomingMessageId_key" ON "AccountantConfirmationToken"("incomingMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountantConfirmation_tokenId_key" ON "AccountantConfirmation"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "Config_key_key" ON "Config"("key");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtorTriageSnapshot" ADD CONSTRAINT "DebtorTriageSnapshot_triageRunId_fkey" FOREIGN KEY ("triageRunId") REFERENCES "TriageRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtorTriageSnapshot" ADD CONSTRAINT "DebtorTriageSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioAnalysis" ADD CONSTRAINT "PortfolioAnalysis_triageRunId_fkey" FOREIGN KEY ("triageRunId") REFERENCES "TriageRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingMessage" ADD CONSTRAINT "IncomingMessage_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountantConfirmationToken" ADD CONSTRAINT "AccountantConfirmationToken_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountantConfirmation" ADD CONSTRAINT "AccountantConfirmation_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "AccountantConfirmationToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

