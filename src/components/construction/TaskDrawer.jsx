import { useState, useEffect, useMemo, useRef } from "react";
import {
  Loader2,
  Trash2,
  Save,
  CalendarRange,
  Tag,
  Users,
  Activity,
  Link2,
  ListChecks,
  FileText,
  Paperclip,
  MessageSquare,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { Select, Textarea } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/AuthContext";
import {
  createTask,
  updateTask,
  deleteTask,
  setDependencies,
} from "../../lib/api/constructionTasks";
import { setAssignees } from "../../lib/api/constructionAssignees";
import { deriveStatus, STATUS_TONE } from "../../lib/construction/status";
import { fmtDuration, diffDays, parseISODate } from "../../lib/construction/dateUtils";
import { StatusBadge } from "./StatusBadge";
import { AssigneePicker } from "./AssigneePicker";
import { TaskDependencies } from "./TaskDependencies";
import { TaskSubtasks } from "./TaskSubtasks";
import { TaskComments } from "./TaskComments";
import { TaskAttachments } from "./TaskAttachments";
import { ProgressRing } from "../ui/Progress";

const SECTION_HEAD = "flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1.5";

function blankDraft(parentTask = null) {
  return {
    name: "",
    description: "",
    category_id: parentTask?.category_id ?? null,
    parent_id: parentTask?.id ?? null,
    planned_start: "",
    planned_end: "",
    actual_start: "",
    actual_end: "",
    progress: 0,
    assignee_ids: [],
    dependency_ids: [],
  };
}

function toDraft(task) {
  return {
    name: task.name ?? "",
    description: task.description ?? "",
    category_id: task.category_id ?? null,
    parent_id: task.parent_id ?? null,
    planned_start: task.planned_start ?? "",
    planned_end: task.planned_end ?? "",
    actual_start: task.actual_start ?? "",
    actual_end: task.actual_end ?? "",
    progress: task.progress ?? 0,
    assignee_ids: task.assignee_ids ?? [],
    dependency_ids: task.dependency_ids ?? [],
  };
}

export function TaskDrawer({
  open,
  task,            // null = creating new
  parentTask,      // when creating subtask under parent
  allTasks,
  projectId,
  categories,
  members,
  currentUserId,
  canEdit,
  onClose,
  onSaved,
  onDeleted,
  onOpenTask,
}) {
  const toast = useToast();
  const { profile } = useAuth();
  const [draft, setDraft] = useState(() => task ? toDraft(task) : blankDraft(parentTask));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    setDraft(task ? toDraft(task) : blankDraft(parentTask));
  }, [task, parentTask]);

  useEffect(() => {
    if (open && !task && nameInputRef.current) {
      // autofocus on name when creating new
      const t = setTimeout(() => nameInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, task]);

  useEffect(() => {
    if (!open || !canEdit) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canEdit, draft]);

  const isNew = !task;
  const isSubtask = !!draft.parent_id;
  const subtasks = useMemo(
    () => allTasks.filter((t) => t.parent_id === task?.id),
    [allTasks, task]
  );

  const status = useMemo(() => deriveStatus(draft), [draft]);
  const tone = STATUS_TONE[status];

  const updateField = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        category_id: draft.category_id || null,
        planned_start: draft.planned_start || null,
        planned_end: draft.planned_end || null,
        actual_start: draft.actual_start || null,
        actual_end: draft.actual_end || null,
        progress: Math.max(0, Math.min(100, Number(draft.progress) || 0)),
      };

      let saved;
      if (isNew) {
        saved = await createTask({
          projectId,
          categoryId: payload.category_id,
          parentId: draft.parent_id,
          name: payload.name,
          description: payload.description,
          plannedStart: payload.planned_start,
          plannedEnd: payload.planned_end,
          actualStart: payload.actual_start,
          actualEnd: payload.actual_end,
          progress: payload.progress,
          createdBy: currentUserId,
        });
      } else {
        saved = await updateTask(task.id, payload, currentUserId);
      }

      const taskId = saved.id;

      await setAssignees({ taskId, userIds: draft.assignee_ids });
      // Solo guardamos dependencias para tareas existentes (no aplican a nuevas hasta tener id;
      // pero después de createTask ya tenemos id, así que también funciona).
      await setDependencies({ taskId, dependsOnTaskIds: draft.dependency_ids });

      toast.success(isNew ? "Tarea creada" : "Tarea actualizada");
      onSaved?.({
        ...saved,
        assignee_ids: draft.assignee_ids,
        dependency_ids: draft.dependency_ids,
      });
      if (isNew) onClose?.();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await deleteTask(task.id);
      toast.success("Tarea eliminada");
      onDeleted?.(task.id);
      setConfirmDelete(false);
      onClose?.();
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  };

  const plannedDuration = fmtDuration(draft.planned_start, draft.planned_end);
  const actualDuration  = fmtDuration(draft.actual_start, draft.actual_end);
  const overrunDays =
    draft.actual_end && draft.planned_end
      ? diffDays(parseISODate(draft.planned_end), parseISODate(draft.actual_end))
      : null;

  const headerTitle = isNew
    ? (isSubtask ? "Nueva subtarea" : "Nueva tarea")
    : (task?.name || "Tarea");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="xl"
      title={headerTitle}
      footer={
        <>
          {!isNew && canEdit && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-rose-700 hover:text-rose-800 inline-flex items-center gap-1.5 mr-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          )}
          <Button variant="ghost" onClick={onClose} size="sm">Cerrar</Button>
          {canEdit && (
            <Button onClick={handleSave} loading={saving} size="sm">
              <Save className="w-3.5 h-3.5" />
              {isNew ? "Crear" : "Guardar"}
            </Button>
          )}
        </>
      }
    >
      <div className="px-4 py-4 flex flex-col gap-5">
        {/* Encabezado de estado + ring */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <input
              ref={nameInputRef}
              type="text"
              value={draft.name}
              onChange={(e) => updateField({ name: e.target.value })}
              disabled={!canEdit}
              placeholder="Nombre de la tarea"
              maxLength={160}
              className="w-full bg-transparent text-base font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none border-b border-transparent focus:border-stone-300 pb-1"
            />
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusBadge status={status} />
              {isSubtask && (
                <span className="text-[10px] uppercase tracking-wider text-stone-500 border border-stone-200 rounded-full px-1.5 py-0.5">
                  Subtarea
                </span>
              )}
              {overrunDays != null && overrunDays > 0 && (
                <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-0.5">
                  {overrunDays} día{overrunDays === 1 ? "" : "s"} de retraso
                </span>
              )}
            </div>
          </div>
          <ProgressRing
            value={draft.progress || 0}
            size={56}
            stroke={5}
            tone={tone}
          />
        </div>

        {/* Categoría */}
        <Section icon={Tag} label="Categoría">
          <Select
            value={draft.category_id || ""}
            disabled={!canEdit}
            onChange={(e) => updateField({ category_id: e.target.value || null })}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Section>

        {/* Fechas */}
        <Section icon={CalendarRange} label="Fechas">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DatePair
              title="Planeado"
              startLabel="Inicio"
              endLabel="Fin"
              start={draft.planned_start}
              end={draft.planned_end}
              onStart={(v) => updateField({ planned_start: v })}
              onEnd={(v) => updateField({ planned_end: v })}
              duration={plannedDuration}
              disabled={!canEdit}
            />
            <DatePair
              title="Real"
              startLabel="Inicio"
              endLabel="Fin"
              start={draft.actual_start}
              end={draft.actual_end}
              onStart={(v) => updateField({ actual_start: v })}
              onEnd={(v) => updateField({ actual_end: v })}
              duration={actualDuration}
              disabled={!canEdit}
            />
          </div>
        </Section>

        {/* Responsables */}
        <Section icon={Users} label="Responsables">
          <AssigneePicker
            members={members}
            selectedIds={draft.assignee_ids}
            onChange={(ids) => updateField({ assignee_ids: ids })}
            disabled={!canEdit}
          />
        </Section>

        {/* Avance */}
        <Section icon={Activity} label="Avance">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={draft.progress}
              disabled={!canEdit}
              onChange={(e) => updateField({ progress: Number(e.target.value) })}
              className="flex-1 accent-stone-900"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={draft.progress}
              disabled={!canEdit}
              onChange={(e) => {
                const n = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                updateField({ progress: n });
              }}
              className="w-16 text-sm tabular-nums bg-stone-50 border border-stone-200 rounded-md px-2 py-1.5 focus:bg-white focus:border-stone-900 focus:outline-none"
            />
            <span className="text-xs text-stone-500">%</span>
          </div>
        </Section>

        {/* Dependencias */}
        <Section icon={Link2} label="Dependencias (Bloqueada por)">
          <TaskDependencies
            allTasks={allTasks}
            currentTaskId={task?.id}
            selectedIds={draft.dependency_ids}
            onChange={(ids) => updateField({ dependency_ids: ids })}
            disabled={!canEdit || isNew}
          />
          {isNew && (
            <p className="text-[11px] text-stone-500 mt-1.5">
              Guarda la tarea para poder agregar dependencias.
            </p>
          )}
        </Section>

        {/* Subtareas (solo en tareas de primer nivel ya guardadas) */}
        {!isNew && !isSubtask && (
          <Section icon={ListChecks} label="Subtareas">
            <TaskSubtasks
              projectId={projectId}
              parent={task}
              subtasks={subtasks}
              canEdit={canEdit}
              currentUserId={currentUserId}
              onChange={onSaved /* parent will refresh; here we trigger a soft refresh */ ? () => onSaved?.(task) : undefined}
              onOpenSubtask={onOpenTask}
            />
          </Section>
        )}

        {/* Descripción */}
        <Section icon={FileText} label="Descripción">
          <Textarea
            rows={3}
            value={draft.description || ""}
            disabled={!canEdit}
            onChange={(e) => updateField({ description: e.target.value })}
            placeholder="Notas, especificaciones, requisitos…"
            className="resize-y"
          />
        </Section>

        {/* Adjuntos */}
        {!isNew && (
          <Section icon={Paperclip} label="Adjuntos">
            <TaskAttachments
              taskId={task.id}
              projectId={projectId}
              currentUserId={currentUserId}
              canEdit={canEdit}
            />
          </Section>
        )}

        {/* Comentarios */}
        {!isNew && (
          <Section icon={MessageSquare} label="Comentarios">
            <TaskComments
              taskId={task.id}
              currentUserId={currentUserId}
              currentUserProfile={profile}
            />
          </Section>
        )}

        {saving && (
          <div className="text-xs text-stone-400 inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Guardando…
          </div>
        )}
      </div>

      {confirmDelete && (
        <Modal
          title="Eliminar tarea"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar <strong>{task?.name}</strong>.
            {!isSubtask && subtasks.length > 0 && (
              <> También se eliminarán sus <strong>{subtasks.length}</strong> subtarea{subtasks.length === 1 ? "" : "s"}.</>
            )}
            {" "}Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </Drawer>
  );
}

function Section({ icon: Icon, label, children }) {
  return (
    <section>
      <div className={SECTION_HEAD}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      {children}
    </section>
  );
}

function DatePair({ title, startLabel, endLabel, start, end, onStart, onEnd, duration, disabled }) {
  return (
    <div className="border border-stone-200 rounded-md p-2.5 bg-stone-50/40">
      <div className="text-[11px] font-semibold text-stone-700 mb-1.5">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        <DateField label={startLabel} value={start} onChange={onStart} disabled={disabled} />
        <DateField label={endLabel}   value={end}   onChange={onEnd}   disabled={disabled} />
      </div>
      <div className="text-[11px] text-stone-500 mt-1.5 tabular-nums">
        Duración: <span className="text-stone-700">{duration}</span>
      </div>
    </div>
  );
}

function DateField({ label, value, onChange, disabled }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-stone-500">{label}</span>
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-white border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:border-stone-900 disabled:bg-stone-100 disabled:text-stone-500"
      />
    </label>
  );
}
