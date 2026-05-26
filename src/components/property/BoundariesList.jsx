import { useState } from "react";
import { Compass, Plus, Trash2, Save } from "lucide-react";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { SectionCard } from "./SectionCard";
import {
  createBoundary,
  updateBoundary,
  deleteBoundary,
} from "../../lib/api/properties";

const DIRECCIONES = [
  { value: "norte", label: "Al norte" },
  { value: "sur", label: "Al sur" },
  { value: "este", label: "Al oriente / este" },
  { value: "oeste", label: "Al poniente / oeste" },
  { value: "noreste", label: "Al noreste" },
  { value: "noroeste", label: "Al noroeste" },
  { value: "sureste", label: "Al sureste" },
  { value: "suroeste", label: "Al suroeste" },
  { value: "otro", label: "Otro" },
];

const TIPOS_VECINO = [
  { value: "", label: "—" },
  { value: "calle", label: "Calle" },
  { value: "avenida", label: "Avenida" },
  { value: "casa_habitacion", label: "Casa habitación" },
  { value: "edificio", label: "Edificio" },
  { value: "comercio", label: "Comercio" },
  { value: "terreno_baldio", label: "Terreno baldío" },
  { value: "area_verde", label: "Área verde" },
  { value: "rio_arroyo", label: "Río / arroyo" },
  { value: "barranca", label: "Barranca" },
  { value: "otro", label: "Otro" },
];

function emptyDraft(position) {
  return {
    direccion: "norte",
    medida_m: "",
    tipo_vecino: "",
    descripcion: "",
    position,
  };
}

export function BoundariesList({ propertyId, projectId, boundaries, canEdit, onChange }) {
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [edits, setEdits] = useState({}); // { id: { field: value } }
  const [savingRow, setSavingRow] = useState(null);

  const perimetro = boundaries.reduce(
    (acc, b) => acc + (b.medida_m ? Number(b.medida_m) : 0),
    0
  );

  const setDraftField = (k) => (e) => {
    const value = e?.target ? e.target.value : e;
    setDraft((prev) => ({ ...prev, [k]: value }));
  };

  const startDraft = () => {
    const nextPos = boundaries.length;
    setDraft(emptyDraft(nextPos));
  };

  const submitDraft = async () => {
    if (!draft) return;
    setSavingDraft(true);
    try {
      const saved = await createBoundary({
        propertyId,
        projectId,
        direccion: draft.direccion,
        medida_m: draft.medida_m === "" ? null : Number(draft.medida_m),
        tipo_vecino: draft.tipo_vecino || null,
        descripcion: draft.descripcion.trim() || null,
        position: draft.position,
      });
      onChange([...boundaries, saved]);
      setDraft(null);
      toast.success("Colindancia agregada");
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSavingDraft(false);
    }
  };

  const setRowField = (id, field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const saveRow = async (b) => {
    const changes = edits[b.id];
    if (!changes) return;
    setSavingRow(b.id);
    try {
      const payload = {};
      for (const [k, v] of Object.entries(changes)) {
        if (k === "medida_m") {
          payload[k] = v === "" ? null : Number(v);
        } else if (k === "tipo_vecino" || k === "descripcion") {
          payload[k] = v === "" ? null : v;
        } else {
          payload[k] = v;
        }
      }
      const saved = await updateBoundary(b.id, payload);
      onChange(boundaries.map((x) => (x.id === b.id ? saved : x)));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[b.id];
        return next;
      });
      toast.success("Colindancia actualizada");
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSavingRow(null);
    }
  };

  const removeRow = async (b) => {
    try {
      await deleteBoundary(b.id);
      onChange(boundaries.filter((x) => x.id !== b.id));
      toast.success("Colindancia eliminada");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    }
  };

  const getDisplay = (b, field) =>
    edits[b.id] && field in edits[b.id]
      ? edits[b.id][field]
      : b[field] == null
      ? ""
      : String(b[field]);

  return (
    <SectionCard
      title="Colindancias"
      icon={Compass}
      action={
        canEdit &&
        !draft && (
          <Button size="sm" variant="ghost" onClick={startDraft}>
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </Button>
        )
      }
    >
      {boundaries.length === 0 && !draft ? (
        <p className="text-xs text-stone-500">Sin colindancias registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium w-44">Dirección</th>
                <th className="text-right px-2 py-1.5 font-medium w-28">Medida (m)</th>
                <th className="text-left px-2 py-1.5 font-medium w-44">Colinda con</th>
                <th className="text-left px-2 py-1.5 font-medium">Descripción</th>
                {canEdit && <th className="w-20" />}
              </tr>
            </thead>
            <tbody>
              {boundaries.map((b) => {
                const dirty = !!edits[b.id];
                return (
                  <tr key={b.id} className="border-t border-stone-100 align-top">
                    <td className="px-2 py-1.5">
                      <Select value={getDisplay(b, "direccion")} onChange={setRowField(b.id, "direccion")} disabled={!canEdit}>
                        {DIRECCIONES.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input inputMode="decimal" value={getDisplay(b, "medida_m")} onChange={setRowField(b.id, "medida_m")} disabled={!canEdit} className="text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={getDisplay(b, "tipo_vecino")} onChange={setRowField(b.id, "tipo_vecino")} disabled={!canEdit}>
                        {TIPOS_VECINO.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input placeholder="p.ej. calle Reforma, lote 12 manzana 4…" value={getDisplay(b, "descripcion")} onChange={setRowField(b.id, "descripcion")} disabled={!canEdit} />
                    </td>
                    {canEdit && (
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">
                        {dirty && (
                          <button
                            onClick={() => saveRow(b)}
                            disabled={savingRow === b.id}
                            className="text-stone-500 hover:text-emerald-700 p-1 disabled:opacity-50"
                            title="Guardar"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => removeRow(b)}
                          className="text-stone-400 hover:text-rose-700 p-1"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {draft && (
                <tr className="border-t border-stone-100 bg-stone-50 align-top">
                  <td className="px-2 py-1.5">
                    <Select value={draft.direccion} onChange={setDraftField("direccion")}>
                      {DIRECCIONES.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input inputMode="decimal" value={draft.medida_m} onChange={setDraftField("medida_m")} className="text-right" autoFocus />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select value={draft.tipo_vecino} onChange={setDraftField("tipo_vecino")}>
                      {TIPOS_VECINO.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={draft.descripcion} onChange={setDraftField("descripcion")} placeholder="p.ej. calle Reforma…" />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <button
                      onClick={submitDraft}
                      disabled={savingDraft}
                      className="text-stone-500 hover:text-emerald-700 p-1 disabled:opacity-50"
                      title="Guardar"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDraft(null)}
                      className="text-stone-400 hover:text-rose-700 p-1"
                      title="Descartar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            {boundaries.length > 0 && (
              <tfoot>
                <tr className="border-t border-stone-200 text-xs">
                  <td className="px-2 py-2 text-stone-500">Perímetro total</td>
                  <td className="px-2 py-2 text-right font-semibold text-stone-900">
                    {perimetro.toFixed(2)} m
                  </td>
                  <td colSpan={canEdit ? 3 : 2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </SectionCard>
  );
}
