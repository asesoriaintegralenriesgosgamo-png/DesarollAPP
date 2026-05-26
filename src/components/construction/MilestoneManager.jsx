import { useState } from "react";
import { Plus, Trash2, Loader2, Flag } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useToast } from "../ui/Toast";
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "../../lib/api/constructionMilestones";
import { fmtDate } from "../../lib/construction/dateUtils";

const COLORS = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];

export function MilestoneManager({ projectId, milestones, onChange, onClose }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !date) return;
    setSaving(true);
    try {
      const row = await createMilestone({
        projectId,
        name: name.trim(),
        date,
        color,
      });
      onChange?.([...milestones, row].sort((a, b) => a.date.localeCompare(b.date)));
      setName("");
      setDate("");
      toast.success("Hito creado");
    } catch (err) {
      toast.error(err.message || "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id, newName) => {
    try {
      const row = await updateMilestone(id, { name: newName });
      onChange?.(milestones.map((m) => (m.id === id ? row : m)));
    } catch (err) {
      toast.error(err.message || "No se pudo renombrar");
    }
  };

  const handleDate = async (id, newDate) => {
    try {
      const row = await updateMilestone(id, { date: newDate });
      onChange?.(
        milestones
          .map((m) => (m.id === id ? row : m))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
    } catch (err) {
      toast.error(err.message || "No se pudo cambiar la fecha");
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteMilestone(id);
      onChange?.(milestones.filter((m) => m.id !== id));
      toast.success("Hito eliminado");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      title="Hitos del proyecto"
      onClose={onClose}
      size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}
    >
      <div className="flex flex-col gap-4">
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end pb-3 border-b border-stone-200">
          <Input
            label="Nombre del hito"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Ej: Permiso de construcción, Entrega…"
          />
          <Input
            label="Fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-700">Color</label>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full ring-1 ${color === c ? "ring-stone-900 ring-offset-1" : "ring-stone-300"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <Button type="submit" size="sm" loading={saving} disabled={!name.trim() || !date}>
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </Button>
        </form>

        {milestones.length === 0 ? (
          <p className="text-sm text-stone-500 text-center py-6">
            Aún no hay hitos. Crea el primero arriba.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {milestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-50"
              >
                <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: m.color }} />
                <input
                  type="text"
                  defaultValue={m.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== m.name) {
                      handleRename(m.id, e.target.value.trim());
                    } else {
                      e.target.value = m.name;
                    }
                  }}
                  className="flex-1 bg-transparent text-sm text-stone-900 px-2 py-1 rounded hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <input
                  type="date"
                  defaultValue={m.date}
                  onChange={(e) => e.target.value && handleDate(m.id, e.target.value)}
                  className="text-xs bg-white border border-stone-200 rounded px-2 py-1 focus:outline-none focus:border-stone-900"
                />
                <span className="text-[11px] text-stone-500 tabular-nums w-24 text-right">
                  {fmtDate(m.date)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="text-stone-400 hover:text-rose-700 p-1"
                  aria-label="Eliminar hito"
                >
                  {deletingId === m.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
