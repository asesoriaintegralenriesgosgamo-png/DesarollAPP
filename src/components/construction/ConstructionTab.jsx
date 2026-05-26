import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/AuthContext";
import {
  listCategories,
  createCategory,
  reorderCategories,
} from "../../lib/api/constructionCategories";
import { listTasks, updateTask } from "../../lib/api/constructionTasks";
import { listMilestones } from "../../lib/api/constructionMilestones";
import { deriveStatus } from "../../lib/construction/status";
import { computeCalendarKPIs } from "../../lib/construction/kpis";
import { CONSTRUCCION_TEMPLATE } from "../../lib/construction/templates";
import { ConstructionKPIs } from "./ConstructionKPIs";
import { ConstructionToolbar } from "./ConstructionToolbar";
import { EmptyStateConstruction } from "./EmptyStateConstruction";
import { CategoryManager } from "./CategoryManager";
import { MilestoneManager } from "./MilestoneManager";
import { TaskDrawer } from "./TaskDrawer";
import { ListView } from "./views/ListView";
import { GanttView } from "./views/GanttView";
import { CalendarView } from "./views/CalendarView";

const DEFAULT_FILTERS = {
  q: "",
  categoryIds: [],
  assigneeIds: [],
  statuses: [],
  onlyMine: false,
};

export function ConstructionTab({ projectId, canEdit, members }) {
  const toast = useToast();
  const { user } = useAuth();

  const [view, setView] = useState("gantt");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showMilestoneManager, setShowMilestoneManager] = useState(false);

  // Drawer state: { mode: "new" | "edit", taskId?, parentTask? } | null
  const [drawerState, setDrawerState] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, ts, ms] = await Promise.all([
        listCategories(projectId),
        listTasks(projectId),
        listMilestones(projectId),
      ]);
      setCategories(cs);
      setTasks(ts);
      setMilestones(ms);
    } catch (err) {
      toast.error(err.message || "No se pudo cargar el calendario");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---------- KPIs y filtrado ----------

  const topLevelTasks = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks]);

  const filteredTopLevel = useMemo(() => {
    const q = (filters.q || "").trim().toLowerCase();
    return topLevelTasks.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(t.category_id)) return false;
      if (filters.assigneeIds.length > 0) {
        const hits = (t.assignee_ids || []).some((id) => filters.assigneeIds.includes(id));
        if (!hits) return false;
      }
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(deriveStatus(t))) return false;
      }
      if (filters.onlyMine && user?.id) {
        if (!(t.assignee_ids || []).includes(user.id)) return false;
      }
      return true;
    });
  }, [topLevelTasks, filters, user]);

  // Incluimos subtareas de los padres visibles para que se rendericen en vistas que las anidan.
  const filteredAll = useMemo(() => {
    const visibleIds = new Set(filteredTopLevel.map((t) => t.id));
    return tasks.filter((t) => !t.parent_id ? visibleIds.has(t.id) : visibleIds.has(t.parent_id));
  }, [tasks, filteredTopLevel]);

  const kpis = useMemo(() => computeCalendarKPIs(filteredTopLevel), [filteredTopLevel]);

  // ---------- Handlers ----------

  const handleOpenTask = (taskId) => setDrawerState({ mode: "edit", taskId });

  const handleNewTask = (categoryId = null) =>
    setDrawerState({
      mode: "new",
      taskId: null,
      defaults: { category_id: categoryId },
    });

  const handleProgressChange = async (taskId, value) => {
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: value } : t)));
    try {
      await updateTask(taskId, { progress: value }, user.id);
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? existing : t)));
      toast.error(err.message || "No se pudo guardar el avance");
    }
  };

  const handleReorderCategories = async (orderedIds) => {
    const prevCats = categories;
    const byId = new Map(categories.map((c) => [c.id, c]));
    const next = orderedIds
      .map((id, idx) => {
        const c = byId.get(id);
        return c ? { ...c, position: idx } : null;
      })
      .filter(Boolean);
    setCategories(next);
    try {
      await reorderCategories(orderedIds);
    } catch (err) {
      setCategories(prevCats);
      toast.error(err.message || "No se pudo reordenar categorías");
    }
  };

  const handleReorderTasksInCategory = async (categoryId, orderedTaskIds) => {
    const realCategoryId = categoryId === "__none__" ? null : categoryId;
    const prevTasks = tasks;
    const positionByTaskId = new Map(orderedTaskIds.map((id, idx) => [id, idx]));
    setTasks((prev) =>
      prev.map((t) =>
        positionByTaskId.has(t.id) ? { ...t, position: positionByTaskId.get(t.id) } : t
      )
    );
    try {
      await Promise.all(
        orderedTaskIds.map((id, idx) =>
          updateTask(id, { position: idx, category_id: realCategoryId }, user.id)
        )
      );
    } catch (err) {
      setTasks(prevTasks);
      toast.error(err.message || "No se pudo reordenar tareas");
    }
  };

  const handleMoveTaskToCategory = async (taskId, toCategoryId, insertIndex) => {
    const realTargetId = toCategoryId === "__none__" ? null : toCategoryId;
    const moving = tasks.find((t) => t.id === taskId);
    if (!moving) return;
    const targetList = tasks
      .filter((t) => !t.parent_id && (t.category_id || "__none__") === toCategoryId)
      .filter((t) => t.id !== taskId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const idx = Math.max(0, Math.min(insertIndex, targetList.length));
    targetList.splice(idx, 0, { ...moving, category_id: realTargetId });
    const orderedIds = targetList.map((t) => t.id);
    const prevTasks = tasks;
    const positionByTaskId = new Map(orderedIds.map((id, i) => [id, i]));
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            category_id: realTargetId,
            position: positionByTaskId.get(t.id) ?? t.position,
          };
        }
        if (positionByTaskId.has(t.id)) {
          return { ...t, position: positionByTaskId.get(t.id) };
        }
        return t;
      })
    );
    try {
      await Promise.all(
        orderedIds.map((id, i) =>
          updateTask(
            id,
            id === taskId
              ? { position: i, category_id: realTargetId }
              : { position: i },
            user.id
          )
        )
      );
    } catch (err) {
      setTasks(prevTasks);
      toast.error(err.message || "No se pudo mover la tarea");
    }
  };

  const handleSeedTemplate = async () => {
    setSeeding(true);
    try {
      const created = [];
      for (let i = 0; i < CONSTRUCCION_TEMPLATE.length; i++) {
        const t = CONSTRUCCION_TEMPLATE[i];
        const row = await createCategory({
          projectId,
          name: t.name,
          color: t.color,
          position: i,
        });
        created.push(row);
      }
      setCategories((prev) => [...prev, ...created]);
      toast.success("Plantilla creada");
    } catch (err) {
      toast.error(err.message || "No se pudo crear la plantilla");
    } finally {
      setSeeding(false);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  const drawerOpen = !!drawerState;
  const drawerTask = drawerState?.mode === "edit"
    ? tasks.find((t) => t.id === drawerState.taskId)
    : null;
  const drawerParent = drawerState?.mode === "new" && drawerState.parentTask
    ? drawerState.parentTask
    : null;
  // Si está creando en una categoría dada, prellenamos category_id usando un "parentTask falso"
  // — pero por simplicidad pasamos defaults via parentTask = { category_id }
  const drawerVirtualParent = drawerState?.mode === "new" && drawerState.defaults?.category_id
    ? { id: null, category_id: drawerState.defaults.category_id }
    : null;

  const isEmpty = categories.length === 0 && tasks.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {isEmpty ? (
        <EmptyStateConstruction
          canEdit={canEdit}
          onSeed={handleSeedTemplate}
          onCreateEmpty={() => setShowCategoryManager(true)}
        />
      ) : (
        <>
          <ConstructionKPIs {...kpis} />

          <ConstructionToolbar
            view={view}
            onViewChange={setView}
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
            members={members}
            canEdit={canEdit}
            onNewTask={() => handleNewTask(null)}
            onManageCategories={() => setShowCategoryManager(true)}
            onManageMilestones={() => setShowMilestoneManager(true)}
            currentUserId={user?.id}
          />

          {seeding && (
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Creando plantilla…
            </div>
          )}

          {view === "gantt" && (
            <GanttView
              tasks={filteredAll}
              categories={categories}
              milestones={milestones}
              members={members}
              onOpenTask={handleOpenTask}
              onReorderCategories={handleReorderCategories}
              onReorderTasksInCategory={handleReorderTasksInCategory}
              onMoveTaskToCategory={handleMoveTaskToCategory}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              tasks={filteredAll}
              categories={categories}
              milestones={milestones}
              onOpenTask={handleOpenTask}
            />
          )}
          {view === "list" && (
            <ListView
              tasks={filteredAll}
              categories={categories}
              members={members}
              canEdit={canEdit}
              onOpenTask={handleOpenTask}
              onCreateInCategory={(catId) => handleNewTask(catId)}
              onProgressChange={handleProgressChange}
              onReorderCategories={handleReorderCategories}
              onReorderTasksInCategory={handleReorderTasksInCategory}
              onMoveTaskToCategory={handleMoveTaskToCategory}
            />
          )}
        </>
      )}

      {showCategoryManager && (
        <CategoryManager
          projectId={projectId}
          categories={categories}
          onChange={setCategories}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {showMilestoneManager && (
        <MilestoneManager
          projectId={projectId}
          milestones={milestones}
          onChange={setMilestones}
          onClose={() => setShowMilestoneManager(false)}
        />
      )}

      <TaskDrawer
        open={drawerOpen}
        task={drawerTask}
        parentTask={drawerParent || drawerVirtualParent}
        allTasks={tasks}
        projectId={projectId}
        categories={categories}
        members={members}
        currentUserId={user?.id}
        canEdit={canEdit}
        onClose={() => setDrawerState(null)}
        onSaved={() => refresh()}
        onDeleted={() => refresh()}
        onOpenTask={(id) => setDrawerState({ mode: "edit", taskId: id })}
      />
    </div>
  );
}
