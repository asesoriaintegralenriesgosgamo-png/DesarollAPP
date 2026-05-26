import { useState, useEffect } from "react";
import { Progress } from "../ui/Progress";

export function ProgressInline({
  value,
  tone = "stone",
  disabled = false,
  onCommit,
  width = "w-28",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (disabled) {
    return (
      <div className="flex items-center gap-2">
        <div className={width}><Progress value={value} tone={tone} size="sm" /></div>
        <span className="text-xs text-stone-600 tabular-nums w-9 text-right">{value ?? 0}%</span>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 group"
        aria-label="Editar avance"
      >
        <div className={width}><Progress value={value} tone={tone} size="sm" /></div>
        <span className="text-xs text-stone-700 tabular-nums w-9 text-right group-hover:text-stone-900">
          {value ?? 0}%
        </span>
      </button>
    );
  }

  const commit = () => {
    const clamped = Math.max(0, Math.min(100, Number(draft) || 0));
    setEditing(false);
    if (clamped !== value) onCommit?.(clamped);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        className={`${width} accent-stone-900`}
        autoFocus
      />
      <input
        type="number"
        min={0}
        max={100}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="w-14 text-xs tabular-nums border border-stone-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-stone-900"
      />
    </div>
  );
}
