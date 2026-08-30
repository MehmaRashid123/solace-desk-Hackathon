import { LoaderCircle, Sparkles } from "lucide-react";
import type { Ticket, TicketPriority } from "@/lib/types";
import { CATEGORIES } from "@/lib/format";
import { Button, Glass, Select, Textarea } from "./ui";

type FieldKey = "category" | "priority" | "summary";

export function AiReviewCard({
  ticket,
  category,
  priority,
  summary,
  editing,
  aiBusy,
  onChangeCategory,
  onChangePriority,
  onChangeSummary,
  onApprove,
  onReject,
  onSave,
  onRegenerate,
}: {
  ticket: Ticket;
  category: string;
  priority: TicketPriority | "";
  summary: string;
  editing: Record<FieldKey, boolean>;
  aiBusy: string | null;
  onChangeCategory: (value: string) => void;
  onChangePriority: (value: TicketPriority | "") => void;
  onChangeSummary: (value: string) => void;
  onApprove: (field: FieldKey) => void;
  onReject: (field: FieldKey) => void;
  onSave: () => void;
  onRegenerate: () => void;
}) {
  const raw = {
    category: ticket.aiCategory || "—",
    priority: ticket.aiPriority || "—",
    summary: ticket.aiSummary || "—",
  };

  return (
    <Glass className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-accent" />
        <h2 className="text-sm font-medium text-white">AI suggestion</h2>
      </div>
      {aiBusy === "triage" ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-muted">
          <LoaderCircle size={14} className="animate-spin" />
          Analyzing ticket...
        </p>
      ) : null}
      {ticket.aiFailed ? (
        <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          AI failed or timed out. Use Edit to enter the official value.
        </p>
      ) : null}

      <div className="space-y-3">
        <ReviewRow
          label="Category"
          raw={raw.category}
          editing={editing.category}
          onAccept={() => onApprove("category")}
          onEdit={() => onReject("category")}
        >
          <Select value={category} onChange={(e) => onChangeCategory(e.target.value)}>
            <option value="">Choose category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </ReviewRow>
        <ReviewRow
          label="Priority"
          raw={raw.priority}
          editing={editing.priority}
          onAccept={() => onApprove("priority")}
          onEdit={() => onReject("priority")}
        >
          <Select value={priority} onChange={(e) => onChangePriority(e.target.value as TicketPriority | "")}>
            <option value="">Choose priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </Select>
        </ReviewRow>
        <ReviewRow
          label="Summary"
          raw={raw.summary}
          editing={editing.summary}
          onAccept={() => onApprove("summary")}
          onEdit={() => onReject("summary")}
        >
          <Textarea rows={3} value={summary} onChange={(e) => onChangeSummary(e.target.value)} />
        </ReviewRow>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="pill" disabled={!category || !priority || !summary.trim()} onClick={onSave}>
          {ticket.category ? "Save review" : "Apply review"}
        </Button>
        <Button variant="ghost" disabled={!!aiBusy} onClick={onRegenerate}>
          {aiBusy === "triage" ? "…" : "Regenerate"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Accept AI Value keeps the suggestion. Edit opens the field. Official values save when you apply the review.
      </p>
    </Glass>
  );
}

function ReviewRow({
  label,
  raw,
  editing,
  onAccept,
  onEdit,
  children,
}: {
  label: string;
  raw: string;
  editing: boolean;
  onAccept: () => void;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className="mt-1 line-clamp-3 text-sm text-white">{raw}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button type="button" variant="pill" className="px-3 py-1 text-[11px]" onClick={onAccept}>
            Accept AI Value
          </Button>
          <Button type="button" variant="ghost" className="px-3 py-1 text-[11px]" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
      {editing ? <div className="mt-3 border-t border-white/10 pt-3">{children}</div> : null}
    </div>
  );
}
