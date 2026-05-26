import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { AvatarStack } from "../../ui/Avatar";
import { Progress } from "../../ui/Progress";
import { ProgressInline } from "../ProgressInline";
import { StatusBadge } from "../StatusBadge";
import { deriveStatus } from "../../../lib/construction/status";
import { fmtDateRange } from "../../../lib/construction/dateUtils";
import { computeWeightedProgress } from "../../../lib/construction/kpis";

const SIN_CATEGORIA = "__none__";

export function ListView({
  tasks,
  categories,
  members,
  canEdit,
  onOpenTask,
  onCreateInCategory,
  onProgressChange,
  onMoveTask,
}) {
  const topLevel = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks]);
  const subtasksByParent = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.parent_id) continue;
      if (!map.has(t.parent_id)) map.set(t.parent_id, []);
      map.get(t.parent_id).push(t);
    }
    return map;
  }, [tasks]);

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

  const memberById = useMemo(() => {
    const m = new Map();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  const orderedCategories = [
    ...categories,
    {
      id: SIN_CATEGORIA,
      name: "Sin categoría",
      color: "#a8a29e",
      position: 9999,
      _virtual: true,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {orderedCategories.map((cat) => {
        const catTasks = grouped.get(cat.id) || [];
        if (cat._virtual && catTasks.length === 0) return null;
        return (
          <CategorySection
            key={cat.id}
            category={cat}
            tasks={catTasks}
            subtasksByParent={subtasksByParent}
            memberById={memberById}
            canEdit={canEdit}
            onOpenTask={onOpenTask}
            onCreate={() => onCreateInCategory?.(cat._virtual ? null : cat.id)}
            onProgressChange={onProgressChange}
            onMoveTask={onMoveTask}
            allTopLevel={catTasks}
          />
        );
      })}
    </div>
  );
}

function CategorySection({
  category, tasks, subtasksByParent, memberById,
  canEdit, onOpenTask, onCreate, onProgressChange, onMoveTask, allTopLevel,
}) {
  const [open, setOpen] = useState(true);
  const weighted = computeWeightedProgress(tasks);

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100 bg-stone-50/50">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-stone-500 hover:text-stone-900"
          aria-label={open ? "Colapsar" : "Expandir"}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <span
          className="w-2.5 h-2.5 rounded-full border border-white ring-1 ring-stone-200 shrink-0"
          style={{ background: category.color }}
        />
        <h4 className="text-sm font-semibold text-stone-900 truncate">{category.name}</h4>
        <span className="text-[10px] text-stone-500 tabular-nums">
          {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
        </span>
        <div className="hidden md:flex flex-1 items-center gap-2 max-w-xs">
          <Progress value={weighted} size="xs" />
          <span className="text-[10px] text-stone-500 tabular-nums w-9 text-right">{weighted}%</span>
        </div>
        <div className="flex-1 md:hidden" />
        {canEdit && (
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md px-2 py-1"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Tarea</span>
          </button>
        )}
      </div>

      {open && (
        tasks.length === 0 ? (
          <div className="px-3 py-4 text-xs text-stone-500 text-center">
            Sin tareas en esta categoría.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {tasks.map((t, idx) => (
              <TaskRow
                key={t.id}
                task={t}
                subtasks={subtasksByParent.get(t.id) || []}
                memberById={memberById}
                canEdit={canEdit}
                onOpenTask={onOpenTask}
                onProgressChange={onProgressChange}
                onMoveUp={idx > 0 ? () => onMoveTask?.(t.id, allTopLevel[idx - 1].id) : null}
                onMoveDown={idx < tasks.length - 1 ? () => onMoveTask?.(t.id, allTopLevel[idx + 1].id) : null}
              />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function TaskRow({
  task, subtasks, memberById, canEdit, onOpenTask, onProgressChange,
  onMoveUp, onMoveDown,
}) {
  const [showSubs, setShowSubs] = useState(false);
  const status = deriveStatus(task);
  const assignees = (task.assignee_ids || []).map((id) => memberById.get(id)).filter(Boolean);
  const isDelayed = status === "delayed";

  return (
    <>
      <li
        className={`group flex items-center gap-2 px-3 py-2 hover:bg-stone-50 ${
          isDelayed ? "border-l-2 border-rose-400" : ""
        }`}
      >
        {subtasks.length > 0 ? (
          <button
            onClick={() => setShowSubs((v) => !v)}
            className="text-stone-400 hover:text-stone-700"
            aria-label={showSubs ? "Ocultar subtareas" : "Mostrar subtareas"}
          >
            {showSubs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 h-3.5" />
        )}

        <button
          onClick={() => onOpenTask?.(task.id)}
          className="flex-1 min-w-0 text-left text-sm text-stone-900 hover:text-stone-700 truncate"
        >
          {task.name}
          {subtasks.length > 0 && (
            <span className="ml-1.5 text-[10px] text-stone-400 tabular-nums">
              · {subtasks.filter((s) => s.progress >= 100).length}/{subtasks.length}
            </span>
          )}
        </button>

        <div className="hidden md:flex items-center w-32 shrink-0">
          {assignees.length > 0 ? (
            <AvatarStack members={assignees} max={3} size="xs" />
          ) : (
            <span className="text-[10px] text-stone-400">—</span>
          )}
        </div>

        <div className="hidden lg:block text-[11px] text-stone-500 tabular-nums w-44 shrink-0 truncate">
          {fmtDateRange(task.planned_start, task.planned_end)}
        </div>

        <div className="hidden xl:block text-[11px] text-stone-500 tabular-nums w-44 shrink-0 truncate">
          {fmtDateRange(task.actual_start, task.actual_end)}
        </div>

        <div className="shrink-0">
          <ProgressInline
            value={task.progress || 0}
            disabled={!canEdit}
            onCommit={(v) => onProgressChange?.(task.id, v)}
            tone={
              status === "done"     ? "emerald" :
              status === "delayed"  ? "rose"    :
              status === "at_risk"  ? "amber"   : "stone"
            }
          />
        </div>

        <div className="shrink-0 hidden sm:block">
          <StatusBadge status={status} />
        </div>

        {canEdit && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className="text-stone-400 hover:text-stone-700 disabled:opacity-30 p-0.5"
              aria-label="Subir"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className="text-stone-400 hover:text-stone-700 disabled:opacity-30 p-0.5"
              aria-label="Bajar"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => onOpenTask?.(task.id)}
              className="text-stone-400 hover:text-stone-700 p-0.5"
              aria-label="Más"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </li>

      {showSubs &&
        subtasks.map((s) => {
          const subStatus = deriveStatus(s);
          const subAssignees = (s.assignee_ids || []).map((id) => memberById.get(id)).filter(Boolean);
          return (
            <li
              key={s.id}
              className="flex items-center gap-2 px-3 py-1.5 pl-9 bg-stone-50/40 hover:bg-stone-50"
            >
              <button
                onClick={() => onOpenTask?.(s.id)}
                className={`flex-1 min-w-0 text-left text-xs truncate ${
                  s.progress >= 100 ? "line-through text-stone-400" : "text-stone-700"
                } hover:text-stone-900`}
              >
                {s.name}
              </button>
              <div className="hidden md:flex items-center w-32 shrink-0">
                {subAssignees.length > 0 ? (
                  <AvatarStack members={subAssignees} max={3} size="xs" />
                ) : (
                  <span className="text-[10px] text-stone-300">—</span>
                )}
              </div>
              <div className="hidden lg:block text-[10px] text-stone-400 tabular-nums w-44 shrink-0 truncate">
                {fmtDateRange(s.planned_start, s.planned_end)}
              </div>
              <div className="hidden xl:block text-[10px] text-stone-400 tabular-nums w-44 shrink-0 truncate">
                {fmtDateRange(s.actual_start, s.actual_end)}
              </div>
              <div className="shrink-0">
                <ProgressInline
                  value={s.progress || 0}
                  disabled={!canEdit}
                  onCommit={(v) => onProgressChange?.(s.id, v)}
                  width="w-20"
                />
              </div>
              <div className="shrink-0 hidden sm:block">
                <StatusBadge status={subStatus} size="xs" />
              </div>
            </li>
          );
        })}
    </>
  );
}
