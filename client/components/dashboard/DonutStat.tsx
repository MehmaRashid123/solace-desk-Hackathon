"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/cn";
import { theme } from "@/lib/theme";

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

export type DonutStatProps = {
  total: number;
  centerLabel: string;
  segments: DonutSegment[];
  className?: string;
};

const OUTER_RADIUS = 80;
const INNER_RADIUS = Math.round(OUTER_RADIUS * 0.6);

export function DonutStat({ total, centerLabel, segments, className }: DonutStatProps) {
  const visible = segments.filter((segment) => segment.value > 0);
  const chartData =
    visible.length > 0
      ? visible.map((segment) => ({ name: segment.label, value: segment.value, color: segment.color }))
      : [{ name: "Empty", value: 1, color: theme.cardBorder }];

  return (
    <div className={cn("w-full", className)}>
      <div className="relative mx-auto h-[180px] w-full max-w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={INNER_RADIUS}
              outerRadius={OUTER_RADIUS}
              stroke="none"
              paddingAngle={visible.length > 1 ? 2 : 0}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-2xl font-bold leading-none text-primary">{total}</p>
            <p className="mt-1 max-w-[7rem] text-[11px] leading-tight text-secondary">{centerLabel}</p>
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-2 px-1">
        {segments.map((segment) => {
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <li key={segment.label} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="inline-flex min-w-0 items-center gap-2 text-secondary">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-secondary">
                {segment.value}
                <span className="mx-1 text-white/20">·</span>
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
