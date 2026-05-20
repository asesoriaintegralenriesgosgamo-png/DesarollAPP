import React, { useState, useMemo } from "react";
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
  Building2,
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
} from "lucide-react";

const fmtMXN = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

const fmtPct = (n, d = 1) =>
  `${isFinite(n) ? n.toFixed(d) : "0.0"}%`;

const fmtNum = (n, d = 0) =>
  new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  }).format(isFinite(n) ? n : 0);

// Sensible default values pulled from Antonio's spreadsheet
const DEFAULTS = {
  // Terreno
  terreno_costo: 1800000,
  terreno_m2: 285,
  terreno_isai: 213558,
  terreno_notario: 15138.63,
  // Construcción
  construccion_m2: 224,
  construccion_costo_m2: 13500,
  imprevistos_pct: 5,
  // Servicios y trámites
  cfe: 500,
  agua: 16244,
  predial_construccion: 4000,
  licencias: 35000,
  proyecto_arqui: 0,
  // Tiempo
  meses_construccion: 9,
  meses_venta: 4,
  // Comerciales
  comision_pct: 5,
  marketing_pct: 1,
  gastos_venta_otros: 0,
  // Venta
  precio_venta: 6000000,
  // Impuestos sobre ganancia
  isr_aplica: false,
  isr_pct: 30,
  // Costo de oportunidad
  costo_oportunidad_pct: 8,
};

const SECTIONS = {
  terreno: { label: "Terreno", icon: Tag, color: "amber" },
  construccion: { label: "Construcción", icon: Hammer, color: "stone" },
  servicios: { label: "Servicios y trámites", icon: Receipt, color: "slate" },
  tiempo: { label: "Tiempo del proyecto", icon: Clock, color: "neutral" },
  comerciales: { label: "Costos comerciales", icon: Tag, color: "zinc" },
  venta: { label: "Venta", icon: Banknote, color: "emerald" },
  impuestos: { label: "Impuestos sobre la ganancia", icon: Percent, color: "rose" },
};

function NumberField({
  label,
  value,
  onChange,
  prefix = "",
  suffix = "",
  step = 1,
  hint = "",
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState("");

  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value));
    }
  }, [value, isFocused]);

  const handleChange = (e) => {
    const raw = e.target.value;
    if (!/^[0-9.,-]*$/.test(raw) && raw !== '') return;
    setLocalValue(raw);
    
    const unformatted = raw.replace(/,/g, '');
    const num = parseFloat(unformatted);
    if (!isNaN(num)) {
      onChange(num);
    } else if (raw === '' || raw === '-') {
      onChange(0);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(value === 0 ? "" : value.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    setLocalValue(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value));
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-stone-600 tracking-tight">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          value={localValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          inputMode={suffix === "%" ? "decimal" : "numeric"}
          className={`w-full bg-stone-50 border border-stone-200 rounded-md py-1.5 text-sm text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white transition-colors ${
            prefix ? "pl-6" : "pl-2.5"
          } ${suffix ? "pr-10" : "pr-2.5"}`}
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

function ToggleField({ label, value, onChange, hint = "" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-stone-600">{label}</span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? "bg-stone-900" : "bg-stone-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, accent = "stone" }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        <Icon className="w-3.5 h-3.5 text-stone-700" strokeWidth={2} />
        <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase">
          {title}
        </h3>
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
  const sizeMap = {
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };
  return (
    <div className="group relative bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-300 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">
          {label}
        </div>
        {tooltip && (
          <Info className="w-3 h-3 text-stone-400 cursor-help" />
        )}
      </div>
      <div className={`${sizeMap[size]} font-semibold ${accents[accent]} tracking-tight`}>
        {value}
      </div>
      {sublabel && (
        <div className="text-[11px] text-stone-500 mt-0.5">{sublabel}</div>
      )}
      
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-stone-900 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center shadow-lg pointer-events-none">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-stone-900"></div>
        </div>
      )}
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
  const icons = {
    warn: AlertTriangle,
    info: Info,
    danger: AlertTriangle,
    success: TrendingUp,
  };
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

export default function AnalisisDesarrollador() {
  const [v, setV] = useState(DEFAULTS);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const calc = useMemo(() => {
    // Inversión - Terreno
    const inv_terreno =
      v.terreno_costo + v.terreno_isai + v.terreno_notario;

    // Inversión - Construcción
    const construccion_directa = v.construccion_m2 * v.construccion_costo_m2;
    const imprevistos_monto = construccion_directa * (v.imprevistos_pct / 100);
    const inv_construccion = construccion_directa + imprevistos_monto;

    // Servicios y trámites
    const inv_servicios =
      v.cfe + v.agua + v.predial_construccion + v.licencias + v.proyecto_arqui;

    // Inversión total (capital expuesto antes de gastos de venta)
    const inversion_total = inv_terreno + inv_construccion + inv_servicios;

    // Costos derivados
    const costo_m2_construccion_solo = v.construccion_m2
      ? inv_construccion / v.construccion_m2
      : 0;
    const costo_m2_terreno = v.terreno_m2
      ? v.terreno_costo / v.terreno_m2
      : 0;
    const costo_total_por_m2_const = v.construccion_m2
      ? inversion_total / v.construccion_m2
      : 0;
    const precio_venta_m2 = v.construccion_m2
      ? v.precio_venta / v.construccion_m2
      : 0;

    // Venta
    const comision_monto = v.precio_venta * (v.comision_pct / 100);
    const marketing_monto = v.precio_venta * (v.marketing_pct / 100);
    const total_gastos_venta =
      comision_monto + marketing_monto + v.gastos_venta_otros;
    const ingreso_neto_venta = v.precio_venta - total_gastos_venta;

    // Utilidad antes de impuestos
    const utilidad_bruta = ingreso_neto_venta - inversion_total;

    // ISR sobre la ganancia
    const isr_monto = v.isr_aplica
      ? Math.max(0, utilidad_bruta) * (v.isr_pct / 100)
      : 0;
    const utilidad_neta = utilidad_bruta - isr_monto;

    // Tiempo y rendimientos
    const meses_total = v.meses_construccion + v.meses_venta;
    const roi_pct = inversion_total ? (utilidad_neta / inversion_total) * 100 : 0;
    const margen_venta_pct = v.precio_venta
      ? (utilidad_neta / v.precio_venta) * 100
      : 0;
    const roi_anualizado_pct = inversion_total && meses_total
      ? (Math.pow(1 + roi_pct / 100, 12 / meses_total) - 1) * 100
      : 0;

    // Costo de oportunidad (qué dejaste de ganar manteniendo el capital invertido)
    const costo_oportunidad =
      inversion_total *
      (Math.pow(1 + v.costo_oportunidad_pct / 100, meses_total / 12) - 1);
    const utilidad_neta_real = utilidad_neta - costo_oportunidad;
    const roi_real_pct = inversion_total
      ? (utilidad_neta_real / inversion_total) * 100
      : 0;

    // Punto de equilibrio (precio mínimo de venta para no perder)
    const breakeven_precio_venta =
      (inversion_total + (v.gastos_venta_otros || 0)) /
      (1 - (v.comision_pct + v.marketing_pct) / 100);

    // Sensibilidad: variar precio venta -10% a +10%
    const sensitivity = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10].map(
      (delta) => {
        const pv = v.precio_venta * (1 + delta / 100);
        const com = pv * (v.comision_pct / 100);
        const mkt = pv * (v.marketing_pct / 100);
        const ing = pv - com - mkt - v.gastos_venta_otros;
        const ub = ing - inversion_total;
        const isr = v.isr_aplica ? Math.max(0, ub) * (v.isr_pct / 100) : 0;
        const un = ub - isr;
        const roi = inversion_total ? (un / inversion_total) * 100 : 0;
        const roi_an = inversion_total && meses_total
          ? (Math.pow(1 + roi / 100, 12 / meses_total) - 1) * 100
          : 0;
        return { delta, pv, un, roi, roi_an };
      }
    );

    return {
      inv_terreno,
      construccion_directa,
      imprevistos_monto,
      inv_construccion,
      inv_servicios,
      inversion_total,
      costo_m2_construccion_solo,
      costo_m2_terreno,
      costo_total_por_m2_const,
      precio_venta_m2,
      comision_monto,
      marketing_monto,
      total_gastos_venta,
      ingreso_neto_venta,
      utilidad_bruta,
      isr_monto,
      utilidad_neta,
      meses_total,
      roi_pct,
      margen_venta_pct,
      roi_anualizado_pct,
      costo_oportunidad,
      utilidad_neta_real,
      roi_real_pct,
      breakeven_precio_venta,
      sensitivity,
    };
  }, [v]);

  const breakdownData = [
    { name: "Terreno", value: calc.inv_terreno, fill: "#a8a29e" },
    { name: "Construcción", value: calc.inv_construccion, fill: "#57534e" },
    { name: "Servicios y trámites", value: calc.inv_servicios, fill: "#d6d3d1" },
  ];

  const sensitivityChart = calc.sensitivity.map((s) => ({
    label: `${s.delta > 0 ? "+" : ""}${s.delta}%`,
    "Utilidad neta": Math.round(s.un),
    delta: s.delta,
  }));

  // Insight generation
  const insights = [];

  if (calc.roi_pct < 15) {
    insights.push({
      tone: "warn",
      title: `Rendimiento bajo: ${fmtPct(calc.roi_pct)}`,
      body: `El estándar de la industria para desarrollo residencial en México es 18-25% sobre inversión. A este nivel, el riesgo del proyecto puede no compensar el capital comprometido.`,
    });
  } else if (calc.roi_pct >= 20) {
    insights.push({
      tone: "success",
      title: `Rendimiento sólido: ${fmtPct(calc.roi_pct)}`,
      body: `Estás dentro del rango saludable para desarrollo residencial. Asegúrate de que los supuestos de precio de venta y costo de construcción sean realistas para el mercado actual.`,
    });
  }

  if (calc.roi_real_pct < 0) {
    insights.push({
      tone: "danger",
      title: "Pérdida real frente al costo de oportunidad",
      body: `Después de descontar lo que ganarías invirtiendo el capital al ${v.costo_oportunidad_pct}% anual durante ${calc.meses_total} meses, el proyecto destruye valor. Compara contra alternativas (CETES, bienes raíces ya rentando, etc.).`,
    });
  } else if (calc.roi_anualizado_pct < v.costo_oportunidad_pct) {
    insights.push({
      tone: "warn",
      title: `Anualizado ${fmtPct(calc.roi_anualizado_pct)} debajo del costo de oportunidad`,
      body: `El ROI anualizado del proyecto es menor al ${v.costo_oportunidad_pct}% que asumiste como costo de oportunidad. El proyecto genera utilidad pero subóptima frente a alternativas pasivas.`,
    });
  }

  if (v.imprevistos_pct < 5) {
    insights.push({
      tone: "warn",
      title: "Imprevistos muy bajos",
      body: `Estás considerando solo ${v.imprevistos_pct}% de imprevistos. La industria sugiere 5-10% para proyectos residenciales. Aumentos en materiales, retrasos y errores de diseño son normales.`,
    });
  }

  if (!v.isr_aplica) {
    insights.push({
      tone: "info",
      title: "Considera el ISR sobre la venta",
      body: `Si vendes como persona física y no calificas para la exención de casa habitación (haber vendido otra en los últimos 3 años, ser inversionista frecuente, no tener comprobantes de inversión), pagarás ISR sobre la ganancia. Como persona moral aplica 30% sobre utilidad. Activa el cálculo para ver el impacto.`,
    });
  }

  if (v.precio_venta < calc.breakeven_precio_venta * 1.05) {
    insights.push({
      tone: "danger",
      title: "Margen sobre punto de equilibrio peligroso",
      body: `Tu precio de venta está a menos del 5% del punto de equilibrio (${fmtMXN(calc.breakeven_precio_venta)}). Cualquier costo no contemplado o rebaja en negociación te puede llevar a pérdida.`,
    });
  }

  if (v.proyecto_arqui === 0) {
    insights.push({
      tone: "info",
      title: "¿Honorarios de proyecto incluidos?",
      body: `Tienes $0 en honorarios de proyecto/arquitecto. Asegúrate de que esto ya esté contemplado dentro del costo por m² de construcción o agrégalo. Típicamente representa 4-8% del costo de obra.`,
    });
  }

  if (v.licencias < 20000) {
    insights.push({
      tone: "warn",
      title: "Licencias y trámites posiblemente subestimados",
      body: `En Querétaro, licencia de construcción + alineamiento + número oficial + factibilidades suelen sumar entre $25,000 y $60,000 dependiendo del m² y zona. Verifica con tu DRO.`,
    });
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-stone-500 text-xs uppercase tracking-widest font-medium mb-1">
              <Building2 className="w-3.5 h-3.5" strokeWidth={2} />
              Análisis desarrollador inmobiliario
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight">
              Casa para venta — escenario completo
            </h1>
            <p className="text-sm text-stone-600 mt-1">
              Modelo de inversión, rendimiento y sensibilidad para casa habitación en Querétaro
            </p>
          </div>
          <button
            onClick={() => setV(DEFAULTS)}
            className="text-xs px-3 py-1.5 border border-stone-300 rounded-md text-stone-700 hover:bg-white transition-colors"
          >
            Restablecer valores
          </button>
        </header>

        {/* Top KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
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
            tooltip="Suma de terreno, construcción, servicios y trámites. Capital total en riesgo."
          />
          <KPICard
            label="Utilidad neta"
            value={fmtMXN(calc.utilidad_neta)}
            sublabel={`Bruta: ${fmtMXN(calc.utilidad_bruta)}`}
            accent={calc.utilidad_neta >= 0 ? "emerald" : "rose"}
            size="lg"
            tooltip="Ganancia final tras descontar toda la inversión, gastos de venta e impuestos."
          />
          <KPICard
            label="ROI"
            value={fmtPct(calc.roi_pct)}
            sublabel={`Anualizado: ${fmtPct(calc.roi_anualizado_pct)}`}
            accent={calc.roi_pct >= 18 ? "emerald" : calc.roi_pct >= 10 ? "amber" : "rose"}
            size="lg"
            tooltip="Retorno de Inversión. Porcentaje que creció el capital invertido (Utilidad / Inversión)."
          />
          <KPICard
            label="Margen sobre venta"
            value={fmtPct(calc.margen_venta_pct)}
            sublabel={`Punto eq.: ${fmtMXN(calc.breakeven_precio_venta)}`}
            accent={calc.margen_venta_pct >= 15 ? "emerald" : calc.margen_venta_pct >= 8 ? "amber" : "rose"}
            size="lg"
            tooltip="Porcentaje del precio de venta que representa tu utilidad neta."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Inputs */}
          <div className="lg:col-span-5 space-y-4">
            <SectionCard title={SECTIONS.terreno.label} icon={SECTIONS.terreno.icon}>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Costo del terreno"
                  value={v.terreno_costo}
                  onChange={set("terreno_costo")}
                  prefix="$"
                />
                <NumberField
                  label="Superficie terreno"
                  value={v.terreno_m2}
                  onChange={set("terreno_m2")}
                  suffix="m²"
                />
                <NumberField
                  label="ISAI / derechos / impuestos"
                  value={v.terreno_isai}
                  onChange={set("terreno_isai")}
                  prefix="$"
                  hint="Derechos + ISAI + retenciones notariales"
                />
                <NumberField
                  label="Honorarios notario (con IVA)"
                  value={v.terreno_notario}
                  onChange={set("terreno_notario")}
                  prefix="$"
                />
              </div>
              <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-100">
                Costo m² terreno: <span className="font-semibold text-stone-900">{fmtMXN(calc.costo_m2_terreno)}</span> · Total adquisición: <span className="font-semibold text-stone-900">{fmtMXN(calc.inv_terreno)}</span>
              </div>
            </SectionCard>

            <SectionCard
              title={SECTIONS.construccion.label}
              icon={SECTIONS.construccion.icon}
            >
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="m² de construcción"
                  value={v.construccion_m2}
                  onChange={set("construccion_m2")}
                  suffix="m²"
                />
                <NumberField
                  label="Costo por m²"
                  value={v.construccion_costo_m2}
                  onChange={set("construccion_costo_m2")}
                  prefix="$"
                  hint="QRO residencial: $12,500-$16,000"
                />
                <NumberField
                  label="Imprevistos"
                  value={v.imprevistos_pct}
                  onChange={set("imprevistos_pct")}
                  suffix="%"
                  step={0.5}
                  hint="Recomendado 5-10%"
                />
                <div className="bg-stone-50 rounded-md p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider">Costo construcción</span>
                  <span className="text-sm font-semibold text-stone-900">{fmtMXN(calc.inv_construccion)}</span>
                  <span className="text-[10px] text-stone-500">+{fmtMXN(calc.imprevistos_monto)} imprevistos</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={SECTIONS.servicios.label} icon={SECTIONS.servicios.icon}>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Contrato CFE"
                  value={v.cfe}
                  onChange={set("cfe")}
                  prefix="$"
                />
                <NumberField
                  label="Contrato agua"
                  value={v.agua}
                  onChange={set("agua")}
                  prefix="$"
                />
                <NumberField
                  label="Predial durante construcción"
                  value={v.predial_construccion}
                  onChange={set("predial_construccion")}
                  prefix="$"
                  hint="Bimestral × duración"
                />
                <NumberField
                  label="Licencias y permisos"
                  value={v.licencias}
                  onChange={set("licencias")}
                  prefix="$"
                  hint="Construcción, alineamiento, DRO"
                />
                <NumberField
                  label="Honorarios de proyecto"
                  value={v.proyecto_arqui}
                  onChange={set("proyecto_arqui")}
                  prefix="$"
                  hint="Arquitecto, ingeniería, supervisión"
                />
              </div>
            </SectionCard>

            <SectionCard title={SECTIONS.tiempo.label} icon={SECTIONS.tiempo.icon}>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Meses de construcción"
                  value={v.meses_construccion}
                  onChange={set("meses_construccion")}
                  suffix="meses"
                />
                <NumberField
                  label="Meses estimados de venta"
                  value={v.meses_venta}
                  onChange={set("meses_venta")}
                  suffix="meses"
                />
                <NumberField
                  label="Costo de oportunidad anual"
                  value={v.costo_oportunidad_pct}
                  onChange={set("costo_oportunidad_pct")}
                  suffix="%"
                  step={0.5}
                  hint="CETES, otra inversión pasiva"
                />
                <div className="bg-stone-50 rounded-md p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider">Total proyecto</span>
                  <span className="text-sm font-semibold text-stone-900">{calc.meses_total} meses</span>
                  <span className="text-[10px] text-stone-500">{(calc.meses_total / 12).toFixed(2)} años</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={SECTIONS.venta.label} icon={SECTIONS.venta.icon}>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Precio de venta esperado"
                  value={v.precio_venta}
                  onChange={set("precio_venta")}
                  prefix="$"
                />
                <div className="bg-stone-50 rounded-md p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider">Precio por m²</span>
                  <span className="text-sm font-semibold text-stone-900">{fmtMXN(calc.precio_venta_m2)}</span>
                </div>
                <NumberField
                  label="Comisión inmobiliaria"
                  value={v.comision_pct}
                  onChange={set("comision_pct")}
                  suffix="%"
                  step={0.25}
                  hint="QRO típico: 4-6%"
                />
                <NumberField
                  label="Marketing"
                  value={v.marketing_pct}
                  onChange={set("marketing_pct")}
                  suffix="%"
                  step={0.25}
                />
                <NumberField
                  label="Otros gastos de venta"
                  value={v.gastos_venta_otros}
                  onChange={set("gastos_venta_otros")}
                  prefix="$"
                  hint="Avalúos, certificados"
                />
              </div>
            </SectionCard>

            <SectionCard title={SECTIONS.impuestos.label} icon={SECTIONS.impuestos.icon}>
              <ToggleField
                label="Aplicar ISR sobre la utilidad"
                value={v.isr_aplica}
                onChange={set("isr_aplica")}
                hint="Activa si NO aplica exención de casa habitación"
              />
              {v.isr_aplica && (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Tasa ISR estimada"
                    value={v.isr_pct}
                    onChange={set("isr_pct")}
                    suffix="%"
                    step={1}
                    hint="PM: 30% · PF: hasta 35% sobre ganancia"
                  />
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
            {/* Investment breakdown */}
            <div className="bg-white border border-stone-200 rounded-lg p-5">
              <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase mb-3 flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5" strokeWidth={2} />
                Desglose de la inversión
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdownData}
                        innerRadius={45}
                        outerRadius={75}
                        dataKey="value"
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {breakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => fmtMXN(value)}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #e7e5e4",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {breakdownData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ background: item.fill }}
                        />
                        <span className="text-xs text-stone-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-stone-900">
                          {fmtMXN(item.value)}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {fmtPct((item.value / calc.inversion_total) * 100)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-stone-200 pt-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900">TOTAL</span>
                    <span className="text-sm font-bold text-stone-900">
                      {fmtMXN(calc.inversion_total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detail KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KPICard
                label="Costo m² construcción"
                value={fmtMXN(calc.costo_m2_construccion_solo)}
                sublabel="Solo obra + imprevistos"
                tooltip="Costo de construir la casa dividido por los m² de obra (sin terreno ni trámites)."
              />
              <KPICard
                label="Costo m² terreno"
                value={fmtMXN(calc.costo_m2_terreno)}
                sublabel={`${fmtNum(v.terreno_m2)} m² totales`}
                tooltip="Precio del lote dividido entre sus metros cuadrados."
              />
              <KPICard
                label="Precio m² venta"
                value={fmtMXN(calc.precio_venta_m2)}
                sublabel={`${fmtNum(v.construccion_m2)} m² const.`}
                tooltip="A cuánto se vende cada metro cuadrado de la casa construida."
              />
              <KPICard
                label="Gastos de venta"
                value={fmtMXN(calc.total_gastos_venta)}
                sublabel={`Comisión + marketing`}
                accent="rose"
                tooltip="Costos de comercialización (inmobiliaria, publicidad) pagados al vender."
              />
              <KPICard
                label="ROI real (vs oportunidad)"
                value={fmtPct(calc.roi_real_pct)}
                sublabel={`Costo oport.: ${fmtMXN(calc.costo_oportunidad)}`}
                accent={calc.roi_real_pct >= 0 ? "emerald" : "rose"}
                tooltip="Ganancia descontando lo que hubieras ganado en CETES (o inversión pasiva) en el mismo tiempo."
              />
              <KPICard
                label="Ingreso neto venta"
                value={fmtMXN(calc.ingreso_neto_venta)}
                sublabel="Después de comisiones"
                accent="emerald"
                tooltip="Dinero que recibes de la venta ya libres de comisión y marketing."
              />
            </div>

            {/* Cash flow waterfall */}
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
                <FlowRow
                  label="Ingreso neto"
                  value={calc.ingreso_neto_venta}
                  bold
                  separator
                />
                <FlowRow label="− Inversión terreno" value={-calc.inv_terreno} indent />
                <FlowRow label="− Inversión construcción" value={-calc.inv_construccion} indent />
                <FlowRow label="− Servicios y trámites" value={-calc.inv_servicios} indent />
                <FlowRow
                  label="Utilidad bruta"
                  value={calc.utilidad_bruta}
                  bold
                  separator
                  accent={calc.utilidad_bruta >= 0 ? "emerald" : "rose"}
                />
                {v.isr_aplica && (
                  <FlowRow label="− ISR sobre utilidad" value={-calc.isr_monto} indent />
                )}
                <FlowRow
                  label="UTILIDAD NETA"
                  value={calc.utilidad_neta}
                  bold
                  separator
                  accent={calc.utilidad_neta >= 0 ? "emerald" : "rose"}
                  size="lg"
                />
                <FlowRow
                  label="− Costo de oportunidad"
                  value={-calc.costo_oportunidad}
                  indent
                  hint={`${calc.meses_total}m al ${v.costo_oportunidad_pct}% anual`}
                />
                <FlowRow
                  label="Utilidad real"
                  value={calc.utilidad_neta_real}
                  bold
                  separator
                  accent={calc.utilidad_neta_real >= 0 ? "emerald" : "rose"}
                />
              </div>
            </div>

            {/* Sensitivity */}
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
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#78716c" }}
                      axisLine={{ stroke: "#d6d3d1" }}
                    />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: "#78716c" }}
                      axisLine={{ stroke: "#d6d3d1" }}
                    />
                    <Tooltip
                      formatter={(value) => fmtMXN(value)}
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e7e5e4" }}
                    />
                    <ReferenceLine y={0} stroke="#a8a29e" strokeWidth={1} />
                    <Bar dataKey="Utilidad neta" radius={[2, 2, 0, 0]}>
                      {sensitivityChart.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry["Utilidad neta"] < 0
                              ? "#dc2626"
                              : entry.delta === 0
                              ? "#0f172a"
                              : "#65a30d"
                          }
                        />
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
                      <tr
                        key={i}
                        className={`border-b border-stone-100 ${
                          s.delta === 0 ? "bg-stone-50 font-semibold" : ""
                        }`}
                      >
                        <td className={`py-1.5 ${s.delta < 0 ? "text-rose-600" : s.delta > 0 ? "text-emerald-700" : "text-stone-900"}`}>
                          {s.delta > 0 ? "+" : ""}{s.delta}%
                        </td>
                        <td className="text-right py-1.5 text-stone-700">{fmtMXN(s.pv)}</td>
                        <td className={`text-right py-1.5 ${s.un < 0 ? "text-rose-600" : "text-stone-900"}`}>
                          {fmtMXN(s.un)}
                        </td>
                        <td className={`text-right py-1.5 ${s.roi < 0 ? "text-rose-600" : "text-stone-900"}`}>
                          {fmtPct(s.roi)}
                        </td>
                        <td className={`text-right py-1.5 ${s.roi_an < 0 ? "text-rose-600" : "text-stone-900"}`}>
                          {fmtPct(s.roi_an)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-lg p-5">
                <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase mb-3 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" strokeWidth={2} />
                  Análisis y alertas
                </h3>
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <InsightRow key={i} {...ins} />
                  ))}
                </div>
              </div>
            )}

            {/* Educational footer */}
            <div className="bg-stone-900 text-stone-100 rounded-lg p-5">
              <h3 className="text-xs font-semibold tracking-tight uppercase mb-3 text-stone-300">
                Lo que debes contemplar (más allá de los números)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed text-stone-300">
                <div>
                  <div className="font-semibold text-white mb-0.5">ISR sobre la venta</div>
                  Casa habitación PF: exenta hasta 700,000 UDIs (~$5.85M MXN, sube con inflación) si no vendiste otra en 3 años. Como inversionista frecuente o PM, paga sobre ganancia.
                </div>
                <div>
                  <div className="font-semibold text-white mb-0.5">IVA en construcción</div>
                  La venta de casa habitación NO causa IVA al comprador, pero los materiales SÍ tienen IVA. Como PF no lo acreditas. Como PM lo acreditas y mejora márgenes 5-10%.
                </div>
                <div>
                  <div className="font-semibold text-white mb-0.5">Tiempo es dinero</div>
                  ROI total es engañoso. Una utilidad del 20% en 18 meses equivale a ~13% anualizado. Compara siempre el anualizado contra alternativas.
                </div>
                <div>
                  <div className="font-semibold text-white mb-0.5">Riesgo de mercado</div>
                  El precio de venta es estimado, no garantizado. Mercado puede tardar 6-12 meses. Considera escenarios pesimistas y rebajas en negociación.
                </div>
                <div>
                  <div className="font-semibold text-white mb-0.5">Imprevistos reales</div>
                  Variación de precios de materiales, retrabajos, cambios de proyecto, retrasos por permisos o clima. Presupuesta 5-10% adicional.
                </div>
                <div>
                  <div className="font-semibold text-white mb-0.5">Estructura legal</div>
                  Si harás más de un proyecto al año, evalúa constituir una sociedad. Cambia régimen fiscal, deducibilidad y exposición personal frente a obligaciones del proyecto.
                </div>
                <div>
                  <div className="font-semibold text-white mb-0.5">Garantías al comprador</div>
                  Por ley, vicios ocultos en construcción se garantizan 5 años (estructura) y 1 año (acabados). Reserva una contingencia post-venta.
                </div>
                <div>
                  <div className="font-semibold text-white mb-0.5">Costo de oportunidad</div>
                  El capital comprometido no genera otro rendimiento. Si CETES dan 9% sin riesgo, tu proyecto debe superar ese benchmark para justificar el riesgo de obra.
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 pt-4 border-t border-stone-200 text-[11px] text-stone-500 text-center">
          Esta herramienta es un modelo financiero para análisis interno. No sustituye asesoría fiscal, legal ni de un perito valuador. Verifica cada supuesto contra cotizaciones reales.
        </footer>
      </div>
    </div>
  );
}

function FlowRow({
  label,
  value,
  indent = false,
  bold = false,
  separator = false,
  accent = "stone",
  size = "md",
  hint = "",
}) {
  const accents = {
    stone: "text-stone-900",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
  };
  const sizeMap = {
    md: "text-sm",
    lg: "text-base",
  };
  return (
    <div
      className={`flex items-center justify-between ${
        separator ? "border-t border-stone-200 pt-2 mt-1" : ""
      } ${indent ? "pl-4" : ""}`}
    >
      <span className={`${bold ? "font-semibold" : "font-normal"} ${sizeMap[size]} text-stone-700`}>
        {label}
        {hint && <span className="text-[10px] text-stone-400 ml-1">({hint})</span>}
      </span>
      <span
        className={`${bold ? "font-semibold" : "font-normal"} ${sizeMap[size]} tabular-nums ${
          value < 0 ? "text-rose-600" : accents[accent]
        }`}
      >
        {fmtMXN(value)}
      </span>
    </div>
  );
}
