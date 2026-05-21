// Modelo financiero del análisis desarrollador inmobiliario.
// Función pura que recibe los inputs (`data`) y devuelve KPIs derivados.

export const DEFAULTS = {
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

export function computeKPIs(v) {
  // merge con defaults por si faltan campos
  v = { ...DEFAULTS, ...v };

  const inv_terreno = v.terreno_costo + v.terreno_isai + v.terreno_notario;

  const construccion_directa = v.construccion_m2 * v.construccion_costo_m2;
  const imprevistos_monto = construccion_directa * (v.imprevistos_pct / 100);
  const inv_construccion = construccion_directa + imprevistos_monto;

  const inv_servicios =
    v.cfe + v.agua + v.predial_construccion + v.licencias + v.proyecto_arqui;

  const inversion_total = inv_terreno + inv_construccion + inv_servicios;

  const costo_m2_construccion_solo = v.construccion_m2
    ? inv_construccion / v.construccion_m2
    : 0;
  const costo_m2_terreno = v.terreno_m2 ? v.terreno_costo / v.terreno_m2 : 0;
  const costo_total_por_m2_const = v.construccion_m2
    ? inversion_total / v.construccion_m2
    : 0;
  const precio_venta_m2 = v.construccion_m2 ? v.precio_venta / v.construccion_m2 : 0;

  const comision_monto = v.precio_venta * (v.comision_pct / 100);
  const marketing_monto = v.precio_venta * (v.marketing_pct / 100);
  const total_gastos_venta = comision_monto + marketing_monto + v.gastos_venta_otros;
  const ingreso_neto_venta = v.precio_venta - total_gastos_venta;

  const utilidad_bruta = ingreso_neto_venta - inversion_total;

  const isr_monto = v.isr_aplica ? Math.max(0, utilidad_bruta) * (v.isr_pct / 100) : 0;
  const utilidad_neta = utilidad_bruta - isr_monto;

  const meses_total = v.meses_construccion + v.meses_venta;
  const roi_pct = inversion_total ? (utilidad_neta / inversion_total) * 100 : 0;
  const margen_venta_pct = v.precio_venta ? (utilidad_neta / v.precio_venta) * 100 : 0;
  const roi_anualizado_pct =
    inversion_total && meses_total
      ? (Math.pow(1 + roi_pct / 100, 12 / meses_total) - 1) * 100
      : 0;

  const costo_oportunidad =
    inversion_total * (Math.pow(1 + v.costo_oportunidad_pct / 100, meses_total / 12) - 1);
  const utilidad_neta_real = utilidad_neta - costo_oportunidad;
  const roi_real_pct = inversion_total
    ? (utilidad_neta_real / inversion_total) * 100
    : 0;

  const breakeven_precio_venta =
    (inversion_total + (v.gastos_venta_otros || 0)) /
    (1 - (v.comision_pct + v.marketing_pct) / 100);

  const sensitivity = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10].map((delta) => {
    const pv = v.precio_venta * (1 + delta / 100);
    const com = pv * (v.comision_pct / 100);
    const mkt = pv * (v.marketing_pct / 100);
    const ing = pv - com - mkt - v.gastos_venta_otros;
    const ub = ing - inversion_total;
    const isr = v.isr_aplica ? Math.max(0, ub) * (v.isr_pct / 100) : 0;
    const un = ub - isr;
    const roi = inversion_total ? (un / inversion_total) * 100 : 0;
    const roi_an =
      inversion_total && meses_total
        ? (Math.pow(1 + roi / 100, 12 / meses_total) - 1) * 100
        : 0;
    return { delta, pv, un, roi, roi_an };
  });

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
}

export function generateInsights(v, calc, fmtMXN, fmtPct) {
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
      body: `Después de descontar lo que ganarías invirtiendo el capital al ${v.costo_oportunidad_pct}% anual durante ${calc.meses_total} meses, el proyecto destruye valor.`,
    });
  } else if (calc.roi_anualizado_pct < v.costo_oportunidad_pct) {
    insights.push({
      tone: "warn",
      title: `Anualizado ${fmtPct(calc.roi_anualizado_pct)} debajo del costo de oportunidad`,
      body: `El ROI anualizado del proyecto es menor al ${v.costo_oportunidad_pct}% que asumiste como costo de oportunidad.`,
    });
  }

  if (v.imprevistos_pct < 5) {
    insights.push({
      tone: "warn",
      title: "Imprevistos muy bajos",
      body: `Estás considerando solo ${v.imprevistos_pct}% de imprevistos. La industria sugiere 5-10% para proyectos residenciales.`,
    });
  }

  if (!v.isr_aplica) {
    insights.push({
      tone: "info",
      title: "Considera el ISR sobre la venta",
      body: `Si vendes como persona física y no calificas para la exención, pagarás ISR sobre la ganancia. Como persona moral aplica 30%. Activa el cálculo para ver el impacto.`,
    });
  }

  if (v.precio_venta < calc.breakeven_precio_venta * 1.05) {
    insights.push({
      tone: "danger",
      title: "Margen sobre punto de equilibrio peligroso",
      body: `Tu precio de venta está a menos del 5% del punto de equilibrio (${fmtMXN(calc.breakeven_precio_venta)}).`,
    });
  }

  if (v.proyecto_arqui === 0) {
    insights.push({
      tone: "info",
      title: "¿Honorarios de proyecto incluidos?",
      body: `Tienes $0 en honorarios de proyecto/arquitecto. Asegúrate de que esto ya esté contemplado dentro del costo por m² de construcción o agrégalo.`,
    });
  }

  if (v.licencias < 20000) {
    insights.push({
      tone: "warn",
      title: "Licencias y trámites posiblemente subestimados",
      body: `En Querétaro, licencia de construcción + trámites suelen sumar entre $25,000 y $60,000.`,
    });
  }

  return insights;
}
