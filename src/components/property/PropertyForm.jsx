import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Hash,
  ScrollText,
  Ruler,
  Building2,
  Wrench,
  CircleDollarSign,
  StickyNote,
  Save,
} from "lucide-react";
import { Input, Select, Textarea } from "../ui/Input";
import { Checkbox } from "../ui/Checkbox";
import { Button } from "../ui/Button";
import { SectionCard } from "./SectionCard";

const EMPTY_FIELDS = {
  // Ubicación
  calle: "",
  numero_exterior: "",
  numero_interior: "",
  colonia: "",
  codigo_postal: "",
  municipio: "",
  estado: "",
  pais: "México",
  entre_calles: "",
  referencias: "",
  ubicacion_url: "",
  latitud: "",
  longitud: "",
  plus_code: "",
  // Catastral
  clave_catastral: "",
  cuenta_predial: "",
  numero_oficial: "",
  alineamiento_folio: "",
  alineamiento_fecha: "",
  folio_real: "",
  numero_predio: "",
  // Escritura / RPP
  escritura_numero: "",
  escritura_fecha: "",
  escritura_notario_nombre: "",
  escritura_notario_numero: "",
  escritura_libro: "",
  escritura_volumen: "",
  rpp_inscripcion: "",
  rpp_fecha: "",
  // Medidas
  superficie_terreno_m2: "",
  superficie_construccion_m2: "",
  frente_m: "",
  fondo_m: "",
  forma_terreno: "",
  topografia: "",
  // Zonificación
  uso_suelo: "",
  zonificacion: "",
  altura_maxima_m: "",
  niveles_maximos: "",
  cos: "",
  cus: "",
  densidad: "",
  restricciones: "",
  // Servicios
  servicio_agua: false,
  servicio_drenaje: false,
  servicio_electricidad: false,
  servicio_gas_natural: false,
  servicio_alumbrado: false,
  pavimentacion: false,
  banquetas: false,
  vigilancia: false,
  cuenta_agua: "",
  cuenta_cfe: "",
  cuenta_gas: "",
  // Costo / legal
  precio_adquisicion: "",
  moneda: "MXN",
  fecha_adquisicion: "",
  gravamenes: "",
  adeudos_predial: "",
  adeudos_agua: "",
  litigios: "",
  // Notas
  notas: "",
};

// Convierte el row del backend (null + numbers) a strings vacíos para <input>.
function rowToFormState(row) {
  if (!row) return { ...EMPTY_FIELDS };
  const out = { ...EMPTY_FIELDS };
  for (const k of Object.keys(EMPTY_FIELDS)) {
    const val = row[k];
    if (val === null || val === undefined) {
      // Mantener default (string vacío para texto, false para booleano).
    } else if (typeof EMPTY_FIELDS[k] === "boolean") {
      out[k] = Boolean(val);
    } else {
      out[k] = String(val);
    }
  }
  return out;
}

// Prepara el payload para Supabase: numéricos parseados, booleanos crudos.
const NUMERIC_FIELDS = new Set([
  "latitud",
  "longitud",
  "superficie_terreno_m2",
  "superficie_construccion_m2",
  "frente_m",
  "fondo_m",
  "altura_maxima_m",
  "niveles_maximos",
  "cos",
  "cus",
  "precio_adquisicion",
  "adeudos_predial",
  "adeudos_agua",
]);

function parseNumeric(raw) {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return null;
  // Aceptar coma decimal (es-MX) y descartar símbolos como ° o espacios extra.
  const normalized = trimmed.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formStateToPayload(state) {
  const payload = {};
  for (const [k, v] of Object.entries(state)) {
    if (typeof EMPTY_FIELDS[k] === "boolean") {
      payload[k] = Boolean(v);
    } else if (NUMERIC_FIELDS.has(k)) {
      payload[k] = parseNumeric(v);
    } else {
      const trimmed = String(v ?? "").trim();
      payload[k] = trimmed === "" ? null : trimmed;
    }
  }
  return payload;
}

export function PropertyForm({ initial, canEdit, saving, onSave }) {
  const [v, setV] = useState(() => rowToFormState(initial));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV(rowToFormState(initial));
    setDirty(false);
  }, [initial]);

  const set = (key) => (eOrValue) => {
    const value =
      eOrValue && typeof eOrValue === "object" && "target" in eOrValue
        ? eOrValue.target.type === "checkbox"
          ? eOrValue.target.checked
          : eOrValue.target.value
        : eOrValue;
    setV((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const areaCalculada = useMemo(() => {
    const f = parseFloat(v.frente_m);
    const d = parseFloat(v.fondo_m);
    if (Number.isFinite(f) && Number.isFinite(d) && f > 0 && d > 0) {
      return (f * d).toFixed(2);
    }
    return null;
  }, [v.frente_m, v.fondo_m]);

  const handleSave = async () => {
    const payload = formStateToPayload(v);
    await onSave(payload);
    setDirty(false);
  };

  const readonly = !canEdit;

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-stone-100/95 backdrop-blur border-b border-stone-200 flex items-center justify-between gap-3">
          <p className="text-xs text-stone-600">
            {dirty
              ? "Cambios sin guardar"
              : "Ficha del predio · datos guardados"}
          </p>
          <Button
            size="sm"
            disabled={!dirty}
            loading={saving}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5" />
            Guardar
          </Button>
        </div>
      )}

      <SectionCard title="Ubicación" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Calle" name="calle" value={v.calle} onChange={set("calle")} disabled={readonly} />
          <Input label="Número exterior" name="numero_exterior" value={v.numero_exterior} onChange={set("numero_exterior")} disabled={readonly} />
          <Input label="Número interior" name="numero_interior" value={v.numero_interior} onChange={set("numero_interior")} disabled={readonly} />
          <Input label="Colonia / Fraccionamiento" name="colonia" value={v.colonia} onChange={set("colonia")} disabled={readonly} />
          <Input label="Código postal" name="codigo_postal" inputMode="numeric" maxLength={5} value={v.codigo_postal} onChange={set("codigo_postal")} disabled={readonly} />
          <Input label="Municipio / Alcaldía" name="municipio" value={v.municipio} onChange={set("municipio")} disabled={readonly} />
          <Input label="Estado" name="estado" value={v.estado} onChange={set("estado")} disabled={readonly} />
          <Input label="País" name="pais" value={v.pais} onChange={set("pais")} disabled={readonly} />
          <Input label="Entre calles" name="entre_calles" value={v.entre_calles} onChange={set("entre_calles")} disabled={readonly} />
        </div>
        <Textarea label="Referencias" name="referencias" rows={2} value={v.referencias} onChange={set("referencias")} disabled={readonly} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Link de ubicación (Google Maps)" name="ubicacion_url" type="url" placeholder="https://maps.google.com/..." value={v.ubicacion_url} onChange={set("ubicacion_url")} disabled={readonly} />
          <Input label="Plus Code" name="plus_code" value={v.plus_code} onChange={set("plus_code")} disabled={readonly} />
          <Input label="Latitud" name="latitud" inputMode="decimal" value={v.latitud} onChange={set("latitud")} disabled={readonly} />
          <Input label="Longitud" name="longitud" inputMode="decimal" value={v.longitud} onChange={set("longitud")} disabled={readonly} />
        </div>
        {v.ubicacion_url && (
          <a
            href={v.ubicacion_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-stone-600 hover:text-stone-900 underline"
          >
            Abrir ubicación →
          </a>
        )}
      </SectionCard>

      <SectionCard title="Identificación catastral y oficial" icon={Hash}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Clave catastral" name="clave_catastral" value={v.clave_catastral} onChange={set("clave_catastral")} disabled={readonly} />
          <Input label="Cuenta predial" name="cuenta_predial" value={v.cuenta_predial} onChange={set("cuenta_predial")} disabled={readonly} />
          <Input label="Número oficial" name="numero_oficial" value={v.numero_oficial} onChange={set("numero_oficial")} disabled={readonly} />
          <Input label="Folio de alineamiento" name="alineamiento_folio" value={v.alineamiento_folio} onChange={set("alineamiento_folio")} disabled={readonly} />
          <Input label="Fecha de alineamiento" name="alineamiento_fecha" type="date" value={v.alineamiento_fecha} onChange={set("alineamiento_fecha")} disabled={readonly} />
          <Input label="Folio real / matrícula" name="folio_real" value={v.folio_real} onChange={set("folio_real")} disabled={readonly} />
          <Input label="Número de predio" name="numero_predio" value={v.numero_predio} onChange={set("numero_predio")} disabled={readonly} />
        </div>
      </SectionCard>

      <SectionCard title="Escritura y Registro Público" icon={ScrollText}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Número de escritura" name="escritura_numero" value={v.escritura_numero} onChange={set("escritura_numero")} disabled={readonly} />
          <Input label="Fecha de escritura" name="escritura_fecha" type="date" value={v.escritura_fecha} onChange={set("escritura_fecha")} disabled={readonly} />
          <Input label="Notario (nombre)" name="escritura_notario_nombre" value={v.escritura_notario_nombre} onChange={set("escritura_notario_nombre")} disabled={readonly} />
          <Input label="Notaría número" name="escritura_notario_numero" value={v.escritura_notario_numero} onChange={set("escritura_notario_numero")} disabled={readonly} />
          <Input label="Libro" name="escritura_libro" value={v.escritura_libro} onChange={set("escritura_libro")} disabled={readonly} />
          <Input label="Volumen / tomo" name="escritura_volumen" value={v.escritura_volumen} onChange={set("escritura_volumen")} disabled={readonly} />
          <Input label="Inscripción en RPP" name="rpp_inscripcion" value={v.rpp_inscripcion} onChange={set("rpp_inscripcion")} disabled={readonly} />
          <Input label="Fecha de inscripción RPP" name="rpp_fecha" type="date" value={v.rpp_fecha} onChange={set("rpp_fecha")} disabled={readonly} />
        </div>
      </SectionCard>

      <SectionCard title="Medidas y superficie" icon={Ruler}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Superficie del terreno (m²)" name="superficie_terreno_m2" inputMode="decimal" value={v.superficie_terreno_m2} onChange={set("superficie_terreno_m2")} disabled={readonly} hint={areaCalculada ? `Frente × fondo = ${areaCalculada} m²` : undefined} />
          <Input label="Superficie de construcción (m²)" name="superficie_construccion_m2" inputMode="decimal" value={v.superficie_construccion_m2} onChange={set("superficie_construccion_m2")} disabled={readonly} />
          <Input label="Frente (m)" name="frente_m" inputMode="decimal" value={v.frente_m} onChange={set("frente_m")} disabled={readonly} />
          <Input label="Fondo (m)" name="fondo_m" inputMode="decimal" value={v.fondo_m} onChange={set("fondo_m")} disabled={readonly} />
          <Select label="Forma del terreno" name="forma_terreno" value={v.forma_terreno} onChange={set("forma_terreno")} disabled={readonly}>
            <option value="">—</option>
            <option value="regular">Regular</option>
            <option value="irregular">Irregular</option>
            <option value="triangular">Triangular</option>
            <option value="trapezoidal">Trapezoidal</option>
            <option value="otro">Otro</option>
          </Select>
          <Select label="Topografía" name="topografia" value={v.topografia} onChange={set("topografia")} disabled={readonly}>
            <option value="">—</option>
            <option value="plano">Plano</option>
            <option value="pendiente_leve">Pendiente leve</option>
            <option value="pendiente_moderada">Pendiente moderada</option>
            <option value="pendiente_pronunciada">Pendiente pronunciada</option>
            <option value="irregular">Irregular</option>
          </Select>
        </div>
      </SectionCard>

      <SectionCard title="Zonificación y uso de suelo" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Uso de suelo permitido" name="uso_suelo" value={v.uso_suelo} onChange={set("uso_suelo")} disabled={readonly} />
          <Input label="Zonificación" name="zonificacion" value={v.zonificacion} onChange={set("zonificacion")} disabled={readonly} />
          <Input label="Densidad" name="densidad" value={v.densidad} onChange={set("densidad")} disabled={readonly} />
          <Input label="Altura máxima (m)" name="altura_maxima_m" inputMode="decimal" value={v.altura_maxima_m} onChange={set("altura_maxima_m")} disabled={readonly} />
          <Input label="Niveles máximos" name="niveles_maximos" inputMode="numeric" value={v.niveles_maximos} onChange={set("niveles_maximos")} disabled={readonly} />
          <Input label="COS (0-1)" name="cos" inputMode="decimal" value={v.cos} onChange={set("cos")} disabled={readonly} hint="Coef. Ocupación del Suelo" />
          <Input label="CUS" name="cus" inputMode="decimal" value={v.cus} onChange={set("cus")} disabled={readonly} hint="Coef. Utilización del Suelo" />
        </div>
        <Textarea label="Restricciones" name="restricciones" rows={2} value={v.restricciones} onChange={set("restricciones")} disabled={readonly} />
      </SectionCard>

      <SectionCard title="Servicios e infraestructura" icon={Wrench}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Checkbox label="Agua potable" checked={v.servicio_agua} onChange={set("servicio_agua")} disabled={readonly} />
          <Checkbox label="Drenaje" checked={v.servicio_drenaje} onChange={set("servicio_drenaje")} disabled={readonly} />
          <Checkbox label="Electricidad" checked={v.servicio_electricidad} onChange={set("servicio_electricidad")} disabled={readonly} />
          <Checkbox label="Gas natural" checked={v.servicio_gas_natural} onChange={set("servicio_gas_natural")} disabled={readonly} />
          <Checkbox label="Alumbrado público" checked={v.servicio_alumbrado} onChange={set("servicio_alumbrado")} disabled={readonly} />
          <Checkbox label="Pavimentación" checked={v.pavimentacion} onChange={set("pavimentacion")} disabled={readonly} />
          <Checkbox label="Banquetas" checked={v.banquetas} onChange={set("banquetas")} disabled={readonly} />
          <Checkbox label="Vigilancia" checked={v.vigilancia} onChange={set("vigilancia")} disabled={readonly} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <Input label="Cuenta de agua" name="cuenta_agua" value={v.cuenta_agua} onChange={set("cuenta_agua")} disabled={readonly} />
          <Input label="Cuenta CFE (electricidad)" name="cuenta_cfe" value={v.cuenta_cfe} onChange={set("cuenta_cfe")} disabled={readonly} />
          <Input label="Cuenta de gas" name="cuenta_gas" value={v.cuenta_gas} onChange={set("cuenta_gas")} disabled={readonly} />
        </div>
      </SectionCard>

      <SectionCard title="Adquisición y situación legal" icon={CircleDollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Precio de adquisición" name="precio_adquisicion" inputMode="decimal" value={v.precio_adquisicion} onChange={set("precio_adquisicion")} disabled={readonly} />
          <Select label="Moneda" name="moneda" value={v.moneda} onChange={set("moneda")} disabled={readonly}>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </Select>
          <Input label="Fecha de adquisición" name="fecha_adquisicion" type="date" value={v.fecha_adquisicion} onChange={set("fecha_adquisicion")} disabled={readonly} />
          <Input label="Adeudo predial" name="adeudos_predial" inputMode="decimal" value={v.adeudos_predial} onChange={set("adeudos_predial")} disabled={readonly} />
          <Input label="Adeudo agua" name="adeudos_agua" inputMode="decimal" value={v.adeudos_agua} onChange={set("adeudos_agua")} disabled={readonly} />
        </div>
        <Textarea label="Gravámenes (hipoteca, embargo, etc.)" name="gravamenes" rows={2} value={v.gravamenes} onChange={set("gravamenes")} disabled={readonly} />
        <Textarea label="Litigios" name="litigios" rows={2} value={v.litigios} onChange={set("litigios")} disabled={readonly} />
      </SectionCard>

      <SectionCard title="Notas" icon={StickyNote}>
        <Textarea name="notas" rows={4} value={v.notas} onChange={set("notas")} disabled={readonly} placeholder="Notas libres sobre el predio…" />
      </SectionCard>
    </div>
  );
}
