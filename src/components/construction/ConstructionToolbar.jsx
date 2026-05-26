import { useState, useRef, useEffect } from "react";
import {
  GanttChartSquare,
  Calendar as CalendarIcon,
  List,
  Plus,
  Search,
  Filter,
  Tags,
  Flag,
  X,
  Check,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { STATUS, STATUS_LABEL } from "../../lib/construction/status";

const VIEWS = [
  { id: "gantt",    label: "Gantt",      icon: GanttChartSquare },
  { id: "calendar", label: "Calendario", icon: CalendarIcon },
  { id: "list",     label: "Lista",      icon: List },
];

export function ConstructionToolbar({
  view, onViewChange,
  filters, onFiltersChange,
  categories, members,
  canEdit, onNewTask, onManageCategories, onManageMilestones,
  currentUserId,
}) {
  const setFilter = (patch) => onFiltersChange?.({ ...filters, ...patch });
  const activeCount =
    (filters.categoryIds?.length || 0) +
    (filters.assigneeIds?.length || 0) +
    (filters.statuses?.length || 0) +
    (filters.onlyMine ? 1 : 0);

  return (
    <div className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur supports-[backdrop-filter]:bg-stone-50/70 -mx-4 md:-mx-8 px-4 md:px-8 py-3 border-b border-stone-200">
      <div className="flex flex-col gap-2.5">
        {/* fila 1: vistas + acciones */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5">
            {VIEWS.map((v) => {
              const active = view === v.id;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  onClick={() => onViewChange?.(v.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[5px] transition-colors ${
                    active
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {v.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={onManageCategories}>
                <Tags className="w-3.5 h-3.5" />
                Categorías
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={onManageMilestones}>
                <Flag className="w-3.5 h-3.5" />
                Hitos
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={onNewTask}>
                <Plus className="w-3.5 h-3.5" />
                Nueva tarea
              </Button>
            )}
          </div>
        </div>

        {/* fila 2: búsqueda + filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={filters.q || ""}
              onChange={(e) => setFilter({ q: e.target.value })}
              placeholder="Buscar tareas…"
              className="w-full bg-white border border-stone-200 rounded-md text-xs pl-8 pr-3 py-1.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
            />
          </div>

          <FilterDropdown
            label="Categoría"
            count={filters.categoryIds?.length}
            options={categories.map((c) => ({ id: c.id, label: c.name, swatch: c.color }))}
            selected={filters.categoryIds || []}
            onChange={(ids) => setFilter({ categoryIds: ids })}
          />
          <FilterDropdown
            label="Responsable"
            count={filters.assigneeIds?.length}
            options={members.map((m) => ({
              id: m.user_id,
              label: m.display_name || m.user_id.slice(0, 6),
            }))}
            selected={filters.assigneeIds || []}
            onChange={(ids) => setFilter({ assigneeIds: ids })}
          />
          <FilterDropdown
            label="Estado"
            count={filters.statuses?.length}
            options={Object.values(STATUS).map((s) => ({ id: s, label: STATUS_LABEL[s] }))}
            selected={filters.statuses || []}
            onChange={(ids) => setFilter({ statuses: ids })}
          />

          <Checkbox
            label="Solo mis tareas"
            checked={!!filters.onlyMine}
            onChange={(e) => setFilter({ onlyMine: e.target.checked })}
            disabled={!currentUserId}
          />

          {activeCount > 0 && (
            <button
              onClick={() =>
                onFiltersChange?.({
                  q: "",
                  categoryIds: [],
                  assigneeIds: [],
                  statuses: [],
                  onlyMine: false,
                })
              }
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 px-1.5 py-0.5"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterDropdown({ label, options, selected, onChange, count }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (id) => {
    if (selected.includes(id)) onChange?.(selected.filter((x) => x !== id));
    else onChange?.([...selected, id]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${
          count > 0
            ? "bg-stone-900 text-white border-stone-900"
            : "bg-white text-stone-700 border-stone-300 hover:border-stone-500"
        }`}
      >
        <Filter className="w-3 h-3" />
        {label}
        {count > 0 && <span className="tabular-nums">({count})</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-56 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-stone-500">Sin opciones</div>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {options.map((o) => {
                const sel = selected.includes(o.id);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => toggle(o.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      {o.swatch && (
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white ring-1 ring-stone-200"
                          style={{ background: o.swatch }}
                        />
                      )}
                      <span className="flex-1 truncate text-left">{o.label}</span>
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
