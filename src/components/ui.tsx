import type { ReactNode } from "react";
import { formatMoney, formatNumber } from "@/lib/format";

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`${glow ? "panel" : "panel"} ${className}`}>{children}</div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-8 place-items-center rounded-[10px] border border-white/10 bg-white/[0.05] text-cyan-200">
            {icon}
          </span>
        ) : null}
        <div>
          <h3 className="text-[13.5px] font-semibold tracking-tight text-white/90">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/40">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-[26px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/45">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  accent = "cyan",
  spark,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  icon?: ReactNode;
  accent?: "cyan" | "pink" | "violet" | "amber" | "emerald";
  spark?: number[];
}) {
  const accents: Record<string, string> = {
    cyan: "#25f4ee",
    pink: "#fe2c55",
    violet: "#8b5cf6",
    amber: "#f5b642",
    emerald: "#34d399",
  };
  const color = accents[accent] ?? accents.cyan;
  return (
    <div className="panel group relative overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-[0.16] blur-2xl transition group-hover:opacity-30"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
        {icon ? (
          <span className="grid size-7 place-items-center rounded-lg border border-white/10 bg-white/[0.05]" style={{ color }}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="relative mt-3 text-[26px] font-bold leading-none tracking-[-0.03em] text-white [font-variant-numeric:tabular-nums]">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <div className="relative mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/40">{hint ?? "—"}</p>
        {delta ? (
          <span
            className="chip !border-0 !py-0.5"
            style={{ color, background: `${color}1a` }}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {spark && spark.length > 1 ? <Sparkline values={spark} color={color} /> : null}
    </div>
  );
}

export function Sparkline({
  values,
  color = "#25f4ee",
  height = 32,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="mt-2 h-8 w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <polygon points={`0,${height} ${points} 100,${height}`} fill={color} opacity="0.1" />
    </svg>
  );
}

type BadgeTone = "cyan" | "pink" | "violet" | "amber" | "emerald" | "slate";

const badgeTones: Record<BadgeTone, string> = {
  cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  pink: "border-pink-400/30 bg-pink-500/10 text-pink-200",
  violet: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  amber: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
  slate: "border-white/12 bg-white/5 text-white/60",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(value: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    active: "emerald",
    live: "pink",
    online: "emerald",
    integrated: "emerald",
    open: "cyan",
    applied: "amber",
    negotiating: "amber",
    contacted: "cyan",
    signed: "emerald",
    won: "emerald",
    paid: "emerald",
    pending: "amber",
    lost: "slate",
    archived: "slate",
    offline: "slate",
    planned: "violet",
    ended: "slate",
    onboarding: "violet",
    pending_review: "amber",
  };
  return map[value] ?? "slate";
}

export function Progress({
  value,
  max = 100,
  tone = "gradient",
  height = 8,
}: {
  value: number;
  max?: number;
  tone?: "gradient" | "cyan" | "pink" | "emerald";
  height?: number;
}) {
  const percent = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const backgrounds: Record<string, string> = {
    gradient: "linear-gradient(90deg,#25f4ee,#8b5cf6,#fe2c55)",
    cyan: "#25f4ee",
    pink: "#fe2c55",
    emerald: "#34d399",
  };
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-white/10"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${percent}%`, background: backgrounds[tone] }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-200/80">
        {icon ?? "✳"}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-white/85">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-white/40">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Money({ value, currency = "TRY" }: { value: number; currency?: string }) {
  return <span className="[font-variant-numeric:tabular-nums]">{formatMoney(value, currency)}</span>;
}

export function MiniBars({ values, accent = "#25f4ee" }: { values: number[]; accent?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-16 items-end gap-1.5">
      {values.map((value, index) => (
        <div
          key={index}
          className="flex-1 rounded-t-[3px] transition-all duration-500 hover:opacity-100"
          style={{
            height: `${Math.max(6, (value / max) * 100)}%`,
            background: `linear-gradient(180deg, ${accent}, ${accent}22)`,
            opacity: 0.55 + (index / values.length) * 0.45,
          }}
          title={formatNumber(value)}
        />
      ))}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2.5 last:border-0">
      <span className="text-[12px] text-white/45">{label}</span>
      <span className="text-[12.5px] font-semibold text-white/85">{value}</span>
    </div>
  );
}
