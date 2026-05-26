import { forwardRef } from "react";
import { Check } from "lucide-react";

export const Checkbox = forwardRef(function Checkbox(
  { label, hint, checked, onChange, disabled, className = "", id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-start gap-2 text-sm text-stone-700 cursor-pointer select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      <span className="relative inline-flex items-center justify-center mt-0.5">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer appearance-none w-4 h-4 rounded border border-stone-300 bg-white checked:bg-stone-900 checked:border-stone-900 hover:border-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 transition-colors"
          {...props}
        />
        <Check className="pointer-events-none absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      {(label || hint) && (
        <span className="flex flex-col gap-0.5 leading-tight">
          {label && <span className="text-sm text-stone-900">{label}</span>}
          {hint && <span className="text-xs text-stone-500">{hint}</span>}
        </span>
      )}
    </label>
  );
});
