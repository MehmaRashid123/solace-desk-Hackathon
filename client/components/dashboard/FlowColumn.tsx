"use client";

import { cn } from "@/lib/cn";

const PRESET_BORDER: Record<string, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
  chart: "var(--chart-2)",
  muted: "rgba(255,255,255,0.2)",
};

export type FlowRow = {
  label: string;
  count: number;
  color?: string;
};

export type FlowColumnProps = {
  title: string;
  items: FlowRow[];
  className?: string;
};

function borderColor(color?: string) {
  if (!color) return PRESET_BORDER.muted;
  return PRESET_BORDER[color] ?? color;
}

function FlowPill({ item }: { item: FlowRow }) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-pill border border-card bg-white/[0.03] px-3 py-2 text-sm border-l-[3px]"
      style={{ borderLeftColor: borderColor(item.color) }}
    >
      <span className="truncate text-primary/90">{item.label}</span>
      <span className="shrink-0 tabular-nums text-secondary">{item.count}</span>
    </div>
  );
}

export function FlowColumn({ title, items, className }: FlowColumnProps) {
  return (
    <div className={cn("min-w-[148px] shrink-0", className)}>
      <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-secondary">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <FlowPill key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}
