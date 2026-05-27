import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  PieChart,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Select } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../lib/api/expenseCategories";
import { computeBudgetExecution } from "../../lib/accounts/calc";
import {
  fmtMoney,
  CATEGORY_COLORS,
} from "../../lib/accounts/format";

const EMPTY = {
  nombre: "",
  parent_id: null,
  presupuesto_inicial: "",
  moneda: "MXN",
  color: "#78716c",
  position: 0,
};

export function BudgetView({ projectId, canEdit, categories, expenses, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  const topLevel = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  const rows = useMemo(
    () =>
      topLevel.map((c) => ({
        category: c,
        exec: computeBudgetExecution(c, categories, expenses),
      })),
    [topLevel, categories, expenses]
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const m = r.category.moneda;
        if (!acc[m]) acc[m] = { presupuesto: 0, ejecutado: 0 };
        acc[m].presupuesto += r.exec.presupuesto;
        acc[m].ejecutado += r.exec.ejecutado;
        return acc;
      },
      {}
    );
  }, [rows]);

  const toggle = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  if (categories.length === 0 && !editing) {
    return (
      <EmptyState
        icon={PieChart}
        title="Sin partidas presupuestales"
        description="Crea partidas (categorías) con presupuesto inicial. Cada egreso se clasifica en una partida y verás cuánto te falta por gastar y cuánto te has excedido."
        action={
          canEdit && (
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="w-4 h-4" />
              Nueva partida
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-3 text-xs flex-wrap">
          {Object.entries(totals).map(([moneda, t]) => {
            const pct = t.presupuesto > 0 ? (t.ejecutado / t.presupuesto) * 100 : 0;
            const tone =
              pct > 100 ? "text-rose-700" : pct >= 90 ? "text-amber-700" : "text-emerald-700";
            return (
              <div key={moneda} className="flex items-baseline gap-2 bg-stone-50 border border-stone-200 rounded-md px-3 py-1.5">
                <span className="text-stone-500">Total {moneda}:</span>
                <span className="tabular-nums text-stone-900 font-medium">
                  {fmtMoney(t.ejecutado, moneda)}
                </span>
                <span className="text-stone-400">/</span>
                <span className="tabular-nums text-stone-700">{fmtMoney(t.presupuesto, moneda)}</span>
                <span className={`tabular-nums font-semibold ${tone}`}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
        {canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY })} size="sm">
            <Plus className="w-3.5 h-3.5" />
            Nueva partida
          </Button>
        )}
      </div>

      {/* Lista jerárquica */}
      <div className="flex flex-col gap-2">
        {rows.map(({ category, exec }) => (
          <CategoryRow
            key={category.id}
            category={category}
            exec={exec}
            expanded={expanded.has(category.id)}
            onToggle={() => toggle(category.id)}
            onEdit={() => setEditing(category)}
            onDelete={() => setConfirmDelete(category)}
            onAddSub={() => setEditing({ ...EMPTY, parent_id: category.id, moneda: category.moneda })}
            onEditSub={(s) => setEditing(s)}
            onDeleteSub={(s) => setConfirmDelete(s)}
            canEdit={canEdit}
          />
        ))}
      </div>

      {editing && (
        <CategoryModal
          projectId={projectId}
          category={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
      {confirmDelete && (
        <DeleteCategoryModal
          category={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onDeleted={() => {
            setConfirmDelete(null);
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function CategoryRow({
  category,
  exec,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddSub,
  onEditSub,
  onDeleteSub,
  canEdit,
}) {
  const pct = Math.min(exec.porcentaje, 200);
  const hasSubs = exec.subcategorias.length > 0;
  const presupuesto = exec.presupuesto;
  const ejecutado = exec.ejecutado;
  const falta = exec.falta;

  const tone =
    pct > 100 ? "rose" : pct >= 90 ? "amber" : pct >= 60 ? "sky" : "emerald";
  const barColor =
    tone === "rose"
      ? "bg-rose-500"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "sky"
      ? "bg-sky-500"
      : "bg-emerald-500";
  const numColor =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
      ? "text-amber-700"
      : tone === "sky"
      ? "text-sky-700"
      : "text-emerald-700";

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          {hasSubs ? (
            <button
              onClick={onToggle}
              className="text-stone-400 hover:text-stone-700 p-0.5"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-sm font-semibold text-stone-900 flex-1 truncate">
            {category.nombre}
          </span>
          <div className="text-right">
            <div className="text-[10px] text-stone-500">
              {presupuesto > 0
                ? `${fmtMoney(ejecutado, category.moneda)} / ${fmtMoney(presupuesto, category.moneda)}`
                : `${fmtMoney(ejecutado, category.moneda)} (sin presupuesto)`}
            </div>
            <div className={`text-sm font-semibold tabular-nums ${numColor}`}>
              {presupuesto > 0 ? `${pct.toFixed(0)}%` : "—"}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-0.5 ml-2">
              <button onClick={onAddSub} className="text-stone-400 hover:text-stone-700 p-1" title="Agregar subpartida">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={onEdit} className="text-stone-400 hover:text-stone-700 p-1" title="Editar">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="text-stone-400 hover:text-rose-700 p-1" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="ml-6">
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden relative">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
            {pct > 100 && (
              <div
                className="absolute top-0 right-0 h-full bg-rose-700 opacity-80"
                style={{ width: `${Math.min(pct - 100, 100)}%`, right: 0 }}
              />
            )}
          </div>
          {presupuesto > 0 && (
            <div className="flex justify-between text-[10px] text-stone-500 mt-1 tabular-nums">
              <span>Falta {fmtMoney(falta, category.moneda)}</span>
              {falta < 0 && (
                <span className="text-rose-700 font-medium">
                  Excedido en {fmtMoney(-falta, category.moneda)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && hasSubs && (
        <div className="border-t border-stone-100 bg-stone-50">
          <ul className="divide-y divide-stone-100">
            {exec.subcategorias.map((s) => {
              const subPct = Math.min(s.porcentaje, 200);
              const subTone =
                subPct > 100
                  ? "bg-rose-500"
                  : subPct >= 90
                  ? "bg-amber-500"
                  : subPct >= 60
                  ? "bg-sky-500"
                  : "bg-emerald-500";
              return (
                <li key={s.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-4" />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-stone-700 flex-1 truncate">{s.nombre}</span>
                    <span className="text-[10px] text-stone-500 tabular-nums">
                      {s.presupuesto_inicial != null
                        ? `${fmtMoney(s.ejecutado, s.moneda)} / ${fmtMoney(s.presupuesto_inicial, s.moneda)}`
                        : fmtMoney(s.ejecutado, s.moneda)}
                    </span>
                    {canEdit && (
                      <div className="flex gap-0.5 ml-2">
                        <button onClick={() => onEditSub(s)} className="text-stone-400 hover:text-stone-700 p-0.5">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => onDeleteSub(s)} className="text-stone-400 hover:text-rose-700 p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {s.presupuesto_inicial != null && Number(s.presupuesto_inicial) > 0 && (
                    <div className="ml-6 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${subTone} transition-all`}
                        style={{ width: `${Math.min(subPct, 100)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function CategoryModal({ projectId, category, categories, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !category.id;
  const [draft, setDraft] = useState({ ...EMPTY, ...category });
  const [saving, setSaving] = useState(false);
  const isSubcategory = !!draft.parent_id;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!draft.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        presupuesto_inicial:
          draft.presupuesto_inicial === "" || draft.presupuesto_inicial == null
            ? null
            : Number(draft.presupuesto_inicial),
      };
      if (isNew) await createCategory({ projectId, ...payload });
      else await updateCategory(category.id, payload);
      toast.success(isNew ? "Partida creada" : "Partida actualizada");
      onSaved();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  const parentName = draft.parent_id
    ? categories.find((c) => c.id === draft.parent_id)?.nombre
    : null;

  return (
    <Modal
      title={
        isNew
          ? isSubcategory
            ? `Nueva subpartida de "${parentName || ""}"`
            : "Nueva partida"
          : "Editar partida"
      }
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <Input
          label="Nombre"
          autoFocus
          required
          value={draft.nombre}
          onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Presupuesto inicial"
            type="number"
            step="0.01"
            min="0"
            value={draft.presupuesto_inicial ?? ""}
            onChange={(e) => setDraft({ ...draft, presupuesto_inicial: e.target.value })}
            placeholder="Opcional"
          />
          <Select
            label="Moneda"
            value={draft.moneda}
            onChange={(e) => setDraft({ ...draft, moneda: e.target.value })}
            disabled={isSubcategory}
            hint={isSubcategory ? "Hereda de la partida padre" : undefined}
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-stone-700 mb-1.5 block">Color</label>
          <div className="flex gap-1.5">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft({ ...draft, color: c })}
                aria-label={`Color ${c}`}
                className={`w-6 h-6 rounded-full border-2 ${
                  draft.color === c ? "border-stone-900" : "border-white"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isNew ? "Crear" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteCategoryModal({ category, onClose, onDeleted }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCategory(category.id);
      toast.success("Partida eliminada");
      onDeleted();
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
      setDeleting(false);
    }
  };
  return (
    <Modal
      title="Eliminar partida"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Eliminar</Button>
        </>
      }
    >
      <p className="text-sm text-stone-700">
        Vas a eliminar <strong>{category.nombre}</strong>. Las subpartidas se eliminan
        también y los egresos asociados quedan sin partida.
      </p>
    </Modal>
  );
}
