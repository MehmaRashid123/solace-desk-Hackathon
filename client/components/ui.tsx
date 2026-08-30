import { APP_INITIAL } from "@/lib/brand";
import { cn } from "@/lib/cn";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export function Glass({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("glass", className)}>{children}</div>;
}

export function Avatar({ name, hue, size = "md" }: { name: string; hue: number; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-medium text-white", dim)}
      style={{ background: `linear-gradient(145deg, hsl(${hue} 70% 48%), hsl(${(hue + 40) % 360} 60% 32%))` }}
    >
      {initials}
    </div>
  );
}

const statusStyles: Record<TicketStatus, string> = {
  New: "bg-accent/15 text-accent ring-accent/25",
  PendingWorkerResponse: "bg-chart/15 text-violet-200 ring-chart/25",
  Accepted: "bg-chart/15 text-violet-200 ring-chart/25",
  InProgress: "bg-amber-400/15 text-amber-200 ring-amber-400/20",
  Completed: "bg-success/15 text-success ring-success/25",
  Rejected: "bg-danger/15 text-danger ring-danger/25",
  Cancelled: "bg-white/10 text-muted ring-white/15",
};

const priorityStyles: Record<TicketPriority, string> = {
  LOW: "text-muted",
  MEDIUM: "text-chart",
  HIGH: "text-danger",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1", statusStyles[status])}>
      {status.replace(/([a-z])([A-Z])/g, " $1 $2")}
    </span>
  );
}

const priorityChip: Record<TicketPriority, string> = {
  LOW: "bg-white/5 text-muted ring-white/10",
  MEDIUM: "bg-chart/15 text-violet-200 ring-chart/25",
  HIGH: "bg-danger/15 text-danger ring-danger/25",
};

export function PriorityDot({ priority }: { priority: TicketPriority | null }) {
  if (!priority) {
    return <span className="text-[11px] uppercase tracking-wide text-muted">Unreviewed</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide", priorityStyles[priority])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {priority}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: TicketPriority | null }) {
  if (!priority) {
    return (
      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted ring-1 ring-white/10">
        Unreviewed
      </span>
    );
  }
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1", priorityChip[priority])}>
      {priority}
    </span>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-surface2 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent/50",
        props.className,
      )}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-[0.16em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-surface2 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted/70 focus:border-accent/50",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-none rounded-2xl border border-white/10 bg-surface2 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted/70 focus:border-accent/50",
        props.className,
      )}
    />
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "pill" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "rounded-full bg-accent px-4 py-2.5 text-white hover:bg-accent-2",
        variant === "pill" && "rounded-full bg-accent px-5 py-2.5 text-white hover:bg-accent-2",
        variant === "ghost" && "rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-white/80 hover:bg-white/[0.07]",
        variant === "danger" && "rounded-full bg-danger px-4 py-2.5 text-white hover:bg-danger/90",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/[0.06] ring-1 ring-white/5", className)} />;
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Glass className="grid place-items-center px-6 py-12 text-center">
      <p className="font-medium text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {children}
    </Glass>
  );
}

export function LogoBadge({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-lg bg-accent text-sm font-bold text-white"
      style={{ width: size, height: size }}
    >
      {APP_INITIAL}
    </span>
  );
}
