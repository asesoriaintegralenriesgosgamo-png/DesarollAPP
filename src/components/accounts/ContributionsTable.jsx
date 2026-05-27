import { useMemo, useState } from "react";
import {
  Plus,
  TrendingUp,
  Pencil,
  Trash2,
  Paperclip,
  Filter,
  X,
  Upload,
  Download,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Select, Textarea } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import {
  createContribution,
  updateContribution,
  deleteContribution,
  uploadContributionReceipt,
  getContributionReceiptUrl,
  removeStorageFile,
} from "../../lib/api/partnerContributions";
import {
  fmtMoney,
  fmtDate,
  fmtDateShort,
  CONTRIBUTION_TIPO_LABEL,
  CONTRIBUTION_ESTADO_LABEL,
  CONTRIBUTION_ESTADO_TONE,
  METODO_LABEL,
} from "../../lib/accounts/format";

const EMPTY = {
  partner_id: "",
  account_id: "",
  fecha: new Date().toISOString().slice(0, 10),
  monto: "",
  moneda: "MXN",
  tipo: "capital",
  concepto: "",
  metodo: "transferencia",
  referencia: "",
  estado: "registrada",
};

export function ContributionsTable({
  projectId,
  canEdit,
  userId,
  contributions,
  partners,
  accounts,
  onChanged,
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterPartner, setFilterPartner] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterEstado, setFilterEstado] = useState("");

  const partnerById = useMemo(
    () => Object.fromEntries(partners.map((p) => [p.id, p])),
    [partners]
  );
  const accountById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const filtered = useMemo(
    () =>
      contributions
        .filter((c) => !filterPartner || c.partner_id === filterPartner)
        .filter((c) => !filterTipo || c.tipo === filterTipo)
        .filter((c) => !filterEstado || c.estado === filterEstado),
    [contributions, filterPartner, filterTipo, filterEstado]
  );

  const total = useMemo(
    () =>
      filtered.reduce(
        (acc, c) => {
          acc[c.moneda] = (acc[c.moneda] || 0) + (Number(c.monto) || 0);
          return acc;
        },
        {}
      ),
    [filtered]
  );

  const openReceipt = async (storagePath) => {
    try {
      const url = await getContributionReceiptUrl(storagePath, 60);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message || "No se pudo abrir el comprobante");
    }
  };

  if (partners.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Primero registra socios"
        description="Necesitas al menos un socio para registrar aportaciones. Ve a la pestaña Socios y crea uno."
      />
    );
  }

  if (contributions.length === 0 && !editing) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Sin aportaciones"
        description="Registra cada vez que un socio aporte capital al proyecto. Puedes subir el comprobante de cada movimiento."
        action={
          canEdit && (
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="w-4 h-4" />
              Nueva aportación
            </Button>
          )
        }
      />
    );
  }

  const hasFilters = filterPartner || filterTipo || filterEstado;

  return (
    <div className="flex flex-col gap-3">
      {/* Filtros + acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Filter className="w-3 h-3" />
          Filtrar:
        </div>
        <select
          value={filterPartner}
          onChange={(e) => setFilterPartner(e.target.value)}
          className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:bg-white"
        >
          <option value="">Todos los socios</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:bg-white"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(CONTRIBUTION_TIPO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:bg-white"
        >
          <option value="">Cualquier estado</option>
          {Object.entries(CONTRIBUTION_ESTADO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setFilterPartner("");
              setFilterTipo("");
              setFilterEstado("");
            }}
            className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
        {canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY })} size="sm" className="ml-auto">
            <Plus className="w-3.5 h-3.5" />
            Nueva aportación
          </Button>
        )}
      </div>

      {/* Total filtrado */}
      <div className="text-xs text-stone-600 flex gap-3">
        <span>{filtered.length} registro{filtered.length === 1 ? "" : "s"}</span>
        {Object.entries(total).map(([moneda, monto]) => (
          <span key={moneda}>
            Total <strong className="text-stone-900 tabular-nums">{fmtMoney(monto, moneda)}</strong>
          </span>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Fecha</th>
              <th className="text-left px-3 py-2 font-medium">Socio</th>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Concepto</th>
              <th className="text-left px-3 py-2 font-medium">Cuenta</th>
              <th className="text-left px-3 py-2 font-medium">Método</th>
              <th className="text-right px-3 py-2 font-medium">Monto</th>
              <th className="text-left px-3 py-2 font-medium">Estado</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const partner = partnerById[c.partner_id];
              const account = accountById[c.account_id];
              const tone = CONTRIBUTION_ESTADO_TONE[c.estado];
              return (
                <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-3 py-2 tabular-nums text-stone-700">
                    {fmtDateShort(c.fecha)}
                  </td>
                  <td className="px-3 py-2">
                    {partner ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: partner.color }}
                        />
                        <span className="text-stone-900 font-medium">{partner.nombre}</span>
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {CONTRIBUTION_TIPO_LABEL[c.tipo]}
                  </td>
                  <td className="px-3 py-2 text-stone-700 max-w-xs truncate">
                    {c.concepto || "—"}
                  </td>
                  <td className="px-3 py-2 text-stone-500">{account?.nombre || "—"}</td>
                  <td className="px-3 py-2 text-stone-500">
                    {c.metodo ? METODO_LABEL[c.metodo] : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-700 tabular-nums">
                    {fmtMoney(c.monto, c.moneda)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tone.bg} ${tone.text} ${tone.border}`}
                    >
                      {CONTRIBUTION_ESTADO_LABEL[c.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      {c.comprobante_storage_path && (
                        <button
                          onClick={() => openReceipt(c.comprobante_storage_path)}
                          className="text-stone-400 hover:text-stone-700 p-1"
                          title="Ver comprobante"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button
                            onClick={() => setEditing(c)}
                            className="text-stone-400 hover:text-stone-700 p-1"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(c)}
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
            No hay aportaciones con esos filtros.
          </p>
        )}
      </div>

      {editing && (
        <ContributionModal
          projectId={projectId}
          userId={userId}
          contribution={editing}
          partners={partners}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
      {confirmDelete && (
        <DeleteContributionModal
          contribution={confirmDelete}
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

function ContributionModal({ projectId, userId, contribution, partners, accounts, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !contribution.id;
  const [draft, setDraft] = useState({ ...EMPTY, ...contribution });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!draft.partner_id) {
      toast.error("Selecciona un socio");
      return;
    }
    if (!draft.monto || Number(draft.monto) <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!draft.fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        monto: Number(draft.monto),
      };
      let savedRow;
      if (isNew) {
        savedRow = await createContribution({ projectId, userId, ...payload });
      } else {
        savedRow = await updateContribution(contribution.id, payload);
      }
      // Upload comprobante si hay archivo
      if (file) {
        try {
          const path = await uploadContributionReceipt({
            projectId,
            contributionId: savedRow.id,
            file,
          });
          await updateContribution(savedRow.id, {
            comprobante_storage_path: path,
          });
        } catch (err) {
          toast.error(`Aportación guardada, pero falló el comprobante: ${err.message}`);
        }
      }
      toast.success(isNew ? "Aportación registrada" : "Aportación actualizada");
      onSaved();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  const handleRemoveReceipt = async () => {
    if (!draft.comprobante_storage_path) return;
    try {
      await removeStorageFile(draft.comprobante_storage_path);
      await updateContribution(contribution.id, { comprobante_storage_path: null });
      setDraft({ ...draft, comprobante_storage_path: null });
      toast.success("Comprobante eliminado");
    } catch (err) {
      toast.error(err.message || "No se pudo quitar el comprobante");
    }
  };

  const openCurrent = async () => {
    try {
      const url = await getContributionReceiptUrl(draft.comprobante_storage_path, 60);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal
      title={isNew ? "Nueva aportación" : "Editar aportación"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Socio"
            required
            value={draft.partner_id}
            onChange={(e) => setDraft({ ...draft, partner_id: e.target.value })}
          >
            <option value="">Selecciona...</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Select
            label="Cuenta destino (opcional)"
            value={draft.account_id || ""}
            onChange={(e) => setDraft({ ...draft, account_id: e.target.value })}
          >
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Fecha"
            type="date"
            required
            value={draft.fecha}
            onChange={(e) => setDraft({ ...draft, fecha: e.target.value })}
          />
          <Input
            label="Monto"
            type="number"
            step="0.01"
            min="0"
            required
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

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            value={draft.tipo}
            onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
          >
            {Object.entries(CONTRIBUTION_TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select
            label="Método"
            value={draft.metodo || ""}
            onChange={(e) => setDraft({ ...draft, metodo: e.target.value })}
          >
            <option value="">—</option>
            {Object.entries(METODO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Referencia (folio, # de transferencia)"
          value={draft.referencia || ""}
          onChange={(e) => setDraft({ ...draft, referencia: e.target.value })}
        />

        <Textarea
          label="Concepto / descripción"
          rows={2}
          value={draft.concepto || ""}
          onChange={(e) => setDraft({ ...draft, concepto: e.target.value })}
        />

        <Select
          label="Estado"
          value={draft.estado}
          onChange={(e) => setDraft({ ...draft, estado: e.target.value })}
        >
          {Object.entries(CONTRIBUTION_ESTADO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>

        {/* Comprobante */}
        <div>
          <label className="text-xs font-medium text-stone-700 mb-1.5 block">
            Comprobante
          </label>
          {draft.comprobante_storage_path ? (
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
              <Paperclip className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-xs text-stone-700 flex-1">Comprobante adjunto</span>
              <button type="button" onClick={openCurrent} className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1">
                <Download className="w-3 h-3" /> Ver
              </button>
              <button type="button" onClick={handleRemoveReceipt} className="text-xs text-rose-600 hover:text-rose-800 inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Quitar
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-stone-300 rounded-md cursor-pointer hover:bg-stone-50">
              <Upload className="w-3.5 h-3.5" />
              {file ? file.name : "Subir comprobante (PDF/imagen)"}
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          )}
        </div>

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

function DeleteContributionModal({ contribution, onClose, onDeleted }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (contribution.comprobante_storage_path) {
        await removeStorageFile(contribution.comprobante_storage_path);
      }
      await deleteContribution(contribution.id);
      toast.success("Aportación eliminada");
      onDeleted();
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
      setDeleting(false);
    }
  };
  return (
    <Modal
      title="Eliminar aportación"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Eliminar</Button>
        </>
      }
    >
      <p className="text-sm text-stone-700">
        Vas a eliminar esta aportación de{" "}
        <strong>{fmtMoney(contribution.monto, contribution.moneda)}</strong> del{" "}
        {fmtDate(contribution.fecha)}. Esta acción no se puede deshacer.
      </p>
    </Modal>
  );
}
