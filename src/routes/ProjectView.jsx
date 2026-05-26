import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Settings,
  Share2,
  Loader2,
  FileText,
  Trash2,
  Copy as CopyIcon,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { RoleBadge } from "../components/ui/RoleBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/AuthContext";
import { getProject } from "../lib/api/projects";
import {
  listScenarios,
  createScenario,
  deleteScenario,
  duplicateScenario,
} from "../lib/api/scenarios";
import { listMembers, getCurrentUserRole } from "../lib/api/members";
import { computeKPIs, DEFAULTS } from "../lib/calc";
import { fmtMXN, fmtPct } from "../lib/format";
import { InviteModal } from "../components/InviteModal";
import { ConstructionTab } from "../components/construction/ConstructionTab";
import { PropertyTab } from "../components/property/PropertyTab";
import { getPropertyByProject } from "../lib/api/properties";

const TABS = [
  { id: "scenarios", label: "Escenarios" },
  { id: "property", label: "Predio" },
  { id: "comparison", label: "Comparación" },
  { id: "construction", label: "Calendario de Obra" },
  { id: "members", label: "Miembros" },
];

export default function ProjectView() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("scenarios");
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState(null);
  const tabsRef = useRef(null);
  const [showTabsFade, setShowTabsFade] = useState(false);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => {
      setShowTabsFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [loading]);

  useEffect(() => {
    const active = tabsRef.current?.querySelector('[aria-selected="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeTab]);

  const refresh = async () => {
    try {
      const [p, s, m, r] = await Promise.all([
        getProject(projectId),
        listScenarios(projectId),
        listMembers(projectId),
        getCurrentUserRole(projectId, user.id),
      ]);
      setProject(p);
      setScenarios(s);
      setMembers(m);
      setRole(r);
    } catch (err) {
      toast.error(err.message || "No se pudo cargar el proyecto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const canEdit = role === "owner" || role === "editor";

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <EmptyState
          icon={FileText}
          title="Proyecto no encontrado"
          description="No tienes acceso a este proyecto o fue eliminado."
        />
      </AppShell>
    );
  }

  const breadcrumbs = [
    { label: "Proyectos", to: "/dashboard" },
    { label: project.name },
  ];

  const handleScenarioCreated = (scenario) => {
    setShowCreate(false);
    navigate(`/projects/${projectId}/scenarios/${scenario.id}`);
  };

  const handleDeleteScenario = async () => {
    if (!scenarioToDelete) return;
    try {
      await deleteScenario(scenarioToDelete.id);
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioToDelete.id));
      toast.success("Escenario eliminado");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setScenarioToDelete(null);
    }
  };

  const handleDuplicate = async (scenario) => {
    try {
      const copy = await duplicateScenario(scenario.id);
      setScenarios((prev) => [{ ...copy, data: scenario.data }, ...prev]);
      toast.success("Escenario duplicado");
    } catch (err) {
      toast.error(err.message || "No se pudo duplicar");
    }
  };

  return (
    <AppShell
      breadcrumbs={breadcrumbs}
      actions={
        <>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setShowInvite(true)}>
              <Share2 className="w-3.5 h-3.5" />
              Compartir
            </Button>
          )}
          {role === "owner" && (
            <Link to={`/projects/${projectId}/settings`}>
              <Button variant="ghost" size="sm">
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Button>
            </Link>
          )}
        </>
      }
    >
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight">
            {project.name}
          </h1>
          <RoleBadge role={role} />
        </div>
        {project.description && (
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">{project.description}</p>
        )}
      </div>

      <div className="border-b border-stone-200 mb-6 relative">
        <nav
          ref={tabsRef}
          className="flex gap-1 overflow-x-auto no-scrollbar"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
                activeTab === t.id
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              }`}
            >
              {t.label}
              {t.id === "scenarios" && (
                <span className="ml-1.5 text-[10px] text-stone-400">({scenarios.length})</span>
              )}
              {t.id === "members" && (
                <span className="ml-1.5 text-[10px] text-stone-400">({members.length})</span>
              )}
            </button>
          ))}
        </nav>
        {showTabsFade && (
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-stone-100 to-transparent"
          />
        )}
      </div>

      {activeTab === "scenarios" && (
        <ScenariosTab
          scenarios={scenarios}
          projectId={projectId}
          canEdit={canEdit}
          onCreate={() => setShowCreate(true)}
          onDuplicate={handleDuplicate}
          onDelete={(s) => setScenarioToDelete(s)}
        />
      )}
      {activeTab === "property" && (
        <PropertyTab projectId={projectId} canEdit={canEdit} />
      )}
      {activeTab === "comparison" && (
        <ComparisonTab scenarios={scenarios} />
      )}
      {activeTab === "construction" && (
        <ConstructionTab
          projectId={projectId}
          canEdit={canEdit}
          members={members}
        />
      )}
      {activeTab === "members" && (
        <MembersTab
          members={members}
          ownerId={project.owner_id}
          canInvite={canEdit}
          onInvite={() => setShowInvite(true)}
        />
      )}

      {showCreate && (
        <CreateScenarioModal
          projectId={projectId}
          userId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={handleScenarioCreated}
        />
      )}
      {showInvite && (
        <InviteModal
          projectId={projectId}
          userId={user.id}
          onClose={() => setShowInvite(false)}
        />
      )}
      {scenarioToDelete && (
        <Modal
          title="Eliminar escenario"
          onClose={() => setScenarioToDelete(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setScenarioToDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDeleteScenario}>
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-stone-700">
            Vas a eliminar <strong>{scenarioToDelete.name}</strong>. Esta acción no se puede
            deshacer.
          </p>
        </Modal>
      )}
    </AppShell>
  );
}

function ScenariosTab({ scenarios, projectId, canEdit, onCreate, onDuplicate, onDelete }) {
  if (scenarios.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin escenarios"
        description="Crea escenarios optimista, base y pesimista para comparar el rendimiento del proyecto."
        action={
          canEdit && (
            <Button onClick={onCreate}>
              <Plus className="w-4 h-4" />
              Nuevo escenario
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={onCreate} size="sm">
            <Plus className="w-3.5 h-3.5" />
            Nuevo escenario
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((s) => {
          const kpis = computeKPIs(s.data || {});
          const positive = kpis.utilidad_neta >= 0;
          return (
            <div
              key={s.id}
              className="bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-400 hover:shadow-sm transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/projects/${projectId}/scenarios/${s.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="text-sm font-semibold text-stone-900 truncate">{s.name}</h3>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {new Date(s.updated_at).toLocaleString("es-MX")}
                  </p>
                </Link>
                {canEdit && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onDuplicate(s)}
                      className="text-stone-400 hover:text-stone-700 p-1"
                      title="Duplicar"
                    >
                      <CopyIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(s)}
                      className="text-stone-400 hover:text-rose-700 p-1"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <Link
                to={`/projects/${projectId}/scenarios/${s.id}`}
                className="grid grid-cols-2 gap-2"
              >
                <Mini label="Utilidad neta" value={fmtMXN(kpis.utilidad_neta)} positive={positive} />
                <Mini
                  label="ROI"
                  value={fmtPct(kpis.roi_pct)}
                  positive={kpis.roi_pct >= 15}
                  neutral={kpis.roi_pct >= 0 && kpis.roi_pct < 15}
                />
              </Link>
              <Link
                to={`/projects/${projectId}/scenarios/${s.id}`}
                className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1"
              >
                Abrir editor
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, positive, neutral }) {
  const color = positive
    ? "text-emerald-700"
    : neutral
    ? "text-amber-700"
    : "text-rose-700";
  return (
    <div className="bg-stone-50 border border-stone-100 rounded p-2">
      <div className="text-[9px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function ComparisonTab({ scenarios }) {
  const rows = useMemo(
    () =>
      scenarios.map((s) => {
        const k = computeKPIs(s.data || {});
        return {
          id: s.id,
          name: s.name,
          precio_venta: s.data?.precio_venta ?? DEFAULTS.precio_venta,
          inversion_total: k.inversion_total,
          utilidad_neta: k.utilidad_neta,
          roi_pct: k.roi_pct,
          roi_anualizado_pct: k.roi_anualizado_pct,
          meses_total: k.meses_total,
        };
      }),
    [scenarios]
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nada que comparar todavía"
        description="Crea al menos dos escenarios y verás aquí la comparación lado a lado."
      />
    );
  }

  const chartData = rows.map((r) => ({
    name: r.name.length > 12 ? `${r.name.slice(0, 11)}…` : r.name,
    "Utilidad neta": Math.round(r.utilidad_neta),
    "Inversión": Math.round(r.inversion_total),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Escenario</th>
              <th className="text-right px-3 py-2 font-medium">Precio venta</th>
              <th className="text-right px-3 py-2 font-medium">Inversión</th>
              <th className="text-right px-3 py-2 font-medium">Utilidad neta</th>
              <th className="text-right px-3 py-2 font-medium">ROI</th>
              <th className="text-right px-3 py-2 font-medium">ROI anualizado</th>
              <th className="text-right px-3 py-2 font-medium">Meses</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-medium text-stone-900">{r.name}</td>
                <td className="px-3 py-2 text-right text-stone-700">{fmtMXN(r.precio_venta)}</td>
                <td className="px-3 py-2 text-right text-stone-700">{fmtMXN(r.inversion_total)}</td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    r.utilidad_neta >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {fmtMXN(r.utilidad_neta)}
                </td>
                <td className="px-3 py-2 text-right">{fmtPct(r.roi_pct)}</td>
                <td className="px-3 py-2 text-right">{fmtPct(r.roi_anualizado_pct)}</td>
                <td className="px-3 py-2 text-right text-stone-500">{r.meses_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-stone-900 mb-3">
          Inversión vs. utilidad neta
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="name" stroke="#78716c" fontSize={11} />
            <YAxis stroke="#78716c" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
            <ReTooltip formatter={(v) => fmtMXN(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Inversión" fill="#a8a29e" />
            <Bar dataKey="Utilidad neta" fill="#059669" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MembersTab({ members, ownerId, canInvite, onInvite }) {
  return (
    <div className="flex flex-col gap-3">
      {canInvite && (
        <div className="flex justify-end">
          <Button onClick={onInvite} size="sm">
            <Share2 className="w-3.5 h-3.5" />
            Invitar
          </Button>
        </div>
      )}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <ul className="divide-y divide-stone-100">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  name={m.display_name}
                  email={m.email}
                  url={m.avatar_url}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">
                    {m.display_name || m.email || "Usuario"}
                    {m.user_id === ownerId && (
                      <span className="text-[10px] text-stone-400 ml-2">(creador)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    desde {new Date(m.created_at).toLocaleDateString("es-MX")}
                  </div>
                </div>
              </div>
              <RoleBadge role={m.role} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CreateScenarioModal({ projectId, userId, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefill, setPrefill] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getPropertyByProject(projectId)
      .then((prop) => {
        if (cancelled || !prop) return;
        const next = {};
        if (prop.superficie_terreno_m2 != null) {
          next.terreno_m2 = Number(prop.superficie_terreno_m2);
        }
        if (prop.precio_adquisicion != null) {
          next.terreno_costo = Number(prop.precio_adquisicion);
        }
        if (Object.keys(next).length > 0) setPrefill(next);
      })
      .catch(() => {
        // Sin ficha del predio: usar DEFAULTS, no es un error que el usuario deba ver.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const row = await createScenario({
        projectId,
        name: name.trim(),
        data: { ...DEFAULTS, ...(prefill ?? {}) },
        createdBy: userId,
      });
      onCreated(row);
      toast.success("Escenario creado");
    } catch (err) {
      toast.error(err.message || "No se pudo crear");
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo escenario" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre"
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Optimista, Base, Pesimista…"
        />
        {prefill && (
          <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5">
            Se prellenarán desde la ficha del predio:
            {prefill.terreno_m2 != null && (
              <> {fmtNumber(prefill.terreno_m2)} m²</>
            )}
            {prefill.terreno_m2 != null && prefill.terreno_costo != null && " · "}
            {prefill.terreno_costo != null && <>{fmtMXN(prefill.terreno_costo)} de costo</>}
            .
          </p>
        )}
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Crear
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function fmtNumber(n) {
  return new Intl.NumberFormat("es-MX").format(n);
}
