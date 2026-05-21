import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FolderOpen, MoreHorizontal, Loader2, FileText } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Textarea } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { RoleBadge } from "../components/ui/RoleBadge";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/AuthContext";
import { listProjects, createProject, updateProject, deleteProject } from "../lib/api/projects";

function formatRelative(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} días`;
  return new Date(date).toLocaleDateString("es-MX");
}

function roleFor(project, userId) {
  return project.raw_members.find((m) => m.user_id === userId)?.role ?? null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null); // project being renamed
  const [deleting, setDeleting] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listProjects();
      setProjects(rows);
    } catch (err) {
      toast.error(err.message || "No se pudieron cargar los proyectos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreated = (project) => {
    setShowCreate(false);
    setProjects((prev) => [project, ...prev]);
    navigate(`/projects/${project.id}`);
  };

  const handleRenamed = (project) => {
    setEditing(null);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? { ...p, name: project.name, description: project.description, updated_at: project.updated_at } : p
      )
    );
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteProject(deleting.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleting.id));
      toast.success("Proyecto eliminado");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight">
            Mis proyectos
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Agrupa varios escenarios bajo un proyecto y colabora con tu equipo.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="md">
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aún no tienes proyectos"
          description="Crea tu primer proyecto para empezar a analizar inmuebles. Cada proyecto agrupa los escenarios (optimista, base, pesimista...) de un inmueble."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Crear proyecto
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => {
            const role = roleFor(p, user?.id);
            return (
              <div
                key={p.id}
                className="bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-400 hover:shadow-sm transition-all flex flex-col gap-3 group relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/projects/${p.id}`} className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-stone-900 truncate">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </Link>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === p.id ? null : p.id);
                      }}
                      className="text-stone-400 hover:text-stone-700 p-1 rounded"
                      aria-label="Acciones"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuOpenId === p.id && (
                      <div
                        className="absolute right-0 mt-1 w-40 bg-white border border-stone-200 rounded-md shadow-lg py-1 z-10"
                        onMouseLeave={() => setMenuOpenId(null)}
                      >
                        <button
                          onClick={() => {
                            setEditing(p);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50"
                        >
                          Renombrar
                        </button>
                        {role === "owner" && (
                          <button
                            onClick={() => {
                              setDeleting(p);
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Link to={`/projects/${p.id}`} className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-xs text-stone-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {p.scenarios_count} escenario{p.scenarios_count === 1 ? "" : "s"}
                    </span>
                    <span>·</span>
                    <span>{formatRelative(p.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-stone-500">
                      {p.members_count} miembro{p.members_count === 1 ? "" : "s"}
                    </span>
                    <RoleBadge role={role} />
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          ownerId={user.id}
        />
      )}
      {editing && (
        <RenameProjectModal
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={handleRenamed}
        />
      )}
      {deleting && (
        <Modal
          title="Eliminar proyecto"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar <strong>{deleting.name}</strong> y todos sus escenarios. Esta acción no
            se puede deshacer.
          </p>
        </Modal>
      )}
    </AppShell>
  );
}

function CreateProjectModal({ onClose, onCreated, ownerId }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const row = await createProject({ name: name.trim(), description: description.trim() || null, ownerId });
      onCreated(row);
      toast.success("Proyecto creado");
    } catch (err) {
      toast.error(err.message || "No se pudo crear");
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo proyecto" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre del proyecto"
          autoFocus
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Casa Roma, Polanco depto chico…"
        />
        <Textarea
          label="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Notas, ubicación, contexto del proyecto"
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Crear proyecto
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RenameProjectModal({ project, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const row = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      onSaved(row);
      toast.success("Proyecto actualizado");
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <Modal title="Renombrar proyecto" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre"
          autoFocus
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
