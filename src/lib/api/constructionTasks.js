import { supabase } from "../supabase";

const TASK_COLUMNS = `
  id, project_id, category_id, parent_id,
  name, description,
  planned_start, planned_end, actual_start, actual_end,
  progress, position,
  created_by, updated_by, created_at, updated_at
`;

export async function listTasks(projectId) {
  // Trae tareas + asignaciones + dependencias embebidas.
  const { data, error } = await supabase
    .from("construction_tasks")
    .select(`
      ${TASK_COLUMNS},
      assignees:construction_task_assignees(user_id),
      dependencies:construction_task_dependencies!construction_task_dependencies_task_id_fkey(depends_on_task_id)
    `)
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...t,
    assignee_ids: (t.assignees ?? []).map((a) => a.user_id),
    dependency_ids: (t.dependencies ?? []).map((d) => d.depends_on_task_id),
  }));
}

export async function getTask(id) {
  const { data, error } = await supabase
    .from("construction_tasks")
    .select(`
      ${TASK_COLUMNS},
      assignees:construction_task_assignees(user_id),
      dependencies:construction_task_dependencies!construction_task_dependencies_task_id_fkey(depends_on_task_id)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    ...data,
    assignee_ids: (data.assignees ?? []).map((a) => a.user_id),
    dependency_ids: (data.dependencies ?? []).map((d) => d.depends_on_task_id),
  };
}

export async function createTask({
  projectId,
  categoryId = null,
  parentId = null,
  name,
  description = null,
  plannedStart = null,
  plannedEnd = null,
  actualStart = null,
  actualEnd = null,
  progress = 0,
  position = 0,
  createdBy,
}) {
  const { data, error } = await supabase
    .from("construction_tasks")
    .insert({
      project_id: projectId,
      category_id: categoryId,
      parent_id: parentId,
      name,
      description,
      planned_start: plannedStart,
      planned_end: plannedEnd,
      actual_start: actualStart,
      actual_end: actualEnd,
      progress,
      position,
      created_by: createdBy,
      updated_by: createdBy,
    })
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return { ...data, assignee_ids: [], dependency_ids: [] };
}

export async function updateTask(id, patch, userId) {
  const allowed = {};
  const fields = [
    "name", "description",
    "category_id", "parent_id",
    "planned_start", "planned_end", "actual_start", "actual_end",
    "progress", "position",
  ];
  for (const f of fields) {
    if (patch[f] !== undefined) allowed[f] = patch[f];
  }
  if (userId) allowed.updated_by = userId;
  const { data, error } = await supabase
    .from("construction_tasks")
    .update(allowed)
    .eq("id", id)
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase
    .from("construction_tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Dependencias ----------

export async function addDependency({ taskId, dependsOnTaskId }) {
  const { error } = await supabase
    .from("construction_task_dependencies")
    .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId });
  if (error) throw error;
}

export async function removeDependency({ taskId, dependsOnTaskId }) {
  const { error } = await supabase
    .from("construction_task_dependencies")
    .delete()
    .eq("task_id", taskId)
    .eq("depends_on_task_id", dependsOnTaskId);
  if (error) throw error;
}

export async function setDependencies({ taskId, dependsOnTaskIds }) {
  // Reemplaza el conjunto completo de dependencias de una tarea.
  const { error: delError } = await supabase
    .from("construction_task_dependencies")
    .delete()
    .eq("task_id", taskId);
  if (delError) throw delError;
  if (dependsOnTaskIds.length === 0) return;
  const rows = dependsOnTaskIds.map((id) => ({
    task_id: taskId,
    depends_on_task_id: id,
  }));
  const { error: insError } = await supabase
    .from("construction_task_dependencies")
    .insert(rows);
  if (insError) throw insError;
}
