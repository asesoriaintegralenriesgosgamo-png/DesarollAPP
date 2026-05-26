import { useState } from "react";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { Input, Select, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { SectionCard } from "./SectionCard";
import {
  createOwner,
  updateOwner,
  deleteOwner,
} from "../../lib/api/properties";

const EMPTY_OWNER = {
  nombre: "",
  tipo_persona: "fisica",
  rfc: "",
  curp: "",
  identificacion_tipo: "",
  identificacion_numero: "",
  porcentaje: "",
  email: "",
  telefono: "",
  domicilio_fiscal: "",
  notas: "",
};

function ownerToForm(row) {
  if (!row) return { ...EMPTY_OWNER };
  const out = { ...EMPTY_OWNER };
  for (const k of Object.keys(EMPTY_OWNER)) {
    const val = row[k];
    out[k] = val === null || val === undefined ? "" : String(val);
  }
  if (!out.tipo_persona) out.tipo_persona = "fisica";
  return out;
}

function formToPayload(form) {
  return {
    nombre: form.nombre.trim(),
    tipo_persona: form.tipo_persona || "fisica",
    rfc: form.rfc.trim() || null,
    curp: form.curp.trim() || null,
    identificacion_tipo: form.identificacion_tipo.trim() || null,
    identificacion_numero: form.identificacion_numero.trim() || null,
    porcentaje:
      form.porcentaje === "" || form.porcentaje === null
        ? null
        : Number(form.porcentaje),
    email: form.email.trim() || null,
    telefono: form.telefono.trim() || null,
    domicilio_fiscal: form.domicilio_fiscal.trim() || null,
    notas: form.notas.trim() || null,
  };
}

export function OwnersList({ propertyId, projectId, owners, canEdit, onChange }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | "new" | row
  const [confirmDelete, setConfirmDelete] = useState(null);

  const total = owners.reduce(
    (acc, o) => acc + (o.porcentaje ? Number(o.porcentaje) : 0),
    0
  );

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteOwner(confirmDelete.id);
      onChange(owners.filter((o) => o.id !== confirmDelete.id));
      toast.success("Propietario eliminado");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <SectionCard
        title="Propietarios"
        icon={Users}
        action={
          canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditing("new")}>
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </Button>
          )
        }
      >
        {owners.length === 0 ? (
          <p className="text-xs text-stone-500">Sin propietarios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Nombre</th>
                  <th className="text-left px-2 py-1.5 font-medium">Persona</th>
                  <th className="text-left px-2 py-1.5 font-medium">RFC</th>
                  <th className="text-right px-2 py-1.5 font-medium">%</th>
                  <th className="text-left px-2 py-1.5 font-medium">Contacto</th>
                  {canEdit && <th className="w-16" />}
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id} className="border-t border-stone-100">
                    <td className="px-2 py-2 text-stone-900 font-medium">{o.nombre}</td>
                    <td className="px-2 py-2 text-stone-600">
                      {o.tipo_persona === "moral" ? "Moral" : "Física"}
                    </td>
                    <td className="px-2 py-2 text-stone-600">{o.rfc || "—"}</td>
                    <td className="px-2 py-2 text-right text-stone-600">
                      {o.porcentaje != null ? `${o.porcentaje}%` : "—"}
                    </td>
                    <td className="px-2 py-2 text-stone-600 text-xs">
                      {o.email || o.telefono || "—"}
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => setEditing(o)}
                          className="text-stone-400 hover:text-stone-900 p-1"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(o)}
                          className="text-stone-400 hover:text-rose-700 p-1"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 text-xs">
                  <td colSpan={3} className="px-2 py-2 text-stone-500">
                    Suma de participación
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-semibold ${
                      total > 100
                        ? "text-rose-700"
                        : total === 100
                        ? "text-emerald-700"
                        : "text-stone-700"
                    }`}
                  >
                    {total.toFixed(2)}%
                  </td>
                  <td colSpan={canEdit ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      {editing && (
        <OwnerModal
          owner={editing === "new" ? null : editing}
          propertyId={propertyId}
          projectId={projectId}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            if (isNew) {
              onChange([...owners, saved]);
            } else {
              onChange(owners.map((o) => (o.id === saved.id ? saved : o)));
            }
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Eliminar propietario"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar a <strong>{confirmDelete.nombre}</strong>. Esta acción no se puede
            deshacer.
          </p>
        </Modal>
      )}
    </>
  );
}

function OwnerModal({ owner, propertyId, projectId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(ownerToForm(owner));
  const [saving, setSaving] = useState(false);
  const isNew = !owner;

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [k]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const saved = isNew
        ? await createOwner({ propertyId, projectId, ...payload })
        : await updateOwner(owner.id, payload);
      onSaved(saved, isNew);
      toast.success(isNew ? "Propietario agregado" : "Propietario actualizado");
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Nuevo propietario" : "Editar propietario"}
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!form.nombre.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input label="Nombre completo / Razón social" autoFocus required value={form.nombre} onChange={set("nombre")} />
        <Select label="Tipo de persona" value={form.tipo_persona} onChange={set("tipo_persona")}>
          <option value="fisica">Persona física</option>
          <option value="moral">Persona moral</option>
        </Select>
        <Input label="RFC" value={form.rfc} onChange={set("rfc")} />
        <Input label="CURP" value={form.curp} onChange={set("curp")} />
        <Input label="Tipo de identificación" placeholder="INE, pasaporte…" value={form.identificacion_tipo} onChange={set("identificacion_tipo")} />
        <Input label="Número de identificación" value={form.identificacion_numero} onChange={set("identificacion_numero")} />
        <Input label="% de participación" inputMode="decimal" value={form.porcentaje} onChange={set("porcentaje")} hint="Entre copropietarios debe sumar 100" />
        <Input label="Email" type="email" value={form.email} onChange={set("email")} />
        <Input label="Teléfono" value={form.telefono} onChange={set("telefono")} />
        <Input label="Domicilio fiscal" value={form.domicilio_fiscal} onChange={set("domicilio_fiscal")} />
        <div className="md:col-span-2">
          <Textarea label="Notas" rows={2} value={form.notas} onChange={set("notas")} />
        </div>
      </form>
    </Modal>
  );
}
