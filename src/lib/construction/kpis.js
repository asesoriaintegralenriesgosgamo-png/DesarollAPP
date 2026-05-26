import { STATUS, deriveStatus } from "./status";
import { parseISODate, stripTime, addDays } from "./dateUtils";

export function computeCalendarKPIs(tasks, today = new Date()) {
  if (!tasks || tasks.length === 0) {
    return { avancePct: 0, total: 0, atrasadas: 0, proximas: 0 };
  }
  // Solo cuentan tareas hoja (sin hijos) para no doble-contar el padre agregado.
  const td = stripTime(today);
  const limit = addDays(td, 7);

  const sumProgress = tasks.reduce((s, t) => s + (t.progress || 0), 0);
  const avancePct = Math.round(sumProgress / tasks.length);

  const atrasadas = tasks.filter((t) => deriveStatus(t, today) === STATUS.DELAYED).length;

  const proximas = tasks.filter((t) => {
    if (!t.planned_start) return false;
    const ps = parseISODate(t.planned_start);
    if (!ps) return false;
    return ps >= td && ps <= limit;
  }).length;

  return { avancePct, total: tasks.length, atrasadas, proximas };
}

// Avance ponderado por duración planeada de las tareas dentro de un grupo.
export function computeWeightedProgress(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  let weightSum = 0;
  let acc = 0;
  for (const t of tasks) {
    const ps = t.planned_start ? parseISODate(t.planned_start) : null;
    const pe = t.planned_end ? parseISODate(t.planned_end) : null;
    const days = ps && pe ? Math.max(1, Math.round((pe - ps) / 86_400_000) + 1) : 1;
    weightSum += days;
    acc += days * (t.progress || 0);
  }
  return Math.round(acc / weightSum);
}
