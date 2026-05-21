import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Trash2, Share2, AlertTriangle } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { RoleBadge } from "../components/ui/RoleBadge";
import { Select } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/AuthContext";
import { getProject, deleteProject } from "../lib/api/projects";
import {
  listMembers,
  updateMemberRole,
  removeMember,
  getCurrentUserRole,
} from "../lib/api/members";
import { InviteModal } from "../components/InviteModal";

export default function ProjectSettings() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const refresh = async () => {
    try {
      const [p, m, r] = await Promise.all([
        getProject(projectId),
        listMembers(projectId),
        getCurrentUserRole(projectId, user.id),
      ]);
      setProject(p);
      setMembers(m);
      setRole(r);
    } catch (err) {
      toast.error(err.message || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      </AppShell>
    );
  }

  if (!project || role !== "owner") {
    return (
      <AppShell>
        <div className="bg-white border border-stone-200 rounded-lg p-6 text-center">
          <p className="text-sm text-stone-700">Solo el owner del proyecto puede acceder.</p>
          <Button
            variant="ghost"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="mt-3"
          >
            ← Volver al proyecto
          </Button>
        </div>
      </AppShell>
    );
  }

  const breadcrumbs = [
    { label: "Proyectos", to: "/dashboard" },
    { label: project.name, to: `/projects/${projectId}` },
    { label: "Settings" },
  ];

  const handleChangeRole = async (memberId, newRole) => {
    if (memberId === project.owner_id) {
      toast.error("No puedes cambiar el rol del creador del proyecto");
      return;
    }
    try {
      await updateMemberRole({ projectId, userId: memberId, role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.user_id === memberId ? { ...m, role: newRole } : m))
      );
      toast.success("Rol actualizado");
    } catch (err) {
      toast.error(err.message || "No se pudo actualizar");
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    try {
      await removeMember({ projectId, userId: memberToRemove.user_id });
      setMembers((prev) => prev.filter((m) => m.user_id !== memberToRemove.user_id));
      toast.success("Miembro expulsado");
    } catch (err) {
      toast.error(err.message || "No se pudo expulsar");
    } finally {
      setMemberToRemove(null);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmText !== "ELIMINAR") return;
    try {
      await deleteProject(projectId);
      toast.success("Proyecto eliminado");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    }
  };

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight mb-6">
        Settings · {project.name}
      </h1>

      <section className="bg-white border border-stone-200 rounded-lg overflow-hidden mb-6">
        <header className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-900">Miembros</h2>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <Share2 className="w-3.5 h-3.5" />
            Invitar
          </Button>
        </header>
        <ul className="divide-y divide-stone-100">
          {members.map((m) => {
            const isOwner = m.user_id === project.owner_id;
            return (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={m.display_name} url={m.avatar_url} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">
                      {m.display_name || m.user_id}
                      {isOwner && (
                        <span className="text-[10px] text-stone-400 ml-2">(creador)</span>
                      )}
                    </div>
                    <div className="text-[10px] text-stone-500">
                      desde {new Date(m.created_at).toLocaleDateString("es-MX")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <RoleBadge role={m.role} />
                  ) : (
                    <Select
                      value={m.role}
                      onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                      className="w-28"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  )}
                  {!isOwner && (
                    <button
                      onClick={() => setMemberToRemove(m)}
                      className="text-stone-400 hover:text-rose-700 p-1.5"
                      title="Expulsar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-white border border-rose-200 rounded-lg overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-rose-100 bg-rose-50">
          <AlertTriangle className="w-4 h-4 text-rose-700" />
          <h2 className="text-sm font-semibold text-rose-900">Zona peligrosa</h2>
        </header>
        <div className="p-4">
          <p className="text-sm text-stone-700 mb-3">
            Eliminar el proyecto borrará todos sus escenarios e invitaciones de forma permanente.
          </p>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar proyecto
          </Button>
        </div>
      </section>

      {showInvite && (
        <InviteModal
          projectId={projectId}
          userId={user.id}
          onClose={() => setShowInvite(false)}
        />
      )}

      {memberToRemove && (
        <Modal
          title="Expulsar miembro"
          onClose={() => setMemberToRemove(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setMemberToRemove(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleRemove}>
                Expulsar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a expulsar a <strong>{memberToRemove.display_name || memberToRemove.user_id}</strong>
            . Perderá acceso al proyecto.
          </p>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Eliminar proyecto"
          onClose={() => {
            setConfirmDelete(false);
            setDeleteConfirmText("");
          }}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteConfirmText("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={deleteConfirmText !== "ELIMINAR"}
                onClick={handleDeleteProject}
              >
                Eliminar definitivamente
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700 mb-3">
            Esta acción es irreversible. Escribe <strong>ELIMINAR</strong> para confirmar.
          </p>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="ELIMINAR"
          />
        </Modal>
      )}
    </AppShell>
  );
}
