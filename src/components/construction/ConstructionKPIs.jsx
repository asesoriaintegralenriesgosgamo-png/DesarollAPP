import { TrendingUp, ListTodo, AlertTriangle, CalendarClock } from "lucide-react";
import { Progress } from "../ui/Progress";

function Tile({ icon: Icon, label, value, hint, tone = "stone", children }) {
  const toneCls = {
    stone:   "text-stone-700",
    emerald: "text-emerald-700",
    amber:   "text-amber-700",
    rose:    "text-rose-700",
  }[tone];
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3 md:p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
      {children}
      {hint && (
        <div className="text-[11px] text-stone-500">{hint}</div>
      )}
    </div>
  );
}

export function ConstructionKPIs({ avancePct, total, atrasadas, proximas }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
      <Tile
        icon={TrendingUp}
        label="Avance global"
        value={`${avancePct}%`}
        tone={avancePct >= 100 ? "emerald" : "stone"}
      >
        <Progress
          value={avancePct}
          tone={avancePct >= 100 ? "emerald" : "stone"}
          size="sm"
        />
      </Tile>
      <Tile
        icon={ListTodo}
        label="Tareas"
        value={total}
        hint={total === 1 ? "1 tarea en seguimiento" : `${total} tareas en seguimiento`}
      />
      <Tile
        icon={AlertTriangle}
        label="Atrasadas"
        value={atrasadas}
        tone={atrasadas > 0 ? "rose" : "stone"}
        hint={atrasadas === 0 ? "Todo al día" : atrasadas === 1 ? "1 tarea vencida" : `${atrasadas} tareas vencidas`}
      />
      <Tile
        icon={CalendarClock}
        label="Próximas 7 días"
        value={proximas}
        tone={proximas > 0 ? "amber" : "stone"}
        hint="Inician esta semana"
      />
    </div>
  );
}
