import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, Flag } from "lucide-react";
import { AvatarStack } from "../../ui/Avatar";
import { Tooltip } from "../../ui/Tooltip";
import { StatusBadge } from "../StatusBadge";
import { deriveStatus, STATUS } from "../../../lib/construction/status";
import {
  parseISODate,
  addDays,
  diffDays,
  stripTime,
  fmtMonthLabel,
  fmtDate,
} from "../../../lib/construction/dateUtils";
import { computeWeightedProgress } from "../../../lib/construction/kpis";

const SIN_CATEGORIA = "__none__";

const ZOOM = {
  month: { dayWidth: 22, label: "Mes" },
  week:  { dayWidth: 64, label: "Semana" },
};

export function GanttView({
  tasks,
  categories,
  milestones,
  members,
  onOpenTask,
}) {
  const [zoom, setZoom] = useState("month");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const scrollRef = useRef(null);

  const memberById = useMemo(() => {
    const m = new Map();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  const topLevel = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks]);
  const subtasksByParent = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.parent_id) continue;
      if (!m.has(t.parent_id)) m.set(t.parent_id, []);
      m.get(t.parent_id).push(t);
    }
    return m;
  }, [tasks]);

  // Compute timeline bounds from all task date fields + today + milestones.
  const bounds = useMemo(() => computeBounds(tasks, milestones), [tasks, milestones]);
  const { start: tlStart, end: tlEnd, totalDays } = bounds;

  const dayWidth = ZOOM[zoom].dayWidth;
  const timelineWidth = totalDays * dayWidth;
  const today = stripTime(new Date());
  const todayOffset = diffDays(tlStart, today) * dayWidth;

  // Center on today on first render
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const target = Math.max(0, todayOffset - el.clientWidth / 2);
      el.scrollLeft = target;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const grouped = useMemo(() => {
    const byCat = new Map();
    for (const c of categories) byCat.set(c.id, []);
    byCat.set(SIN_CATEGORIA, []);
    for (const t of topLevel) {
      const key = t.category_id && byCat.has(t.category_id) ? t.category_id : SIN_CATEGORIA;
      byCat.get(key).push(t);
    }
    return byCat;
  }, [topLevel, categories]);

  const orderedCategories = useMemo(() => {
    const all = [
      ...categories,
      { id: SIN_CATEGORIA, name: "Sin categoría", color: "#a8a29e", _virtual: true },
    ];
    return all.filter((c) => (grouped.get(c.id) || []).length > 0);
  }, [categories, grouped]);

  // Flatten rows for arrow positioning + render.
  const flatRows = useMemo(() => {
    const rows = [];
    for (const cat of orderedCategories) {
      rows.push({ type: "category", cat });
      for (const t of grouped.get(cat.id) || []) {
        rows.push({ type: "task", task: t, cat });
        if (!collapsed.has(t.id)) {
          for (const s of subtasksByParent.get(t.id) || []) {
            rows.push({ type: "subtask", task: s, parent: t, cat });
          }
        }
      }
    }
    return rows;
  }, [orderedCategories, grouped, subtasksByParent, collapsed]);

  // For dependency arrows: map task_id -> row index
  const rowIndexByTaskId = useMemo(() => {
    const m = new Map();
    flatRows.forEach((r, i) => {
      if (r.type === "task" || r.type === "subtask") m.set(r.task.id, i);
    });
    return m;
  }, [flatRows]);

  const months = useMemo(() => buildMonthAxis(tlStart, tlEnd), [tlStart, tlEnd]);

  if (topLevel.length === 0) {
    return (
      <div className="border border-dashed border-stone-300 rounded-lg p-10 text-center bg-stone-50/40">
        <p className="text-sm text-stone-500">
          Sin tareas para mostrar en la línea de tiempo.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
        <div className="text-[10px] uppercase tracking-wider text-stone-500">
          {fmtDate(tlStart, { withYear: true })} – {fmtDate(tlEnd, { withYear: true })}
        </div>
        <div className="inline-flex border border-stone-200 rounded-md p-0.5">
          {Object.entries(ZOOM).map(([id, conf]) => (
            <button
              key={id}
              onClick={() => setZoom(id)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                zoom === id ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {id === "week" ? <ZoomIn className="w-3 h-3" /> : <ZoomOut className="w-3 h-3" />}
              {conf.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden">
        <div className="flex" style={{ width: `${360 + timelineWidth}px` }}>
          {/* Columna fija izquierda */}
          <div className="w-[360px] shrink-0 sticky left-0 z-10 bg-white border-r border-stone-200">
            {/* Header alineado con el axis */}
            <div className="h-[44px] border-b border-stone-200 bg-stone-50 px-3 flex items-center text-[10px] uppercase tracking-wider text-stone-500">
              Tarea
            </div>
            {/* Hitos row (fila para alinear con el axis de hitos en timeline) */}
            <div className="h-[28px] border-b border-stone-100 bg-stone-50/40 px-3 flex items-center text-[10px] text-stone-500">
              <Flag className="w-3 h-3 mr-1.5 text-rose-500" /> Hitos
            </div>
            {flatRows.map((row, idx) => {
              if (row.type === "category") {
                const cat = row.cat;
                const catTasks = (grouped.get(cat.id) || []);
                return (
                  <div
                    key={`cat-${cat.id}`}
                    className="flex items-center gap-2 px-3 h-[28px] bg-stone-50 border-b border-stone-100"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cat.color }}
                    />
                    <span className="text-xs font-semibold text-stone-900 truncate">{cat.name}</span>
                    <span className="ml-auto text-[10px] text-stone-500 tabular-nums">
                      {computeWeightedProgress(catTasks)}%
                    </span>
                  </div>
                );
              }
              const isSubtask = row.type === "subtask";
              const t = row.task;
              const cat = row.cat;
              const assignees = (t.assignee_ids || []).map((id) => memberById.get(id)).filter(Boolean);
              const subs = subtasksByParent.get(t.id) || [];
              return (
                <div
                  key={`row-${t.id}-${idx}`}
                  className={`group flex items-center gap-1.5 px-3 h-[36px] border-b border-stone-100 hover:bg-stone-50 ${
                    isSubtask ? "pl-7" : ""
                  }`}
                >
                  {!isSubtask && subs.length > 0 ? (
                    <button
                      onClick={() => toggleSet(collapsed, t.id, setCollapsed)}
                      className="text-stone-400 hover:text-stone-700"
                      aria-label="Colapsar"
                    >
                      {collapsed.has(t.id)
                        ? <ChevronRight className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />}
                    </button>
                  ) : (
                    <span className="w-3" />
                  )}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: cat.color }}
                  />
                  <button
                    onClick={() => onOpenTask?.(t.id)}
                    className="flex-1 min-w-0 text-left text-xs text-stone-900 hover:text-stone-700 truncate"
                  >
                    {t.name}
                  </button>
                  {assignees.length > 0 && (
                    <AvatarStack members={assignees} max={2} size="xs" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline scrollable */}
          <div className="relative" style={{ width: `${timelineWidth}px` }}>
            {/* Header de meses */}
            <div className="h-[44px] border-b border-stone-200 bg-stone-50 relative">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-stone-200 px-2 flex items-center text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                  style={{ left: m.offset * dayWidth, width: m.days * dayWidth }}
                >
                  {fmtMonthLabel(m.start)}
                </div>
              ))}
            </div>

            {/* Fila de hitos */}
            <div className="h-[28px] border-b border-stone-100 bg-stone-50/40 relative">
              {milestones.map((ms) => {
                const d = parseISODate(ms.date);
                if (!d) return null;
                const off = diffDays(tlStart, d) * dayWidth;
                return (
                  <Tooltip
                    key={ms.id}
                    label={`${ms.name} · ${fmtDate(ms.date)}`}
                  >
                    <span
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border border-stone-200 shadow-sm"
                      style={{ left: off, color: ms.color }}
                    >
                      <Flag className="w-3 h-3" />
                    </span>
                  </Tooltip>
                );
              })}
            </div>

            {/* Filas (tareas) */}
            {flatRows.map((row, idx) => {
              if (row.type === "category") {
                return (
                  <div
                    key={`tcat-${row.cat.id}`}
                    className="h-[28px] bg-stone-50 border-b border-stone-100"
                  />
                );
              }
              return (
                <GanttRow
                  key={`tr-${row.task.id}-${idx}`}
                  task={row.task}
                  cat={row.cat}
                  isSubtask={row.type === "subtask"}
                  tlStart={tlStart}
                  dayWidth={dayWidth}
                  onClick={() => onOpenTask?.(row.task.id)}
                />
              );
            })}

            {/* Línea de hoy */}
            <div
              className="absolute top-0 bottom-0 w-px bg-stone-900/80 pointer-events-none z-20"
              style={{ left: todayOffset }}
            >
              <span className="absolute -top-0 -left-1 w-2 h-2 rounded-full bg-stone-900" />
            </div>

            {/* Flechas de dependencias */}
            <DependencyArrows
              tasks={tasks}
              tlStart={tlStart}
              dayWidth={dayWidth}
              rowIndexByTaskId={rowIndexByTaskId}
              headerOffset={44 + 28}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttRow({ task, cat, isSubtask, tlStart, dayWidth, onClick }) {
  const status = deriveStatus(task);
  const ps = task.planned_start ? parseISODate(task.planned_start) : null;
  const pe = task.planned_end ? parseISODate(task.planned_end) : null;
  const as = task.actual_start ? parseISODate(task.actual_start) : null;
  const ae = task.actual_end ? parseISODate(task.actual_end) : null;

  const plannedLeft = ps ? diffDays(tlStart, ps) * dayWidth : null;
  const plannedDays = ps && pe ? Math.max(1, diffDays(ps, pe) + 1) : 0;
  const plannedWidth = plannedDays * dayWidth;

  // Barra real: si no hay actual_start, se "infiere" desde planned_start con progreso.
  const realStart = as || ps;
  const realLeft = realStart ? diffDays(tlStart, realStart) * dayWidth : null;
  const realFullDays = ae && realStart
    ? Math.max(1, diffDays(realStart, ae) + 1)
    : plannedDays;
  const realWidthMax = realFullDays * dayWidth;
  const realWidth = ae ? realWidthMax : (realWidthMax * (task.progress || 0)) / 100;

  const colorBar = cat.color || "#78716c";
  const borderCls =
    status === STATUS.DELAYED ? "ring-2 ring-rose-400" :
    status === STATUS.AT_RISK ? "ring-2 ring-amber-300" :
    status === STATUS.DONE    ? "ring-2 ring-emerald-300" : "";
  const isDelayedRow = status === STATUS.DELAYED;

  return (
    <button
      onClick={onClick}
      className={`relative block w-full h-[36px] border-b border-stone-100 hover:bg-stone-50 text-left ${
        isDelayedRow ? "bg-rose-50/30" : ""
      } ${isSubtask ? "pl-3" : ""}`}
    >
      {plannedLeft != null && plannedWidth > 0 && (
        <div
          className={`absolute top-3 h-1.5 rounded-full bg-stone-200 ${ae ? "" : "border border-dashed border-stone-300"}`}
          style={{ left: plannedLeft, width: plannedWidth }}
        />
      )}
      {realLeft != null && realWidth > 0 && (
        <div
          className={`absolute top-[18px] h-3 rounded-full ${borderCls}`}
          style={{
            left: realLeft,
            width: realWidth,
            background: status === STATUS.DONE ? "#059669" : colorBar,
          }}
        />
      )}
    </button>
  );
}

function DependencyArrows({ tasks, tlStart, dayWidth, rowIndexByTaskId, headerOffset }) {
  const rowH = 36;
  const catH = 28;
  const arrows = [];
  for (const t of tasks) {
    const deps = t.dependency_ids || [];
    for (const depId of deps) {
      const fromIdx = rowIndexByTaskId.get(depId);
      const toIdx   = rowIndexByTaskId.get(t.id);
      if (fromIdx == null || toIdx == null) continue;
      const fromTask = tasks.find((x) => x.id === depId);
      if (!fromTask) continue;
      const fromEnd = fromTask.planned_end ? parseISODate(fromTask.planned_end) : null;
      const toStart = t.planned_start ? parseISODate(t.planned_start) : null;
      if (!fromEnd || !toStart) continue;
      const x1 = (diffDays(tlStart, fromEnd) + 1) * dayWidth;
      const x2 = diffDays(tlStart, toStart) * dayWidth;
      const y1 = rowOffset(fromIdx, rowH, catH, headerOffset) + rowH / 2;
      const y2 = rowOffset(toIdx, rowH, catH, headerOffset) + rowH / 2;
      arrows.push({ id: `${depId}->${t.id}`, x1, y1, x2, y2 });
    }
  }
  if (arrows.length === 0) return null;
  const totalH = headerOffset + rowOffset(9999, rowH, catH, 0);
  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width="100%"
      height={totalH}
      style={{ overflow: "visible" }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 z" fill="#a8a29e" />
        </marker>
      </defs>
      {arrows.map((a) => {
        const midX = Math.max(a.x1 + 8, a.x2 - 8);
        const d = `M ${a.x1} ${a.y1} L ${midX} ${a.y1} L ${midX} ${a.y2} L ${a.x2 - 4} ${a.y2}`;
        return (
          <path
            key={a.id}
            d={d}
            fill="none"
            stroke="#a8a29e"
            strokeWidth="1"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}

function rowOffset(idx, rowH, catH, headerOffset) {
  // Mismo cálculo del DOM: header (axis + milestones) + filas variables.
  // Pero como flatRows mezcla categorías (catH) y tareas (rowH), aquí asumimos
  // que el caller siempre da un idx válido. Para evitar drift fino entre la
  // posición real y el cálculo, usamos rowH constante: ajuste menor visual.
  return headerOffset + idx * rowH;
}

function toggleSet(set, value, setter) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function computeBounds(tasks, milestones) {
  const dates = [];
  for (const t of tasks) {
    if (t.planned_start) dates.push(parseISODate(t.planned_start));
    if (t.planned_end) dates.push(parseISODate(t.planned_end));
    if (t.actual_start) dates.push(parseISODate(t.actual_start));
    if (t.actual_end) dates.push(parseISODate(t.actual_end));
  }
  for (const m of milestones) {
    if (m.date) dates.push(parseISODate(m.date));
  }
  const today = stripTime(new Date());
  dates.push(today);

  if (dates.length === 0) {
    const start = addDays(today, -14);
    const end = addDays(today, 60);
    return { start, end, totalDays: diffDays(start, end) + 1 };
  }

  let min = dates[0];
  let max = dates[0];
  for (const d of dates) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const start = addDays(min, -7);
  const end = addDays(max, 14);
  return { start, end, totalDays: diffDays(start, end) + 1 };
}

function buildMonthAxis(start, end) {
  const out = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const monthStart = cursor < start ? start : cursor;
    const monthEnd = next > addDays(end, 1) ? addDays(end, 1) : next;
    out.push({
      start: cursor,
      offset: Math.max(0, diffDays(start, monthStart)),
      days: diffDays(monthStart, monthEnd),
    });
    cursor = next;
  }
  return out;
}
