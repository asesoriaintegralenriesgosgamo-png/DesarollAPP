import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Select, Textarea } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import { createPayee, updatePayee, deletePayee } from "../../lib/api/payees";
import { sumPaidToPayee } from "../../lib/accounts/calc";
import { fmtMoney, PAYEE_TIPO_LABEL } from "../../lib/accounts/format";

const EMPTY = {
  nombre: "",
  tipo: "proveedor",
  rfc: "",
  email: "",
  telefono: "",
  contacto_nombre: "",
  notas: "",
};

export function PayeesList({ projectId, canEdit, payees, expenses, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const rows = useMemo(
    () =>
      payees
        .map((p) => ({
          ...p,
          total_pagado: sumPaidToPayee(p.id, expenses, "MXN"),
          num_egresos: expenses.filter((e) => e.payee_id === p.id).length,
        }))
        .sort((a, b) => b.total_pagado - a.total_pagado),
    [payees, expenses]
  );

  if (rows.length === 0 && !editing) {
    return (
      <EmptyState
        icon={Building2}
        title="Sin proveedores"
        description="Registra proveedores, contratistas y profesionales a quienes les pagas. Después puedes ligarlos a cada egreso."
        action={
          canEdit && (
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="w-4 h-4" />
              Nuevo proveedor
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
            Nuevo proveedor
          </Button>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Nombre</th>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">RFC</th>
              <th className="text-left px-3 py-2 font-medium">Contacto</th>
              <th className="text-right px-3 py-2 font-medium">Total pagado</th>
              <th className="text-right px-3 py-2 font-medium">Egresos</th>
              {canEdit && <th className="w-24" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-3 py-2 font-medium text-stone-900">{p.nombre}</td>
                <td className="px-3 py-2 text-stone-700">{PAYEE_TIPO_LABEL[p.tipo]}</td>
                <td className="px-3 py-2 text-stone-500 tabular-nums">{p.rfc || "—"}</td>
                <td className="px-3 py-2 text-stone-700">
                  {p.contacto_nombre || p.email || p.telefono || "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-900">
                  {fmtMoney(p.total_pagado)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                  {p.num_egresos}
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <button
                        onClick={() => setEditing(p)}
                        className="text-stone-400 hover:text-stone-700 p-1"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p)}
                        className="text-stone-400 hover:text-rose-700 p-1"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <PayeeModal
          projectId={projectId}
          payee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
      {confirmDelete && (
        <DeletePayeeModal
          payee={confirmDelete}
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

function PayeeModal({ projectId, payee, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !payee.id;
  const [draft, setDraft] = useState({ ...EMPTY, ...payee });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!draft.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createPayee({ projectId, ...draft });
      } else {
        await updatePayee(payee.id, draft);
      }
      toast.success(isNew ? "Proveedor creado" : "Proveedor actualizado");
      onSaved();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <Modal title={isNew ? "Nuevo proveedor" : "Editar proveedor"} onClose={onClose} size="lg">
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <Input
          label="Nombre"
          autoFocus
          required
          value={draft.nombre}
          onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            value={draft.tipo}
            onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
          >
            {Object.entries(PAYEE_TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input
            label="RFC"
            value={draft.rfc}
            onChange={(e) => setDraft({ ...draft, rfc: e.target.value.toUpperCase() })}
            placeholder="XAXX010101000"
            maxLength={13}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Email"
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <Input
            label="Teléfono"
            value={draft.telefono}
            onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
          />
        </div>
        <Input
          label="Persona de contacto"
          value={draft.contacto_nombre}
          onChange={(e) => setDraft({ ...draft, contacto_nombre: e.target.value })}
        />
        <Textarea
          label="Notas"
          rows={2}
          value={draft.notas}
          onChange={(e) => setDraft({ ...draft, notas: e.target.value })}
        />
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

function DeletePayeeModal({ payee, onClose, onDeleted }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePayee(payee.id);
      toast.success("Proveedor eliminado");
      onDeleted();
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
      setDeleting(false);
    }
  };

  return (
    <Modal
      title="Eliminar proveedor"
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
        Vas a eliminar <strong>{payee.nombre}</strong>. Los egresos asociados se mantienen
        pero ya no tendrán proveedor.
      </p>
    </Modal>
  );
}
