import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, X, Check, Link2, AlertCircle } from "lucide-react";
import { wouldCreateCycle, buildDepMap } from "../../lib/construction/dependencies";

export function TaskDependencies({
  allTasks,
  currentTaskId,
  selectedIds = [],
  onChange,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const depMap = useMemo(() => buildDepMap(allTasks), [allTasks]);

  const eligible = useMemo(
    () => allTasks.filter((t) => t.id !== currentTaskId && !t.parent_id === !allTasks.find((x) => x.id === currentTaskId)?.parent_id),
    [allTasks, currentTaskId]
  );
  // ^ heurística: solo permitir dependencias entre tareas del mismo nivel
  // (padres con padres, subtareas con subtareas) para mantener el modelo simple.

  const selected = allTasks.filter((t) => selectedIds.includes(t.id));

  const toggle = (id) => {
    setError(null);
    if (selectedIds.includes(id)) {
      onChange?.(selectedIds.filter((x) => x !== id));
      return;
    }
    if (currentTaskId && wouldCreateCycle(depMap, currentTaskId, id)) {
      setError("Esa dependencia crearía un ciclo");
      return;
    }
    onChange?.([...selectedIds, id]);
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 && (
          <span className="text-xs text-stone-400">Sin dependencias</span>
        )}
        {selected.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-xs text-stone-700 max-w-[220px]"
          >
            <Link2 className="w-3 h-3 text-stone-400 shrink-0" />
            <span className="truncate">{t.name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => toggle(t.id)}
                className="text-stone-400 hover:text-rose-700"
                aria-label={`Quitar dependencia ${t.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-stone-600 border border-dashed border-stone-300 rounded-md px-2 py-0.5 hover:border-stone-500 hover:text-stone-900"
          >
            <Plus className="w-3 h-3" />
            Agregar
          </button>
        )}
      </div>

      {error && (
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-rose-700">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-72 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-100">
            Esta tarea inicia cuando terminen…
          </div>
          {eligible.length === 0 ? (
            <div className="px-3 py-2 text-xs text-stone-500">Sin tareas disponibles</div>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {eligible.map((t) => {
                const sel = selectedIds.includes(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      <span className="flex-1 truncate text-left">{t.name}</span>
                      {sel && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
