"use client";

import type { Stats, Ticket } from "@/lib/types";
import { deriveFlowCounts, flowCategoryBreakdown } from "@/lib/ticketFlow";
import { FlowBoard, FlowColumn, type FlowRow } from "@/components/dashboard";

export type FlowItem = FlowRow;

type TicketFlowProps = {
  flowCounts?: Stats["flowCounts"];
  categoryBreakdown?: { category: string; count: number }[];
  tickets?: Ticket[];
};

function categoryItems(breakdown: { category: string; count: number }[] | undefined, tickets: Ticket[]) {
  const rows = breakdown?.length ? breakdown : flowCategoryBreakdown(tickets);
  const colors: FlowRow["color"][] = ["accent", "chart", "success", "muted", "muted", "muted"];
  if (!rows.length) {
    return [{ label: "Uncategorized", count: 0, color: "muted" as const }];
  }
  return rows.slice(0, 6).map((row, index) => ({
    label: row.category,
    count: row.count,
    color: colors[index % colors.length],
  }));
}

export function TicketFlow({ flowCounts, categoryBreakdown, tickets = [] }: TicketFlowProps) {
  const counts = flowCounts ?? deriveFlowCounts(tickets);
  const categorizedItems = categoryItems(categoryBreakdown, tickets);
  const totalInScope = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="nx-card p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-primary">Ticket flow</p>
          <p className="mt-1 text-xs text-secondary">Live pipeline counts from creation through completion.</p>
        </div>
        <p className="text-xs text-secondary">{totalInScope} tickets in scope</p>
      </div>

      <FlowBoard>
        <FlowColumn
          title="Intake"
          items={[
            { label: "New", count: counts.New, color: "accent" },
            { label: "Pending response", count: counts.PendingWorkerResponse, color: "chart" },
          ]}
        />
        <FlowColumn title="Categorized" items={categorizedItems} />
        <FlowColumn
          title="Response"
          items={[
            { label: "Accepted", count: counts.Accepted, color: "success" },
            { label: "Rejected", count: counts.Rejected, color: "danger" },
          ]}
        />
        <FlowColumn
          title="Progress"
          items={[
            { label: "In progress", count: counts.InProgress, color: "chart" },
            { label: "Completed", count: counts.Completed, color: "success" },
          ]}
        />
        <FlowColumn title="Final" items={[{ label: "Cancelled", count: counts.Cancelled, color: "muted" }]} />
      </FlowBoard>
    </div>
  );
}

export const InvestigationsFlow = TicketFlow;

export { FlowBoard, FlowColumn } from "@/components/dashboard";
