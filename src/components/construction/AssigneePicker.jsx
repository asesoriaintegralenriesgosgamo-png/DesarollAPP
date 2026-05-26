import { useState, useRef, useEffect } from "react";
import { Plus, X, Check } from "lucide-react";
import { Avatar } from "../ui/Avatar";

export function AssigneePicker({
  members = [],
  selectedIds = [],
  onChange,
  disabled = false,
  size = "sm",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = members.filter((m) => selectedIds.includes(m.user_id));

  const toggle = (userId) => {
    if (selectedIds.includes(userId)) {
      onChange?.(selectedIds.filter((id) => id !== userId));
    } else {
      onChange?.([...selectedIds, userId]);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center flex-wrap gap-1.5">
        {selected.length === 0 && (
          <span className="text-xs text-stone-400">Sin responsables</span>
        )}
        {selected.map((m) => (
          <span
            key={m.user_id}
            className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-xs text-stone-700"
          >
            <Avatar
              name={m.display_name}
              email={m.email}
              url={m.avatar_url}
              size="xs"
            />
            <span className="max-w-[100px] truncate">
              {m.display_name || m.email?.split("@")[0] || "Usuario"}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => toggle(m.user_id)}
                className="text-stone-400 hover:text-rose-700"
                aria-label={`Quitar ${m.display_name || m.email || "miembro"}`}
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
            className="inline-flex items-center gap-1 text-xs text-stone-600 border border-dashed border-stone-300 rounded-full px-2 py-0.5 hover:border-stone-500 hover:text-stone-900"
          >
            <Plus className="w-3 h-3" />
            Agregar
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-60 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
          <ul className="max-h-64 overflow-y-auto py-1">
            {members.length === 0 ? (
              <li className="px-3 py-2 text-xs text-stone-500">Sin miembros</li>
            ) : (
              members.map((m) => {
                const sel = selectedIds.includes(m.user_id);
                return (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.user_id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      <Avatar
                        name={m.display_name}
                        email={m.email}
                        url={m.avatar_url}
                        size="sm"
                      />
                      <span className="flex-1 truncate text-left">
                        {m.display_name || m.email?.split("@")[0] || "Usuario"}
                      </span>
                      {sel && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
