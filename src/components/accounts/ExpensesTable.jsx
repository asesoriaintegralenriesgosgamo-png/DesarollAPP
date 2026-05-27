import { useMemo, useState } from "react";
import {
  Plus,
  Receipt,
  Pencil,
  Trash2,
  Paperclip,
  Filter,
  X,
  Link2,
  FileText,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import {
  deleteExpense,
  removeStorageFile,
  getExpenseFileUrl,
} from "../../lib/api/projectExpenses";
import {
  fmtMoney,
  fmtDate,
  fmtDateShort,
  EXPENSE_ESTADO_LABEL,
  EXPENSE_ESTADO_TONE,
  METODO_LABEL,
} from "../../lib/accounts/format";
import { ExpenseDrawer } from "./ExpenseDrawer";

export function ExpensesTable({
  projectId,
  canEdit,
  userId,
  expenses,
  partners,
  payees,
  categories,
  accounts,
  tasks,
  onChanged,
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayee, setFilterPayee] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterTask, setFilterTask] = useState("");

  const payeeById = useMemo(
    () => Object.fromEntries(payees.map((p) => [p.id, p])),
    [payees]
  );
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const taskById = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.id, t])),
    [tasks]
  );

  const filtered = useMemo(
    () =>
      expenses
        .filter((e) => !filterCategory || e.category_id === filterCategory)
        .filter((e) => !filterPayee || e.payee_id === filterPayee)
        .filter((e) => !filterEstado || e.estado === filterEstado)
        .filter(
          (e) =>
            !filterTask ||
            (filterTask === "__any" ? e.construction_task_id : e.construction_task_id === filterTask)
        ),
    [expenses, filterCategory, filterPayee, filterEstado, filterTask]
  );

  const totals = useMemo(
    () =>
      filtered.reduce((acc, e) => {
        acc[e.moneda] = (acc[e.moneda] || 0) + (Number(e.monto) || 0);
        return acc;
      }, {}),
    [filtered]
  );

  const openNew = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (e) => {
    setEditing(e);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setEditing(null), 250);
  };

  const openFile = async (path) => {
    try {
      const url = await getExpenseFileUrl(path, 60);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (expenses.length === 0 && !drawerOpen) {
    return (
      <>
        <EmptyState
          icon={Receipt}
          title="Sin egresos registrados"
          description="Registra cada gasto: a quién pagaste, en qué partida, desde qué cuenta, y opcionalmente liga el egreso a una tarea de obra. Sube factura y comprobante para tener todo en orden."
          action={
            canEdit && (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4" />
                Nuevo egreso
              </Button>
            )
          }
        />
        {drawerOpen && (
          <ExpenseDrawer
            open={drawerOpen}
            expense={editing}
            projectId={projectId}
            userId={userId}
            canEdit={canEdit}
            payees={payees}
            categories={categories}
            accounts={accounts}
            tasks={tasks}
            onClose={closeDrawer}
            onSaved={() => {
              closeDrawer();
              onChanged?.();
            }}
          />
        )}
      </>
    );
  }

  const hasFilters = filterCategory || filterPayee || filterEstado || filterTask;

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <Filter className="w-3 h-3" /> Filtrar:
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:bg-white"
          >
            <option value="">Todas las partidas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? "  · " : ""}{c.nombre}
              </option>
            ))}
          </select>
          <select
            value={filterPayee}
            onChange={(e) => setFilterPayee(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:bg-white"
          >
            <option value="">Todos los proveedores</option>
            {payees.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:bg-white"
          >
            <option value="">Cualquier estado</option>
            {Object.entries(EXPENSE_ESTADO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:bg-white"
          >
            <option value="">Cualquier vínculo a obra</option>
            <option value="__any">Vinculado a alguna tarea</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => {
                setFilterCategory("");
                setFilterPayee("");
                setFilterEstado("");
                setFilterTask("");
              }}
              className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
          {canEdit && (
            <Button onClick={openNew} size="sm" className="ml-auto">
              <Plus className="w-3.5 h-3.5" />
              Nuevo egreso
            </Button>
          )}
        </div>

        {/* Totales */}
        <div className="text-xs text-stone-600 flex gap-3 flex-wrap">
          <span>{filtered.length} registro{filtered.length === 1 ? "" : "s"}</span>
          {Object.entries(totals).map(([moneda, monto]) => (
            <span key={moneda}>
              Total <strong className="text-rose-700 tabular-nums">{fmtMoney(monto, moneda)}</strong>
            </span>
          ))}
        </div>

        {/* Tabla */}
        <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Fecha</th>
                <th className="text-left px-3 py-2 font-medium">Concepto</th>
                <th className="text-left px-3 py-2 font-medium">Partida</th>
                <th className="text-left px-3 py-2 font-medium">Proveedor</th>
                <th className="text-left px-3 py-2 font-medium">Cuenta</th>
                <th className="text-left px-3 py-2 font-medium">Tarea obra</th>
                <th className="text-right px-3 py-2 font-medium">Monto</th>
                <th className="text-left px-3 py-2 font-medium">Estado</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const payee = payeeById[e.payee_id];
                const cat = categoryById[e.category_id];
                const acc = accountById[e.account_id];
                const task = taskById[e.construction_task_id];
                const tone = EXPENSE_ESTADO_TONE[e.estado];
                return (
                  <tr key={e.id} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-3 py-2 tabular-nums text-stone-700">
                      {fmtDateShort(e.fecha)}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <div className="text-stone-900 truncate">{e.concepto}</div>
                      {e.referencia && (
                        <div className="text-[10px] text-stone-400 truncate">
                          {e.referencia}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-stone-700">{cat.nombre}</span>
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-stone-700">{payee?.nombre || "—"}</td>
                    <td className="px-3 py-2 text-stone-500">{acc?.nombre || "—"}</td>
                    <td className="px-3 py-2 text-stone-500">
                      {task ? (
                        <span className="inline-flex items-center gap-1 text-stone-700">
                          <Link2 className="w-3 h-3" />
                          <span className="truncate max-w-[140px]">{task.name}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-rose-700 tabular-nums">
                      {fmtMoney(e.monto, e.moneda)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tone.bg} ${tone.text} ${tone.border}`}
                      >
                        {EXPENSE_ESTADO_LABEL[e.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        {e.factura_storage_path && (
                          <button
                            onClick={() => openFile(e.factura_storage_path)}
                            className="text-emerald-600 hover:text-emerald-800 p-1"
                            title="Ver factura"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {e.comprobante_storage_path && (
                          <button
                            onClick={() => openFile(e.comprobante_storage_path)}
                            className="text-stone-400 hover:text-stone-700 p-1"
                            title="Ver comprobante"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEdit(e)}
                              className="text-stone-400 hover:text-stone-700 p-1"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(e)}
                              className="text-stone-400 hover:text-rose-700 p-1"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-sm text-stone-500 text-center py-6">
              No hay egresos con esos filtros.
            </p>
          )}
        </div>
      </div>

      {drawerOpen && (
        <ExpenseDrawer
          open={drawerOpen}
          expense={editing}
          projectId={projectId}
          userId={userId}
          canEdit={canEdit}
          payees={payees}
          categories={categories}
          accounts={accounts}
          tasks={tasks}
          onClose={closeDrawer}
          onSaved={() => {
            closeDrawer();
            onChanged?.();
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Eliminar egreso"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    if (confirmDelete.factura_storage_path) {
                      await removeStorageFile(confirmDelete.factura_storage_path);
                    }
                    if (confirmDelete.comprobante_storage_path) {
                      await removeStorageFile(confirmDelete.comprobante_storage_path);
                    }
                    await deleteExpense(confirmDelete.id);
                    toast.success("Egreso eliminado");
                    setConfirmDelete(null);
                    onChanged?.();
                  } catch (err) {
                    toast.error(err.message || "No se pudo eliminar");
                  }
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar el egreso "{confirmDelete.concepto}" del{" "}
            {fmtDate(confirmDelete.fecha)} por{" "}
            <strong>{fmtMoney(confirmDelete.monto, confirmDelete.moneda)}</strong>.
          </p>
        </Modal>
      )}
    </>
  );
}
