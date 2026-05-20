import { useEffect, useState } from "react";
import { LogIn, LogOut, Save, FolderOpen, Trash2, X, Loader2, Mail, RotateCcw } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import {
  listScenarios,
  getScenario,
  createScenario,
  deleteScenario,
} from "../lib/scenarios";

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function LoginModal({ onClose, signInWithEmail }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      await signInWithEmail(email);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Error desconocido");
    }
  };

  if (status === "sent") {
    return (
      <Modal title="Revisa tu correo" onClose={onClose}>
        <div className="flex flex-col items-center text-center py-4 gap-3">
          <Mail className="w-10 h-10 text-stone-700" strokeWidth={1.5} />
          <p className="text-sm text-stone-700">
            Te enviamos un link de acceso a <strong>{email}</strong>.
          </p>
          <p className="text-xs text-stone-500">
            Abre el correo y haz click en el enlace para iniciar sesión. Puedes cerrar esta ventana.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Iniciar sesión" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-stone-600">
          Escribe tu correo y te enviaremos un link mágico para entrar (sin contraseñas).
        </p>
        <input
          type="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="w-full bg-stone-50 border border-stone-200 rounded-md py-2 px-3 text-sm text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
        />
        {status === "error" && (
          <p className="text-xs text-rose-700">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={status === "sending"}
          className="bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-sm font-medium rounded-md py-2 px-4 flex items-center justify-center gap-2 transition-colors"
        >
          {status === "sending" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Enviar link mágico
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}

function SaveModal({ onClose, onSave, defaultName = "" }) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await onSave(name.trim());
      onClose();
    } catch (err) {
      setSaving(false);
      setErrorMsg(err?.message ?? "Error al guardar");
    }
  };

  return (
    <Modal title="Guardar escenario" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs font-medium text-stone-600">Nombre del escenario</label>
        <input
          type="text"
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Casa Roma, Polanco depto chico…"
          className="w-full bg-stone-50 border border-stone-200 rounded-md py-2 px-3 text-sm text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
        />
        {errorMsg && <p className="text-xs text-rose-700">{errorMsg}</p>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-sm font-medium rounded-md py-2 px-4 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </form>
    </Modal>
  );
}

function ScenariosModal({ onClose, onLoad }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [busyId, setBusyId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const rows = await listScenarios();
      setList(rows);
    } catch (err) {
      setErrorMsg(err?.message ?? "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleLoad = async (id) => {
    setBusyId(id);
    try {
      const row = await getScenario(id);
      onLoad(row.data, row.name);
      onClose();
    } catch (err) {
      setErrorMsg(err?.message ?? "Error al cargar");
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Borrar este escenario? Esta acción no se puede deshacer.")) return;
    setBusyId(id);
    try {
      await deleteScenario(id);
      setList((rows) => rows.filter((r) => r.id !== id));
    } catch (err) {
      setErrorMsg(err?.message ?? "Error al borrar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title="Mis escenarios" onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-stone-500 text-center py-6">
          Aún no has guardado escenarios.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100 max-h-80 overflow-y-auto">
          {list.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2 gap-2">
              <button
                onClick={() => handleLoad(row.id)}
                disabled={busyId === row.id}
                className="flex-1 text-left text-sm text-stone-900 hover:text-stone-600 truncate"
              >
                <div className="font-medium truncate">{row.name}</div>
                <div className="text-[10px] text-stone-400">
                  {new Date(row.updated_at).toLocaleString("es-MX")}
                </div>
              </button>
              <button
                onClick={() => handleDelete(row.id)}
                disabled={busyId === row.id}
                className="text-stone-400 hover:text-rose-700 p-1"
                title="Borrar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {errorMsg && <p className="text-xs text-rose-700 mt-3">{errorMsg}</p>}
    </Modal>
  );
}

export function AccountBar({ currentData, onLoad, onReset }) {
  const { user, loading, signInWithEmail, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showList, setShowList] = useState(false);
  const [lastSavedName, setLastSavedName] = useState("");

  const handleSave = async (name) => {
    await createScenario({ name, data: currentData, userId: user.id });
    setLastSavedName(name);
  };

  const handleLoad = (data, name) => {
    onLoad(data);
    setLastSavedName(name);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cargando…
      </div>
    );
  }

  const btnBase =
    "text-xs px-3 py-1.5 border rounded-md transition-colors flex items-center gap-1.5";
  const btnGhost = `${btnBase} border-stone-300 text-stone-700 hover:bg-white`;
  const btnPrimary = `${btnBase} border-stone-900 bg-stone-900 text-white hover:bg-stone-800`;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onReset} className={btnGhost} title="Volver a los valores por defecto">
          <RotateCcw className="w-3.5 h-3.5" />
          Restablecer
        </button>

        {user ? (
          <>
            <button
              onClick={() => setShowList(true)}
              className={btnGhost}
              title="Ver mis escenarios guardados"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Mis escenarios
            </button>
            <button
              onClick={() => setShowSave(true)}
              className={btnPrimary}
              title="Guardar el escenario actual"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-stone-300">
              <span className="text-xs text-stone-500 max-w-[140px] truncate" title={user.email}>
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="text-stone-400 hover:text-stone-900 p-1"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => setShowLogin(true)} className={btnPrimary}>
            <LogIn className="w-3.5 h-3.5" />
            Iniciar sesión
          </button>
        )}
      </div>

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} signInWithEmail={signInWithEmail} />
      )}
      {showSave && user && (
        <SaveModal
          onClose={() => setShowSave(false)}
          onSave={handleSave}
          defaultName={lastSavedName}
        />
      )}
      {showList && user && (
        <ScenariosModal onClose={() => setShowList(false)} onLoad={handleLoad} />
      )}
    </>
  );
}
