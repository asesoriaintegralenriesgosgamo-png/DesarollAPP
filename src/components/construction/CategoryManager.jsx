import { useState } from "react";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useToast } from "../ui/Toast";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../lib/api/constructionCategories";
import { CATEGORY_PALETTE } from "../../lib/construction/templates";

export function CategoryManager({
  projectId,
  categories,
  onChange,
  onClose,
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(CATEGORY_PALETTE[0].value);
  const [deletingId, setDeletingId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const row = await createCategory({
        projectId,
        name: newName.trim(),
        color: newColor,
        position: categories.length,
      });
      onChange?.([...categories, row]);
      setNewName("");
      toast.success("Categoría creada");
    } catch (err) {
      toast.error(err.message || "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id, name) => {
    try {
      const row = await updateCategory(id, { name });
      onChange?.(categories.map((c) => (c.id === id ? row : c)));
    } catch (err) {
      toast.error(err.message || "No se pudo renombrar");
    }
  };

  const handleColor = async (id, color) => {
    try {
      const row = await updateCategory(id, { color });
      onChange?.(categories.map((c) => (c.id === id ? row : c)));
    } catch (err) {
      toast.error(err.message || "No se pudo cambiar color");
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteCategory(id);
      onChange?.(categories.filter((c) => c.id !== id));
      toast.success("Categoría eliminada");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      title="Categorías de obra"
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <form onSubmit={handleCreate} className="flex items-end gap-2 pb-3 border-b border-stone-200">
          <div className="flex-1">
            <Input
              label="Nueva categoría"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              placeholder="Ej: Cimentación, Acabados…"
            />
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Button type="submit" size="sm" loading={saving} disabled={!newName.trim()}>
            <Plus className="w-3.5 h-3.5" />
            Crear
          </Button>
        </form>

        {categories.length === 0 ? (
          <p className="text-sm text-stone-500 text-center py-6">
            Aún no hay categorías. Crea la primera arriba.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-50"
              >
                <GripVertical className="w-3.5 h-3.5 text-stone-300" />
                <input
                  type="text"
                  defaultValue={c.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== c.name) {
                      handleRename(c.id, e.target.value.trim());
                    } else {
                      e.target.value = c.name;
                    }
                  }}
                  className="flex-1 bg-transparent text-sm text-stone-900 px-2 py-1 rounded hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <ColorPicker
                  value={c.color}
                  onChange={(v) => handleColor(c.id, v)}
                />
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="text-stone-400 hover:text-rose-700 p-1"
                  aria-label="Eliminar categoría"
                >
                  {deletingId === c.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-stone-500 leading-relaxed">
          Al eliminar una categoría, las tareas asociadas no se borran — quedan
          como <em>Sin categoría</em> y puedes reasignarlas después.
        </p>
      </div>
    </Modal>
  );
}

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-6 h-6 rounded-full border-2 border-white ring-1 ring-stone-300 hover:ring-stone-500"
        style={{ background: value }}
        aria-label="Cambiar color"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-stone-200 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1.5">
            {CATEGORY_PALETTE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => { onChange?.(c.value); setOpen(false); }}
                className={`w-6 h-6 rounded-full ring-1 ${value === c.value ? "ring-stone-900 ring-offset-1" : "ring-stone-300"}`}
                style={{ background: c.value }}
                aria-label={c.label}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
