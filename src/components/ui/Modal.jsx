import { useEffect } from "react";
import { X } from "lucide-react";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Modal({ title, onClose, children, size = "md", footer = null }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${SIZES[size]} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
            <h3 id="modal-title" className="text-sm font-semibold text-stone-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
