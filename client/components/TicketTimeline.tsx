import { formatStamp } from "@/lib/format";
import { cn } from "@/lib/cn";

export type TimelineEventType =
  | "creation"
  | "ai"
  | "status"
  | "assignment"
  | "rejection"
  | "completion"
  | "message"
  | "other";

export type TimelineEvent = {
  type: TimelineEventType;
  label: string;
  timestamp: string;
};

const DOT_COLOR: Record<TimelineEventType, string> = {
  creation: "var(--text-secondary)",
  ai: "var(--chart-2)",
  status: "var(--accent)",
  assignment: "var(--accent)",
  rejection: "var(--danger)",
  completion: "var(--success)",
  message: "rgba(255,255,255,0.35)",
  other: "rgba(255,255,255,0.35)",
};

export function timelineEventColor(type: TimelineEventType) {
  return DOT_COLOR[type] ?? DOT_COLOR.other;
}

export type TicketTimelineProps = {
  events: TimelineEvent[];
  className?: string;
  title?: string;
};

export function TicketTimeline({ events, className, title = "Activity timeline" }: TicketTimelineProps) {
  if (!events.length) {
    return (
      <div className={cn("nx-card p-4", className)}>
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="mt-2 text-sm text-secondary">No events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className={cn("nx-card overflow-hidden p-4 md:p-5", className)}>
      <p className="mb-4 text-sm font-medium text-primary">{title}</p>
      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 touch-pan-x">
        <div className="relative min-w-max px-2 pt-1">
          <div className="absolute inset-x-2 top-[9px] h-px bg-white/15" aria-hidden />
          <div className="flex gap-6 md:gap-8">
            {events.map((event, index) => (
              <div
                key={`${event.label}-${event.timestamp}-${index}`}
                className="relative flex w-[100px] shrink-0 flex-col items-center text-center md:w-[112px]"
              >
                <span
                  className="relative z-10 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--card)]"
                  style={{ backgroundColor: timelineEventColor(event.type) }}
                />
                <p className="mt-3 line-clamp-2 text-xs font-medium leading-tight text-primary">{event.label}</p>
                <p className="mt-1 text-[11px] leading-tight text-secondary">{formatStamp(event.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
