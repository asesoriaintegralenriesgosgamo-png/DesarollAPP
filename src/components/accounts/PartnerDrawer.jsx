import { useEffect, useMemo, useState } from "react";
import {
  Save,
  Trash2,
  User as UserIcon,
  Mail,
  Wallet,
  FileSignature,
  TrendingUp,
  StickyNote,
  Upload,
  Download,
  FileText,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Select, Textarea } from "../ui/Input";
import { useToast } from "../ui/Toast";
import {
  createPartner,
  updatePartner,
  deletePartner,
} from "../../lib/api/projectPartners";
import {
  uploadContract,
  getContractSignedUrl,
  deleteContract,
} from "../../lib/api/partnerContracts";
import { computePartnerStatus } from "../../lib/accounts/calc";
import {
  fmtMoney,
  fmtDate,
  PARTNER_COLORS,
  PARTNER_TIPO_LABEL,
  CONTRACT_TIPO_LABEL,
  CONTRIBUTION_TIPO_LABEL,
} from "../../lib/accounts/format";

const SECTION_HEAD =
  "flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-2";

function blank(usedColors = []) {
  const color =
    PARTNER_COLORS.find((c) => !usedColors.includes(c)) || PARTNER_COLORS[0];
  return {
    nombre: "",
    tipo_persona: "fisica",
    rfc: "",
    curp: "",
    identificacion_tipo: "",
    identificacion_numero: "",
    email: "",
    telefono: "",
    domicilio_fiscal: "",
    rol_en_proyecto: "",
    porcentaje_contractual: 0,
    monto_comprometido: 0,
    moneda: "MXN",
    color,
    activo: true,
    notas: "",
  };
}

export function PartnerDrawer({
  open,
  partner,
  projectId,
  userId,
  canEdit,
  contributions = [],
  contracts = [],
  accounts = [],
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const isNew = !partner?.id;
  const [draft, setDraft] = useState(() => ({ ...blank(), ...(partner || {}) }));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft({ ...blank(), ...(partner || {}) });
  }, [partner]);

  const status = useMemo(
    () => (partner?.id ? computePartnerStatus(partner, contributions) : null),
    [partner, contributions]
  );

  const partnerContracts = useMemo(
    () => (partner?.id ? contracts.filter((c) => c.partner_id === partner.id) : []),
    [contracts, partner]
  );

  const partnerContribs = useMemo(
    () =>
      partner?.id
        ? contributions
            .filter((c) => c.partner_id === partner.id)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        : [],
    [contributions, partner]
  );

  const accountById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const updateField = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    if (!draft.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        porcentaje_contractual:
          draft.porcentaje_contractual === "" || draft.porcentaje_contractual == null
            ? null
            : Number(draft.porcentaje_contractual),
        monto_comprometido:
          draft.monto_comprometido === "" || draft.monto_comprometido == null
            ? null
            : Number(draft.monto_comprometido),
      };
      if (isNew) {
        await createPartner({ projectId, userId, ...payload });
        toast.success("Socio creado");
      } else {
        await updatePartner(partner.id, { userId, ...payload });
        toast.success("Socio actualizado");
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deletePartner(partner.id);
      toast.success("Socio eliminado");
      setConfirmDelete(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  };

  const handleContractUpload = async (file, tipo) => {
    try {
      await uploadContract({
        projectId,
        partnerId: partner.id,
        file,
        userId,
        tipo,
        nombre: file.name,
      });
      toast.success("Contrato subido");
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "No se pudo subir el contrato");
    }
  };

  const handleContractOpen = async (c) => {
    try {
      const url = await getContractSignedUrl(c.storage_path, 60);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message || "No se pudo abrir");
    }
  };

  const handleContractDelete = async (c) => {
    try {
      await deleteContract({ id: c.id, storagePath: c.storage_path });
      toast.success("Contrato eliminado");
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="xl"
      title={isNew ? "Nuevo socio" : draft.nombre || "Socio"}
      footer={
        <>
          {!isNew && canEdit && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-rose-700 hover:text-rose-800 inline-flex items-center gap-1.5 mr-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          )}
          <Button variant="ghost" onClick={onClose} size="sm">
            Cerrar
          </Button>
          {canEdit && (
            <Button onClick={handleSave} loading={saving} size="sm">
              <Save className="w-3.5 h-3.5" />
              {isNew ? "Crear" : "Guardar"}
            </Button>
          )}
        </>
      }
    >
      <div className="px-4 py-4 flex flex-col gap-5">
        {/* Header con color y nombre */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-semibold shrink-0"
              style={{ backgroundColor: draft.color }}
            >
              {initials(draft.nombre)}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                {PARTNER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateField({ color: c })}
                    aria-label={`Color ${c}`}
                    className={`w-3.5 h-3.5 rounded-full border ${
                      draft.color === c ? "ring-2 ring-stone-900 ring-offset-1" : "border-white"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={draft.nombre}
              onChange={(e) => updateField({ nombre: e.target.value })}
              disabled={!canEdit}
              placeholder="Nombre del socio"
              maxLength={200}
              className="w-full bg-transparent text-base font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none border-b border-transparent focus:border-stone-300 pb-1"
            />
            <input
              type="text"
              value={draft.rol_en_proyecto || ""}
              onChange={(e) => updateField({ rol_en_proyecto: e.target.value })}
              disabled={!canEdit}
              placeholder="Rol (ej: Inversionista, Socio operador)"
              className="w-full bg-transparent text-xs text-stone-500 placeholder:text-stone-400 focus:outline-none mt-1"
            />
          </div>
        </div>

        {/* Status snapshot si existe */}
        {!isNew && status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatusCard label="% contractual" value={`${(draft.porcentaje_contractual || 0).toFixed(2)}%`} />
            <StatusCard label="Comprometido" value={fmtMoney(status.comprometido, draft.moneda)} />
            <StatusCard label="Aportado" value={fmtMoney(status.aportado, draft.moneda)} tone="positive" />
            <StatusCard
              label="Falta"
              value={fmtMoney(status.faltante, draft.moneda)}
              tone={status.faltante > 0 ? "warn" : "neutral"}
            />
          </div>
        )}

        {/* Identidad */}
        <Section icon={UserIcon} label="Identidad">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo persona"
              value={draft.tipo_persona}
              disabled={!canEdit}
              onChange={(e) => updateField({ tipo_persona: e.target.value })}
            >
              {Object.entries(PARTNER_TIPO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Input
              label="RFC"
              value={draft.rfc || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ rfc: e.target.value.toUpperCase() })}
              maxLength={13}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Input
              label="CURP"
              value={draft.curp || ""}
              disabled={!canEdit || draft.tipo_persona === "moral"}
              onChange={(e) => updateField({ curp: e.target.value.toUpperCase() })}
              maxLength={18}
            />
            <Input
              label="Identificación"
              placeholder="ej. INE 123456..."
              value={draft.identificacion_numero || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ identificacion_numero: e.target.value })}
            />
          </div>
        </Section>

        {/* Contacto */}
        <Section icon={Mail} label="Contacto">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              value={draft.email || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ email: e.target.value })}
            />
            <Input
              label="Teléfono"
              value={draft.telefono || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ telefono: e.target.value })}
            />
          </div>
          <Textarea
            label="Domicilio fiscal"
            className="mt-3"
            rows={2}
            value={draft.domicilio_fiscal || ""}
            disabled={!canEdit}
            onChange={(e) => updateField({ domicilio_fiscal: e.target.value })}
          />
        </Section>

        {/* Participación */}
        <Section icon={Wallet} label="Participación financiera">
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="% contractual"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={draft.porcentaje_contractual ?? ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ porcentaje_contractual: e.target.value })}
            />
            <Input
              label="Monto comprometido"
              type="number"
              step="0.01"
              min="0"
              value={draft.monto_comprometido ?? ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ monto_comprometido: e.target.value })}
            />
            <Select
              label="Moneda"
              value={draft.moneda || "MXN"}
              disabled={!canEdit}
              onChange={(e) => updateField({ moneda: e.target.value })}
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-700 mt-3">
            <input
              type="checkbox"
              checked={!!draft.activo}
              disabled={!canEdit}
              onChange={(e) => updateField({ activo: e.target.checked })}
            />
            Socio activo
          </label>
        </Section>

        {/* Historial de aportaciones */}
        {!isNew && (
          <Section icon={TrendingUp} label={`Aportaciones (${partnerContribs.length})`}>
            {partnerContribs.length === 0 ? (
              <p className="text-xs text-stone-500 py-2">
                Sin aportaciones registradas. Ve a la pestaña "Aportaciones" para registrar.
              </p>
            ) : (
              <div className="border border-stone-200 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">Fecha</th>
                      <th className="text-left px-2 py-1.5 font-medium">Tipo</th>
                      <th className="text-left px-2 py-1.5 font-medium">Cuenta destino</th>
                      <th className="text-right px-2 py-1.5 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerContribs.map((c) => (
                      <tr key={c.id} className="border-t border-stone-100">
                        <td className="px-2 py-1.5 tabular-nums text-stone-700">{fmtDate(c.fecha)}</td>
                        <td className="px-2 py-1.5 text-stone-700">
                          {CONTRIBUTION_TIPO_LABEL[c.tipo] || c.tipo}
                        </td>
                        <td className="px-2 py-1.5 text-stone-500">
                          {accountById[c.account_id]?.nombre || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium text-emerald-700">
                          {fmtMoney(c.monto, c.moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* Contratos */}
        {!isNew && (
          <Section icon={FileSignature} label={`Contratos (${partnerContracts.length})`}>
            {canEdit && <UploadContract onPick={handleContractUpload} />}
            {partnerContracts.length > 0 && (
              <ul className="mt-2 divide-y divide-stone-100 border border-stone-200 rounded-md">
                {partnerContracts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-stone-900 truncate">
                        {c.nombre}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {CONTRACT_TIPO_LABEL[c.tipo] || c.tipo}
                        {c.fecha_firma && <> · firmado {fmtDate(c.fecha_firma)}</>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleContractOpen(c)}
                      className="text-stone-400 hover:text-stone-700 p-1"
                      title="Descargar"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleContractDelete(c)}
                        className="text-stone-400 hover:text-rose-700 p-1"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Notas */}
        <Section icon={StickyNote} label="Notas">
          <Textarea
            rows={3}
            value={draft.notas || ""}
            disabled={!canEdit}
            onChange={(e) => updateField({ notas: e.target.value })}
            placeholder="Acuerdos, condiciones especiales..."
          />
        </Section>
      </div>

      {confirmDelete && (
        <Modal
          title="Eliminar socio"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar <strong>{partner?.nombre}</strong>. Se eliminarán también
            todas sus aportaciones y contratos. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </Drawer>
  );
}

function Section({ icon: Icon, label, children }) {
  return (
    <section>
      <div className={SECTION_HEAD}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      {children}
    </section>
  );
}

function StatusCard({ label, value, tone }) {
  const color =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : "text-stone-900";
  return (
    <div className="bg-stone-50 border border-stone-100 rounded-md px-2 py-2">
      <div className="text-[9px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function UploadContract({ onPick }) {
  const [tipo, setTipo] = useState("asociacion");
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await onPick(file, tipo);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        className="bg-stone-50 border border-stone-200 rounded-md text-xs px-2 py-1.5"
      >
        {Object.entries(CONTRACT_TIPO_LABEL).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-stone-300 rounded-md cursor-pointer hover:bg-stone-50">
        <Upload className="w-3.5 h-3.5" />
        {busy ? "Subiendo..." : "Subir contrato (PDF)"}
        <input
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          disabled={busy}
          onChange={handleFile}
        />
      </label>
    </div>
  );
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
