import { fmtMXN } from "../format";

// Formatea monto en cualquier moneda. Asume MXN/USD del modelo.
export function fmtMoney(amount, moneda = "MXN") {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda || "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

// Versión compacta para KPIs grandes (1.2M, 350K)
export function fmtMoneyCompact(amount, moneda = "MXN") {
  const value = Number(amount) || 0;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  let formatted;
  if (abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  } else if (abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1) + "K";
  } else {
    return fmtMoney(value, moneda);
  }
  const prefix = moneda === "USD" ? "US$" : "$";
  return `${sign}${prefix}${formatted}`;
}

// CLABE / cuenta bancaria → oculta dígitos
export function maskAccount(numero) {
  if (!numero) return "—";
  const s = String(numero);
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
}

// Fecha amigable
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Fecha corta para tablas (dd MMM)
export function fmtDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

// Re-export para conveniencia
export { fmtMXN };

// Paleta de colores para socios (cíclica)
export const PARTNER_COLORS = [
  "#0891b2", // sky-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#dc2626", // red-600
  "#0d9488", // teal-600
  "#65a30d", // lime-600
];

export function nextPartnerColor(existing = []) {
  for (const color of PARTNER_COLORS) {
    if (!existing.includes(color)) return color;
  }
  return PARTNER_COLORS[existing.length % PARTNER_COLORS.length];
}

// Paleta para categorías
export const CATEGORY_COLORS = [
  "#78716c", // stone-500
  "#0891b2",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#65a30d",
  "#9333ea",
];

// Labels de tipos
export const PARTNER_TIPO_LABEL = {
  fisica: "Persona física",
  moral: "Persona moral",
};

export const CONTRIBUTION_TIPO_LABEL = {
  capital: "Capital",
  prestamo: "Préstamo",
  especie: "En especie",
  reembolso: "Reembolso",
};

export const METODO_LABEL = {
  transferencia: "Transferencia",
  cheque: "Cheque",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  especie: "En especie",
  otro: "Otro",
};

export const EXPENSE_ESTADO_LABEL = {
  programado: "Programado",
  pagado: "Pagado",
  conciliado: "Conciliado",
  cancelado: "Cancelado",
};

export const CONTRIBUTION_ESTADO_LABEL = {
  registrada: "Registrada",
  conciliada: "Conciliada",
};

export const PAYEE_TIPO_LABEL = {
  proveedor: "Proveedor",
  contratista: "Contratista",
  profesional: "Profesional",
  gobierno: "Gobierno",
  empleado: "Empleado",
  servicio: "Servicio",
  otro: "Otro",
};

export const ACCOUNT_TIPO_LABEL = {
  operativa: "Operativa",
  escrow: "Escrow",
  inversion: "Inversión",
  credito: "Crédito",
  otra: "Otra",
};

export const CONTRACT_TIPO_LABEL = {
  asociacion: "Asociación",
  fideicomiso: "Fideicomiso",
  prestamo: "Préstamo",
  cesion: "Cesión",
  servicios: "Servicios",
  otro: "Otro",
};

export const TRANSFER_TIPO_LABEL = {
  cesion_porcentaje: "Cesión de %",
  ajuste: "Ajuste",
  distribucion: "Distribución",
};

// Tonos visuales por estado
export const EXPENSE_ESTADO_TONE = {
  programado: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  pagado: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  conciliado: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  cancelado: { bg: "bg-stone-100", text: "text-stone-500", border: "border-stone-200" },
};

export const CONTRIBUTION_ESTADO_TONE = {
  registrada: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  conciliada: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};
