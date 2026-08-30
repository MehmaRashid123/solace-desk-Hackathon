/**
 * Pre-migration data script for worker-booking TicketStatus enum change.
 *
 * Run BEFORE applying prisma migration 20260830140000_worker_booking_flow:
 *   npx tsx scripts/migrate-ticket-status.ts
 *
 * Step 1 (this script): rewrites TicketEvent.fromValue / toValue strings so history
 *   matches the new enum labels before the DB enum swap.
 * Step 2 (migration.sql): replaces TicketStatus enum + adds new columns/tables.
 *
 * Ticket.status rows are migrated inside migration.sql via CASE mapping.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATUS_MAP: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "PendingWorkerResponse",
  IN_PROGRESS: "InProgress",
  RESOLVED: "Completed",
};

function mapStatus(value: string | null) {
  if (!value) return value;
  return STATUS_MAP[value] ?? value;
}

async function main() {
  const tickets = await prisma.ticket.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  console.log("Current Ticket.status distribution (pre-migration):");
  for (const row of tickets) {
    const mapped = STATUS_MAP[String(row.status)] ?? String(row.status);
    console.log(`  ${String(row.status)} -> ${mapped}  (${row._count._all} rows)`);
  }

  const events = await prisma.ticketEvent.findMany({
    select: { id: true, fromValue: true, toValue: true },
  });

  let updated = 0;
  for (const event of events) {
    const fromValue = mapStatus(event.fromValue);
    const toValue = mapStatus(event.toValue);
    if (fromValue === event.fromValue && toValue === event.toValue) continue;

    await prisma.ticketEvent.update({
      where: { id: event.id },
      data: { fromValue, toValue },
    });
    updated += 1;
  }

  console.log(`Updated ${updated} TicketEvent row(s) with mapped status strings.`);
  console.log("Next: npx prisma migrate deploy -w server  (or migrate dev)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
