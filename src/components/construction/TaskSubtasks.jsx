import { useState } from "react";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "../ui/Checkbox";
import { useToast } from "../ui/Toast";
import {
  createTask,
  updateTask,
  deleteTask,
} from "../../lib/api/constructionTasks";

export function TaskSubtasks({
  projectId,
  parent,
  subtasks,
  canEdit,
  currentUserId,
  onChange,
  onOpenSubtask,
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const handleAdd = async (e) => {
    e?.preventDefault();
    const value = name.trim();
    if (!value) return;
    setSaving(true);
    try {
      const row = await createTask({
        projectId,
        categoryId: parent.category_id,
        parentId: parent.id,
        name: value,
        position: subtasks.length,
        createdBy: currentUserId,
      });
      onChange?.([...subtasks, { ...row, assignee_ids: [], dependency_ids: [] }]);
      setName("");
    } catch (err) {
      toast.error(err.message || "No se pudo crear la subtarea");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (sub) => {
    const next = sub.progress >= 100 ? 0 : 100;
    setBusyId(sub.id);
    try {
      const row = await updateTask(sub.id, { progress: next }, currentUserId);
      onChange?.(subtasks.map((s) => (s.id === sub.id ? { ...s, ...row } : s)));
    } catch (err) {
      toast.error(err.message || "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (sub) => {
    setBusyId(sub.id);
    try {
      await deleteTask(sub.id);
      onChange?.(subtasks.filter((s) => s.id !== sub.id));
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {subtasks.length === 0 ? (
        <p className="text-xs text-stone-500">Sin subtareas.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-stone-50 group"
            >
              <Checkbox
                checked={s.progress >= 100}
                onChange={() => handleToggleDone(s)}
                disabled={!canEdit || busyId === s.id}
              />
              <button
                type="button"
                onClick={() => onOpenSubtask?.(s.id)}
                className={`flex-1 text-left text-sm truncate ${
                  s.progress >= 100 ? "line-through text-stone-400" : "text-stone-800"
                } hover:text-stone-900`}
              >
                {s.name}
              </button>
              <span className="text-[10px] text-stone-400 tabular-nums w-8 text-right">
                {s.progress ?? 0}%
              </span>
              {canEdit && (
                <button
                  onClick={() => handleDelete(s)}
                  disabled={busyId === s.id}
                  className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-700 p-0.5"
                  aria-label="Eliminar subtarea"
                >
                  {busyId === s.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="flex items-center gap-1.5 mt-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva subtarea…"
            maxLength={160}
            className="flex-1 text-sm bg-stone-50 border border-stone-200 rounded-md px-2 py-1.5 placeholder:text-stone-400 focus:bg-white focus:border-stone-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="text-stone-600 hover:text-stone-900 disabled:text-stone-300 p-1.5"
            aria-label="Agregar subtarea"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </form>
      )}
    </div>
  );
}
