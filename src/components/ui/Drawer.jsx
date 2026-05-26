import { useEffect } from "react";
import { X } from "lucide-react";

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function Drawer({
  open,
  title,
  onClose,
  footer = null,
  children,
  width = "md",
  ariaLabel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || "Panel"}
        className={`absolute right-0 top-0 h-full w-full ${WIDTHS[width]} bg-white shadow-xl flex flex-col transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {title !== undefined && (
          <header className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
            <h3 className="text-sm font-semibold text-stone-900 truncate pr-3">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-stone-400 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
