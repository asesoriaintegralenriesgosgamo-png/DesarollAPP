import { useMemo, useState } from "react";
import { Plus, ArrowRight, Trash2, Pencil, Repeat } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Select, Textarea } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import {
  createTransfer,
  updateTransfer,
  deleteTransfer,
} from "../../lib/api/partnerTransfers";
import {
  fmtMoney,
  fmtDate,
  fmtDateShort,
  TRANSFER_TIPO_LABEL,
} from "../../lib/accounts/format";

const EMPTY = {
  from_partner_id: "",
  to_partner_id: "",
  fecha: new Date().toISOString().slice(0, 10),
  tipo: "cesion_porcentaje",
  porcentaje_transferido: "",
  monto: "",
  moneda: "MXN",
  concepto: "",
  referencia: "",
};

export function TransfersTable({
  projectId,
  canEdit,
  userId,
  partners,
  transfers,
  onChanged,
}) {
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const partnerById = useMemo(
    () => Object.fromEntries(partners.map((p) => [p.id, p])),
    [partners]
  );

  if (partners.length < 2) {
    return (
      <EmptyState
        icon={Repeat}
        title="Necesitas al menos 2 socios"
        description="Las transferencias y cesiones se hacen entre dos socios. Crea al menos dos en la pestaña Socios."
      />
    );
  }

  if (transfers.length === 0 && !editing) {
    return (
      <EmptyState
        icon={Repeat}
        title="Sin transferencias entre socios"
        description="Registra cesiones de porcentaje contractual, ajustes o distribuciones entre los socios."
        action={
          canEdit && (
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="w-4 h-4" />
              Nueva transferencia
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
            Nueva transferencia
          </Button>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Fecha</th>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">De</th>
              <th className="w-6" />
              <th className="text-left px-3 py-2 font-medium">A</th>
              <th className="text-right px-3 py-2 font-medium">%</th>
              <th className="text-right px-3 py-2 font-medium">Monto</th>
              <th className="text-left px-3 py-2 font-medium">Concepto</th>
              {canEdit && <th className="w-20" />}
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => {
              const from = partnerById[t.from_partner_id];
              const to = partnerById[t.to_partner_id];
              return (
                <tr key={t.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-3 py-2 tabular-nums text-stone-700">
                    {fmtDateShort(t.fecha)}
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {TRANSFER_TIPO_LABEL[t.tipo]}
                  </td>
                  <td className="px-3 py-2">
                    <PartnerChip partner={from} />
                  </td>
                  <td className="px-3 py-2 text-stone-400">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </td>
                  <td className="px-3 py-2">
                    <PartnerChip partner={to} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-900">
                    {t.porcentaje_transferido != null
                      ? `${Number(t.porcentaje_transferido).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                    {t.monto != null && Number(t.monto) > 0
                      ? fmtMoney(t.monto, t.moneda)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-stone-600 max-w-xs truncate">
                    {t.concepto || "—"}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => setEditing(t)}
                          className="text-stone-400 hover:text-stone-700 p-1"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(t)}
                          className="text-stone-400 hover:text-rose-700 p-1"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <TransferModal
          projectId={projectId}
          userId={userId}
          transfer={editing}
          partners={partners}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
      {confirmDelete && (
        <Modal
          title="Eliminar transferencia"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await deleteTransfer(confirmDelete.id);
                  setConfirmDelete(null);
                  onChanged?.();
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar esta transferencia del {fmtDate(confirmDelete.fecha)}.
          </p>
        </Modal>
      )}
    </div>
  );
}

function PartnerChip({ partner }) {
  if (!partner) return <span className="text-stone-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: partner.color }}
      />
      <span className="text-stone-900">{partner.nombre}</span>
    </span>
  );
}

function TransferModal({ projectId, userId, transfer, partners, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !transfer.id;
  const [draft, setDraft] = useState({ ...EMPTY, ...transfer });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!draft.from_partner_id || !draft.to_partner_id) {
      toast.error("Selecciona ambos socios");
      return;
    }
    if (draft.from_partner_id === draft.to_partner_id) {
      toast.error("Los socios deben ser diferentes");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        porcentaje_transferido:
          draft.porcentaje_transferido === "" ? null : Number(draft.porcentaje_transferido),
        monto: draft.monto === "" ? null : Number(draft.monto),
      };
      if (isNew) await createTransfer({ projectId, userId, ...payload });
      else await updateTransfer(transfer.id, payload);
      toast.success(isNew ? "Transferencia registrada" : "Transferencia actualizada");
      onSaved();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Nueva transferencia" : "Editar transferencia"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="De (socio origen)"
            required
            value={draft.from_partner_id}
            onChange={(e) => setDraft({ ...draft, from_partner_id: e.target.value })}
          >
            <option value="">Selecciona...</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Select
            label="A (socio destino)"
            required
            value={draft.to_partner_id}
            onChange={(e) => setDraft({ ...draft, to_partner_id: e.target.value })}
          >
            <option value="">Selecciona...</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha"
            type="date"
            required
            value={draft.fecha}
            onChange={(e) => setDraft({ ...draft, fecha: e.target.value })}
          />
          <Select
            label="Tipo"
            value={draft.tipo}
            onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
          >
            {Object.entries(TRANSFER_TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="% transferido"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={draft.porcentaje_transferido}
            onChange={(e) => setDraft({ ...draft, porcentaje_transferido: e.target.value })}
          />
          <Input
            label="Monto (opcional)"
            type="number"
            step="0.01"
            min="0"
            value={draft.monto}
            onChange={(e) => setDraft({ ...draft, monto: e.target.value })}
          />
          <Select
            label="Moneda"
            value={draft.moneda}
            onChange={(e) => setDraft({ ...draft, moneda: e.target.value })}
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </Select>
        </div>
        <Input
          label="Referencia"
          value={draft.referencia || ""}
          onChange={(e) => setDraft({ ...draft, referencia: e.target.value })}
        />
        <Textarea
          label="Concepto"
          rows={2}
          value={draft.concepto || ""}
          onChange={(e) => setDraft({ ...draft, concepto: e.target.value })}
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isNew ? "Registrar" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
