import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { Tooltip } from "../../ui/Tooltip";
import {
  monthGrid,
  parseISODate,
  isBetween,
  isSameDay,
  fmtDate,
  stripTime,
  fmtMonthLabel,
} from "../../../lib/construction/dateUtils";

const WEEK_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarView({ tasks, categories, milestones, onOpenTask }) {
  const [cursor, setCursor] = useState(() => {
    const t = stripTime(new Date());
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const categoryColor = useMemo(() => {
    const m = new Map();
    for (const c of categories) m.set(c.id, c.color);
    return m;
  }, [categories]);

  const today = stripTime(new Date());

  // Tareas activas por día.
  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const d of grid) map.set(d.getTime(), []);
    for (const t of tasks) {
      const s = t.planned_start ? parseISODate(t.planned_start) : null;
      const e = t.planned_end ? parseISODate(t.planned_end) : (s || null);
      if (!s) continue;
      for (const d of grid) {
        if (isBetween(d, s, e || s)) {
          map.get(d.getTime()).push(t);
        }
      }
    }
    return map;
  }, [tasks, grid]);

  const milestonesByDay = useMemo(() => {
    const map = new Map();
    for (const d of grid) map.set(d.getTime(), []);
    for (const ms of milestones) {
      const d = ms.date ? parseISODate(ms.date) : null;
      if (!d) continue;
      const key = stripTime(d).getTime();
      if (map.has(key)) map.get(key).push(ms);
    }
    return map;
  }, [milestones, grid]);

  const monthIdx = cursor.getMonth();

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="ml-1 text-xs text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100"
          >
            Hoy
          </button>
        </div>
        <h4 className="text-sm font-semibold text-stone-900 capitalize">
          {fmtMonthLabel(cursor)}
        </h4>
        <div className="w-16" />
      </div>

      <div className="grid grid-cols-7 border-b border-stone-100">
        {WEEK_HEADERS.map((d) => (
          <div
            key={d}
            className="text-[10px] uppercase tracking-wider text-stone-500 font-medium text-center py-1.5"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6">
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === monthIdx;
          const isToday = isSameDay(d, today);
          const dayTasks = tasksByDay.get(d.getTime()) || [];
          const dayMilestones = milestonesByDay.get(d.getTime()) || [];
          const visible = dayTasks.slice(0, 3);
          const extra = dayTasks.length - visible.length;
          return (
            <div
              key={i}
              className={`min-h-[88px] border-b border-r border-stone-100 p-1.5 flex flex-col gap-1 relative ${
                !inMonth ? "bg-stone-50/40 text-stone-400" : "bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`text-[11px] tabular-nums w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-stone-900 text-white font-semibold"
                      : inMonth
                      ? "text-stone-700"
                      : "text-stone-400"
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className="flex items-center gap-0.5">
                  {dayMilestones.map((m) => (
                    <Tooltip key={m.id} label={m.name}>
                      <span style={{ color: m.color }}>
                        <Flag className="w-3 h-3" />
                      </span>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                {visible.map((t) => {
                  const color = categoryColor.get(t.category_id) || "#a8a29e";
                  return (
                    <Tooltip
                      key={t.id}
                      label={`${t.name} · ${t.progress ?? 0}%`}
                    >
                      <button
                        onClick={() => onOpenTask?.(t.id)}
                        className="w-full text-left text-[10px] truncate rounded px-1.5 py-0.5 text-white shadow-sm"
                        style={{ background: color }}
                      >
                        {t.name}
                      </button>
                    </Tooltip>
                  );
                })}
                {extra > 0 && (
                  <Tooltip
                    label={dayTasks
                      .slice(3)
                      .map((t) => t.name)
                      .join(", ")}
                  >
                    <span className="text-[10px] text-stone-500 px-1.5 cursor-default">
                      +{extra} más
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/40 text-[11px] text-stone-500">
        {fmtDate(grid[0])} – {fmtDate(grid[grid.length - 1])}
      </div>
    </div>
  );
}
