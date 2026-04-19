-- Track delivery failures per sequence (for auto-escalation after N fails)
-- and last incoming message timestamp (for IN_CONVERSATION timeout).

ALTER TABLE "OutreachSequence"
  ADD COLUMN "sendFailureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastIncomingAt" TIMESTAMP(3);
