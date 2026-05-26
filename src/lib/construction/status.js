import { stripTime, parseISODate, diffDays } from "./dateUtils";

export const STATUS = {
  PLANNED:     "planned",
  IN_PROGRESS: "in_progress",
  DONE:        "done",
  AT_RISK:     "at_risk",
  DELAYED:     "delayed",
};

export const STATUS_LABEL = {
  [STATUS.PLANNED]:     "Planeada",
  [STATUS.IN_PROGRESS]: "En curso",
  [STATUS.DONE]:        "Completada",
  [STATUS.AT_RISK]:     "En riesgo",
  [STATUS.DELAYED]:     "Atrasada",
};

export const STATUS_TONE = {
  [STATUS.PLANNED]:     "stone",
  [STATUS.IN_PROGRESS]: "stone",
  [STATUS.DONE]:        "emerald",
  [STATUS.AT_RISK]:     "amber",
  [STATUS.DELAYED]:     "rose",
};

// `task` puede traer planned_start/planned_end como string ISO o Date.
export function deriveStatus(task, today = new Date()) {
  const progress = task?.progress ?? 0;
  if (progress >= 100) return STATUS.DONE;

  const td = stripTime(today);
  const ps = task.planned_start ? parseISODate(task.planned_start) : null;
  const pe = task.planned_end   ? parseISODate(task.planned_end)   : null;
  const as = task.actual_start  ? parseISODate(task.actual_start)  : null;
  const ae = task.actual_end    ? parseISODate(task.actual_end)    : null;

  if (ae && pe && ae > pe) return STATUS.DELAYED;
  if (pe && td > pe && progress < 100) return STATUS.DELAYED;

  if (ps && pe && td >= ps) {
    if (!as && progress === 0) return STATUS.AT_RISK;
    const total = Math.max(1, diffDays(ps, pe) + 1);
    const elapsed = Math.max(0, diffDays(ps, td));
    const expected = Math.min(100, (elapsed / total) * 100);
    if (progress + 15 < expected) return STATUS.AT_RISK;
  }
  if (as || progress > 0) return STATUS.IN_PROGRESS;
  return STATUS.PLANNED;
}
