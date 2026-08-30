"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/cn";

export type StatCardProps = {
  label: string;
  value: string | number;
  trendPercent?: number;
  trendDirection?: "up" | "down";
  /** When true, up = red and down = green (e.g. lower resolution time is better). */
  invertTrend?: boolean;
  sparklineData?: number[];
  className?: string;
};

function TrendBadge({
  trendPercent,
  trendDirection,
  invertTrend = false,
}: Pick<StatCardProps, "trendPercent" | "trendDirection" | "invertTrend">) {
  if (trendPercent === undefined || !trendDirection) return null;

  const isUp = trendDirection === "up";
  const good = invertTrend ? !isUp : isUp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium",
        good ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
      )}
    >
      {isUp ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
      {Math.abs(Math.round(trendPercent * 10) / 10)}%
    </span>
  );
}

function StatSparkline({ points }: { points: number[] }) {
  const data = points.map((value, index) => ({ index, value }));

  return (
    <div className="mt-4 h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatCard({
  label,
  value,
  trendPercent,
  trendDirection,
  invertTrend = false,
  sparklineData,
  className,
}: StatCardProps) {
  return (
    <div className={cn("nx-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] text-secondary">{label}</p>
        <TrendBadge trendPercent={trendPercent} trendDirection={trendDirection} invertTrend={invertTrend} />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-primary">{value}</p>
      {sparklineData?.length ? <StatSparkline points={sparklineData} /> : null}
    </div>
  );
}

export function trendFromPercent(percent?: number): "up" | "down" | undefined {
  if (percent === undefined || Number.isNaN(percent)) return undefined;
  if (percent === 0) return "up";
  return percent > 0 ? "up" : "down";
}
