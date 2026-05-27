import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Landmark, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Select, Textarea } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import {
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../../lib/api/projectBankAccounts";
import { computeAccountBalance } from "../../lib/accounts/calc";
import {
  fmtMoney,
  maskAccount,
  fmtDate,
  ACCOUNT_TIPO_LABEL,
} from "../../lib/accounts/format";

const EMPTY = {
  nombre: "",
  banco: "",
  numero_cuenta: "",
  clabe: "",
  moneda: "MXN",
  saldo_inicial: 0,
  fecha_apertura: "",
  tipo: "operativa",
  activa: true,
  notas: "",
};

export function BankAccountsList({
  projectId,
  canEdit,
  accounts,
  contributions,
  expenses,
  partners,
  payees,
  onChanged,
}) {
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewing, setViewing] = useState(null);

  const accountsWithBalance = useMemo(
    () =>
      accounts.map((a) => ({
        ...a,
        saldo_actual: computeAccountBalance(a, contributions, expenses),
      })),
    [accounts, contributions, expenses]
  );

  if (accounts.length === 0 && !editing) {
    return (
      <EmptyState
        icon={Landmark}
        title="Sin cuentas bancarias"
        description="Registra las cuentas donde se reciben aportaciones y desde donde se hacen los pagos. Te permitirá ver el saldo real en tiempo real."
        action={
          canEdit && (
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="w-4 h-4" />
              Nueva cuenta
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing({ ...EMPTY })} size="sm">
            <Plus className="w-3.5 h-3.5" />
            Nueva cuenta
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {accountsWithBalance.map((a) => (
          <div
            key={a.id}
            className={`bg-white border rounded-lg p-4 flex flex-col gap-2 transition-all ${
              a.activa
                ? "border-stone-200 hover:border-stone-400 hover:shadow-sm"
                : "border-stone-200 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => setViewing(a)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Landmark className="w-3.5 h-3.5 text-stone-500" />
                  <h3 className="text-sm font-semibold text-stone-900 truncate">
                    {a.nombre}
                  </h3>
                </div>
                <p className="text-xs text-stone-500">
                  {a.banco || "—"} · {maskAccount(a.numero_cuenta)}
                </p>
              </button>
              {canEdit && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setEditing(a)}
                    className="text-stone-400 hover:text-stone-700 p-1"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(a)}
                    className="text-stone-400 hover:text-rose-700 p-1"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider text-stone-500">
                Saldo
              </span>
              <span
                className={`text-lg font-semibold tabular-nums ${
                  a.saldo_actual >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {fmtMoney(a.saldo_actual, a.moneda)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Pill>{ACCOUNT_TIPO_LABEL[a.tipo]}</Pill>
              <Pill>{a.moneda}</Pill>
              {!a.activa && <Pill tone="muted">Inactiva</Pill>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <BankAccountModal
          projectId={projectId}
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
      {confirmDelete && (
        <DeleteAccountModal
          account={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onDeleted={() => {
            setConfirmDelete(null);
            onChanged?.();
          }}
        />
      )}
      {viewing && (
        <AccountMovementsModal
          account={viewing}
          contributions={contributions}
          expenses={expenses}
          partners={partners}
          payees={payees}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function Pill({ children, tone = "default" }) {
  const cls =
    tone === "muted"
      ? "bg-stone-100 text-stone-500"
      : "bg-stone-100 text-stone-700";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border border-stone-200 ${cls}`}>
      {children}
    </span>
  );
}

function BankAccountModal({ projectId, account, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !account.id;
  const [draft, setDraft] = useState({ ...EMPTY, ...account });
  const [saving, setSaving] = useState(false);

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
        saldo_inicial: Number(draft.saldo_inicial) || 0,
      };
      if (isNew) await createBankAccount({ projectId, ...payload });
      else await updateBankAccount(account.id, payload);
      toast.success(isNew ? "Cuenta creada" : "Cuenta actualizada");
      onSaved();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Nueva cuenta bancaria" : "Editar cuenta"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <Input
          label="Nombre"
          required
          autoFocus
          placeholder="ej. BBVA Cuenta de Obra"
          value={draft.nombre}
          onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Banco"
            value={draft.banco}
            onChange={(e) => setDraft({ ...draft, banco: e.target.value })}
          />
          <Select
            label="Tipo"
            value={draft.tipo}
            onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
          >
            {Object.entries(ACCOUNT_TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Número de cuenta"
            value={draft.numero_cuenta}
            onChange={(e) => setDraft({ ...draft, numero_cuenta: e.target.value })}
          />
          <Input
            label="CLABE (18 dígitos)"
            value={draft.clabe}
            onChange={(e) => setDraft({ ...draft, clabe: e.target.value.replace(/\D/g, "") })}
            maxLength={18}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select
            label="Moneda"
            value={draft.moneda}
            onChange={(e) => setDraft({ ...draft, moneda: e.target.value })}
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </Select>
          <Input
            label="Saldo inicial"
            type="number"
            step="0.01"
            value={draft.saldo_inicial}
            onChange={(e) => setDraft({ ...draft, saldo_inicial: e.target.value })}
          />
          <Input
            label="Fecha apertura"
            type="date"
            value={draft.fecha_apertura}
            onChange={(e) => setDraft({ ...draft, fecha_apertura: e.target.value })}
          />
        </div>
        <Textarea
          label="Notas"
          rows={2}
          value={draft.notas}
          onChange={(e) => setDraft({ ...draft, notas: e.target.value })}
        />
        <label className="flex items-center gap-2 text-xs text-stone-700">
          <input
            type="checkbox"
            checked={draft.activa}
            onChange={(e) => setDraft({ ...draft, activa: e.target.checked })}
          />
          Cuenta activa
        </label>
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

function DeleteAccountModal({ account, onClose, onDeleted }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBankAccount(account.id);
      toast.success("Cuenta eliminada");
      onDeleted();
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
      setDeleting(false);
    }
  };
  return (
    <Modal
      title="Eliminar cuenta bancaria"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Eliminar
          </Button>
        </>
      }
    >
      <p className="text-sm text-stone-700">
        Vas a eliminar <strong>{account.nombre}</strong>. Los movimientos asociados
        se mantienen pero perderán la referencia de cuenta.
      </p>
    </Modal>
  );
}

function AccountMovementsModal({ account, contributions, expenses, partners, payees, onClose }) {
  const movements = useMemo(() => {
    const ins = contributions
      .filter((c) => c.account_id === account.id)
      .map((c) => ({
        id: `c-${c.id}`,
        fecha: c.fecha,
        tipo: "in",
        monto: Number(c.monto) || 0,
        moneda: c.moneda,
        descripcion: c.concepto || "Aportación",
        partido:
          partners.find((p) => p.id === c.partner_id)?.nombre || "—",
      }));
    const outs = expenses
      .filter(
        (e) =>
          e.account_id === account.id &&
          (e.estado === "pagado" || e.estado === "conciliado")
      )
      .map((e) => ({
        id: `e-${e.id}`,
        fecha: e.fecha,
        tipo: "out",
        monto: Number(e.monto) || 0,
        moneda: e.moneda,
        descripcion: e.concepto,
        partido: payees.find((p) => p.id === e.payee_id)?.nombre || "—",
      }));
    return [...ins, ...outs].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [account, contributions, expenses, partners, payees]);

  return (
    <Modal title={`Movimientos · ${account.nombre}`} onClose={onClose} size="xl">
      <div className="flex flex-col gap-3">
        <div className="text-xs text-stone-500">
          Saldo inicial: {fmtMoney(account.saldo_inicial, account.moneda)}
          {account.fecha_apertura && <> · Abierta el {fmtDate(account.fecha_apertura)}</>}
        </div>
        {movements.length === 0 ? (
          <p className="text-sm text-stone-500 py-6 text-center">Sin movimientos.</p>
        ) : (
          <div className="border border-stone-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium">Concepto</th>
                  <th className="text-left px-3 py-2 font-medium">Contraparte</th>
                  <th className="text-right px-3 py-2 font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-stone-700 tabular-nums">
                      {fmtDate(m.fecha)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {m.tipo === "in" ? (
                          <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span className="text-stone-900">{m.descripcion}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-stone-600">{m.partido}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${
                        m.tipo === "in" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {m.tipo === "in" ? "+" : "−"} {fmtMoney(m.monto, m.moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
