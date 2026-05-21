import { forwardRef } from "react";

export const Input = forwardRef(function Input(
  { label, hint, error, className = "", id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-stone-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full bg-stone-50 border rounded-md py-2 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white transition-colors ${
          error
            ? "border-rose-500 focus:border-rose-700"
            : "border-stone-200 focus:border-stone-900"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-rose-700">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, children, className = "", id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-stone-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={`w-full bg-stone-50 border rounded-md py-2 px-3 text-sm text-stone-900 focus:outline-none focus:bg-white transition-colors ${
          error
            ? "border-rose-500 focus:border-rose-700"
            : "border-stone-200 focus:border-stone-900"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs text-rose-700">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, className = "", id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-stone-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={`w-full bg-stone-50 border rounded-md py-2 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white transition-colors resize-y ${
          error
            ? "border-rose-500 focus:border-rose-700"
            : "border-stone-200 focus:border-stone-900"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-rose-700">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
});
