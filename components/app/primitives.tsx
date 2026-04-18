import Link from "next/link";

export function PageTopbar({
  crumbs,
  actions,
}: {
  crumbs: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="flex justify-between items-center px-8 py-5 border-b border-[var(--line)] sticky top-0 z-10 backdrop-blur-md"
      style={{ background: "color-mix(in oklab, var(--background) 85%, transparent)" }}
    >
      <div className="text-[13px] text-[var(--mute)]">{crumbs}</div>
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex justify-between items-end gap-5 flex-wrap">
      <div>
        <h1 className="text-[38px] font-bold tracking-[-0.035em] leading-none m-0">{title}</h1>
        {sub && <p className="text-[var(--ink-2)] text-[15px] mt-2 m-0">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </div>
  );
}

export function Pill({
  variant = "ghost",
  children,
  href,
  onClick,
  type,
}: {
  variant?: "ink" | "accent" | "ghost";
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const cls =
    variant === "ink"
      ? "bg-[var(--ink)] text-[var(--background)] hover:bg-black"
      : variant === "accent"
      ? "bg-[var(--accent)] text-[var(--accent-2)]"
      : "border border-[var(--line)] bg-[var(--card)] hover:border-[var(--ink)]";
  const base =
    "px-3.5 py-2 rounded-full font-semibold text-[13px] inline-flex items-center gap-1.5 transition hover:-translate-y-px whitespace-nowrap";
  if (href) {
    return (
      <Link href={href} className={`${base} ${cls}`}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type || "button"} onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}

export function HeroCard({
  tag,
  title,
  desc,
  chip,
  emoji,
}: {
  tag?: React.ReactNode;
  title: React.ReactNode;
  desc?: React.ReactNode;
  chip?: React.ReactNode;
  emoji?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center mb-5"
      style={{
        background: "var(--ink)",
        color: "var(--background)",
        padding: "28px 32px",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.04,
        }}
      />
      {emoji && (
        <div
          className="absolute pointer-events-none select-none"
          style={{ right: -20, top: -30, fontSize: 200, opacity: 0.07 }}
        >
          {emoji}
        </div>
      )}
      <div className="relative">
        {tag && (
          <div className="inline-flex items-center gap-1.5 text-[var(--accent)] zt-mono text-[11px] tracking-[.08em] uppercase mb-2.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
              style={{ boxShadow: "0 0 8px var(--accent)" }}
            />
            {tag}
          </div>
        )}
        <h2 className="text-[28px] font-bold tracking-[-0.025em] leading-tight m-0 mb-1.5">{title}</h2>
        {desc && (
          <p className="text-[14px] m-0" style={{ color: "#ffffffaa" }}>
            {desc}
          </p>
        )}
      </div>
      {chip && <div className="relative">{chip}</div>}
    </div>
  );
}

export function NumChip({
  children,
  onCopy,
  copied,
}: {
  children: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div
      className="zt-mono text-[14px] rounded-[14px] flex items-center gap-2.5 relative"
      style={{
        background: "#ffffff10",
        border: "1px solid #ffffff1f",
        padding: "14px 18px",
      }}
    >
      {children}
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="text-[var(--accent)] font-bold cursor-pointer ml-1.5"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

export function Kpi({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string;
  value: React.ReactNode;
  trend?: React.ReactNode;
  trendUp?: boolean;
}) {
  return (
    <div className="border border-[var(--line)] rounded-[14px] bg-[var(--card)]" style={{ padding: "16px 18px" }}>
      <div className="text-[26px] font-bold tracking-[-0.025em] leading-none">{value}</div>
      <div className="text-[11.5px] text-[var(--mute)] mt-2 zt-mono uppercase tracking-[.06em]">{label}</div>
      {trend && (
        <div className="text-[11.5px] mt-1" style={{ color: trendUp ? "#1FAE4F" : "var(--mute)" }}>
          {trend}
        </div>
      )}
    </div>
  );
}

export function StatCard({
  emoji,
  label,
  value,
  sub,
}: {
  emoji?: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] p-5 relative">
      {emoji && (
        <div className="absolute top-3.5 right-4 w-8 h-8 rounded-[8px] bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center text-[14px]">
          {emoji}
        </div>
      )}
      <div className="zt-mono text-[11px] uppercase tracking-[.08em] text-[var(--mute)]">{label}</div>
      <div className="text-[34px] font-bold tracking-[-0.035em] leading-none mt-3">{value}</div>
      {sub && <div className="text-[12px] text-[var(--mute)] mt-1.5">{sub}</div>}
    </div>
  );
}

export function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--card)] border border-[var(--line)] rounded-[18px] ${className}`}
      style={{ padding: 22 }}
    >
      {(title || action) && (
        <div className="flex justify-between items-baseline gap-2.5 mb-4">
          <div>
            {title && <h3 className="text-[17px] m-0 mb-1 font-bold tracking-[-0.015em]">{title}</h3>}
            {sub && <p className="text-[12px] text-[var(--mute)] m-0">{sub}</p>}
          </div>
          {action && <div className="text-[12px] font-semibold border-b border-[var(--line)]">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatusPill({
  variant,
  children,
}: {
  variant: "ok" | "pending" | "cancel" | "active";
  children: React.ReactNode;
}) {
  const map = {
    ok: { bg: "color-mix(in oklab, #1FAE4F 18%, transparent)", color: "#1FAE4F" },
    pending: { bg: "color-mix(in oklab, #E89A1C 18%, transparent)", color: "#7a4a00" },
    cancel: { bg: "color-mix(in oklab, #D93A2E 15%, transparent)", color: "#D93A2E" },
    active: { bg: "var(--accent)", color: "var(--accent-2)" },
  } as const;
  const s = map[variant];
  return (
    <span
      className="zt-mono text-[10.5px] uppercase tracking-[.04em] rounded-full font-bold"
      style={{ padding: "3px 8px", background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

export function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`zt-mono text-[10px] uppercase tracking-[.09em] text-[var(--mute)] ${className}`}>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex p-1 bg-[var(--card)] border border-[var(--line)] rounded-full gap-0.5 mb-4">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={`px-4 py-2 rounded-full text-[13px] font-medium ${
            active === it.id ? "bg-[var(--ink)] text-[var(--background)] font-semibold" : "text-[var(--ink-2)]"
          }`}
        >
          {it.label}
          {typeof it.count === "number" && (
            <span
              className={`zt-mono text-[11px] ml-1.5 ${active === it.id ? "text-[var(--accent)]" : "text-[var(--mute)]"}`}
            >
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
