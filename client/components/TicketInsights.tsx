"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Ticket } from "@/lib/types";
import { dayBuckets, pctChange } from "@/lib/ticketDetail";
import { theme } from "@/lib/theme";
import { Glass } from "./ui";
import { cn } from "@/lib/cn";

export function TicketInsights({ tickets, compact = false }: { tickets: Ticket[]; compact?: boolean }) {
  const [days, setDays] = useState<7 | 30>(7);
  const buckets = useMemo(() => dayBuckets(tickets, days), [tickets, days]);
  const created = buckets.reduce((sum, b) => sum + b.count, 0);
  const prevCreated = useMemo(() => dayBuckets(tickets, days * 2).slice(0, days).reduce((sum, b) => sum + b.count, 0), [tickets, days]);
  const hours = buckets.map((b) => Number(b.avgHours.toFixed(1)));
  const avgNow = hours.reduce((a, b) => a + b, 0) / (hours.filter((h) => h > 0).length || 1);
  const prevHours = useMemo(() => {
    const prior = dayBuckets(tickets, days * 2).slice(0, days);
    const vals = prior.map((b) => b.avgHours);
    return vals.reduce((a, b) => a + b, 0) / (vals.filter((h) => h > 0).length || 1);
  }, [tickets, days]);
  const data = buckets.map((b) => ({
    label: b.label.replace(/^\w+ /, ""),
    tickets: b.count,
    hours: Number(b.avgHours.toFixed(1)),
  }));

  const chartHeight = compact ? "h-32" : "h-44";
  const areaHeight = compact ? "h-28" : "h-40";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Glass className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-white">Tickets per day</p>
            <p className="text-xs text-muted">{created} opened in this window</p>
          </div>
          <Range days={days} setDays={setDays} />
        </div>
        <div className={chartHeight}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke={theme.cardBorder} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: theme.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: theme.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 12, color: theme.textPrimary }}
              />
              <Bar dataKey="tickets" fill={theme.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Glass>
      <Glass className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-white">Resolution time trend</p>
            <p className="text-xs text-muted">Average hours to resolve · last {days} days</p>
          </div>
          <Range days={days} setDays={setDays} />
        </div>
        {compact ? null : (
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-pill bg-accent/15 px-2.5 py-0.5 text-[11px] text-accent">
              Volume {pctChange(created, prevCreated) >= 0 ? "+" : ""}
              {pctChange(created, prevCreated)}%
            </span>
            <span className="rounded-pill bg-accent/15 px-2.5 py-0.5 text-[11px] text-accent">
              Time {pctChange(avgNow, prevHours) >= 0 ? "+" : ""}
              {pctChange(avgNow, prevHours)}%
            </span>
          </div>
        )}
        <div className={areaHeight}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="resolveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.accentStart} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={theme.accentEnd} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={theme.cardBorder} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: theme.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: theme.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 12, color: theme.textPrimary }}
              />
              <Area type="monotone" dataKey="hours" stroke={theme.accent} fill="url(#resolveFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Glass>
    </div>
  );
}

function Range({ days, setDays }: { days: 7 | 30; setDays: (value: 7 | 30) => void }) {
  return (
    <div className="flex rounded-pill bg-white/[0.04] p-0.5">
      {([7, 30] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setDays(option)}
          className={cn("rounded-pill px-2.5 py-1 text-[11px]", days === option ? "bg-accent text-white" : "text-muted")}
        >
          {option}d
        </button>
      ))}
    </div>
  );
}
