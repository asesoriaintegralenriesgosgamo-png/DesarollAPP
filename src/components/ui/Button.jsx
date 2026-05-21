import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "border-stone-900 bg-stone-900 text-white hover:bg-stone-800 disabled:bg-stone-400 disabled:border-stone-400",
  ghost:
    "border-stone-300 text-stone-700 bg-white hover:bg-stone-50 disabled:text-stone-400 disabled:bg-stone-100",
  outline:
    "border-stone-300 text-stone-900 bg-white hover:bg-stone-50 disabled:text-stone-400",
  danger:
    "border-rose-700 bg-rose-700 text-white hover:bg-rose-800 disabled:bg-rose-300 disabled:border-rose-300",
  subtle:
    "border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:text-stone-400",
};

const SIZES = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-sm px-5 py-2.5 gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center border rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
