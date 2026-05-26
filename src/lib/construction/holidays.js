// Calendario de días no laborables para obra en México.
// - Sábado y domingo se derivan al vuelo (no se listan en el mapa).
// - Feriados LFT (Art. 74) — descansos obligatorios.
// - Festivos de costumbre — no obligatorios pero comúnmente respetados en obra.

import { stripTime, toISODate, addDays, parseISODate } from "./dateUtils";

const yearCache = new Map();

export const NON_WORKING_TYPE = Object.freeze({
  WEEKEND: "weekend",
  LFT: "lft",
  CUSTOM: "custom",
});

// Algoritmo Anonymous Gregorian (Gauss/Meeus) para Domingo de Pascua.
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// n = 1..5; weekday Mon=1..Sun=7 (ISO).
export function nthIsoWeekdayOfMonth(year, monthIndex, isoWeekday, n) {
  const first = new Date(year, monthIndex, 1);
  const firstIso = ((first.getDay() + 6) % 7) + 1;
  const offset = (isoWeekday - firstIso + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (n - 1) * 7);
}

function buildYear(year) {
  const map = new Map();
  const add = (date, type, name) => {
    map.set(toISODate(date), { type, name });
  };

  // ---- LFT (Art. 74) ----
  add(new Date(year, 0, 1), NON_WORKING_TYPE.LFT, "Año Nuevo");
  add(nthIsoWeekdayOfMonth(year, 1, 1, 1), NON_WORKING_TYPE.LFT, "Día de la Constitución");
  add(nthIsoWeekdayOfMonth(year, 2, 1, 3), NON_WORKING_TYPE.LFT, "Natalicio de Benito Juárez");
  add(new Date(year, 4, 1), NON_WORKING_TYPE.LFT, "Día del Trabajo");
  add(new Date(year, 8, 16), NON_WORKING_TYPE.LFT, "Día de la Independencia");
  add(nthIsoWeekdayOfMonth(year, 10, 1, 3), NON_WORKING_TYPE.LFT, "Revolución Mexicana");
  if (year >= 2018 && (year - 2018) % 6 === 0) {
    add(new Date(year, 11, 1), NON_WORKING_TYPE.LFT, "Transmisión del Poder Ejecutivo Federal");
  }
  add(new Date(year, 11, 25), NON_WORKING_TYPE.LFT, "Navidad");

  // ---- Costumbre ----
  const easter = easterSunday(year);
  add(addDays(easter, -3), NON_WORKING_TYPE.CUSTOM, "Jueves Santo");
  add(addDays(easter, -2), NON_WORKING_TYPE.CUSTOM, "Viernes Santo");
  add(new Date(year, 10, 2), NON_WORKING_TYPE.CUSTOM, "Día de Muertos");
  add(new Date(year, 11, 12), NON_WORKING_TYPE.CUSTOM, "Virgen de Guadalupe");

  return map;
}

function getYearMap(year) {
  let m = yearCache.get(year);
  if (!m) {
    m = buildYear(year);
    yearCache.set(year, m);
  }
  return m;
}

// Devuelve un Map<isoDate, {type, name}> con TODOS los días inhábiles
// (incluyendo fines de semana) dentro del rango [start, end] inclusivo.
export function getNonWorkingDaysInRange(start, end) {
  const out = new Map();
  if (!start || !end) return out;
  const s = stripTime(start);
  const e = stripTime(end);
  // Inyecta feriados LFT y costumbre de los años cubiertos.
  for (let y = s.getFullYear(); y <= e.getFullYear(); y += 1) {
    for (const [iso, info] of getYearMap(y)) {
      const d = parseISODate(iso);
      if (d && d >= s && d <= e) out.set(iso, info);
    }
  }
  // Inyecta fines de semana.
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay(); // 0=domingo, 6=sábado
    if (dow !== 0 && dow !== 6) continue;
    const iso = toISODate(d);
    if (out.has(iso)) continue; // un feriado en fin de semana mantiene su nombre
    out.set(iso, {
      type: NON_WORKING_TYPE.WEEKEND,
      name: dow === 0 ? "Domingo" : "Sábado",
    });
  }
  return out;
}

export function isNonWorkingDay(date) {
  if (!date) return null;
  const d = stripTime(date);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) {
    return { type: NON_WORKING_TYPE.WEEKEND, name: dow === 0 ? "Domingo" : "Sábado" };
  }
  return getYearMap(d.getFullYear()).get(toISODate(d)) || null;
}
