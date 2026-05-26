const TONES = {
  stone:   { bar: "bg-stone-900",   track: "bg-stone-200",   ring: "stroke-stone-900"   },
  emerald: { bar: "bg-emerald-600", track: "bg-emerald-100", ring: "stroke-emerald-600" },
  amber:   { bar: "bg-amber-500",   track: "bg-amber-100",   ring: "stroke-amber-500"   },
  rose:    { bar: "bg-rose-600",    track: "bg-rose-100",    ring: "stroke-rose-600"    },
};

const HEIGHTS = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export function Progress({ value = 0, tone = "stone", size = "md", className = "" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const t = TONES[tone] || TONES.stone;
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full ${HEIGHTS[size]} rounded-full overflow-hidden ${t.track} ${className}`}
    >
      <div
        className={`h-full ${t.bar} transition-[width] duration-300 ease-out rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProgressRing({ value = 0, size = 36, stroke = 4, tone = "stone", className = "" }) {
  const pct = Math.max(0, Math.min(100, value));
  const t = TONES[tone] || TONES.stone;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`${Math.round(pct)}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="stroke-stone-200"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className={t.ring}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 300ms ease-out" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-stone-700 tabular-nums"
        style={{ fontSize: size * 0.32, fontWeight: 600 }}
      >
        {Math.round(pct)}
      </text>
    </svg>
  );
}
