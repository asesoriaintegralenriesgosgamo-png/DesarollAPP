import { useEffect, useState } from "react";
import { Loader2, Mail, Link2, Copy, X, RefreshCw } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input, Select } from "./ui/Input";
import { RoleBadge } from "./ui/RoleBadge";
import { useToast } from "./ui/Toast";
import {
  listInvitations,
  createEmailInvitation,
  createLinkInvitation,
  revokeInvitation,
} from "../lib/api/invitations";

const TABS = [
  { id: "email", label: "Por correo", icon: Mail },
  { id: "link", label: "Link compartible", icon: Link2 },
];

function inviteUrl(token) {
  return `${window.location.origin}/invite/${token}`;
}

export function InviteModal({ projectId, userId, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState("email");
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listInvitations(projectId);
      setInvitations(rows);
    } catch (err) {
      toast.error(err.message || "No se pudieron cargar las invitaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const emailInvites = invitations.filter((i) => i.email);
  const linkInvites = invitations.filter((i) => !i.email);

  return (
    <Modal title="Invitar colaboradores" onClose={onClose} size="lg">
      <div className="flex gap-1 border-b border-stone-200 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === t.id
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "email" && (
        <EmailTab
          projectId={projectId}
          userId={userId}
          invitations={emailInvites}
          loading={loading}
          onRefresh={refresh}
        />
      )}
      {tab === "link" && (
        <LinkTab
          projectId={projectId}
          userId={userId}
          invitations={linkInvites}
          loading={loading}
          onRefresh={refresh}
        />
      )}
    </Modal>
  );
}

function EmailTab({ projectId, userId, invitations, loading, onRefresh }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setCreating(true);
    try {
      const inv = await createEmailInvitation({
        projectId,
        email: email.trim().toLowerCase(),
        role,
        invitedBy: userId,
      });
      toast.success("Invitación creada");
      setEmail("");
      onRefresh();
      // Copia el link al portapapeles para que el owner pueda compartirlo manualmente
      // hasta que activemos el envío server-side por correo.
      navigator.clipboard?.writeText(inviteUrl(inv.token)).catch(() => {});
      toast.info("Copiamos el link al portapapeles", { duration: 6000 });
    } catch (err) {
      toast.error(err.message || "No se pudo crear la invitación");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeInvitation(id);
      toast.success("Invitación revocada");
      onRefresh();
    } catch (err) {
      toast.error(err.message || "No se pudo revocar");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex-1 w-full">
          <Input
            type="email"
            label="Correo del invitado"
            placeholder="persona@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="w-32">
          <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </Select>
        </div>
        <Button type="submit" loading={creating} disabled={!email.trim()}>
          <Mail className="w-3.5 h-3.5" />
          Enviar
        </Button>
      </form>

      <div>
        <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
          Invitaciones pendientes
        </h4>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-xs text-stone-500 py-2">No hay invitaciones pendientes.</p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-md">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-stone-900 truncate">{inv.email}</div>
                  <div className="text-[10px] text-stone-500">
                    Caduca {new Date(inv.expires_at).toLocaleDateString("es-MX")}
                  </div>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  onClick={() =>
                    navigator.clipboard?.writeText(inviteUrl(inv.token)).then(() =>
                      toast.info("Link copiado")
                    )
                  }
                  className="text-stone-400 hover:text-stone-900 p-1"
                  title="Copiar link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRevoke(inv.id)}
                  className="text-stone-400 hover:text-rose-700 p-1"
                  title="Revocar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-stone-500 mt-2">
          Por ahora copiamos el link al portapapeles para que lo compartas tú. El envío automático
          por correo se habilitará al configurar SMTP en Supabase.
        </p>
      </div>
    </div>
  );
}

function LinkTab({ projectId, userId, invitations, loading, onRefresh }) {
  const toast = useToast();
  const [role, setRole] = useState("viewer");
  const [creating, setCreating] = useState(false);

  const handleGenerate = async () => {
    setCreating(true);
    try {
      // Revoca los links activos del mismo rol antes de crear uno nuevo
      const existing = invitations.find((i) => i.role === role);
      if (existing) {
        await revokeInvitation(existing.id);
      }
      const inv = await createLinkInvitation({ projectId, role, invitedBy: userId });
      navigator.clipboard?.writeText(inviteUrl(inv.token)).catch(() => {});
      toast.success("Link generado y copiado");
      onRefresh();
    } catch (err) {
      toast.error(err.message || "No se pudo generar");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeInvitation(id);
      toast.success("Link revocado");
      onRefresh();
    } catch (err) {
      toast.error(err.message || "No se pudo revocar");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="w-full sm:w-40">
          <Select label="Rol del invitado" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </Select>
        </div>
        <Button onClick={handleGenerate} loading={creating}>
          <RefreshCw className="w-3.5 h-3.5" />
          {invitations.some((i) => i.role === role) ? "Regenerar" : "Generar link"}
        </Button>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
          Links activos
        </h4>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-xs text-stone-500 py-2">No hay links activos.</p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-md">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-stone-900 font-mono truncate">
                    {inviteUrl(inv.token)}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    Caduca {new Date(inv.expires_at).toLocaleDateString("es-MX")}
                  </div>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  onClick={() =>
                    navigator.clipboard?.writeText(inviteUrl(inv.token)).then(() =>
                      toast.info("Link copiado")
                    )
                  }
                  className="text-stone-400 hover:text-stone-900 p-1"
                  title="Copiar"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRevoke(inv.id)}
                  className="text-stone-400 hover:text-rose-700 p-1"
                  title="Revocar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
