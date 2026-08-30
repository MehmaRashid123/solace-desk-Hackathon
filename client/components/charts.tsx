import { cn } from "@/lib/cn";

function linePath(points: number[]) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const coords = points.map((value, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * 100;
    const y = 28 - ((value - min) / span) * 22;
    return { x, y };
  });
  const d = coords
    .map((point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      const prev = coords[i - 1];
      const cx = (prev.x + point.x) / 2;
      return `C ${cx} ${prev.y}, ${cx} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");
  return { d, last: coords[coords.length - 1] };
}

export function Sparkline({
  points,
  className,
  secondary,
}: {
  points: number[];
  className?: string;
  secondary?: number[];
}) {
  const primary = linePath(points);
  const next = secondary ? linePath(secondary) : null;
  const fillId = `af-${points.join("x").replace(/\./g, "")}`;
  return (
    <svg viewBox="0 0 100 32" className={cn("h-12 w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7A45" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FF3D1F" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${primary.d} L ${primary.last?.x ?? 100} 32 L 0 32 Z`} fill={`url(#${fillId})`} />
      <path d={primary.d} fill="none" stroke="#FF5722" strokeWidth="1.7" />
      {next ? <path d={next.d} fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="3 2" /> : null}
    </svg>
  );
}

export function Donut({
  slices,
  label,
  sub,
}: {
  slices: Array<{ value: number; color: string; name?: string }>;
  label: string;
  sub: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let offset = 0;
  const rings = slices.map((slice) => {
    const pct = slice.value / total;
    const dash = pct * 100;
    const item = { ...slice, dash, offset, pct };
    offset += dash;
    return item;
  });
  const named = slices.filter((slice) => slice.name);
  return (
    <div>
      <div className="relative grid h-36 place-items-center">
        <svg viewBox="0 0 36 36" className="h-36 w-36 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#1a1a1a" strokeWidth="5" />
          {rings.map((ring, i) => (
            <circle
              key={i}
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke={ring.color}
              strokeWidth="5"
              strokeDasharray={`${ring.dash} ${100 - ring.dash}`}
              strokeDashoffset={-ring.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute text-center">
          <p className="text-2xl font-semibold leading-none text-white">{label}</p>
          <p className="mt-1 text-[11px] text-muted">{sub}</p>
        </div>
      </div>
      {named.length > 0 ? (
        <div className="mt-1 space-y-1.5 px-1">
          {named.map((slice) => (
            <div key={slice.name} className="flex items-center justify-between text-[11px] text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: slice.color }} />
                {slice.name}
              </span>
              <span>
                {slice.value} / {Math.round((slice.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BarChart({
  bars,
}: {
  bars: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex h-40 items-end gap-1.5">
      {bars.map((bar) => (
        <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-muted">{bar.value}</span>
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full rounded-t-md accent-gradient"
              style={{ height: `${Math.max((bar.value / max) * 100, bar.value ? 8 : 2)}%` }}
            />
          </div>
          <span className="truncate text-[10px] text-muted">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

export function AreaTrend({
  points,
  badges,
}: {
  points: number[];
  badges?: Array<{ label: string; value: string }>;
}) {
  const primary = linePath(points.length ? points : [0]);
  const fillId = `area-${points.join("x").replace(/\./g, "")}`;
  return (
    <div className="relative">
      {badges?.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span key={badge.label} className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] text-accent">
              {badge.label} {badge.value}
            </span>
          ))}
        </div>
      ) : null}
      <svg viewBox="0 0 100 36" className="h-36 w-full" aria-hidden>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF7A45" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FF3D1F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${primary.d} L ${primary.last?.x ?? 100} 36 L 0 36 Z`} fill={`url(#${fillId})`} />
        <path d={primary.d} fill="none" stroke="#FF5722" strokeWidth="1.8" />
      </svg>
    </div>
  );
}
