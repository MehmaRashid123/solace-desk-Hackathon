-- Worker-booking flow: extend User/Ticket, replace TicketStatus enum, add WorkerRating.
-- Run AFTER scripts/migrate-ticket-status.ts (step 1: TicketEvent string values).
--
-- Status mapping (Ticket.status):
--   NEW         -> New
--   ASSIGNED    -> PendingWorkerResponse
--   IN_PROGRESS -> InProgress
--   RESOLVED    -> Completed

-- AlterEnum-style replacement for PostgreSQL
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";

CREATE TYPE "TicketStatus" AS ENUM (
  'New',
  'PendingWorkerResponse',
  'Accepted',
  'InProgress',
  'Completed',
  'Rejected',
  'Cancelled'
);

ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Ticket"
  ALTER COLUMN "status" TYPE "TicketStatus"
  USING (
    CASE "status"::text
      WHEN 'NEW' THEN 'New'::"TicketStatus"
      WHEN 'ASSIGNED' THEN 'PendingWorkerResponse'::"TicketStatus"
      WHEN 'IN_PROGRESS' THEN 'InProgress'::"TicketStatus"
      WHEN 'RESOLVED' THEN 'Completed'::"TicketStatus"
      ELSE 'New'::"TicketStatus"
    END
  );

ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'New'::"TicketStatus";

DROP TYPE "TicketStatus_old";

-- User worker profile fields
ALTER TABLE "User"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;

-- Ticket booking fields
ALTER TABLE "Ticket"
  ADD COLUMN "urgency" "TicketPriority",
  ADD COLUMN "suggestedWorkerIds" JSONB,
  ADD COLUMN "rejectionReason" TEXT;

-- Worker ratings
CREATE TABLE "WorkerRating" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "stars" INTEGER NOT NULL CHECK ("stars" >= 1 AND "stars" <= 5),
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkerRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerRating_ticketId_key" ON "WorkerRating"("ticketId");
CREATE INDEX "WorkerRating_workerId_createdAt_idx" ON "WorkerRating"("workerId", "createdAt");
CREATE INDEX "WorkerRating_customerId_createdAt_idx" ON "WorkerRating"("customerId", "createdAt");

ALTER TABLE "WorkerRating"
  ADD CONSTRAINT "WorkerRating_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerRating"
  ADD CONSTRAINT "WorkerRating_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerRating"
  ADD CONSTRAINT "WorkerRating_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
