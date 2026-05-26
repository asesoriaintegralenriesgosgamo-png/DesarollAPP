import { STATUS, STATUS_LABEL } from "../../lib/construction/status";

const STYLES = {
  [STATUS.PLANNED]:     "bg-stone-100 text-stone-700 border-stone-200",
  [STATUS.IN_PROGRESS]: "bg-blue-50 text-blue-700 border-blue-200",
  [STATUS.DONE]:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  [STATUS.AT_RISK]:     "bg-amber-50 text-amber-800 border-amber-200",
  [STATUS.DELAYED]:     "bg-rose-50 text-rose-800 border-rose-200",
};

export function StatusBadge({ status, size = "sm", className = "" }) {
  const cls = STYLES[status] || STYLES[STATUS.PLANNED];
  const sizeCls = size === "xs"
    ? "text-[10px] px-1.5 py-0.5"
    : "text-[11px] px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${cls} ${sizeCls} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full ${
          status === STATUS.DONE ? "bg-emerald-500" :
          status === STATUS.IN_PROGRESS ? "bg-blue-500" :
          status === STATUS.AT_RISK ? "bg-amber-500" :
          status === STATUS.DELAYED ? "bg-rose-500" :
          "bg-stone-400"
        }`}
      />
      {STATUS_LABEL[status] || "—"}
    </span>
  );
}
