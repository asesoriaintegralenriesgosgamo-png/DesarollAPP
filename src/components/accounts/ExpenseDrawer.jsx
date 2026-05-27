import { useEffect, useState } from "react";
import {
  Save,
  Trash2,
  Receipt,
  Tag,
  Building2,
  Landmark,
  Link2,
  FileText,
  Paperclip,
  StickyNote,
  Upload,
  Download,
  X,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Select, Textarea } from "../ui/Input";
import { useToast } from "../ui/Toast";
import {
  createExpense,
  updateExpense,
  uploadExpenseFile,
  getExpenseFileUrl,
  removeStorageFile,
} from "../../lib/api/projectExpenses";
import {
  EXPENSE_ESTADO_LABEL,
  METODO_LABEL,
} from "../../lib/accounts/format";

const SECTION_HEAD =
  "flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-2";

const EMPTY = {
  payee_id: "",
  category_id: "",
  account_id: "",
  construction_task_id: "",
  fecha: new Date().toISOString().slice(0, 10),
  monto: "",
  moneda: "MXN",
  concepto: "",
  metodo: "transferencia",
  referencia: "",
  estado: "pagado",
  factura_uuid: "",
  factura_folio: "",
  factura_storage_path: null,
  comprobante_storage_path: null,
};

export function ExpenseDrawer({
  open,
  expense,
  projectId,
  userId,
  canEdit,
  payees,
  categories,
  accounts,
  tasks,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const isNew = !expense?.id;
  const [draft, setDraft] = useState(() => ({ ...EMPTY, ...(expense || {}) }));
  const [facturaFile, setFacturaFile] = useState(null);
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({ ...EMPTY, ...(expense || {}) });
    setFacturaFile(null);
    setComprobanteFile(null);
  }, [expense]);

  const updateField = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    if (!draft.concepto.trim()) {
      toast.error("El concepto es obligatorio");
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
      // Convert "" → null for nullable FK fields
      ["payee_id", "category_id", "account_id", "construction_task_id"].forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });

      let row;
      if (isNew) {
        row = await createExpense({ projectId, userId, ...payload });
      } else {
        row = await updateExpense(expense.id, payload);
      }

      // Upload factura si hay
      if (facturaFile) {
        try {
          const path = await uploadExpenseFile({
            projectId,
            expenseId: row.id,
            file: facturaFile,
            kind: "factura",
          });
          await updateExpense(row.id, { factura_storage_path: path });
        } catch (err) {
          toast.error(`Egreso guardado, pero falló la factura: ${err.message}`);
        }
      }

      // Upload comprobante si hay
      if (comprobanteFile) {
        try {
          const path = await uploadExpenseFile({
            projectId,
            expenseId: row.id,
            file: comprobanteFile,
            kind: "comprobante",
          });
          await updateExpense(row.id, { comprobante_storage_path: path });
        } catch (err) {
          toast.error(`Egreso guardado, pero falló el comprobante: ${err.message}`);
        }
      }

      toast.success(isNew ? "Egreso registrado" : "Egreso actualizado");
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const removeFile = async (field) => {
    const path = draft[field];
    if (!path) return;
    try {
      await removeStorageFile(path);
      await updateExpense(expense.id, { [field]: null });
      updateField({ [field]: null });
      toast.success("Archivo eliminado");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openFile = async (path) => {
    try {
      const url = await getExpenseFileUrl(path, 60);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Categorías agrupadas: top-level + sus subs
  const topLevel = categories.filter((c) => !c.parent_id);
  const subsByParent = categories.reduce((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="xl"
      title={isNew ? "Nuevo egreso" : draft.concepto || "Egreso"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} size="sm">
            Cerrar
          </Button>
          {canEdit && (
            <Button onClick={handleSave} loading={saving} size="sm">
              <Save className="w-3.5 h-3.5" />
              {isNew ? "Registrar" : "Guardar"}
            </Button>
          )}
        </>
      }
    >
      <div className="px-4 py-4 flex flex-col gap-5">
        {/* Concepto */}
        <Section icon={Receipt} label="Concepto y monto">
          <input
            type="text"
            value={draft.concepto}
            onChange={(e) => updateField({ concepto: e.target.value })}
            disabled={!canEdit}
            placeholder="ej. Compra de cemento gris 50 sacos"
            maxLength={300}
            className="w-full bg-transparent text-base font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none border-b border-transparent focus:border-stone-300 pb-1 mb-3"
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Fecha"
              type="date"
              required
              value={draft.fecha}
              disabled={!canEdit}
              onChange={(e) => updateField({ fecha: e.target.value })}
            />
            <Input
              label="Monto"
              type="number"
              step="0.01"
              min="0"
              required
              value={draft.monto}
              disabled={!canEdit}
              onChange={(e) => updateField({ monto: e.target.value })}
            />
            <Select
              label="Moneda"
              value={draft.moneda}
              disabled={!canEdit}
              onChange={(e) => updateField({ moneda: e.target.value })}
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </div>
        </Section>

        {/* Categorización */}
        <Section icon={Tag} label="Partida presupuestal">
          <Select
            value={draft.category_id || ""}
            disabled={!canEdit}
            onChange={(e) => updateField({ category_id: e.target.value })}
          >
            <option value="">Sin partida</option>
            {topLevel.map((c) => (
              <optgroup key={c.id} label={c.nombre}>
                <option value={c.id}>{c.nombre} (total)</option>
                {(subsByParent[c.id] || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {c.nombre} › {s.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Section>

        {/* Proveedor */}
        <Section icon={Building2} label="Proveedor / beneficiario">
          <Select
            value={draft.payee_id || ""}
            disabled={!canEdit}
            onChange={(e) => updateField({ payee_id: e.target.value })}
          >
            <option value="">Sin proveedor</option>
            {payees.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </Section>

        {/* Cuenta y método */}
        <Section icon={Landmark} label="Cuenta y método de pago">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Cuenta origen"
              value={draft.account_id || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ account_id: e.target.value })}
            >
              <option value="">Sin cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </Select>
            <Select
              label="Método"
              value={draft.metodo || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ metodo: e.target.value })}
            >
              <option value="">—</option>
              {Object.entries(METODO_LABEL)
                .filter(([k]) => k !== "especie")
                .map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
            </Select>
          </div>
          <Input
            label="Referencia (folio/no. transferencia)"
            className="mt-3"
            value={draft.referencia || ""}
            disabled={!canEdit}
            onChange={(e) => updateField({ referencia: e.target.value })}
          />
          <Select
            label="Estado"
            className="mt-3"
            value={draft.estado}
            disabled={!canEdit}
            onChange={(e) => updateField({ estado: e.target.value })}
          >
            {Object.entries(EXPENSE_ESTADO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Section>

        {/* Vínculo a obra */}
        <Section icon={Link2} label="Vínculo con Calendario de Obra (opcional)">
          {tasks.length === 0 ? (
            <p className="text-xs text-stone-500">
              No hay tareas de obra. Crea tareas en la pestaña "Calendario de Obra" para poder ligarlas.
            </p>
          ) : (
            <Select
              value={draft.construction_task_id || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ construction_task_id: e.target.value })}
            >
              <option value="">Sin vincular</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.parent_id ? "  · " : ""}{t.name}
                </option>
              ))}
            </Select>
          )}
          <p className="text-[11px] text-stone-500 mt-1.5">
            Ligar a una tarea te permitirá ver cuánto se ha gastado por actividad.
          </p>
        </Section>

        {/* Factura CFDI */}
        <Section icon={FileText} label="Factura (CFDI)">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="UUID fiscal"
              placeholder="XXXX-XXXX-XXXX..."
              value={draft.factura_uuid || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ factura_uuid: e.target.value })}
            />
            <Input
              label="Folio interno"
              value={draft.factura_folio || ""}
              disabled={!canEdit}
              onChange={(e) => updateField({ factura_folio: e.target.value })}
            />
          </div>
          <FileSlot
            label="PDF de la factura"
            path={draft.factura_storage_path}
            file={facturaFile}
            onFile={setFacturaFile}
            onOpen={() => openFile(draft.factura_storage_path)}
            onRemove={() => removeFile("factura_storage_path")}
            disabled={!canEdit || isNew}
            hint={isNew ? "Guarda primero para poder subir archivos" : undefined}
          />
        </Section>

        {/* Comprobante */}
        <Section icon={Paperclip} label="Comprobante de pago">
          <FileSlot
            label="Comprobante (PDF/imagen)"
            path={draft.comprobante_storage_path}
            file={comprobanteFile}
            onFile={setComprobanteFile}
            onOpen={() => openFile(draft.comprobante_storage_path)}
            onRemove={() => removeFile("comprobante_storage_path")}
            disabled={!canEdit || isNew}
            hint={isNew ? "Guarda primero para poder subir archivos" : undefined}
          />
        </Section>

        {/* Notas — usar concepto extendido si quieren */}
        <Section icon={StickyNote} label="Notas">
          <Textarea
            rows={3}
            value={draft.notas || ""}
            disabled
            placeholder="Las notas se pueden agregar editando el concepto."
            className="bg-stone-100"
          />
        </Section>
      </div>
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

function FileSlot({ label, path, file, onFile, onOpen, onRemove, disabled, hint }) {
  if (path) {
    return (
      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
        <Paperclip className="w-3.5 h-3.5 text-stone-500" />
        <span className="text-xs text-stone-700 flex-1">{label} adjunto</span>
        <button
          type="button"
          onClick={onOpen}
          className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"
        >
          <Download className="w-3 h-3" /> Ver
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-rose-600 hover:text-rose-800 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Quitar
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <label
        className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-stone-300 rounded-md ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-stone-50"
        }`}
      >
        <Upload className="w-3.5 h-3.5" />
        {file ? file.name : label}
        <input
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
      </label>
      {hint && <p className="text-[11px] text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}
