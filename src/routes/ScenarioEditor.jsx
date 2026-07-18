import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Banknote,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Calculator,
  Info,
  Receipt,
  Hammer,
  Tag,
  Percent,
  Clock,
  Save,
  Copy as CopyIcon,
  Trash2,
  MoreHorizontal,
  Loader2,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/AuthContext";
import {
  getScenario,
  updateScenario,
  deleteScenario,
  duplicateScenario,
} from "../lib/api/scenarios";
import { getProject } from "../lib/api/projects";
import { getCurrentUserRole } from "../lib/api/members";
import { computeKPIs, generateInsights, DEFAULTS } from "../lib/calc";
import { fmtMXN, fmtPct, fmtNumber as fmtNum } from "../lib/format";

const SECTIONS = {
  terreno: { label: "Terreno", icon: Tag },
  construccion: { label: "Construcción", icon: Hammer },
  servicios: { label: "Servicios y trámites", icon: Receipt },
  tiempo: { label: "Tiempo del proyecto", icon: Clock },
  comerciales: { label: "Costos comerciales", icon: Tag },
  venta: { label: "Venta", icon: Banknote },
  impuestos: { label: "Impuestos sobre la ganancia", icon: Percent },
};

export default function ScenarioEditor() {
  const { projectId, scenarioId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [scenario, setScenario] = useState(null);
  const [project, setProject] = useState(null);
  const [role, setRole] = useState(null);
  const [v, setV] = useState(DEFAULTS);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      getScenario(scenarioId),
      getProject(projectId),
      getCurrentUserRole(projectId, user.id),
    ])
      .then(([s, p, r]) => {
        if (cancelled) return;
        setScenario(s);
        setProject(p);
        setRole(r);
        setV({ ...DEFAULTS, ...(s.data || {}) });
        setName(s.name);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || "No se pudo cargar el escenario");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, projectId, user.id]);

  const canEdit = role === "owner" || role === "editor";
  const readonly = !canEdit;

  const set = (k) => (val) => {
    if (readonly) return;
    setV((s) => ({ ...s, [k]: val }));
    setDirty(true);
  };

  const calc = useMemo(() => computeKPIs(v), [v]);
  const insights = useMemo(
    () => generateInsights(v, calc, fmtMXN, fmtPct),
    [v, calc]
  );

  const breakdownData = useMemo(
    () => [
      { name: "Terreno", value: calc.inv_terreno, fill: "#a8a29e" },
      { name: "Construcción", value: calc.inv_construccion, fill: "#57534e" },
      { name: "Servicios y trámites", value: calc.inv_servicios, fill: "#d6d3d1" },
    ],
    [calc]
  );

  const sensitivityChart = useMemo(
    () =>
      calc.sensitivity.map((s) => ({
        label: `${s.delta > 0 ? "+" : ""}${s.delta}%`,
        "Utilidad neta": Math.round(s.un),
        delta: s.delta,
      })),
    [calc]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateScenario(scenarioId, { name, data: v });
      setDirty(false);
      toast.success("Escenario guardado");
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (newName) => {
    setName(newName);
    setShowRename(false);
    if (!dirty) {
      try {
        await updateScenario(scenarioId, { name: newName });
        toast.success("Renombrado");
      } catch (err) {
        toast.error(err.message || "No se pudo renombrar");
      }
    }
    // si está dirty, se guardará en el próximo handleSave
  };

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateScenario(scenarioId, `${name} (copia)`);
      toast.success("Duplicado");
      navigate(`/projects/${projectId}/scenarios/${copy.id}`);
    } catch (err) {
      toast.error(err.message || "No se pudo duplicar");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteScenario(scenarioId);
      toast.success("Escenario eliminado");
      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
      setShowDelete(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      </AppShell>
    );
  }

  if (!scenario || !project) {
    return (
      <AppShell>
        <div className="bg-white border border-stone-200 rounded-lg p-6 text-center">
          <p className="text-sm text-stone-700">Escenario no encontrado.</p>
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mt-3"
          >
            ← Volver al dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  const breadcrumbs = [
    { label: "Proyectos", to: "/dashboard" },
    { label: project.name, to: `/projects/${projectId}` },
    { label: name },
  ];

  return (
    <AppShell
      breadcrumbs={breadcrumbs}
      actions={
        canEdit ? (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!dirty}
            >
              <Save className="w-3.5 h-3.5" />
              {dirty ? "Guardar" : "Guardado"}
            </Button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="text-stone-500 hover:text-stone-900 p-1.5 rounded"
                aria-label="Más acciones"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-1 w-44 bg-white border border-stone-200 rounded-md shadow-lg py-1 z-30"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowRename(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50"
                  >
                    Renombrar
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDuplicate();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50 flex items-center gap-2"
                  >
                    <CopyIcon className="w-3 h-3" /> Duplicar
                  </button>
                  <Link
                    to={`/projects/${projectId}`}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-3 h-3" /> Volver al proyecto
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowDelete(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <Link
            to={`/projects/${projectId}`}
            className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Link>
        )
      }
    >
      {readonly && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900">
          <Eye className="w-3.5 h-3.5" />
          Tienes acceso de solo lectura. Pide al owner cambiar tu rol para editar.
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight">{name}</h1>
        <p className="text-sm text-stone-600 mt-1">
          Modelo de inversión, rendimiento y sensibilidad para casa habitación
        </p>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <KPICard
          label="Precio de venta"
          value={fmtMXN(v.precio_venta)}
          sublabel={`${fmtMXN(calc.precio_venta_m2)} / m² const`}
          size="lg"
          tooltip="Precio final estimado al que se venderá la propiedad."
          accent="blue"
        />
        <KPICard
          label="Inversión total"
          value={fmtMXN(calc.inversion_total)}
          sublabel={`${fmtMXN(calc.costo_total_por_m2_const)} / m² const`}
          size="lg"
          tooltip="Suma de terreno, construcción, servicios y trámites."
        />
        <KPICard
          label="Utilidad neta"
          value={fmtMXN(calc.utilidad_neta)}
          sublabel={`Bruta: ${fmtMXN(calc.utilidad_bruta)}`}
          accent={calc.utilidad_neta >= 0 ? "emerald" : "rose"}
          size="lg"
          tooltip="Ganancia final tras descontar inversión, gastos de venta e impuestos."
        />
        <KPICard
          label="ROI"
          value={fmtPct(calc.roi_pct)}
          sublabel={`Anualizado: ${fmtPct(calc.roi_anualizado_pct)}`}
          accent={calc.roi_pct >= 18 ? "emerald" : calc.roi_pct >= 10 ? "amber" : "rose"}
          size="lg"
          tooltip="Retorno de Inversión sobre capital."
        />
        <KPICard
          label="Margen sobre venta"
          value={fmtPct(calc.margen_venta_pct)}
          sublabel={`Punto eq.: ${fmtMXN(calc.breakeven_precio_venta)}`}
          accent={calc.margen_venta_pct >= 15 ? "emerald" : calc.margen_venta_pct >= 8 ? "amber" : "rose"}
          size="lg"
          tooltip="Porcentaje del precio de venta que representa tu utilidad."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Inputs */}
        <div className="lg:col-span-5 space-y-4">
          <SectionCard title={SECTIONS.terreno.label} icon={SECTIONS.terreno.icon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              <NumberField label="Costo del terreno" value={v.terreno_costo} onChange={set("terreno_costo")} prefix="$" readonly={readonly} />
              <NumberField label="Superficie terreno" value={v.terreno_m2} onChange={set("terreno_m2")} suffix="m²" readonly={readonly} />
              <NumberField label="ISAI / derechos / impuestos" value={v.terreno_isai} onChange={set("terreno_isai")} prefix="$" hint="Derechos + ISAI + retenciones" readonly={readonly} />
              <NumberField label="Honorarios notario (con IVA)" value={v.terreno_notario} onChange={set("terreno_notario")} prefix="$" readonly={readonly} />
            </div>
            <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-100">
              Costo m² terreno: <span className="font-semibold text-stone-900">{fmtMXN(calc.costo_m2_terreno)}</span> · Total adquisición: <span className="font-semibold text-stone-900">{fmtMXN(calc.inv_terreno)}</span>
            </div>
          </SectionCard>

          <SectionCard title={SECTIONS.construccion.label} icon={SECTIONS.construccion.icon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              <NumberField label="m² de construcción" value={v.construccion_m2} onChange={set("construccion_m2")} suffix="m²" readonly={readonly} />
              <NumberField label="Costo por m²" value={v.construccion_costo_m2} onChange={set("construccion_costo_m2")} prefix="$" hint="QRO residencial: $12,500-$16,000" readonly={readonly} />
              <NumberField label="Imprevistos" value={v.imprevistos_pct} onChange={set("imprevistos_pct")} suffix="%" step={0.5} hint="Recomendado 5-10%" readonly={readonly} />
              <div className="bg-stone-50 rounded-md p-2 flex flex-col justify-center">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">Costo construcción</span>
                <span className="text-sm font-semibold text-stone-900">{fmtMXN(calc.inv_construccion)}</span>
                <span className="text-[10px] text-stone-500">+{fmtMXN(calc.imprevistos_monto)} imprevistos</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={SECTIONS.servicios.label} icon={SECTIONS.servicios.icon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              <NumberField label="Contrato CFE" value={v.cfe} onChange={set("cfe")} prefix="$" readonly={readonly} />
              <NumberField label="Contrato agua" value={v.agua} onChange={set("agua")} prefix="$" readonly={readonly} />
              <NumberField label="Predial durante construcción" value={v.predial_construccion} onChange={set("predial_construccion")} prefix="$" hint="Bimestral × duración" readonly={readonly} />
              <NumberField label="Licencias y permisos" value={v.licencias} onChange={set("licencias")} prefix="$" hint="Construcción, alineamiento, DRO" readonly={readonly} />
              <NumberField label="Honorarios de proyecto" value={v.proyecto_arqui} onChange={set("proyecto_arqui")} prefix="$" hint="Arquitecto, ingeniería, supervisión" readonly={readonly} />
            </div>
          </SectionCard>

          <SectionCard title={SECTIONS.tiempo.label} icon={SECTIONS.tiempo.icon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              <NumberField label="Meses de construcción" value={v.meses_construccion} onChange={set("meses_construccion")} suffix="meses" readonly={readonly} />
              <NumberField label="Meses estimados de venta" value={v.meses_venta} onChange={set("meses_venta")} suffix="meses" readonly={readonly} />
              <NumberField label="Costo de oportunidad anual" value={v.costo_oportunidad_pct} onChange={set("costo_oportunidad_pct")} suffix="%" step={0.5} hint="CETES, otra inversión pasiva" readonly={readonly} />
              <div className="bg-stone-50 rounded-md p-2 flex flex-col justify-center">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">Total proyecto</span>
                <span className="text-sm font-semibold text-stone-900">{calc.meses_total} meses</span>
                <span className="text-[10px] text-stone-500">{(calc.meses_total / 12).toFixed(2)} años</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={SECTIONS.venta.label} icon={SECTIONS.venta.icon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              <NumberField label="Precio de venta esperado" value={v.precio_venta} onChange={set("precio_venta")} prefix="$" readonly={readonly} />
              <div className="bg-stone-50 rounded-md p-2 flex flex-col justify-center">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">Precio por m²</span>
                <span className="text-sm font-semibold text-stone-900">{fmtMXN(calc.precio_venta_m2)}</span>
              </div>
              <NumberField label="Comisión inmobiliaria" value={v.comision_pct} onChange={set("comision_pct")} suffix="%" step={0.25} hint="QRO típico: 4-6%" readonly={readonly} />
              <NumberField label="Marketing" value={v.marketing_pct} onChange={set("marketing_pct")} suffix="%" step={0.25} readonly={readonly} />
              <NumberField label="Otros gastos de venta" value={v.gastos_venta_otros} onChange={set("gastos_venta_otros")} prefix="$" hint="Avalúos, certificados" readonly={readonly} />
            </div>
          </SectionCard>

          <SectionCard title={SECTIONS.impuestos.label} icon={SECTIONS.impuestos.icon}>
            <ToggleField label="Aplicar ISR sobre la utilidad" value={v.isr_aplica} onChange={set("isr_aplica")} hint="Activa si NO aplica exención de casa habitación" readonly={readonly} />
            {v.isr_aplica && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                <NumberField label="Tasa ISR estimada" value={v.isr_pct} onChange={set("isr_pct")} suffix="%" step={1} hint="PM: 30% · PF: hasta 35%" readonly={readonly} />
                <div className="bg-rose-50 rounded-md p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-rose-600 uppercase tracking-wider">ISR estimado</span>
                  <span className="text-sm font-semibold text-rose-900">{fmtMXN(calc.isr_monto)}</span>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* RIGHT: Results */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-stone-200 rounded-lg p-5">
            <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase mb-3 flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5" strokeWidth={2} />
              Desglose de la inversión
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdownData} innerRadius={45} outerRadius={75} dataKey="value" stroke="#fff" strokeWidth={2}>
                      {breakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => fmtMXN(value)} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e7e5e4" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {breakdownData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.fill }} />
                      <span className="text-xs text-stone-700">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-stone-900">{fmtMXN(item.value)}</div>
                      <div className="text-[10px] text-stone-500">
                        {fmtPct((item.value / (calc.inversion_total || 1)) * 100)}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t border-stone-200 pt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-900">TOTAL</span>
                  <span className="text-sm font-bold text-stone-900">{fmtMXN(calc.inversion_total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <KPICard label="Costo m² construcción" value={fmtMXN(calc.costo_m2_construccion_solo)} sublabel="Solo obra + imprevistos" />
            <KPICard label="Costo m² terreno" value={fmtMXN(calc.costo_m2_terreno)} sublabel={`${fmtNum(v.terreno_m2)} m² totales`} />
            <KPICard label="Precio m² venta" value={fmtMXN(calc.precio_venta_m2)} sublabel={`${fmtNum(v.construccion_m2)} m² const.`} />
            <KPICard label="Gastos de venta" value={fmtMXN(calc.total_gastos_venta)} sublabel="Comisión + marketing" accent="rose" />
            <KPICard label="ROI real (vs oportunidad)" value={fmtPct(calc.roi_real_pct)} sublabel={`Costo oport.: ${fmtMXN(calc.costo_oportunidad)}`} accent={calc.roi_real_pct >= 0 ? "emerald" : "rose"} />
            <KPICard label="Ingreso neto venta" value={fmtMXN(calc.ingreso_neto_venta)} sublabel="Después de comisiones" accent="emerald" />
          </div>

          <div className="bg-white border border-stone-200 rounded-lg p-5">
            <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
              Flujo del proyecto
            </h3>
            <div className="space-y-1.5">
              <FlowRow label="Precio de venta" value={v.precio_venta} accent="emerald" />
              <FlowRow label="− Comisión" value={-calc.comision_monto} indent />
              <FlowRow label="− Marketing" value={-calc.marketing_monto} indent />
              <FlowRow label="− Otros gastos venta" value={-v.gastos_venta_otros} indent />
              <FlowRow label="Ingreso neto" value={calc.ingreso_neto_venta} bold separator />
              <FlowRow label="− Inversión terreno" value={-calc.inv_terreno} indent />
              <FlowRow label="− Inversión construcción" value={-calc.inv_construccion} indent />
              <FlowRow label="− Servicios y trámites" value={-calc.inv_servicios} indent />
              <FlowRow label="Utilidad bruta" value={calc.utilidad_bruta} bold separator accent={calc.utilidad_bruta >= 0 ? "emerald" : "rose"} />
              {v.isr_aplica && <FlowRow label="− ISR sobre utilidad" value={-calc.isr_monto} indent />}
              <FlowRow label="UTILIDAD NETA" value={calc.utilidad_neta} bold separator accent={calc.utilidad_neta >= 0 ? "emerald" : "rose"} size="lg" />
              <FlowRow label="− Costo de oportunidad" value={-calc.costo_oportunidad} indent hint={`${calc.meses_total}m al ${v.costo_oportunidad_pct}% anual`} />
              <FlowRow label="Utilidad real" value={calc.utilidad_neta_real} bold separator accent={calc.utilidad_neta_real >= 0 ? "emerald" : "rose"} />
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg p-5">
            <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase mb-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
              Sensibilidad: variación del precio de venta
            </h3>
            <p className="text-[11px] text-stone-500 mb-3">
              Cómo cambia tu utilidad si vendes arriba o abajo del precio esperado
            </p>
            <div className="h-44 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sensitivityChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#78716c" }} axisLine={{ stroke: "#d6d3d1" }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#78716c" }} axisLine={{ stroke: "#d6d3d1" }} />
                  <Tooltip formatter={(value) => fmtMXN(value)} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e7e5e4" }} />
                  <ReferenceLine y={0} stroke="#a8a29e" strokeWidth={1} />
                  <Bar dataKey="Utilidad neta" radius={[2, 2, 0, 0]}>
                    {sensitivityChart.map((entry, i) => (
                      <Cell key={i} fill={entry["Utilidad neta"] < 0 ? "#dc2626" : entry.delta === 0 ? "#0f172a" : "#65a30d"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="text-left py-1.5 font-medium">Δ Precio</th>
                    <th className="text-right py-1.5 font-medium">Precio venta</th>
                    <th className="text-right py-1.5 font-medium">Utilidad neta</th>
                    <th className="text-right py-1.5 font-medium">ROI</th>
                    <th className="text-right py-1.5 font-medium">ROI anual</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.sensitivity.map((s, i) => (
                    <tr key={i} className={`border-b border-stone-100 ${s.delta === 0 ? "bg-stone-50 font-semibold" : ""}`}>
                      <td className={`py-1.5 ${s.delta < 0 ? "text-rose-600" : s.delta > 0 ? "text-emerald-700" : "text-stone-900"}`}>
                        {s.delta > 0 ? "+" : ""}{s.delta}%
                      </td>
                      <td className="text-right py-1.5 text-stone-700">{fmtMXN(s.pv)}</td>
                      <td className={`text-right py-1.5 ${s.un < 0 ? "text-rose-600" : "text-stone-900"}`}>{fmtMXN(s.un)}</td>
                      <td className={`text-right py-1.5 ${s.roi < 0 ? "text-rose-600" : "text-stone-900"}`}>{fmtPct(s.roi)}</td>
                      <td className={`text-right py-1.5 ${s.roi_an < 0 ? "text-rose-600" : "text-stone-900"}`}>{fmtPct(s.roi_an)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {insights.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-lg p-5">
              <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase mb-3 flex items-center gap-2">
                <Info className="w-3.5 h-3.5" strokeWidth={2} />
                Análisis y alertas
              </h3>
              <div className="space-y-2">
                {insights.map((ins, i) => <InsightRow key={i} {...ins} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {showRename && (
        <RenameModal initial={name} onClose={() => setShowRename(false)} onSave={handleRename} />
      )}
      {showDelete && (
        <Modal
          title="Eliminar escenario"
          onClose={() => setShowDelete(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancelar</Button>
              <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar <strong>{name}</strong>. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </AppShell>
  );
}

// ============================================================================
// Sub-components específicos del editor
// ============================================================================

function RenameModal({ initial, onClose, onSave }) {
  const [val, setVal] = useState(initial);
  return (
    <Modal title="Renombrar escenario" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!val.trim()) return;
          onSave(val.trim());
        }}
        className="flex flex-col gap-3"
      >
        <Input autoFocus value={val} onChange={(e) => setVal(e.target.value)} maxLength={80} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!val.trim()}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

function NumberField({ label, value, onChange, prefix = "", suffix = "", hint = "", readonly = false }) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState("");

  React.useEffect(() => {
    if (!isFocused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value));
    }
  }, [value, isFocused]);

  const handleChange = (e) => {
    const raw = e.target.value;
    if (!/^[0-9.,-]*$/.test(raw) && raw !== "") return;
    setLocalValue(raw);
    const unformatted = raw.replace(/,/g, "");
    const num = parseFloat(unformatted);
    if (!isNaN(num)) onChange(num);
    else if (raw === "" || raw === "-") onChange(0);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-stone-600 tracking-tight leading-tight break-words">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          value={localValue}
          onFocus={() => {
            if (readonly) return;
            setIsFocused(true);
            setLocalValue(value === 0 ? "" : value.toString());
          }}
          onBlur={() => {
            setIsFocused(false);
            setLocalValue(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value));
          }}
          onChange={handleChange}
          disabled={readonly}
          inputMode={suffix === "%" ? "decimal" : "numeric"}
          className={`w-full bg-stone-50 border border-stone-200 rounded-md py-1.5 text-sm text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white transition-colors disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed ${prefix ? "pl-6" : "pl-2.5"} ${suffix ? "pr-10" : "pr-2.5"}`}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="text-[10px] text-stone-400 leading-tight">{hint}</span>}
    </div>
  );
}

function ToggleField({ label, value, onChange, hint = "", readonly = false }) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-3 py-1">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-stone-600 leading-tight break-words">{label}</span>
        {hint && <span className="text-[10px] text-stone-400 leading-tight mt-0.5">{hint}</span>}
      </div>
      <button
        type="button"
        onClick={() => !readonly && onChange(!value)}
        disabled={readonly}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${value ? "bg-stone-900" : "bg-stone-300"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        <Icon className="w-3.5 h-3.5 text-stone-700" strokeWidth={2} />
        <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function KPICard({ label, value, sublabel, accent = "stone", size = "md", tooltip }) {
  const accents = {
    stone: "text-stone-900",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
  };
  const sizeMap = { md: "text-xl", lg: "text-2xl" };
  return (
    <div className="group relative bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-300 transition-colors">
      <div className="flex items-start gap-1.5 mb-1">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium leading-tight break-words">{label}</div>
        {tooltip && <Info className="w-3 h-3 text-stone-400 cursor-help" />}
      </div>
      <div className={`${sizeMap[size]} font-semibold ${accents[accent]} tracking-tight`}>{value}</div>
      {sublabel && <div className="text-[11px] text-stone-500 mt-0.5">{sublabel}</div>}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-stone-900 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center shadow-lg pointer-events-none">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-stone-900"></div>
        </div>
      )}
    </div>
  );
}

function FlowRow({ label, value, indent = false, bold = false, separator = false, accent = "stone", size = "md", hint = "" }) {
  const accents = { stone: "text-stone-900", emerald: "text-emerald-700", rose: "text-rose-700" };
  const sizeMap = { md: "text-sm", lg: "text-base" };
  return (
    <div className={`flex items-start justify-between gap-2 ${separator ? "border-t border-stone-200 pt-2 mt-1" : ""} ${indent ? "pl-4" : ""}`}>
      <span className={`${bold ? "font-semibold" : "font-normal"} ${sizeMap[size]} text-stone-700 leading-tight break-words`}>
        {label}
        {hint && <span className="text-[10px] text-stone-400 ml-1 block sm:inline">({hint})</span>}
      </span>
      <span className={`${bold ? "font-semibold" : "font-normal"} ${sizeMap[size]} tabular-nums shrink-0 text-right ${value < 0 ? "text-rose-600" : accents[accent]}`}>
        {fmtMXN(value)}
      </span>
    </div>
  );
}

function InsightRow({ tone, title, body }) {
  const tones = {
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  const icons = { warn: AlertTriangle, info: Info, danger: AlertTriangle, success: TrendingUp };
  const Icon = icons[tone];
  return (
    <div className={`border ${tones[tone]} rounded-md p-3 flex gap-2.5`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold mb-0.5">{title}</div>
        <div className="text-xs leading-relaxed opacity-90">{body}</div>
      </div>
    </div>
  );
}
