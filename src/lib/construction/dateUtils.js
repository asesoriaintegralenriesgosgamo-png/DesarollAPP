// Utilidades de fechas usadas por el Calendario de Obra.
// Trabajamos en "calendar-day" (sin hora ni TZ) para reflejar el tipo `date` de Postgres.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function stripTime(d) {
  const x = d instanceof Date ? d : new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

export function toISODate(d) {
  if (!d) return null;
  const x = stripTime(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s) {
  if (!s) return null;
  // Acepta "YYYY-MM-DD" sin TZ → construye fecha local sin desplazamiento.
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function diffDays(a, b) {
  if (!a || !b) return 0;
  return Math.round((stripTime(b) - stripTime(a)) / MS_PER_DAY);
}

export function addDays(d, n) {
  const x = stripTime(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isSameDay(a, b) {
  if (!a || !b) return false;
  const x = stripTime(a);
  const y = stripTime(b);
  return x.getTime() === y.getTime();
}

export function isBetween(d, start, end) {
  if (!d || !start || !end) return false;
  const x = stripTime(d).getTime();
  return x >= stripTime(start).getTime() && x <= stripTime(end).getTime();
}

export function fmtDate(d, { withYear = true } = {}) {
  if (!d) return "—";
  const x = d instanceof Date ? d : parseISODate(d);
  if (!x) return "—";
  return x.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function fmtDateRange(start, end) {
  if (!start && !end) return "Sin fechas";
  if (start && !end) return `Desde ${fmtDate(start)}`;
  if (!start && end) return `Hasta ${fmtDate(end)}`;
  return `${fmtDate(start, { withYear: false })} – ${fmtDate(end)}`;
}

export function fmtDuration(start, end) {
  if (!start || !end) return "—";
  const n = diffDays(start, end) + 1; // inclusivo
  if (n === 1) return "1 día";
  return `${n} días`;
}

export function fmtRelative(d, now = new Date()) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const seconds = Math.round((now - date) / 1000);
  if (seconds < 60) return "hace unos segundos";
  const min = Math.round(seconds / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `hace ${days} d`;
  return fmtDate(date);
}

export function startOfMonth(d) {
  const x = stripTime(d);
  return new Date(x.getFullYear(), x.getMonth(), 1);
}

export function endOfMonth(d) {
  const x = stripTime(d);
  return new Date(x.getFullYear(), x.getMonth() + 1, 0);
}

// Devuelve un grid de 6×7 cubriendo el mes (lunes-domingo).
export function monthGrid(d) {
  const first = startOfMonth(d);
  const dow = (first.getDay() + 6) % 7; // 0 = lunes
  const gridStart = addDays(first, -dow);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function fmtMonthLabel(d) {
  const x = d instanceof Date ? d : parseISODate(d);
  return x.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export function fmtBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
