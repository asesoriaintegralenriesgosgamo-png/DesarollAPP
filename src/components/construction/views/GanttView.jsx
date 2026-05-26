import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Flag,
  Maximize2,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AvatarStack } from "../../ui/Avatar";
import { Tooltip } from "../../ui/Tooltip";
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
import {
  getNonWorkingDaysInRange,
  NON_WORKING_TYPE,
} from "../../../lib/construction/holidays";

const SIN_CATEGORIA = "__none__";

const MIN_DAY_WIDTH = 6;
const MAX_DAY_WIDTH = 90;
const DEFAULT_DAY_WIDTH = 22;
const ZOOM_STEP = 1.25;

const HEADER_H = 44;
const MILESTONES_H = 28;
const HEADER_OFFSET = HEADER_H + MILESTONES_H;
const LEFT_PANE_W = 360;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function zoomLabel(dayWidth) {
  if (dayWidth >= 56) return "Día";
  if (dayWidth >= 28) return "Semana";
  if (dayWidth >= 14) return "Mes";
  return "Trimestre";
}

export function GanttView({
  tasks,
  categories,
  milestones,
  members,
  onOpenTask,
  onReorderCategories,
  onReorderTasksInCategory,
  onMoveTaskToCategory,
}) {
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const scrollRef = useRef(null);
  const didCenterRef = useRef(false);

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

  const bounds = useMemo(() => computeBounds(tasks, milestones), [tasks, milestones]);
  const { start: tlStart, end: tlEnd, totalDays } = bounds;

  const timelineWidth = totalDays * dayWidth;
  const today = stripTime(new Date());
  const todayOffset = diffDays(tlStart, today) * dayWidth;

  // Centramos en hoy únicamente en el primer render.
  useEffect(() => {
    if (didCenterRef.current) return;
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const target = Math.max(0, todayOffset - el.clientWidth / 2);
    el.scrollLeft = target;
    didCenterRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return all.filter((c) => !c._virtual || (grouped.get(c.id) || []).length > 0);
  }, [categories, grouped]);

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

  const rowIndexByTaskId = useMemo(() => {
    const m = new Map();
    flatRows.forEach((r, i) => {
      if (r.type === "task" || r.type === "subtask") m.set(r.task.id, i);
    });
    return m;
  }, [flatRows]);

  const months = useMemo(() => buildMonthAxis(tlStart, tlEnd), [tlStart, tlEnd]);

  // Sombreado de días inhábiles (fines de semana + feriados LFT + costumbre).
  const nonWorkingBands = useMemo(() => {
    const map = getNonWorkingDaysInRange(tlStart, tlEnd);
    const bands = [];
    for (const [iso, info] of map) {
      const d = parseISODate(iso);
      if (!d) continue;
      bands.push({
        iso,
        type: info.type,
        name: info.name,
        offset: diffDays(tlStart, d),
      });
    }
    bands.sort((a, b) => a.offset - b.offset);
    return bands;
  }, [tlStart, tlEnd]);

  // ---------- Zoom ----------
  const setZoomAroundClientX = useCallback(
    (nextDayWidth, clientX) => {
      const el = scrollRef.current;
      if (!el) {
        setDayWidth(nextDayWidth);
        return;
      }
      const rect = el.getBoundingClientRect();
      const cursorX = clientX != null ? clientX - rect.left : el.clientWidth / 2;
      const anchorDays = (el.scrollLeft + cursorX) / dayWidth;
      setDayWidth(nextDayWidth);
      // Después de re-render, ajusta scroll para preservar el día bajo el cursor.
      requestAnimationFrame(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollLeft = anchorDays * nextDayWidth - cursorX;
      });
    },
    [dayWidth]
  );

  const handleZoomIn = () =>
    setZoomAroundClientX(clamp(dayWidth * ZOOM_STEP, MIN_DAY_WIDTH, MAX_DAY_WIDTH));
  const handleZoomOut = () =>
    setZoomAroundClientX(clamp(dayWidth / ZOOM_STEP, MIN_DAY_WIDTH, MAX_DAY_WIDTH));
  const handleZoomFit = () => {
    const el = scrollRef.current;
    if (!el) return;
    const avail = Math.max(200, el.clientWidth - 8);
    const next = clamp(avail / totalDays, MIN_DAY_WIDTH, MAX_DAY_WIDTH);
    setDayWidth(next);
  };

  // Ctrl/⌘ + wheel (incluye pinch de trackpad macOS).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.01);
      const next = clamp(dayWidth * factor, MIN_DAY_WIDTH, MAX_DAY_WIDTH);
      if (Math.abs(next - dayWidth) < 0.01) return;
      setZoomAroundClientX(next, e.clientX);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [dayWidth, setZoomAroundClientX]);

  // ---------- DnD ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const realCategoryIds = useMemo(
    () => orderedCategories.filter((c) => !c._virtual).map((c) => c.id),
    [orderedCategories]
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "category" && overData?.type === "category") {
      const oldIdx = realCategoryIds.indexOf(active.id);
      const newIdx = realCategoryIds.indexOf(over.id);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const next = arrayMove(realCategoryIds, oldIdx, newIdx);
      onReorderCategories?.(next);
      return;
    }

    if (activeData?.type === "task") {
      const sourceCat = activeData.categoryId;
      let targetCat;
      let overIdx;
      if (overData?.type === "task") {
        targetCat = overData.categoryId;
        const arr = grouped.get(targetCat) || [];
        overIdx = arr.findIndex((t) => t.id === over.id);
      } else if (overData?.type === "category") {
        targetCat = over.id;
        overIdx = (grouped.get(targetCat) || []).length;
      } else {
        return;
      }

      if (sourceCat === targetCat) {
        const arr = grouped.get(sourceCat) || [];
        const oldIdx = arr.findIndex((t) => t.id === active.id);
        if (oldIdx < 0 || overIdx < 0 || oldIdx === overIdx) return;
        const next = arrayMove(arr, oldIdx, overIdx).map((t) => t.id);
        onReorderTasksInCategory?.(sourceCat, next);
      } else {
        onMoveTaskToCategory?.(active.id, targetCat, overIdx >= 0 ? overIdx : 0);
      }
    }
  };

  if (topLevel.length === 0 && categories.length === 0) {
    return (
      <div className="border border-dashed border-stone-300 rounded-lg p-10 text-center bg-stone-50/40">
        <p className="text-sm text-stone-500">Sin categorías ni tareas para mostrar.</p>
      </div>
    );
  }

  const hasOnlyCategories = topLevel.length === 0 && categories.length > 0;

  // Estilos de grilla CSS: línea de día punteada + línea de semana sólida.
  // Alineamos las semanas al lunes más cercano antes de tlStart.
  const tlStartDow = (tlStart.getDay() + 6) % 7; // 0=lunes
  const weekOffsetPx = -tlStartDow * dayWidth;
  const dayGradient = `repeating-linear-gradient(to right, rgba(120,113,108,0.10) 0 1px, transparent 1px ${dayWidth}px)`;
  const weekGradient = `repeating-linear-gradient(to right, rgba(120,113,108,0.30) 0 1px, transparent 1px ${dayWidth * 7}px)`;

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
        <div className="text-[10px] uppercase tracking-wider text-stone-500">
          {fmtDate(tlStart, { withYear: true })} – {fmtDate(tlEnd, { withYear: true })}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-stone-500">
            <LegendChip type={NON_WORKING_TYPE.WEEKEND} label="Fin de semana" />
            <LegendChip type={NON_WORKING_TYPE.LFT} label="Feriado LFT" />
            <LegendChip type={NON_WORKING_TYPE.CUSTOM} label="Costumbre" />
          </div>
          <div className="inline-flex items-center border border-stone-200 rounded-md p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={dayWidth <= MIN_DAY_WIDTH + 0.5}
              className="inline-flex items-center justify-center w-6 h-6 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-30"
              title="Reducir zoom"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="px-2 text-[11px] font-medium text-stone-600 tabular-nums w-20 text-center">
              {zoomLabel(dayWidth)} · {Math.round(dayWidth)}px
            </span>
            <button
              onClick={handleZoomIn}
              disabled={dayWidth >= MAX_DAY_WIDTH - 0.5}
              className="inline-flex items-center justify-center w-6 h-6 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-30"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={handleZoomFit}
              className="inline-flex items-center justify-center w-6 h-6 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              title="Ajustar al ancho"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {hasOnlyCategories && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-900">
          Aún no hay tareas. Usa <span className="font-semibold">+ Tarea</span> en la barra para crear una en alguna categoría.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={realCategoryIds} strategy={verticalListSortingStrategy}>
          <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden">
            <div className="flex" style={{ width: `${LEFT_PANE_W + timelineWidth}px` }}>
              {/* Columna fija izquierda */}
              <div className="w-[360px] shrink-0 sticky left-0 z-10 bg-white border-r border-stone-200">
                <div className="h-[44px] border-b border-stone-200 bg-stone-50 px-3 flex items-center text-[10px] uppercase tracking-wider text-stone-500">
                  Tarea
                </div>
                <div className="h-[28px] border-b border-stone-100 bg-stone-50/40 px-3 flex items-center text-[10px] text-stone-500">
                  <Flag className="w-3 h-3 mr-1.5 text-rose-500" /> Hitos
                </div>
                <LeftPane
                  orderedCategories={orderedCategories}
                  grouped={grouped}
                  subtasksByParent={subtasksByParent}
                  memberById={memberById}
                  collapsed={collapsed}
                  setCollapsed={setCollapsed}
                  onOpenTask={onOpenTask}
                />
              </div>

              {/* Timeline scrollable */}
              <div className="relative" style={{ width: `${timelineWidth}px` }}>
                {/* Header de meses */}
                <div className="h-[44px] border-b border-stone-200 bg-stone-50 relative z-20">
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
                <div className="h-[28px] border-b border-stone-100 bg-stone-50/40 relative z-20">
                  {milestones.map((ms) => {
                    const d = parseISODate(ms.date);
                    if (!d) return null;
                    const off = diffDays(tlStart, d) * dayWidth;
                    return (
                      <Tooltip key={ms.id} label={`${ms.name} · ${fmtDate(ms.date)}`}>
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

                {/* Capa de grilla (día + semana) — detrás de las filas */}
                <div
                  className="absolute left-0 right-0 pointer-events-none z-0"
                  style={{
                    top: HEADER_OFFSET,
                    bottom: 0,
                    backgroundImage: `${weekGradient}, ${dayGradient}`,
                    backgroundPosition: `${weekOffsetPx}px 0, 0 0`,
                  }}
                />

                {/* Capa de sombreado de días inhábiles */}
                <div
                  className="absolute left-0 right-0 pointer-events-none z-0"
                  style={{ top: HEADER_OFFSET, bottom: 0 }}
                >
                  {nonWorkingBands.map((b) => (
                    <NonWorkingBand key={b.iso} band={b} dayWidth={dayWidth} />
                  ))}
                </div>

                {/* Filas (tareas) */}
                {orderedCategories.map((cat) => (
                  <TimelineCategoryBlock
                    key={`tcat-${cat.id}`}
                    cat={cat}
                    tasks={grouped.get(cat.id) || []}
                    subtasksByParent={subtasksByParent}
                    collapsed={collapsed}
                    tlStart={tlStart}
                    dayWidth={dayWidth}
                    onOpenTask={onOpenTask}
                  />
                ))}

                {/* Línea de hoy */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-stone-900/80 pointer-events-none z-30"
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
                  headerOffset={HEADER_OFFSET}
                />
              </div>
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function LeftPane({
  orderedCategories,
  grouped,
  subtasksByParent,
  memberById,
  collapsed,
  setCollapsed,
  onOpenTask,
}) {
  return (
    <>
      {orderedCategories.map((cat) => {
        const catTasks = grouped.get(cat.id) || [];
        return (
          <SortableCategoryRow
            key={`cat-${cat.id}`}
            cat={cat}
            catTasks={catTasks}
            subtasksByParent={subtasksByParent}
            memberById={memberById}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            onOpenTask={onOpenTask}
          />
        );
      })}
    </>
  );
}

function SortableCategoryRow({
  cat,
  catTasks,
  subtasksByParent,
  memberById,
  collapsed,
  setCollapsed,
  onOpenTask,
}) {
  const isVirtual = !!cat._virtual;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cat.id,
    data: { type: "category" },
    disabled: isVirtual,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center gap-2 px-3 h-[28px] bg-stone-50 border-b border-stone-100 ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        {!isVirtual ? (
          <button
            {...attributes}
            {...listeners}
            className="text-stone-300 hover:text-stone-600 cursor-grab active:cursor-grabbing -ml-1"
            title="Arrastra para reordenar categoría"
            aria-label="Reordenar categoría"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: cat.color }}
        />
        <span className="text-xs font-semibold text-stone-900 truncate">{cat.name}</span>
        <span className="ml-auto text-[10px] text-stone-500 tabular-nums">
          {computeWeightedProgress(catTasks)}%
        </span>
      </div>

      <SortableContext
        items={catTasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {catTasks.map((t) => {
          const subs = subtasksByParent.get(t.id) || [];
          return (
            <SortableTaskRow
              key={`row-${t.id}`}
              task={t}
              cat={cat}
              assignees={(t.assignee_ids || [])
                .map((id) => memberById.get(id))
                .filter(Boolean)}
              subs={subs}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              onOpenTask={onOpenTask}
              renderSubtasks={!collapsed.has(t.id) ? subs : []}
              memberById={memberById}
            />
          );
        })}
      </SortableContext>
    </div>
  );
}

function SortableTaskRow({
  task,
  cat,
  assignees,
  subs,
  collapsed,
  setCollapsed,
  onOpenTask,
  renderSubtasks,
  memberById,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", categoryId: cat.id },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center gap-1.5 px-3 h-[36px] border-b border-stone-100 hover:bg-stone-50 ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="text-stone-300 group-hover:text-stone-500 hover:!text-stone-700 cursor-grab active:cursor-grabbing -ml-1"
          title="Arrastra para reordenar"
          aria-label="Reordenar tarea"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        {subs.length > 0 ? (
          <button
            onClick={() => toggleSet(collapsed, task.id, setCollapsed)}
            className="text-stone-400 hover:text-stone-700"
            aria-label="Colapsar"
          >
            {collapsed.has(task.id) ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: cat.color }}
        />
        <button
          onClick={() => onOpenTask?.(task.id)}
          className="flex-1 min-w-0 text-left text-xs text-stone-900 hover:text-stone-700 truncate"
        >
          {task.name}
        </button>
        {assignees.length > 0 && (
          <AvatarStack members={assignees} max={2} size="xs" />
        )}
      </div>

      {renderSubtasks.map((s) => {
        const subAssignees = (s.assignee_ids || [])
          .map((id) => memberById.get(id))
          .filter(Boolean);
        return (
          <div
            key={`row-${s.id}`}
            className="flex items-center gap-1.5 px-3 h-[36px] border-b border-stone-100 hover:bg-stone-50 pl-10"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: cat.color }}
            />
            <button
              onClick={() => onOpenTask?.(s.id)}
              className="flex-1 min-w-0 text-left text-xs text-stone-700 hover:text-stone-900 truncate"
            >
              {s.name}
            </button>
            {subAssignees.length > 0 && (
              <AvatarStack members={subAssignees} max={2} size="xs" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineCategoryBlock({
  cat,
  tasks,
  subtasksByParent,
  collapsed,
  tlStart,
  dayWidth,
  onOpenTask,
}) {
  return (
    <>
      <div className="h-[28px] border-b border-stone-100 relative z-10" />
      {tasks.map((t) => (
        <TimelineTaskRows
          key={t.id}
          task={t}
          cat={cat}
          subtasks={collapsed.has(t.id) ? [] : subtasksByParent.get(t.id) || []}
          tlStart={tlStart}
          dayWidth={dayWidth}
          onOpenTask={onOpenTask}
        />
      ))}
    </>
  );
}

function TimelineTaskRows({ task, cat, subtasks, tlStart, dayWidth, onOpenTask }) {
  return (
    <>
      <GanttRow
        task={task}
        cat={cat}
        isSubtask={false}
        tlStart={tlStart}
        dayWidth={dayWidth}
        onClick={() => onOpenTask?.(task.id)}
      />
      {subtasks.map((s) => (
        <GanttRow
          key={s.id}
          task={s}
          cat={cat}
          isSubtask={true}
          tlStart={tlStart}
          dayWidth={dayWidth}
          onClick={() => onOpenTask?.(s.id)}
        />
      ))}
    </>
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
      className={`relative block w-full h-[36px] border-b border-stone-100 hover:bg-stone-50/60 text-left z-10 ${
        isDelayedRow ? "bg-rose-50/40" : ""
      } ${isSubtask ? "pl-3" : ""}`}
    >
      {plannedLeft != null && plannedWidth > 0 && (
        <div
          className={`absolute top-3 h-1.5 rounded-full bg-stone-200 ${
            ae ? "" : "border border-dashed border-stone-300"
          }`}
          style={{ left: plannedLeft, width: plannedWidth }}
        />
      )}
      {realLeft != null && realWidth > 0 && (
        <div
          className={`absolute top-[18px] h-3 rounded-full shadow-sm ${borderCls}`}
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

function NonWorkingBand({ band, dayWidth }) {
  const left = band.offset * dayWidth;
  const width = dayWidth;
  let bg = "rgba(0,0,0,0.04)";
  let extra = null;
  if (band.type === NON_WORKING_TYPE.LFT) {
    bg = "rgba(244,63,94,0.08)";
    extra = (
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-rose-500"
        style={{ marginTop: 2 }}
      />
    );
  } else if (band.type === NON_WORKING_TYPE.CUSTOM) {
    bg =
      "repeating-linear-gradient(45deg, rgba(245,158,11,0.10) 0 3px, rgba(245,158,11,0) 3px 7px), rgba(245,158,11,0.05)";
  }

  return (
    <span
      title={band.name}
      className="absolute top-0 bottom-0 block"
      style={{ left, width, background: bg }}
    >
      {extra}
    </span>
  );
}

function LegendChip({ type, label }) {
  let style = { background: "rgba(0,0,0,0.10)" };
  if (type === NON_WORKING_TYPE.LFT) {
    style = { background: "rgba(244,63,94,0.30)" };
  } else if (type === NON_WORKING_TYPE.CUSTOM) {
    style = {
      background:
        "repeating-linear-gradient(45deg, rgba(245,158,11,0.6) 0 3px, rgba(245,158,11,0.15) 3px 7px)",
    };
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm border border-stone-200" style={style} />
      {label}
    </span>
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
      const toIdx = rowIndexByTaskId.get(t.id);
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
      className="absolute top-0 left-0 pointer-events-none z-30"
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
