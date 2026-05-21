import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId++;
      const full = { id, kind: "info", duration: 4000, ...toast };
      setToasts((current) => [...current, full]);
      if (full.duration > 0) {
        setTimeout(() => dismiss(id), full.duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = {
    push,
    dismiss,
    success: (message, opts = {}) => push({ kind: "success", message, ...opts }),
    error: (message, opts = {}) => push({ kind: "error", message, duration: 6000, ...opts }),
    info: (message, opts = {}) => push({ kind: "info", message, ...opts }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const STYLES = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  error: "bg-rose-50 border-rose-200 text-rose-900",
  info: "bg-stone-50 border-stone-200 text-stone-900",
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

function ToastItem({ toast, onClose }) {
  const Icon = ICONS[toast.kind];
  return (
    <div
      role="status"
      className={`flex items-start gap-2 px-3 py-2.5 rounded-md border shadow-sm text-sm ${STYLES[toast.kind]}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">{toast.message}</div>
      <button
        onClick={onClose}
        className="text-current opacity-60 hover:opacity-100"
        aria-label="Cerrar notificación"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
